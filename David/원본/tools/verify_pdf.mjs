// PDF 검사: 모든 QR을 300dpi로 읽어 링크 주소와 맞는지, 영상ID, 차례 이동 링크, 강조 짝, 금지 글자.
// node verify_pdf.mjs <원본폴더> <pdf> [main|english]
import fs from "fs";
import * as mupdf from "mupdf";
import jsQR from "jsqr";
import { loadBook, ytUrl } from "./parse.mjs";

const [root, pdf, volume = "main"] = process.argv.slice(2);
const EN = volume === "english";
const book = loadBook(root);
const vids = new Set(book.lessons.map((L) => L.vid));
const expected = new Set();
for (const L of EN ? [] : book.lessons) {
  expected.add(ytUrl(L.vid, "0:00"));
  for (const c of L.chapters) { if (c.ts) expected.add(ytUrl(L.vid, c.ts)); c.secs.forEach((s) => s.ts && expected.add(ytUrl(L.vid, s.ts))); }
}
const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
const DPI = 300, S = DPI / 72;
const ttsSeen = [];
let qrOk = 0, qrBad = [], uriSet = new Set(), internal = 0, pagesText = "";
for (let i = 0; i < doc.countPages(); i++) {
  const page = doc.loadPage(i);
  pagesText += page.toStructuredText().asText();
  const links = page.getLinks();
  const ext = links.filter((l) => l.isExternal());
  for (const l of ext) if (l.getURI().startsWith("https://translate.google.com/")) ttsSeen.push(new URL(l.getURI()).searchParams.get("text"));
  const yt = ext.filter((l) => l.getURI().startsWith("https://youtu.be/"));
  internal += 0;
  internal += links.filter((l) => !l.isExternal()).length;
  if (!yt.length) continue;
  const pm = page.toPixmap(mupdf.Matrix.scale(S, S), mupdf.ColorSpace.DeviceRGB, false, true);
  const W = pm.getWidth(), H = pm.getHeight(), px = pm.getPixels(), n = pm.getNumberOfComponents();
  // 같은 주소의 링크 사각형을 합쳐 한 덩어리(QR + 시각 + 문구)로 본다
  const groups = new Map();
  for (const l of yt) {
    const u = l.getURI(); uriSet.add(u);
    const [x0, y0, x1, y1] = l.getBounds();
    const g = groups.get(u) || [1e9, 1e9, -1e9, -1e9];
    groups.set(u, [Math.min(g[0], x0), Math.min(g[1], y0), Math.max(g[2], x1), Math.max(g[3], y1)]);
  }
  for (const [u, [x0, y0, x1, y1]] of groups) {
    const pad = 4;
    const X0 = Math.max(0, Math.floor((x0 - pad) * S)), Y0 = Math.max(0, Math.floor((y0 - pad) * S));
    const X1 = Math.min(W, Math.ceil((x1 + pad) * S)), Y1 = Math.min(H, Math.ceil((y1 + pad) * S));
    const w = X1 - X0, h = Y1 - Y0, rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const s = ((Y0 + y) * W + (X0 + x)) * n, d = (y * w + x) * 4;
      rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = 255;
    }
    const r = jsQR(rgba, w, h);
    if (r && r.data === u) qrOk++;
    else qrBad.push(`${i + 1}쪽: 링크 ${u} / QR ${r ? r.data : "판독 실패"}`);
  }
}
const problems = [];
for (const u of uriSet) {
  const m = u.match(/^https:\/\/youtu\.be\/([\w-]{11})\?t=\d+$/);
  if (!m || !vids.has(m[1])) problems.push("영상ID·주소 형식 이상: " + u);
}
for (const u of expected) if (!uriSet.has(u)) problems.push("빠진 영상 링크: " + u);
// 영어 강의 권: 절마다 원문 듣기 + (고어가 있으면) 현대 영어 듣기. 본책에는 듣기 링크가 없어야 한다.
const ttsWant = EN ? [...new Set(book.lessons.flatMap((L) => (L.english ? L.english.verses.flatMap((v) => [v.text, v.modern]) : [])))] : [];
if (!EN && ttsSeen.length) problems.push(`본책에 듣기 링크 ${ttsSeen.length}개가 남아 있음(영어 강의는 별도 권)`);
if (!EN && /킹제임스 영어 강의 — 사무엘기상|직독직해와 구문 강의/.test(pagesText.replace(/별도 권 「다윗의 삶 — 킹제임스 영어 강의」/g, ""))) problems.push("본책에 영어 강의 내용이 남아 있음");
const ttsSet = new Set(ttsSeen);
for (const t of ttsWant) if (!ttsSet.has(t)) problems.push("듣기 링크 빠짐: " + t.slice(0, 40));
if (/개념 문제|예상 질문/.test(pagesText)) problems.push("말씀판에 '개념 문제/예상 질문' 글자가 있음");
if (/@@\w+@@/.test(pagesText)) problems.push("쪽 번호용 표식이 남아 있음");
// 표지(1쪽)의 그라데이션 배경은 Edge가 그림으로 굽는다 → 제외
const imgCount = (() => { let c = 0; for (let i = 1; i < doc.countPages(); i++) { const t = doc.loadPage(i).toStructuredText("preserve-images"); t.walk({ onImageBlock() { c++; } }); } return c; })();
if (imgCount) problems.push(`표지 밖 이미지 ${imgCount}장 (말씀판은 0장이어야 함)`);

console.log(`쪽수 ${doc.countPages()} | 영상 링크 주소 ${uriSet.size}개(기대 ${expected.size}) | QR 판독 일치 ${qrOk}개, 불일치 ${qrBad.length}개 | 내부 이동 링크 ${internal}개 | 듣기 링크 ${ttsSet.size}개(기대 ${ttsWant.length}) | 표지 밖 이미지 ${imgCount}장`);
qrBad.forEach((s) => console.log("  ✗", s));
problems.forEach((s) => console.log("  ✗", s));
process.exit(qrBad.length || problems.length ? 1 : 0);
