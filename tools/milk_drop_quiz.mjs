// 밀크 완성 PDF에서 「개념 문제」「답안」 단원을 뺀다(사용자 지시 2026-11-14 「개념 문제 답안 전체 밀크 삭제해라」).
// 밀크는 원고(빌드 원본)가 저장소에 없으므로 완성 PDF를 직접 고친다:
//   1) 「개념 문제」 첫 쪽 ~ 「예상 질문과 답변」 바로 앞 쪽을 지운다.
//   2) 그 뒤 쪽들의 쪽 번호(아래 가운데)를 지운 쪽 수만큼 당긴다.
//   3) 차례에서 두 줄(과 링크)을 지우고, 아래 줄(예상 질문과 답변·용어·인물 풀이)을 올리며 쪽 번호를 고친다.
//   4) 「이 책을 읽는 법」에서 「개념 문제, 」「답안, 」「개념 문제(답안은 다음 쪽부터) → 」를 지운다.
// 글자는 다시 조판하지 않고, 원래 글리프의 위치만 옮기거나 지운다(글꼴·색이 그대로 남는다).
// node milk_drop_quiz.mjs <입력.pdf> <출력.pdf>
import fs from "fs";
import path from "path";
import * as mupdf from "mupdf";

const [inPdf, outPdf] = process.argv.slice(2);
if (!inPdf || !outPdf) { console.error("사용법: node milk_drop_quiz.mjs <입력.pdf> <출력.pdf>"); process.exit(1); }
const name = path.basename(inPdf);
const fail = (m) => { console.error(`✗ ${name}: ${m}`); process.exit(1); };

const doc = mupdf.Document.openDocument(fs.readFileSync(inPdf), "application/pdf").asPDF();
const N = doc.countPages();

// ---------- 글자 줄 읽기 ----------
function stextLines(i) {
  const p = doc.loadPage(i), st = p.toStructuredText("preserve-whitespace");
  const lines = [];
  let cur = null;
  st.walk({
    beginLine(bbox) { cur = { bbox, chars: [] }; },
    onChar(c, origin, font, size, quad) { cur.chars.push({ c, x: origin[0], y: origin[1], size }); },
    endLine() { cur.text = cur.chars.map((ch) => ch.c).join(""); lines.push(cur); cur = null; },
  });
  st.destroy(); p.destroy();
  return lines;
}
const firstText = (i) => stextLines(i).slice(0, 1).map((l) => l.text.trim()).join("");
// 단원 첫 쪽: 큰 머리글(가장 큰 글자) 줄이 그 단원 이름인 쪽 (QR 글자가 먼저 읽히는 쪽이 있다)
const headText = (i) => {
  const ls = stextLines(i).filter((l) => l.chars.length);
  if (!ls.length) return "";
  const big = Math.max(...ls.map((l) => l.chars[0].size));
  return ls.find((l) => l.chars[0].size === big).text.trim();
};

