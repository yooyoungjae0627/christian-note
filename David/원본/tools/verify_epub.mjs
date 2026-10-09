// EPUB 검사: 구조(mimetype 첫 항목·무압축), XML 문법, 내부 이동·영상 링크, 원고 문단·강조 수가 원고와 같은지, mupdf로 열리는지.
// node verify_epub.mjs <원본폴더> <epub>
import fs from "fs";
import JSZip from "jszip";
import { XMLValidator } from "fast-xml-parser";
import * as mupdf from "mupdf";
import { loadBook, ytUrl } from "./parse.mjs";

const [root, epub, volume = "main"] = process.argv.slice(2);
const EN = volume === "english";
const book = loadBook(root);
const raw = fs.readFileSync(epub);
const zip = await JSZip.loadAsync(raw);
const problems = [];

// 1) mimetype: 첫 항목, 무압축(로컬 헤더의 압축 방식 0), 내용 정확
if (raw.readUInt32LE(0) !== 0x04034b50 || raw.toString("latin1", 30, 38) !== "mimetype") problems.push("mimetype이 첫 항목이 아님");
if (raw.readUInt16LE(8) !== 0) problems.push("mimetype이 압축되어 있음");
if ((await zip.file("mimetype").async("string")) !== "application/epub+zip") problems.push("mimetype 내용 이상");

// 2) XML 문법
const texts = {};
for (const name of Object.keys(zip.files)) {
  if (!/\.(xhtml|opf|ncx|xml)$/.test(name)) continue;
  const t = await zip.file(name).async("string");
  texts[name] = t;
  const v = XMLValidator.validate(t);
  if (v !== true) problems.push(`XML 오류 ${name}: ${v.err.msg} (줄 ${v.err.line})`);
}

