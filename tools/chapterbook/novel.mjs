// 단원 책 서두의 「소설로 먼저 읽기」(지침 §2-4, 모든 성경 책 공통, 사용자 지시 2026-10-23) — 성경 본문이 나오기 전에 단원 전체 이야기를 소설처럼 풀어 쓴다.
//   node tools/chapterbook/novel.mjs <genesis|1sam|2sam|1ki|2ki …> check [N …]   원고 검사 — 종료 코드 0이어야 빌드
// 원고: 단원 원고와 같은 폴더의 <책>-novelNN.json  { "paras": [ { "t": "문단", "refs": ["1:1-8"] } ] }
// 검사: 문단 근거 절이 단원 범위 안, 단원의 모든 단락을 문단 근거가 덮음, 대사는 근거 절에 말이 있을 때만·옛 말투 금지, 해설 말투 금지, 분량.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R, BOOKS, chapterVerses, esc } from "./lib.mjs";
import { useBook, loadUnit, UNITS, unitDir, isUnitBook } from "./units.mjs";

export const novelFile = (book, n) => { useBook(book); return path.join(unitDir(), `${book}-novel${String(n).padStart(2, "0")}.json`); };
export const hasNovel = (book, n) => fs.existsSync(novelFile(book, n));
export const loadNovel = (book, n) => JSON.parse(fs.readFileSync(novelFile(book, n), "utf8"));

// "12:4" · "12:4-10" → [[12,4], …] 절 목록
function verses(r) {
  const m = String(r).match(/^(\d+):(\d+)(?:-(\d+))?$/); if (!m) return null;
  const c = +m[1], a = +m[2], z = m[3] ? +m[3] : a; if (z < a) return null;
  return [...Array(z - a + 1)].map((_, i) => [c, a + i]);
}
const flat = (s) => s.replace(/\s+/g, " ");