// ---------- 내용 스트림: BT…ET 블록을 글리프 단위로 ----------
function getContent(po) {
  const c = po.get("Contents");
  const parts = c.isArray() ? Array.from({ length: c.length }, (_, k) => c.get(k)) : [c];
  return Buffer.concat(parts.map((x) => Buffer.from(x.readStream().asUint8Array()))).toString("latin1");
}
function setContent(po, s) {
  po.put("Contents", doc.addStream(Buffer.from(s, "latin1"), doc.newDictionary()));
}
// 블록 하나 = [{font,size,code(hex),x,y}] (Tf/Tm/Td/Tj만 있는 블록만 다룬다)
function parseBlock(body) {
  const toks = body.match(/\/[^\s/<>\[\]()]+|<[0-9A-Fa-f]*>|[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?|[A-Za-z*']+/g) || [];
  const glyphs = []; let font = null, size = 0, x = 0, y = 0; const st = [];
  for (const t of toks) {
    if (t === "BT" || t === "ET") continue;
    if (t === "Tf") { size = +st.pop(); font = st.pop(); }
    else if (t === "Tm") { const v = st.splice(-6).map(Number); x = v[4]; y = v[5]; if (v[0] !== 1 || v[1] !== 0 || v[2] !== 0 || v[3] !== -1) return null; }
    else if (t === "Td") { const v = st.splice(-2).map(Number); x += v[0]; y -= v[1]; }
    else if (t === "Tj") { glyphs.push({ font, size, code: st.pop(), x, y }); }
    else if (/^[A-Za-z*']+$/.test(t)) return null; // 다른 연산자가 있으면 손대지 않는다
    else st.push(t);
  }
  return glyphs;
}
function emitBlock(glyphs) {
  let s = "BT\n", f = null, sz = null;
  for (const g of glyphs) {
    if (g.font !== f || g.size !== sz) { s += `${g.font} ${g.size} Tf\n`; f = g.font; sz = g.size; }
    s += `1 0 0 -1 ${+g.x.toFixed(5)} ${+g.y.toFixed(5)} Tm\n${g.code} Tj\n`;
  }
  return s + "ET";
}
function blocksOf(s) {
  const out = []; const re = /BT\b[\s\S]*?\bET/g; let m;
  while ((m = re.exec(s))) out.push({ start: m.index, end: m.index + m[0].length, glyphs: parseBlock(m[0]) });
  return out;
}
function rewrite(s, blocks, changed) {
  let out = "", pos = 0;
  for (const b of blocks) {
    if (!changed.has(b)) continue;
    out += s.slice(pos, b.start) + (b.glyphs.length ? emitBlock(b.glyphs) : ""); pos = b.end;
  }
  return out + s.slice(pos);
}

// 글자 줄 → 그 줄의 글리프들(내용 좌표 y가 같은 블록들, x 순). 글자 수와 글리프 수가 같아야 한다.
function lineGlyphs(blocks, y) {
  const gs = [];
  for (const b of blocks) if (b.glyphs) for (const g of b.glyphs) if (Math.abs(g.y - y) < 0.01) gs.push({ g, b });
  return gs.sort((a, b) => a.g.x - b.g.x);
}
// 글자 줄의 내용 좌표 y 찾기: 줄의 글자 수와 글리프 수가 맞는 y 중 x 순서가 줄 글자와 같은 것
function contentYs(blocks) { const ys = new Set(); for (const b of blocks) if (b.glyphs) for (const g of b.glyphs) ys.add(g.y); return [...ys]; }
// 내용 좌표 ↔ 쪽 좌표: 블록 글리프 x와 글자 origin x는 한 척도(scale, offset)로 이어진다.
function calib(lines, blocks) {
  // 가장 긴 줄로 y 대응을 찾는다
  const ys = contentYs(blocks);
  const pairs = [];
  for (const l of lines) {
    const n = l.chars.length;
    for (const y of ys) {
      const gs = lineGlyphs(blocks, y);
      if (gs.length === n && n >= 3) pairs.push({ l, y, gs });
    }
  }
  return pairs;
}
// 쪽 좌표 y(글자 기준선) → 내용 좌표 y 1차식. 글자 6개 이상인 줄로 맞춘다(짧은 줄은 어느 y에나 맞아 버리므로).
function calibrate(lines, blocks) {
  const pts = [];
  for (const l of lines) if (l.chars.length >= 6) { const m = matchLine([l], blocks, l.text, null); if (m && m.err < 0.5) pts.push([l.chars[0].y, m.y]); }
  const fit = (P) => {
    const n = P.length, sx = P.reduce((s, p) => s + p[0], 0), sy = P.reduce((s, p) => s + p[1], 0);
    const sxx = P.reduce((s, p) => s + p[0] * p[0], 0), sxy = P.reduce((s, p) => s + p[0] * p[1], 0);
    const a = (n * sxy - sx * sy) / (n * sxx - sx * sx); return [a, (sy - a * sx) / n];
  };
  // 잘못 맞은 줄(같은 글자 수·간격의 다른 줄)을 빼며 다시 맞춘다: 기울기 중앙값으로 시작
  let P = pts;
  for (let it = 0; it < 5 && P.length >= 2; it++) {
    const slopes = [];
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) if (Math.abs(P[j][0] - P[i][0]) > 5) slopes.push((P[j][1] - P[i][1]) / (P[j][0] - P[i][0]));
    slopes.sort((x, y) => x - y);
    const a = slopes[slopes.length >> 1]; const bs = P.map((p) => p[1] - a * p[0]).sort((x, y) => x - y); const b = bs[bs.length >> 1];
    const keep = P.filter((p) => Math.abs(a * p[0] + b - p[1]) < 3);
    if (keep.length === P.length) break; P = keep;
  }
  if (P.length < 2) return null;
  const [a, b] = fit(P);
  return (ypt) => a * ypt + b;
}
function matchLine(lines, blocks, text, cal) {
  const l = lines.find((ln) => ln.text.includes(text));
  if (!l) return null;
  let ys = contentYs(blocks);
  if (cal) { const want = cal(l.chars[0].y); ys = ys.filter((y) => Math.abs(y - want) < 4); }
  // 쪽 좌표 x 간격과 내용 좌표 x 간격의 비가 일정한 y를 고른다
  let best = null;
  const n = l.chars.length;
  for (const y of ys) {
    const all = lineGlyphs(blocks, y);
    // 같은 y에 다른 줄 조각(차례 쪽 번호 등)이 있을 수 있어 연속 n개 창을 모두 본다
    for (let s0 = 0; s0 + n <= all.length; s0++) {
      const gs = all.slice(s0, s0 + n);
      const span = l.chars.at(-1).x - l.chars[0].x;
      const k = span ? (gs.at(-1).g.x - gs[0].g.x) / span : 1;
      if (!(k > 0)) continue;
      let err = 0;
      for (let i = 0; i < n; i++) err = Math.max(err, Math.abs((gs[i].g.x - gs[0].g.x) - k * (l.chars[i].x - l.chars[0].x)));
      // 글자 2개짜리 줄은 어느 창이든 오차 0이므로, 같으면 왼쪽(먼저 나오는) 창을 쓴다
      if (!best || err < best.err - 1e-6 || (Math.abs(err - best.err) <= 1e-6 && s0 === 0 && best.s0 !== 0)) best = { y, gs, err, k, l, s0 };
    }
  }
  return best && best.err < 2 ? best : null;
}

const changedBlocks = new Map(); // pageIndex -> Set(blocks)
const pageState = new Map(); // pageIndex -> {s, blocks}
function state(i) {
  if (!pageState.has(i)) { const s = getContent(doc.findPage(i)); pageState.set(i, { s, blocks: blocksOf(s), changed: new Set() }); }
  return pageState.get(i);
}
function flush(i) {
  const st = pageState.get(i); if (!st || !st.changed.size) return;
  setContent(doc.findPage(i), rewrite(st.s, st.blocks, st.changed));
}

// 줄 안의 글자 범위 [a,b)를 지우고 뒤 글자를 당긴다
function cutRange(st, m, a, b) {
  const dx = (b < m.gs.length ? m.gs[b].g.x : null) - m.gs[a].g.x;
  const kill = new Set(m.gs.slice(a, b).map((e) => e.g));
  for (const e of m.gs) st.changed.add(e.b);
  for (const blk of new Set(m.gs.map((e) => e.b))) blk.glyphs = blk.glyphs.filter((g) => !kill.has(g));
  if (b < m.gs.length) for (const e of m.gs.slice(b)) e.g.x -= dx;
}

// ---------- 1) 지울 쪽 범위 ----------
let qStart = -1, faqStart = -1;
for (let i = 0; i < N; i++) {
  const t = headText(i);
  if (qStart < 0 && t === "개념 문제") qStart = i;
  if (qStart >= 0 && t === "예상 질문과 답변") { faqStart = i; break; }
}
if (qStart < 0 || faqStart < 0) fail(`개념 문제(${qStart + 1})·예상 질문과 답변(${faqStart + 1}) 쪽을 찾지 못함`);
const K = faqStart - qStart;
const hasAns = Array.from({ length: K }, (_, k) => headText(qStart + k)).includes("답안");
if (!hasAns) fail("지울 범위 안에 「답안」 쪽이 없음");

// ---------- 2) 뒤쪽 쪽 번호(DejaVuSans, Identity-H) ----------
const DJ0 = 0x13; // DejaVuSans의 '0' 글리프 번호
let renum = 0;
for (let i = faqStart; i < N; i++) {
  const po = doc.findPage(i);
  let s = getContent(po);
  const re = /BT\s*\n(\/F\d+) ([\d.]+) Tf\s*\n1 0 0 -1 ([\d.]+) ([\d.]+) Tm\s*\n<([0-9A-F]{4})> Tj((?:\s*\n[\d.]+ 0 Td <[0-9A-F]{4}> Tj)*)\s*\nET/g;
  const hits = [...s.matchAll(re)].filter((m) => {
    const codes = [m[5], ...[...m[6].matchAll(/<([0-9A-F]{4})>/g)].map((x) => x[1])].map((h) => parseInt(h, 16) - DJ0);
    return codes.every((d) => d >= 0 && d <= 9) && +codes.join("") === i + 1;
  });
  if (hits.length !== 1) fail(`${i + 1}쪽 쪽 번호를 찾지 못함(${hits.length})`);
  const m = hits[0];
  const adv = m[6] ? +m[6].match(/([\d.]+) 0 Td/)[1] : 5.934845;
  const oldN = String(i + 1), newN = String(i + 1 - K);
  const cx = +m[3] + (oldN.length * adv) / 2;
  const x0 = cx - (newN.length * adv) / 2;
  const glyphs = [...newN].map((d) => (DJ0 + +d).toString(16).toUpperCase().padStart(4, "0"));
  let blk = `BT\n${m[1]} ${m[2]} Tf\n1 0 0 -1 ${+x0.toFixed(5)} ${m[4]} Tm\n<${glyphs[0]}> Tj`;
  for (const g of glyphs.slice(1)) blk += `\n${adv} 0 Td <${g}> Tj`;
  s = s.slice(0, m.index) + blk + "\nET" + s.slice(m.index + m[0].length);
  setContent(po, s); renum++;
}

// ---------- 3) 차례 ----------
let tocPage = -1;
for (let i = 0; i < qStart; i++) {
  const ls = stextLines(i).map((l) => l.text.trim());
  if (ls.includes("개념 문제") && ls.includes("답안") && ls.includes("예상 질문과 답변")) { tocPage = i; break; }
}
if (tocPage < 0) fail("차례 쪽을 찾지 못함");
{
  const st = state(tocPage), lines = stextLines(tocPage);
  const cal = calibrate(lines, st.blocks); if (!cal) fail("차례 쪽 좌표 맞춤 실패");
  const rowOf = (t) => matchLine(lines.filter((l) => l.text.trim() === t), st.blocks, t, cal);
  const labels = ["개념 문제", "답안", "예상 질문과 답변", "용어·인물 풀이"].map((t) => {
    const r = rowOf(t); if (!r) fail(`차례 줄 「${t}」 글리프를 찾지 못함`); return r;
  });
  // 쪽 번호 글리프: 같은 y에서 라벨보다 오른쪽 블록
  const numOf = (r) => {
    const gs = lineGlyphs(st.blocks, r.y).filter((e) => e.g.x > r.gs.at(-1).g.x + 50);
    if (!gs.length || new Set(gs.map((e) => e.b)).size !== 1) fail("차례 쪽 번호 블록을 찾지 못함");
    return gs;
  };
  const nums = labels.map(numOf);
  // 쪽 번호 글꼴의 숫자 코드: Differences에서 g11(0)…g1A(9)
  const fontRes = doc.findPage(tocPage).get("Resources").get("Font");
  const digitCode = (fontName) => {
    const f = fontRes.get(fontName.slice(1)).resolve(), dif = f.get("Encoding").resolve().get("Differences");
    const map = {}; let code = 0;
    for (let k = 0; k < dif.length; k++) { const v = dif.get(k); if (v.isNumber()) code = v.asNumber(); else { const nm = v.asName(); const g = parseInt(nm.slice(1), 16); if (g >= 0x11 && g <= 0x1a && !(g - 0x11 in map)) map[g - 0x11] = code; code++; } }
    return map;
  };
  const decode = (gs) => { const mp = digitCode(gs[0].g.font); const inv = Object.fromEntries(Object.entries(mp).map(([d, c]) => [c, d])); return gs.map((e) => inv[parseInt(e.g.code.slice(1, -1), 16)]).join(""); };
  const expect = [qStart + 1, null, faqStart + 1, null];
  if (+decode(nums[0]) !== qStart + 1 || +decode(nums[2]) !== faqStart + 1) fail(`차례 쪽 번호가 실제와 다름(${decode(nums[0])}/${qStart + 1}, ${decode(nums[2])}/${faqStart + 1})`);
  // 지울 두 줄
  for (const k of [0, 1]) {
    const kill = new Set([...labels[k].gs, ...nums[k]].map((e) => e.g));
    for (const e of [...labels[k].gs, ...nums[k]]) { st.changed.add(e.b); e.b.glyphs = e.b.glyphs.filter((g) => !kill.has(g)); }
  }
  // 올릴 두 줄 + 쪽 번호 바꾸기
  for (const [from, to] of [[2, 0], [3, 1]]) {
    const dy = labels[to].y - labels[from].y;
    for (const e of labels[from].gs) { e.g.y += dy; st.changed.add(e.b); }
    const gs = nums[from], mp = digitCode(gs[0].g.font);
    const adv = gs.length > 1 ? gs[1].g.x - gs[0].g.x : 6.2872467;
    const oldS = decode(gs), newS = String(+oldS - K);
    for (const d of newS) if (!(d in mp)) fail(`차례 쪽 번호 글꼴에 숫자 ${d}가 없음`);
    const end = gs.at(-1).g.x + adv, blk = gs[0].b, tmpl = gs[0].g;
    const fresh = [...newS].map((d, k) => ({ font: tmpl.font, size: tmpl.size, code: "<" + mp[d].toString(16).toUpperCase().padStart(2, "0") + ">", x: end - (newS.length - k) * adv, y: tmpl.y + dy }));
    const kill = new Set(gs.map((e) => e.g));
    const at = blk.glyphs.findIndex((g) => kill.has(g));
    blk.glyphs = [...blk.glyphs.slice(0, at), ...fresh, ...blk.glyphs.filter((g, k) => k >= at && !kill.has(g))];
    st.changed.add(blk);
  }
  // 차례 링크: 지운 줄의 링크는 지우고, 올린 줄의 링크는 같이 올린다
  const pg = doc.loadPage(tocPage);
  const rowPt = labels.map((r) => r.l.bbox);
  const inRow = (rect, bb) => { const cy = (rect[1] + rect[3]) / 2; return cy >= bb[1] - 4 && cy <= bb[3] + 4; }; // bb = [x0,y0,x1,y1]
  let movedLinks = 0, killedLinks = 0;
  for (const ln of pg.getLinks()) {
    const r = ln.getBounds();
    if (inRow(r, rowPt[0]) || inRow(r, rowPt[1])) { pg.deleteLink(ln); killedLinks++; continue; }
    for (const [from, to] of [[2, 0], [3, 1]]) if (inRow(r, rowPt[from])) {
      const dyPt = rowPt[to][1] - rowPt[from][1];
      ln.setBounds([r[0], r[1] + dyPt, r[2], r[3] + dyPt]); movedLinks++;
    }
  }
  pg.destroy();
  if (killedLinks !== 2 || movedLinks !== 2) fail(`차례 링크 지움 ${killedLinks}·옮김 ${movedLinks}(각 2여야 함)`);
  // 지운 단원의 이름 붙은 목적지(quiz·answers)도 뺀다
  const root = doc.getTrailer().get("Root");
  const oldDests = root.get("Dests"); // PDF 1.1 방식: 이름 → 목적지 사전
  if (oldDests.isDictionary()) for (const nm of ["quiz", "answers"]) if (!oldDests.get(nm).isNull()) oldDests.delete(nm);
  const namesD = root.get("Names");
  const dests = namesD.isDictionary() ? namesD.get("Dests") : null;
  const dropNames = (node) => {
    if (!node || !node.isDictionary()) return;
    const arr = node.get("Names");
    if (arr.isArray()) for (let k = arr.length - 2; k >= 0; k -= 2) { const nm = arr.get(k).asString(); if (nm === "quiz" || nm === "answers") { arr.delete(k + 1); arr.delete(k); } }
    const kids = node.get("Kids"); if (kids.isArray()) for (let k = 0; k < kids.length; k++) dropNames(kids.get(k).resolve());
  };
  if (dests && !dests.isNull()) dropNames(dests.resolve());
  console.log(`  차례 ${tocPage + 1}쪽: 두 줄 지움, 링크 지움 ${killedLinks}·옮김 ${movedLinks}`);
}

// ---------- 4) 이 책을 읽는 법 ----------
let guidePage = -1;
for (let i = 0; i < tocPage; i++) if (headText(i) === "이 책을 읽는 법") { guidePage = i; break; }
if (guidePage < 0) fail("「이 책을 읽는 법」 쪽을 찾지 못함");
{
  const st = state(guidePage), lines = stextLines(guidePage);
  const cal = calibrate(lines, st.blocks); if (!cal) fail("읽는 법 쪽 좌표 맞춤 실패");
  const cut = (lineKey, from, to) => {
    const m = matchLine(lines, st.blocks, lineKey, cal); if (!m) fail(`읽는 법 줄 「${lineKey}」 글리프를 찾지 못함`);
    const t = m.l.text, a = t.indexOf(from), b = to === null ? t.length : t.indexOf(to, a + 1);
    if (a < 0 || b < 0) fail(`읽는 법 줄에서 「${from}」~「${to}」를 찾지 못함`);
    cutRange(st, m, a, b);
    return m;
  };
  cut("개념 문제, 예상", "개념 문제, ", "예상");
  cut("옆과 답안, 예상", "답안, ", "예상");
  // 책의 구성: 첫 줄의 「개념 문제(…) →」를 지우고 둘째 줄을 그 자리에 잇는다
  const m1 = matchLine(lines, st.blocks, "개념 문제(답안은 다음 쪽부터)", cal); if (!m1) fail("책의 구성 첫 줄을 찾지 못함");
  const i1 = lines.indexOf(m1.l), l2 = lines[i1 + 1];
  if (!l2 || !l2.text.trim().startsWith("예상 질문과 답변")) fail("책의 구성 둘째 줄이 예상 질문과 답변으로 시작하지 않음");
  // 첫 줄은 「… 이야기 →」에서 끝나고 둘째 줄(예상 질문과 답변 → 용어·인물 풀이)은 그대로 둔다
  // (둘째 줄을 끌어올리면 한 줄에 들어가지 않는다). 「개념 문제(」부터 줄 끝(→)까지 지운다.
  const a = m1.l.text.indexOf("개념 문제(");
  let b = m1.l.text.length;
  cutRange(st, m1, a, b);
  // 남은 줄 끝 공백 글리프는 보이지 않으므로 그대로 둔다
}
flush(tocPage); flush(guidePage);

// ---------- 1) 쪽 지우기(마지막에: 앞의 쪽 번호는 원래 번호 기준) ----------
for (let k = faqStart - 1; k >= qStart; k--) doc.deletePage(k);

fs.writeFileSync(outPdf, doc.saveToBuffer("garbage=1,compress").asUint8Array());
doc.destroy();

// ---------- 확인 ----------
const chk = mupdf.Document.openDocument(fs.readFileSync(outPdf), "application/pdf");
const n2 = chk.countPages();
let all = "";
for (let i = 0; i < n2; i++) { const p = chk.loadPage(i); all += p.toStructuredText().asText() + "\f"; p.destroy(); }
chk.destroy();
const pagesTxt = all.split("\f");
const left = (pagesTxt.join("").match(/개념 문제|답안/g) || []).length;
const faqIdx = qStart; // 예상 질문과 답변이 지운 자리로 당겨짐
console.log(`${left === 0 && n2 === N - K ? "✓" : "✗"} ${path.basename(outPdf)} | ${N}→${n2}쪽(−${K}: ${qStart + 1}~${faqStart}쪽) | 쪽 번호 ${renum}개 당김 | 남은 「개념 문제/답안」 ${left} | 예상 질문 ${faqIdx + 1}쪽`);
process.exit(left === 0 && n2 === N - K ? 0 : 2);