// 3) 링크
const ids = {};
for (const [n, t] of Object.entries(texts)) if (n.endsWith(".xhtml")) ids[n.replace("OEBPS/", "")] = new Set([...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const expected = new Set();
for (const L of EN ? [] : book.lessons) { expected.add(ytUrl(L.vid, "0:00")); for (const c of L.chapters) { if (c.ts) expected.add(ytUrl(L.vid, c.ts)); c.secs.forEach((s) => s.ts && expected.add(ytUrl(L.vid, s.ts))); } }
const yt = new Set(), tts = new Set();
let internal = 0;
for (const [n, t] of Object.entries(texts)) {
  if (!n.endsWith(".xhtml")) continue;
  const here = n.replace("OEBPS/", "");
  for (const m of t.matchAll(/href="([^"]+)"/g)) {
    const h = m[1];
    if (h.endsWith(".css")) continue;
    if (h.startsWith("https://translate.google.com/")) { tts.add(new URL(h.replace(/&amp;/g, "&")).searchParams.get("text")); continue; }
    if (/^https?:/.test(h)) { yt.add(h); continue; }
    internal++;
    const [f, frag] = h.split("#");
    const file = f || here;
    if (!ids[file]) problems.push(`없는 파일로 이동: ${n} → ${h}`);
    else if (frag && !ids[file].has(frag)) problems.push(`없는 위치로 이동: ${n} → ${h}`);
  }
}
for (const u of expected) if (!yt.has(u)) problems.push("빠진 영상 링크: " + u);
for (const u of yt) if (!expected.has(u)) problems.push("예상 밖 링크: " + u);
const ttsWant = EN ? [...new Set(book.lessons.flatMap((L) => (L.english ? L.english.verses.flatMap((v) => [v.text, v.modern]) : [])))] : [];
if (!EN && tts.size) problems.push(`본책에 듣기 링크 ${tts.size}개가 남아 있음`);
for (const t of ttsWant) if (!tts.has(t)) problems.push("듣기 링크 빠짐: " + t.slice(0, 40));

// 4) 원고와 같은 분량인지: 문단 수, 말씀 상자 수, 용어 상자 수, 강조 수
const all = Object.entries(texts).filter(([n]) => /lesson\d+\.xhtml$/.test(n)).map(([, t]) => t).join("");
const want = { person: 0, p: 0, verse: 0, note: 0, h1: 0, h2: 0, h3: 0 };
for (const L of book.lessons) for (const c of L.chapters) for (const b of [...c.blocks, ...c.secs.flatMap((s) => s.blocks)]) {
  if (b.t === "p") want.p++; if (b.t === "verse") want.verse++; if (b.t === "note") want.note++;
  const txt = b.t === "people" ? b.items.map((p) => p.text).join(" ") : b.text || "";
  for (const m of txt.matchAll(/\{([123]):/g)) want["h" + m[1]]++;
  if (b.t === "people") { want.person = (want.person || 0) + b.items.length; }
}
for (const L of book.lessons) for (const s of L.summary) for (const m of s.matchAll(/\{([123]):/g)) want["h" + m[1]]++;
const got = { person: (all.match(/<div class="pc">/g) || []).length, p: (all.match(/<p class="bp">/g) || []).length, verse: (all.match(/<div class="verse( vref)?">/g) || []).length, note: (all.match(/<div class="note">/g) || []).length,
  h1: (all.match(/class="h1"/g) || []).length, h2: (all.match(/class="h2"/g) || []).length, h3: (all.match(/class="h3"/g) || []).length };
if (!EN) for (const k of Object.keys(want)) if (want[k] !== got[k]) problems.push(`${k} 수 다름: 원고 ${want[k]} / EPUB ${got[k]}`);
if (/개념 문제|예상 질문/.test(all)) problems.push("'개념 문제/예상 질문' 글자가 있음");

// 4-2) 영어 강의 권: 절·뼈대·틀리기 쉬운 점·확인 질문·현대 영어 수가 원고와 같은지
let enInfo = "";
if (EN) {
  const en = Object.entries(texts).filter(([n]) => /\/en\d+\.xhtml$/.test(n)).map(([, t]) => t).join("");
  const E = book.lessons.filter((L) => L.english).map((L) => L.english);
  const w = { env: E.reduce((a, x) => a + x.verses.length, 0), skel: E.reduce((a, x) => a + x.verses.reduce((b, v) => b + v.sk.length, 0) + x.grammar.reduce((b, g) => b + g.items.filter((i) => i.t === "sk").length, 0), 0), gx: E.reduce((a, x) => a + x.grammar.reduce((b, g) => b + g.items.filter((i) => i.t === "x").length, 0), 0), gq: E.reduce((a, x) => a + x.grammar.reduce((b, g) => b + g.items.filter((i) => i.t === "q").length, 0), 0), cm: E.reduce((a, x) => a + x.verses.reduce((b, v) => b + v.chunks.filter((c) => c.modern).length, 0), 0) };
  const g = { env: (en.match(/<div class="env">/g) || []).length, skel: (en.match(/<div class="skel">/g) || []).length, gx: (en.match(/<div class="gx">/g) || []).length, gq: (en.match(/<div class="gq">/g) || []).length, cm: (en.match(/<div class="cm">/g) || []).length };
  for (const k of Object.keys(w)) if (w[k] !== g[k]) problems.push(`${k} 수 다름: 원고 ${w[k]} / EPUB ${g[k]}`);
  enInfo = ` | 절 ${g.env} 뼈대 ${g.skel} 틀리기쉬움 ${g.gx} 확인질문 ${g.gq} 현대영어청크 ${g.cm}`;
}

// 5) 실제로 열리는지(mupdf EPUB 엔진)
let pages = 0;
try { const d = mupdf.Document.openDocument(raw, "application/epub+zip"); d.layout(420, 600, 12); pages = d.countPages(); } catch (e) { problems.push("mupdf로 열리지 않음: " + e.message); }

console.log(`EPUB ${(raw.length / 1024).toFixed(0)}KB | XML 파일 ${Object.keys(texts).length}개 | 내부 이동 ${internal}개 | 영상 링크 ${yt.size}개(기대 ${expected.size}) | 듣기 링크 ${tts.size}개(기대 ${ttsWant.length}) | 인물 ${got.person} 문단 ${got.p} 말씀상자 ${got.verse} 용어상자 ${got.note} 강조 ${got.h1}/${got.h2}/${got.h3} | mupdf 시험 조판 ${pages}쪽${enInfo}`);
problems.forEach((s) => console.log("  ✗", s));
process.exit(problems.length ? 1 : 0);
