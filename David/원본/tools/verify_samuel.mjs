// 「영어로 읽는 사무엘기」 검사: node verify_samuel.mjs <원본폴더> <pdf> <epub>
//  - 모든 절의 칠판·듣기 링크가 있고 듣기 링크 문장이 BSB 본문과 같은지
//  - 고어(thou·thee·hath·unto 등)가 하나도 없는지(현대 영어만)
//  - 차례 이동 링크가 실제 쪽을 가리키는지(PDF), EPUB 구조·XML·이미지·내부 링크
import fs from "fs";
import * as mupdf from "mupdf";
import JSZip from "jszip";
import { XMLValidator } from "fast-xml-parser";
import { loadSamuel } from "./samuel.mjs";

const [root, pdf, epub] = process.argv.slice(2);
const chapters = loadSamuel(root);
const verses = chapters.flatMap((C) => C.verses.map((v) => ({ C, v, ref: `${C.book === "사무엘상" ? "1" : "2"} Samuel ${C.n}:${v.n}` })));
const wantTts = new Set(verses.map((x) => x.v.text));
const ARCHAIC = /\b(thee|thou|thy|thine|ye|hath|doth|shalt|wilt|unto|spake|whithersoever|wherefore|twain|behold)\b/i;
const problems = [];

for (const { v, ref } of verses) { const m = v.text.match(ARCHAIC); if (m) problems.push(`${ref}: 고어 "${m[0]}"`); }

// PDF
const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
let text = "", tts = new Set(), internal = 0, badInternal = 0;
for (let i = 0; i < doc.countPages(); i++) {
  const p = doc.loadPage(i);
  text += p.toStructuredText().asText() + "\n";
  for (const l of p.getLinks()) {
    if (l.isExternal()) { const u = l.getURI(); if (u.startsWith("https://translate.google.com/")) tts.add(new URL(u).searchParams.get("text")); }
    else { internal++; if (doc.resolveLink(l) < 0) badInternal++; }
  }
}
for (const t of wantTts) if (!tts.has(t)) problems.push("PDF 듣기 링크 빠짐: " + t.slice(0, 40));
for (const { ref } of verses) if (!text.includes(ref)) problems.push("PDF 칠판 빠짐: " + ref);
if (/@@\w+@@/.test(text)) problems.push("PDF에 쪽 번호 표식이 남아 있음");
if (badInternal) problems.push(`PDF 내부 링크 ${badInternal}개가 쪽을 못 찾음`);
console.log(`PDF ${doc.countPages()}쪽 | 칠판 ${verses.length}절 | 듣기 링크 ${tts.size}개(기대 ${wantTts.size}) | 내부 이동 ${internal}개`);

// EPUB
const raw = fs.readFileSync(epub);
const zip = await JSZip.loadAsync(raw);
if (raw.toString("latin1", 30, 38) !== "mimetype" || raw.readUInt16LE(8) !== 0) problems.push("EPUB mimetype이 첫 항목·무압축이 아님");
const names = Object.keys(zip.files);
const xml = {};
for (const n of names.filter((n) => /\.(xhtml|opf|ncx|xml)$/.test(n))) {
  xml[n] = await zip.file(n).async("string");
  const r = XMLValidator.validate(xml[n]);
  if (r !== true) problems.push(`EPUB XML 오류 ${n}: ${r.err.msg} (줄 ${r.err.line})`);
}
const ids = {};
for (const [n, t] of Object.entries(xml)) ids[n.replace("OEBPS/", "")] = new Set([...t.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
let eInternal = 0; const eTts = new Set(); let imgRefs = 0;
for (const [n, t] of Object.entries(xml)) {
  if (!n.endsWith(".xhtml")) continue;
  for (const m of t.matchAll(/href="([^"]+)"/g)) {
    const h = m[1].replace(/&amp;/g, "&");
    if (h.endsWith(".css")) continue;
    if (h.startsWith("https://translate.google.com/")) { eTts.add(new URL(h).searchParams.get("text")); continue; }
    if (/^https?:/.test(h)) continue;
    eInternal++;
    const [f, frag] = h.split("#");
    const file = f || n.replace("OEBPS/", "");
    if (!ids[file] || (frag && !ids[file].has(frag))) problems.push(`EPUB 깨진 링크 ${n} → ${h}`);
  }
  for (const m of t.matchAll(/<img src="([^"]+)"/g)) { imgRefs++; if (!zip.file("OEBPS/" + m[1])) problems.push("EPUB 없는 그림: " + m[1]); }
}
for (const t of wantTts) if (!eTts.has(t)) problems.push("EPUB 듣기 링크 빠짐: " + t.slice(0, 40));
const boards = names.filter((n) => /OEBPS\/s\dc\d+v\d+\.jpg$/.test(n)).length;
if (boards !== verses.length) problems.push(`EPUB 칠판 그림 ${boards}장(기대 ${verses.length})`);
let epPages = 0;
try { const d = mupdf.Document.openDocument(raw, "application/epub+zip"); d.layout(420, 600, 12); epPages = d.countPages(); } catch (e) { problems.push("EPUB이 열리지 않음: " + e.message); }
console.log(`EPUB ${(raw.length / 1024).toFixed(0)}KB | 칠판 그림 ${boards}장 | 듣기 링크 ${eTts.size}개 | 내부 이동 ${eInternal}개 | 그림 참조 ${imgRefs}개 | 시험 조판 ${epPages}쪽`);
problems.forEach((p) => console.log("  ✗", p));
process.exit(problems.length ? 1 : 0);
