// 성경 주제별 교재 EPUB 빌드: node build_epub.mjs <원본폴더> <출력폴더>
// 원고·구성·강조는 PDF판과 같다. QR 대신 ▶ 시각 링크. 슬라이드는 JPEG(가로 1000px).
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import sharp from "sharp";
import { loadBook, esc, ytUrl, ordinal, tocId, sid } from "./parse.mjs";
import { chapterHtml, storyTitleHtml, summaryHtml, quizHtml, answersHtml, faqHtml, glossHtml, tocItems, setMode, setImgResolver, setTocResolver } from "./html.mjs";
import { coverHtml } from "./common.mjs";
import { edgeShot } from "./edge.mjs";
setMode("epub");

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, outDir] = process.argv.slice(2);
const book = loadBook(root);
const sfile = (S) => `story${String(S.n).padStart(2, "0")}.xhtml`;
const imgName = (S, b) => `img/s${String(S.n).padStart(2, "0")}_${b.file.replace(/\.\w+$/, "")}.jpg`;
setImgResolver(imgName);
setTocResolver((id) => `contents.xhtml#toc-${id}`);

const xhtml = (title, body, cls = "") => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body${cls ? ` class="${cls}"` : ""}>
${body.replace(/<br>/g, "<br/>").replace(/(<img [^>]*?)(?<!\/)>/g, "$1/>")}
</body></html>`;

// 이야기 안의 이동(#id)은 같은 파일 안, 차례 → 이야기는 파일#id
const where = {};
for (const S of book.stories) for (const [, id] of tocItems(S)) where[id] = sfile(S);

function frontXhtml() {
  const S0 = book.stories[0];
  return xhtml("이 책을 읽는 법", `<section id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
  <p>이 책은 「${book.series}」 시리즈의 <b>제 ${Number(book.only)}권</b>으로, 첫열매들(FIRSTFRUITS) 예배 강의 <b>하나를 한 권</b>으로 엮은 교재입니다. 강의를 녹취하여 내용과 예화와 순서는 하나도 빼지 않고 문장만 읽기 좋게 다듬었습니다. 장 제목과 소제목, 그림 캡션, 용어 상자, 뒷부분(한눈에 보는 이야기, 개념 문제, 예상 질문과 답변, 용어·인물 풀이)은 정리한 사람이 덧붙였습니다.</p>
  <div class="lab">세 단계 강조</div>
  <table class="legend"><tr><td><span class="h1">노란 바탕</span></td><td>중요한 문장</td></tr>
  <tr><td><span class="h2">노란 바탕 + 굵게</span></td><td>더 중요한 문장</td></tr>
  <tr><td><span class="h3">굵게 + 빨간 밑줄</span></td><td>핵심 명제 — 이것만 이어 읽어도 흐름이 보입니다</td></tr>
  <tr><td>성경 구절 상자</td><td>강의 슬라이드의 구절을 글자 그대로 옮긴 상자</td></tr>
  <tr><td>용어 상자</td><td>강의 밖의 낯선 말·인물을 짧게 설명한 상자</td></tr></table>
  <div class="lab">강의 영상</div>
  <p>${S0.vid ? `장·소제목 옆과 답안, 예상 질문 옆의 <a class="yt" href="${ytUrl(S0.vid, "0:00")}">▶ 0:00</a> 같은 빨간 시각 표시를 누르면 그 부분의 강의 영상이 바로 열립니다.` : `이 강의는 유튜브 링크를 받지 않아 영상 구간 이동(▶)이 없습니다.`}</p>
  <div class="lab">이야기 표제와 「목차로 이동」</div>
  <p>이야기마다 첫머리에 원 강의 정보와 그 이야기의 강의 그림 색깔 표가 있습니다. 그 아래 <b>◀ 목차로 이동</b>을 누르면 차례의 그 이야기 항목으로 돌아갑니다. 각 장과 뒷부분 제목 아래에도 같은 단추가 있어, 누르면 차례의 그 장 항목으로 갑니다.</p>
  <div class="lab">전자책으로 읽을 때</div>
  <p>글자 크기를 키우거나 줄이면 줄이 화면에 맞게 다시 흐릅니다. 어두운 화면으로 읽어도 됩니다. 쪽 번호는 기기와 글자 크기에 따라 달라지고, 상자 모양은 앱마다 조금씩 다르게 보일 수 있습니다.</p>
  <div class="lab">책의 구성</div>
  <p>이 책을 읽는 법 → 차례 → [이야기 표제 → 시작하며 → 본문 장들 → 마치며 → 한눈에 보는 이야기 → 개념 문제 → 답안 → 예상 질문과 답변 → 용어·인물 풀이]</p></section>`);
}

function contentsXhtml() {
  const cls = ["tl", "tc", "ts"];
  let h = "";
  for (const S of book.stories) {
    h += `<div class="tstory" id="${tocId(S)}">`;
    for (const [t, id, d, sub] of tocItems(S)) {
      h += `<a class="${cls[d]}"${d ? ` id="toc-${id}"` : ""} href="${where[id]}#${id}">${esc(t)}</a>`;
      if (sub && d < 2) h += `<div class="${d === 0 ? "tsub0" : "tsub"}">${esc(sub)}</div>`;
    }
    h += `</div>`;
  }
  return xhtml("차례", `<section id="toc"><h1>차례</h1><div class="gold"></div><div class="tocnote">${book.stories[0].vid ? `1. 빨간 <b>▶ 시각</b>을 누르면 그 부분의 강의 영상이 열립니다.<br>2. 차례의 제목을 누르면 그곳으로 이동합니다.` : `차례의 제목을 누르면 그곳으로 이동합니다.`}</div><div class="toc">${h}</div></section>`);
}

async function storyXhtml(S) {
  let h = await storyTitleHtml(book, S);
  for (let i = 0; i < S.chapters.length; i++) h += await chapterHtml(S, S.chapters[i], i);
  h += summaryHtml(S) + quizHtml(S) + (await answersHtml(S)) + (await faqHtml(book, S)) + glossHtml(S);
  return xhtml(`${ordinal(S.n)} 이야기 · ${S.title}`, h);
}

function navXhtml() {
  let html = "", depth = -1;
  const items = book.stories.flatMap((S) => tocItems(S).map(([t, id, d]) => [t, `${where[id]}#${id}`, d]));
  for (const [t, href, d] of items) {
    if (d > depth) html += "<ol>".repeat(d - depth);
    else { html += "</li>"; if (d < depth) html += "</ol></li>".repeat(depth - d); }
    html += `<li><a href="${href}">${esc(t)}</a>`;
    depth = d;
  }
  html += "</li>" + "</ol></li>".repeat(depth) + "</ol>";
  html = html.replace(/^<ol>/, `<ol><li><a href="front.xhtml#howto">이 책을 읽는 법</a></li><li><a href="contents.xhtml">차례</a></li>`);
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko">
<head><meta charset="utf-8"/><title>차례</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><nav epub:type="toc" id="nav"><h1>차례</h1>${html}</nav>
<nav epub:type="landmarks" hidden=""><ol><li><a epub:type="cover" href="cover.xhtml">표지</a></li><li><a epub:type="toc" href="contents.xhtml">차례</a></li><li><a epub:type="bodymatter" href="${sfile(book.stories[0])}">본문</a></li></ol></nav></body></html>`;
}

function ncx() {
  let n = 0;
  const pt = (label, src, kids = "") => `<navPoint id="np${++n}" playOrder="${n}"><navLabel><text>${esc(label)}</text></navLabel><content src="${src}"/>${kids}</navPoint>`;
  let pts = pt("이 책을 읽는 법", "front.xhtml#howto") + pt("차례", "contents.xhtml");
  for (const S of book.stories) {
    const it = tocItems(S);
    pts += pt(it[0][0], `${sfile(S)}#${sid(S)}`, it.filter((x) => x[2] === 1).map(([t, id]) => pt(t, `${sfile(S)}#${id}`)).join(""));
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${book.uid}"/><meta name="dtb:depth" content="2"/></head>
<docTitle><text>${esc(book.title)}</text></docTitle><navMap>${pts}</navMap></ncx>`;
}

fs.mkdirSync(outDir, { recursive: true });
// 표지: PDF판 표지 HTML을 그대로 찍는다
const coverFile = path.join(outDir, "_cover.png"), coverHtmlFile = path.join(outDir, "_cover.html");
fs.writeFileSync(coverHtmlFile, `<!doctype html><html><head><meta charset="utf-8"><style>${fs.readFileSync(path.join(here, "print.css"), "utf8")} body{margin:0}</style></head><body>${coverHtml(book)}</body></html>`);
edgeShot(coverHtmlFile, coverFile, 559, 794, 2.2);

const files = [
  ["cover.xhtml", xhtml("표지", `<div class="cover"><img src="cover.png" alt="${esc(book.title)} 표지"/></div>`, "cover")],
  ["front.xhtml", frontXhtml()],
  ["contents.xhtml", contentsXhtml()],
];
for (const S of book.stories) files.push([sfile(S), await storyXhtml(S)]);

const imgs = [];
for (const S of book.stories) for (const b of S.chapters.flatMap((c) => [...c.blocks, ...c.secs.flatMap((s) => s.blocks)]).filter((b) => b.t === "img"))
  imgs.push([imgName(S, b), await sharp(b.path).resize({ width: 1000, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer()]);

const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const id = (f) => f.replace(/[^\w]/g, "_");
const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ko">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${book.uid}</dc:identifier><dc:title>${esc(book.title)}</dc:title><dc:language>ko</dc:language>
<dc:creator>첫열매들(FIRSTFRUITS) 예배 강의 · ${esc(book.owner || "")} 정리</dc:creator><meta property="dcterms:modified">${now}</meta><meta name="cover" content="cover-img"/>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
<item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/>
${imgs.map(([n]) => `<item id="${id(n)}" href="${n}" media-type="image/jpeg"/>`).join("\n")}
${files.map(([f, c]) => `<item id="${id(f)}" href="${f}" media-type="application/xhtml+xml"${/<svg[\s>]/.test(c) ? ' properties="svg"' : ""}/>`).join("\n")}
</manifest>
<spine toc="ncx">
${files.map(([f]) => `<itemref idref="${id(f)}"/>`).join("\n")}
</spine>
</package>`;

const zip = new JSZip();
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="utf-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
zip.file("OEBPS/content.opf", opf);
zip.file("OEBPS/nav.xhtml", navXhtml());
zip.file("OEBPS/toc.ncx", ncx());
zip.file("OEBPS/style.css", fs.readFileSync(path.join(here, "epub.css")));
zip.file("OEBPS/cover.png", fs.readFileSync(coverFile));
for (const [n, b] of imgs) zip.file("OEBPS/" + n, b);
for (const [f, c] of files) zip.file("OEBPS/" + f, c);
const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
const out = path.join(outDir, book.epubName);
fs.writeFileSync(out, buf);
fs.rmSync(coverFile); fs.rmSync(coverHtmlFile);
console.log("완성:", out, (buf.length / 1024).toFixed(0) + "KB");