export function checkNovel(book, n) {
  useBook(book);
  const E = [];
  if (!hasNovel(book, n)) return ["원고 없음 " + novelFile(book, n)];
  let d; try { d = loadNovel(book, n); } catch (e) { return ["JSON 오류 " + e.message]; }
  const u = loadUnit(n);
  const text = {}; let nVerse = 0, vChars = 0;
  for (const p of u.parts) for (const v of chapterVerses(book, p.ch)) { const [c, x] = v.ref.split(":").map(Number); if (x >= p.from && x <= p.to) { text[`${c}:${x}`] = v.ko; nVerse++; vChars += v.ko.length; } }
  if (!Array.isArray(d.paras) || !d.paras.length) return ["문단 없음"];
  const used = new Set(); let chars = 0;
  d.paras.forEach((p, i) => {
    const at = `${i + 1}번째 문단`;
    if (!p.t || typeof p.t !== "string") { E.push(at + " 글 없음"); return; }
    chars += p.t.length;
    if (/["']/.test(p.t)) E.push(at + " 곧은 따옴표 — 대사는 “ ”로");
    if (/[A-Za-z]/.test(p.t)) E.push(at + " 영어 글자");
    if (!p.refs?.length) { E.push(at + " 근거 절 없음"); return; }
    let src = "";
    for (const r of p.refs) {
      const vs = verses(r); if (!vs) { E.push(`${at} 근거 형식 ${r}`); continue; }
      for (const [c, x] of vs) { const k = `${c}:${x}`; if (!text[k]) E.push(`${at} 근거 ${k}가 단원 밖`); else { used.add(k); src += " " + text[k]; } }
    }
    // 대사는 뜻은 그대로 요즘 말투로(§2-4, 2026-10-24) — 근거 절에 인물의 말이 있을 때만 따옴표, 옛 말투는 대사·서술 모두 금지
    if (/“/.test(p.t) && !/[“”‘’]|말하|말씀|노래|애가|애도|이르|대답|외치|물어|물었|부르|명령|맹세|축복|저주|기도/.test(src)) E.push(`${at} 따옴표 대사가 있는데 근거 절에 인물의 말이 없음`);
    const old = p.t.match(/[가-힣]*(하리라|하노라|느니라|이니라|하였더라|하더라|였더라|었더라|았더라|리로다|도다|할지니라|할지어다|하시니라|하라 하|소서|나이다|옵니다|하옵|하였느니라)(?=[\s.,!?”’]|$)/g);
    if (old) E.push(`${at} 옛 말투: ${[...new Set(old)].slice(0, 5).join(", ")}`);
    if ((p.t.match(/“/g) || []).length !== (p.t.match(/”/g) || []).length) E.push(at + " 따옴표 짝이 안 맞음");
    // 구절에 기반한 이야기만(§2-4) — 따옴표 밖 서술에 해설·추측·교훈 말투가 있으면 실패
    const narr = p.t.replace(/“[^”]*”/g, "");
    const bad = narr.match(/강의|강사|교리|교회|해설|밀크|스코필드|일 것이다|였을 것이다|었을 것이다|였을지|우리[는가의도] |그리스도|복음|구원받|사람은 누구나|사람이란|인간은|우리 인생|뜻이다|의미한다|가르쳐 준다|교훈|상징/g);
    if (bad) E.push(`${at} 구절 밖 해설·추측 말투: ${[...new Set(bad)].join(", ")}`);
  });
  // 단원의 모든 절이 어느 문단의 근거에 들어갔는지(빠진 절은 단락 이름과 함께)
  for (const p of u.parts) for (const s of p.d.sections) {
    const miss = (verses(s.ref) || []).filter(([c, x]) => !used.has(`${c}:${x}`)).map(([c, x]) => `${c}:${x}`);
    if (miss.length) E.push(`단락 ${s.ref} 「${s.title}」에서 이야기에 없는 절: ${miss.join(", ")}`);
  }
  // 문장 생김새(§2-4, 2026-10-24): 끝 두 글자가 같은 서술 문장을 세 번 잇지 않고, '~ㅆ다'(과거형) 서술 문장을 다섯 번 넘게 잇지 않으며, '했다'로 끝나는 문장은 30% 이하
  let narr = 0, haetda = 0;
  d.paras.forEach((p, i) => {
    const sents = String(p.t || "").replace(/“[^”]*”/g, (q) => q.replace(/[.!?]/g, "")).split(/(?<=[.!?…])s+/).map((x) => x.trim()).filter(Boolean);
    let last = null, run = 0, past = 0;
    for (const x of sents) {
      if (/[”’]$/.test(x) || /^[“‘]/.test(x)) { last = null; run = 0; past = 0; continue; }
      const k = x.replace(/[.!?…]+$/, "").slice(-2); narr++; if (k === "했다") haetda++;
      run = k === last ? run + 1 : 1; last = k;
      const pc = k.charCodeAt(0) - 0xac00; past = k[1] === "다" && pc >= 0 && pc % 28 === 20 ? past + 1 : 0;
      if (past === 6) E.push(`${i + 1}번째 문단 과거형 '~ㅆ다' 문장 여섯 번 연속(문장 생김새를 바꿀 것): …${x.slice(-24)}`);
      if (run === 3) E.push(`${i + 1}번째 문단 같은 어미 '${k}' 세 번 연속: …${x.slice(-24)}`);
    }
  });
  if (narr >= 10 && haetda / narr > 0.3) E.push(`'했다'로 끝나는 문장 ${Math.round(haetda / narr * 100)}%(30% 이하)`);
  // 분량은 단원 본문 글자 수에 맞춘다(구절로만 풀면 본문 길이와 비슷하다). 너무 길면 해설로 채운 것이다
  const lo = Math.round(vChars * 0.7), hi = Math.round(vChars * 1.5) + 300;
  if (chars < lo || chars > hi) E.push(`분량 ${chars}자(이 단원 본문 ${vChars}자 → ${lo}–${hi}자)`);
  return E;
}

// 표지·읽는 법·차례 다음, 첫 장 머리 앞에 들어가는 쪽
export function novelHtml(book, n, mk = () => "") {
  useBook(book);
  const d = loadNovel(book, n), u = loadUnit(n), B = BOOKS[book];
  const range = u.parts.map((p) => p.full ? `${p.ch}장` : `${p.ch}:${p.from}–${p.to}`).join(", ");
  let o = `<section class="front novel" id="novel">${mk("novel")}<p class="eyebrow">STORY</p><h1>소설로 먼저 읽기</h1><div class="nv-sub">${esc(B.ko)} ${esc(u.title)}</div><div class="gold"></div>`;
  let ch = null;
  d.paras.forEach((p, i) => {
    if (i === d.paras.length - 1) o += `<div class="nv-end">`;
    const c = +String(p.refs[0]).split(":")[0];
    if (u.parts.length > 1 && c !== ch) { o += `<div class="nv-ch">${B.ko} ${c}장</div>`; ch = c; }
    o += `<p class="nv">${esc(p.t)}</p>`;
  });
  o += `<p class="nv-note">이 이야기는 ${esc(B.ko)} ${range} 본문(표준킹제임스성경)의 구절만으로 풀어 썼습니다. “ ” 안의 말은 본문의 뜻을 바꾸지 않고 요즘 말투로 옮긴 것입니다. 이제 칠판의 본문으로 한 단락씩 읽어 봅니다.</p></div></section>`;
  return { html: NOVEL_CSS + o, nav: [["novel", "소설로 먼저 읽기", 0]] };
}
const NOVEL_CSS = `<style>
.novel .nv-sub{font:600 10pt/1.6 "Noto Sans KR",sans-serif;color:#6b5d3d;margin-top:-1mm;}
.novel p.nv{font-size:10.8pt;line-height:1.95;text-indent:1em;margin:0 0 2.2mm;}
.novel .gold + p.nv::first-letter,.novel .nv-ch + p.nv::first-letter{font-size:1.45em;font-weight:700;color:#18233f;}
.novel .gold + p.nv,.novel .nv-ch + p.nv{text-indent:0;}
.novel .nv-ch{font:700 9pt "Noto Sans KR",sans-serif;letter-spacing:.14em;color:#c9973b;text-align:center;margin:6mm 0 3.5mm;break-after:avoid;}
.novel .nv-ch:before,.novel .nv-ch:after{content:"—";margin:0 2mm;color:#d8c08a;}
.novel .nv-end{break-inside:avoid;}
.novel .nv-note{font:8.6pt/1.75 "Noto Sans KR",sans-serif;color:#6b6b6b;border-top:.2mm solid #e2d6b8;padding-top:2.5mm;margin-top:6mm;}
</style>`;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [book, cmd, ...rest] = process.argv.slice(2);
  if (!isUnitBook(book) || cmd !== "check") { console.error("사용법: novel.mjs <단원 책> check [N …]"); process.exit(2); }
  useBook(book);
  const list = rest.length ? rest.map(Number) : UNITS.map((u) => u.unit);
  let bad = 0;
  for (const n of list) {
    const e = checkNovel(book, n); if (e.length) bad++;
    const chars = hasNovel(book, n) ? loadNovel(book, n).paras?.reduce((a, p) => a + (p.t?.length || 0), 0) : 0;
    console.log(`${BOOKS[book].ko} 단원 ${n}: ${e.length ? "실패" : "통과"} · ${chars}자`);
    for (const m of e.slice(0, 12)) console.log("   - " + m);
  }
  process.exit(bad ? 1 : 0);
}
