// PDF 검사: node verify_pdf.mjs <원본폴더> <pdf>
// ① 모든 QR을 300dpi로 읽어 링크 주소와 일치 ② 영상ID·빠진 영상 링크 ③ 차례 링크·쪽 번호
// ④ 「목차로 이동」이 차례의 그 이야기 항목을 화면 맨 위로 가져오는지 ⑤ 슬라이드 그림 수 ⑥ 쪽 번호 표식 잔류
import fs from "fs";
import * as mupdf from "mupdf";
import jsQR from "jsqr";
import { loadBook, ytUrl, ordinal, tocId } from "./parse.mjs";
import { tocItems } from "./html.mjs";

const [root, pdf] = process.argv.slice(2);
const book = loadBook(root);
const vids = new Set(book.stories.map((S) => S.vid).filter(Boolean));
const expected = new Set();
for (const S of book.stories) {
  if (!S.vid) continue; // 링크를 받지 않은 강의: 영상 링크가 없어야 정상(아래에서 영상ID 집합으로 검사)
  expected.add(ytUrl(S.vid, "0:00"));
  for (const c of S.chapters) { if (c.ts) expected.add(ytUrl(S.vid, c.ts)); c.secs.forEach((s) => s.ts && expected.add(ytUrl(S.vid, s.ts))); }
  [...S.quiz, ...S.faq].forEach((q) => expected.add(ytUrl(S.vid, q.ts)));
}
const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
const N = doc.countPages(), S300 = 300 / 72;
const problems = [];
let qrOk = 0, qrGroups = 0, uriSet = new Set(), internal = [], text = [];
for (let i = 0; i < N; i++) {
  const page = doc.loadPage(i);
  { const st = page.toStructuredText(); text.push(st.asText()); st.destroy(); } // 놓아 주지 않으면 1600쪽에서 WASM 메모리가 바닥남
  const links = page.getLinks();
  internal.push(...links.filter((l) => !l.isExternal()).map((l) => ({ page: i + 1, uri: l.getURI(), b: l.getBounds() })));
  const yt = links.filter((l) => l.isExternal() && l.getURI().startsWith("https://youtu.be/"));
  if (!yt.length) { page.destroy(); continue; }
  const pm = page.toPixmap(mupdf.Matrix.scale(S300, S300), mupdf.ColorSpace.DeviceRGB, false, true);
  const W = pm.getWidth(), H = pm.getHeight(), px = pm.getPixels(), n = pm.getNumberOfComponents();
  // 같은 주소의 링크 사각형을 합쳐 한 덩어리(QR + 시각 + 문구)로 본다. 같은 쪽에 같은 주소가 둘이면 세로로 떨어진 것끼리 나눈다
  const groups = [];
  for (const l of yt) {
    const u = l.getURI(); uriSet.add(u);
    const [x0, y0, x1, y1] = l.getBounds();
    const g = groups.find((g) => g.u === u && y0 < g.b[3] + 6 && y1 > g.b[1] - 6);
    if (g) g.b = [Math.min(g.b[0], x0), Math.min(g.b[1], y0), Math.max(g.b[2], x1), Math.max(g.b[3], y1)];
    else groups.push({ u, b: [x0, y0, x1, y1] });
  }
  for (const { u, b: [x0, y0, x1, y1] } of groups) {
    qrGroups++;
    const pad = 4;
    const X0 = Math.max(0, Math.floor((x0 - pad) * S300)), Y0 = Math.max(0, Math.floor((y0 - pad) * S300));
    const X1 = Math.min(W, Math.ceil((x1 + pad) * S300)), Y1 = Math.min(H, Math.ceil((y1 + pad) * S300));
    const w = X1 - X0, h = Y1 - Y0, rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((Y0 + y) * W + (X0 + x)) * n, d = (y * w + x) * 4;
      rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = 255;
    }
    const r = jsQR(rgba, w, h);
    if (r && r.data === u) qrOk++;
    else problems.push(`${i + 1}쪽 QR: 링크 ${u} / 판독 ${r ? r.data : "실패"}`);
  }
  pm.destroy(); page.destroy();
}
for (const u of uriSet) {
  const m = u.match(/^https:\/\/youtu\.be\/([\w-]{11})\?t=\d+$/);
  if (!m || !vids.has(m[1])) problems.push("영상ID·주소 형식 이상: " + u);
}
for (const u of expected) if (!uriSet.has(u)) problems.push("빠진 영상 링크: " + u);

