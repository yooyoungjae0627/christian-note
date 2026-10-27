// EPUB 검사: node verify_epub.mjs <원본폴더> <epub>
// mimetype(첫 항목·무압축), XML 문법, 내부 이동·그림 연결, 영상 링크, 원고와 문단·구절 상자·용어 상자·강조·문제 수 일치, 「목차로 이동」, mupdf로 열림
import fs from "fs";
import JSZip from "jszip";
import { XMLValidator } from "fast-xml-parser";
import * as mupdf from "mupdf";
import { loadBook, ytUrl, tocId } from "./parse.mjs";
import { tocItems } from "./html.mjs";

const [root, epub] = process.argv.slice(2);
const book = loadBook(root);
const buf = fs.readFileSync(epub);
const problems = [];
// mimetype: 첫 항목, 무압축(로컬 헤더 압축 방식 0)
if (buf.readUInt32LE(0) !== 0x04034b50 || buf.readUInt16LE(8) !== 0 || buf.toString("latin1", 30, 38) !== "mimetype") problems.push("mimetype이 첫 항목·무압축이 아님");
const zip = await JSZip.loadAsync(buf);
const names = Object.keys(zip.files);
const docs = {};
for (const n of names.filter((n) => /\.(xhtml|opf|ncx|xml)$/.test(n))) {
  const s = await zip.file(n).async("string");
  const v = XMLValidator.validate(s);
  if (v !== true) problems.push(`XML 오류 ${n}: ${v.err.msg} (줄 ${v.err.line})`);
  docs[n] = s;
}
const ids = {};
for (const [n, s] of Object.entries(docs)) ids[n.replace("OEBPS/", "")] = new Set([...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
let internal = 0, yt = new Set(), imgs = 0;
for (const [n, s] of Object.entries(docs).filter(([n]) => n.endsWith(".xhtml"))) {
  const file = n.replace("OEBPS/", "");
  for (const [, href] of s.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith("https://youtu.be/")) { yt.add(href); continue; }
    if (/^https?:/.test(href) || href.endsWith(".css")) continue;
    const [f, frag] = href.split("#");
    const target = f || file;
    if (!ids[target] && !names.includes("OEBPS/" + target)) problems.push(`${file}: 없는 파일로 이동 ${href}`);
    else if (frag && !ids[target]?.has(frag)) problems.push(`${file}: 없는 위치로 이동 ${href}`);
    else internal++;
  }
  for (const [, src] of s.matchAll(/<img [^>]*src="([^"]+)"/g)) { if (!names.includes("OEBPS/" + src)) problems.push(`${file}: 그림 없음 ${src}`); else imgs++; }
}
// 원고와 수 맞추기
const count = (s, re) => (s.match(re) || []).length;
for (const S of book.stories) {
  const f = `OEBPS/story${String(S.n).padStart(2, "0")}.xhtml`;
  const s = docs[f];
  if (!s) { problems.push("이야기 파일 없음: " + f); continue; }
  const blocks = S.chapters.flatMap((c) => [...c.blocks, ...c.secs.flatMap((x) => x.blocks)]);
  const want = { 문단: blocks.filter((b) => b.t === "p").length, 그림: blocks.filter((b) => b.t === "img").length, 구절상자: blocks.filter((b) => b.t === "img" && b.verse).length, 용어상자: blocks.filter((b) => b.t === "note").length, 문제: S.quiz.length, 답안: S.quiz.length, 예상질문: S.faq.length,
    강조: blocks.filter((b) => b.t === "p").reduce((a, b) => a + count(b.text, /\{[123]:/g), 0) };
  want.구절상자 += blocks.filter((b) => b.t === "verse").length;
  want.강조 = blocks.reduce((a, b) => a + count([b.text, b.verse].filter(Boolean).join(" "), /\{[123]:/g), 0);
  const got = { 문단: count(s, /<p class="bp">/g), 그림: count(s, /<figure class="slide[ "]/g), 구절상자: count(s, /<div class="verse[ "]/g), 용어상자: count(s, /<div class="note">/g), 문제: count(s, /<div class="qz">/g), 답안: count(s, /<div class="an[ "]/g), 예상질문: count(s, /<div class="fq[ "]/g),
    강조: count(s.split('id="' + `S${S.n}sum`)[0], /<span class="h[123]">/g) };
  for (const k of Object.keys(want)) if (want[k] !== got[k]) problems.push(`${S.n}번째 이야기 ${k}: 원고 ${want[k]} / EPUB ${got[k]}`);
  console.log(`  ${S.n}번째 이야기: ` + Object.entries(got).map(([k, v]) => `${k} ${v}`).join(", "));
  // 영상 링크
  if (!S.vid) { // 링크를 받지 않은 강의: 영상 링크가 하나도 없어야 한다
    if (/href="https:\/\/youtu\.be\//.test(s)) problems.push(`${S.n}번째 이야기: 링크를 받지 않았는데 영상 링크가 있음`);
  } else {
  const exp = new Set([ytUrl(S.vid, "0:00"), ...S.chapters.flatMap((c) => [c.ts, ...c.secs.map((x) => x.ts)]).filter(Boolean).map((t) => ytUrl(S.vid, t)), ...[...S.quiz, ...S.faq].map((q) => ytUrl(S.vid, q.ts))]);
  for (const u of exp) if (!yt.has(u)) problems.push("빠진 영상 링크: " + u);
  }
  // 목차로 이동
  if (!s.includes(`href="contents.xhtml#${tocId(S)}"`)) problems.push(`${S.n}번째 이야기: 「목차로 이동」 링크 없음`);
  if (!ids["contents.xhtml"]?.has(tocId(S))) problems.push(`${S.n}번째 이야기: 차례에 이동 위치(${tocId(S)}) 없음`);
  // 각 장·뒷부분 제목 아래 「목차로 이동」 → 차례의 그 장 항목
  let chBack = 0;
  for (const [t, id, d] of tocItems(S)) {
    if (d !== 1) continue;
    if (!s.includes(`href="contents.xhtml#toc-${id}"`) || !ids["contents.xhtml"]?.has(`toc-${id}`)) problems.push(`「${t}」: 「목차로 이동」 또는 차례 이동 위치 없음`);
    else chBack++;
  }
  console.log(`  ${S.n}번째 이야기: 장·뒷부분 「목차로 이동」 ${chBack}개 정상`);
}
// 「들어가며」 쪽은 앞부분(읽는 법·차례·목차 파일)에 없어야 한다. 본문 문장 속 '들어가며'(동사)는 해당 없음
if (["OEBPS/front.xhtml", "OEBPS/contents.xhtml", "OEBPS/nav.xhtml", "OEBPS/toc.ncx"].some((n) => (docs[n] || "").includes("들어가며"))) problems.push("「들어가며」가 남아 있음(사용자 지시 2026-10-03: 뺀다)");
for (const u of yt) if (!/^https:\/\/youtu\.be\/[\w-]{11}\?t=\d+$/.test(u)) problems.push("영상 주소 형식 이상: " + u);
let pages = 0;
try { const d = mupdf.Document.openDocument(buf, "application/epub+zip"); pages = d.countPages(); } catch (e) { problems.push("mupdf로 열리지 않음: " + e.message); }
console.log(`파일 ${names.length}개 | XHTML·XML ${Object.keys(docs).length}개 | 내부 이동 ${internal}개 정상 | 영상 링크 주소 ${yt.size}개 | 그림 ${imgs}개 | mupdf 쪽수 ${pages}`);
problems.forEach((s) => console.log("  ✗", s));
process.exit(problems.length ? 1 : 0);