// 차례: 모든 항목이 이동하고, 적힌 쪽 번호 = 실제 쪽
const dest = (uri) => doc.resolveLinkDestination(uri);
// 앞부분(표지·읽는 법·차례) = 첫 이야기 표제 쪽 앞까지. 이야기가 늘면 차례도 수십 쪽이 된다
const frontEnd = dest("#nameddest=" + "S" + book.stories[0].n).page + 1; // 1부터 센 첫 이야기 쪽
const tocTxt = text.slice(0, frontEnd - 1).join("\n");
let tocOk = 0;
const tocLineCache = {};
const tocLines = (i) => {
  if (!tocLineCache[i]) { const pg = doc.loadPage(i), st = pg.toStructuredText(); tocLineCache[i] = JSON.parse(st.asJSON(1)).blocks.flatMap((b) => b.lines || []); st.destroy(); pg.destroy(); }
  return tocLineCache[i];
};
for (const S of book.stories) for (const [t, id] of tocItems(S)) {
  const l = internal.find((x) => x.uri === "#nameddest=" + id && x.page < frontEnd);
  if (!l) { problems.push("차례 링크 없음: " + t); continue; }
  const d = dest(l.uri);
  // 링크 사각형과 같은 높이에 있는 글줄들(제목 + 오른쪽 쪽 번호)을 왼쪽부터 이어 읽는다.
  // 같은 낱말이 다른 항목에도 있을 수 있어(「몸」「돈」) 글자로 찾지 않고 자리로 찾는다
  const [, ly0, , ly1] = l.b, mid = (ly0 + ly1) / 2;
  const row = tocLines(l.page - 1).filter((ln) => ln.bbox.y <= mid && ln.bbox.y + ln.bbox.h >= mid).sort((a, b) => a.bbox.x - b.bbox.x).map((ln) => ln.text).join(" ");
  // 제목이 숫자로 끝날 수 있다(「1억 분의 1」) → 제목 뒤의 숫자만 쪽 번호로 본다
  const after = row.includes(t) ? row.slice(row.indexOf(t) + t.length) : row;
  const num = (after.match(/(\d+)\s*$/) || [])[1];
  if (num && +num !== d.page + 1) problems.push(`차례 쪽 번호 불일치: ${t} 적힌 ${num} / 실제 ${d.page + 1}`);
  else tocOk++;
}

// 「목차로 이동」: 이야기 표제 쪽 왼쪽 아래 → 차례에서 그 이야기 항목 막대의 바로 위(0~6pt)
let backOk = 0;
for (const S of book.stories) {
  const id = tocId(S);
  const l = internal.find((x) => x.uri === "#nameddest=" + id);
  if (!l) { problems.push(`${S.n}번째 이야기: 「목차로 이동」 링크 없음`); continue; }
  const d = dest(l.uri);
  // 차례 쪽에서 그 이야기 막대(남색)의 맨 윗줄 찾기: 막대 글자 줄 위쪽
  const pg = doc.loadPage(d.page);
  const pm = pg.toPixmap(mupdf.Matrix.identity, mupdf.ColorSpace.DeviceRGB, false, true);
  const W = pm.getWidth(), px = pm.getPixels(), n = pm.getNumberOfComponents();
  const st0 = pg.toStructuredText(), j = JSON.parse(st0.asJSON(1));
  st0.destroy();
  const line = j.blocks.flatMap((b) => b.lines || []).find((ln) => ln.text.startsWith(`${ordinal(S.n)} 이야기`));
  if (!line) { problems.push(`${S.n}번째 이야기: 이동한 쪽(${d.page + 1})에 차례 항목이 없음`); continue; }
  let top = Math.floor(line.bbox.y);
  while (top > 0) { const s = ((top - 1) * W + Math.floor(line.bbox.x) - 4) * n; if (px[s] < 60 && px[s + 2] < 100) top--; else break; }
  const gap = top - d.y;
  const [bx0, by0] = l.b;
  const titlePage = l.page;
  if (gap < 0 || gap > 6) problems.push(`${S.n}번째 이야기: 「목차로 이동」 도착 높이 ${d.y.toFixed(1)}pt, 항목 막대 ${top}pt (차이 ${gap.toFixed(1)}pt)`);
  else if (!(by0 > 450 && bx0 < 80)) problems.push(`${S.n}번째 이야기: 「목차로 이동」 단추가 왼쪽 아래가 아님 (${bx0.toFixed(0)}, ${by0.toFixed(0)})`);
  else { backOk++; console.log(`  「목차로 이동」 ${titlePage}쪽 → ${d.page + 1}쪽, 도착 높이 ${d.y.toFixed(1)}pt / 항목 막대 위 ${top}pt`); }
}

// 각 장·뒷부분 제목 아래 「목차로 이동」: 그 제목이 있는 쪽에 있고, 누르면 차례의 그 장 항목 줄 바로 위(0~8pt)에 도착
let chBackOk = 0, chBackWant = 0;
for (const S of book.stories) for (const [t, id, d] of tocItems(S)) {
  if (d !== 1) continue;
  chBackWant++;
  const headPage = dest("#nameddest=" + id).page + 1;
  const l = internal.find((x) => x.uri === "#nameddest=toc-" + id && x.page === headPage);
  if (!l) { problems.push(`「${t}」: 제목 쪽(${headPage})에 「목차로 이동」 없음`); continue; }
  const dd = dest(l.uri);
  const pg1 = doc.loadPage(dd.page), st1 = pg1.toStructuredText(), j = JSON.parse(st1.asJSON(1));
  st1.destroy(); pg1.destroy();
  const line = j.blocks.flatMap((b) => b.lines || []).find((ln) => ln.text.startsWith(t.slice(0, 10)));
  if (!line) { problems.push(`「${t}」: 이동한 쪽(${dd.page + 1})에 차례 항목이 없음`); continue; }
  const gap = line.bbox.y - dd.y;
  if (gap < 0 || gap > 8) problems.push(`「${t}」: 도착 높이 ${dd.y.toFixed(1)}pt, 항목 줄 ${line.bbox.y}pt (차이 ${gap.toFixed(1)}pt)`);
  else chBackOk++;
}
// 「들어가며」 쪽(앞부분)이 없어야 한다. 본문 문장 속 '들어가며'(동사)는 해당 없음
if (/들어가며/.test(tocTxt)) problems.push("「들어가며」가 남아 있음(사용자 지시 2026-10-03: 뺀다)");

// 슬라이드 그림 수(표지 배경 그림은 제외)
let imgCount = 0;
for (let i = 1; i < N; i++) { const pg = doc.loadPage(i), st = pg.toStructuredText("preserve-images"); st.walk({ onImageBlock(bb) { if (bb[2] - bb[0] > 1 && bb[3] - bb[1] > 1) imgCount++; } }); /* 넓이 없는 조각(2026-10-09 27권 읽는 법 쪽에서 높이 0·음수 5개)은 그림이 아니다 */ st.destroy(); pg.destroy(); }
const slides = book.stories.reduce((a, S) => a + S.images.length, 0);
if (imgCount !== slides) problems.push(`본문 그림 ${imgCount}장 ≠ 슬라이드 ${slides}장`);
if (/@@[\w-]+@@/.test(text.join(""))) problems.push("쪽 번호용 표식이 남아 있음");

console.log(`쪽수 ${N} | 영상 링크 주소 ${uriSet.size}개(기대 ${expected.size}) | QR ${qrGroups}개 중 판독 일치 ${qrOk}개 | 차례 항목 ${tocOk}개 정상 | 목차로 이동: 이야기 ${backOk}/${book.stories.length}, 장·뒷부분 ${chBackOk}/${chBackWant} | 본문 그림 ${imgCount}장(슬라이드 ${slides}장)`);
problems.forEach((s) => console.log("  ✗", s));
process.exit(problems.length ? 1 : 0);
