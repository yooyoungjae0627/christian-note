// 「다윗의 삶 — 영어로 읽는 사무엘기」 EPUB: node build_samuel_epub.mjs <원본폴더> <출력폴더>
// 칠판은 앱마다 글꼴·CSS 지원이 달라 PNG로 찍어 넣고, 설명은 글(리플로우)로 넣는다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { esc, inline } from "./parse.mjs";
import { loadSamuel } from "./samuel.mjs";
import { boardHtml, boardCss, ROLE } from "./board.mjs";
import { coverHtml } from "./common.mjs";
import { ttsButton, setMode } from "./html.mjs";
import { edgeShot } from "./edge.mjs";
setMode("epub");

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, outDir] = process.argv.slice(2);
const book = JSON.parse(fs.readFileSync(path.join(root, "book.json"), "utf8"));
const vol = { ...book, ...book.english };
const chapters = loadSamuel(root);
const cid = (C) => `${C.book === "사무엘상" ? "s1" : "s2"}c${C.n}`;
const bookEn = (C) => (C.book === "사무엘상" ? "1 Samuel" : "2 Samuel");
const cfile = (C) => `${cid(C)}.xhtml`;
const work = path.join(outDir, "_samuel_epub");
fs.mkdirSync(path.join(work, "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(here, "fonts"))) fs.copyFileSync(path.join(here, "fonts", f), path.join(work, "fonts", f));

// 흰 바탕 아래쪽을 잘라 내고 JPEG(품질 82)로 바꾼다(EPUB 용량을 줄이려고)
function trimToJpeg(file, jpgFile) {
  const p = PNG.sync.read(fs.readFileSync(file));
  let last = 0;
  for (let y = p.height - 1; y >= 0 && !last; y--)
    for (let x = 0; x < p.width; x += 3) { const i = (y * p.width + x) * 4; if (p.data[i] < 245 || p.data[i + 1] < 245 || p.data[i + 2] < 245) { last = y; break; } }
  const out = new PNG({ width: p.width, height: last + 4 });
  PNG.bitblt(p, out, 0, 0, p.width, last + 4, 0, 0);
  fs.writeFileSync(jpgFile, jpeg.encode({ data: out.data, width: out.width, height: out.height }, 82).data);
  fs.rmSync(file);
}
function shot(html, name, w, h, scale) {
  const hf = path.join(work, "_s.html"), pf = path.join(work, name);
  fs.writeFileSync(hf, html);
  edgeShot(hf, pf, w, h, scale);
  return pf;
}

const xhtml = (title, body) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body.replace(/<br>/g, "<br/>")}</body></html>`;

const imgs = [];
// 표지
{
  const css = fs.readFileSync(path.join(here, "print.css"), "utf8");
  const pf = shot(`<!doctype html><html><head><meta charset="utf-8"><style>${css} body{margin:0}</style></head><body>${coverHtml(vol, "en")}</body></html>`, "cover.png", 559, 794, 2.2);
  imgs.push(["cover.png", pf, true]);
}
// 칠판
const bcss = boardCss("fonts/") + `body{margin:0;background:#fff;width:640px;padding:6px;box-sizing:border-box}`;
for (const C of chapters) for (const v of C.verses) {
  const name = `${cid(C)}v${v.n}.jpg`;
  const pf = shot(`<!doctype html><html><head><meta charset="utf-8"><style>${bcss}</style></head><body>${boardHtml({ ref: `${bookEn(C)} ${C.n}:${v.n}`, refKo: `${C.book} ${C.n}:${v.n}`, chunks: v.chunks, key: v.key })}</body></html>`, "_raw.png", 640, 1800, 1.6);
  const jf = path.join(work, name);
  trimToJpeg(pf, jf);
  imgs.push([name, jf]);
  process.stdout.write(".");
}
console.log("");

const legend = Object.entries(ROLE).map(([k, v]) => `<b>${k}</b> ${v.ko}`).join(" · ");
const front = xhtml("이 책을 읽는 법", `<section id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
<p>이 책은 사무엘상 1장부터 한 절씩 차례로 영어로 읽어 가는 <b>영어 구문·문법 교재</b>입니다. 영어 본문은 오늘날의 쉬운 현대 영어 성경인 ${esc(vol.textSource)}을 씁니다. 장이 하나씩 더해질 때마다 이 책에 이어 붙입니다.</p>
<div class="lab">한 절의 순서</div>
<p>① <b>칠판</b> — 한 절을 청크로 끊어 쓰고 그 아래 노란 분필로 직독직해를 적었습니다. 맨 아래 ★는 핵심 한 줄입니다.<br>② <b>쉬운 설명</b> — 무슨 이야기인지 쉽게 풀었습니다.<br>③ <b>문법·구문 설명</b> — 문장이 어떻게 짜여 있는지 설명합니다.</p>
<div class="lab">칠판의 색 분필</div><p>${legend}. 단어 밑 색 밑줄과 그 위 글자가 문장 성분입니다. 빨간 빗금(/)에서 끊어 앞에서부터 뜻을 붙여 읽으세요.</p>
<div class="lab">듣기</div><p>절마다 있는 <b>듣기</b> 버튼을 누르면 Google 번역 화면이 열리고, 그곳의 스피커 단추를 누르면 미국식 영어로 읽어 줍니다(인터넷 필요).</p>
<div class="lab">전자책으로 읽을 때</div><p>설명 글은 글자 크기에 맞게 다시 흐릅니다. 칠판은 그림이라 손가락으로 벌려 크게 볼 수 있습니다.</p></section>`);

const tocItems = [];
for (const C of chapters) {
  tocItems.push([`${C.book} ${C.n}장 · ${C.title}`, `${cfile(C)}#${cid(C)}`, 0]);
  for (const v of C.verses) tocItems.push([`${C.n}장 ${v.n}절`, `${cfile(C)}#${cid(C)}v${v.n}`, 1]);
  tocItems.push([`${C.n}장 필수 단어`, `${cfile(C)}#${cid(C)}w`, 1], [`${C.n}장 문법 정리`, `${cfile(C)}#${cid(C)}s`, 1]);
}
const contents = xhtml("차례", `<section id="toc"><h1>차례</h1><div class="gold"></div><div class="toc">${tocItems.map(([t, h, d]) => `<a class="${d ? "ts" : "tl"}" href="${h}">${esc(t)}</a>`).join("")}</div></section>`);

const chFiles = chapters.map((C) => {
  const id = cid(C);
  let h = `<section id="${id}"><div class="chn">${C.book} ${C.n}장 · ${bookEn(C)} ${C.n}</div><h1>${esc(C.title)}</h1><div class="gold"></div>${C.intro.map((p) => `<p>${inline(p)}</p>`).join("")}
  <div class="learn"><div class="lh">이 장에서 배우는 문법</div><ul>${C.learn.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div></section>`;
  for (const v of C.verses) {
    h += `<section class="sv" id="${id}v${v.n}"><h3>${C.n}장 ${v.n}절 ${ttsButton(v.text)}</h3>
    <div class="bdimg"><img src="${id}v${v.n}.jpg" alt="${esc(`${bookEn(C)} ${C.n}:${v.n} — ${v.text}`)}"/></div>
    <div class="lab2">쉬운 설명</div>${v.easy.map((p) => `<p>${inline(p)}</p>`).join("")}
    <div class="lab2">문법 · 구문 설명</div>${v.gram.map((p) => `<p>${inline(p)}</p>`).join("")}</section>`;
  }
  h += `<section id="${id}w"><h2>${C.book} ${C.n}장 필수 단어</h2><table class="words"><thead><tr><th>단어</th><th>뜻</th><th>나온 절</th></tr></thead><tbody>${C.words.map((w) => `<tr><td class="w">${esc(w.w)}</td><td>${esc(w.ko)}</td><td class="r">${esc(w.ref)}</td></tr>`).join("")}</tbody></table></section>`;
  h += `<section id="${id}s"><h2>${C.book} ${C.n}장 문법 정리</h2><ol class="sum">${C.sum.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>`;
  return [cfile(C), xhtml(`${C.book} ${C.n}장`, h)];
});

// 확성기 아이콘
const spk = shot(`<!doctype html><html><body style="margin:0;background:#18233f"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="48" height="48"><rect width="24" height="24" fill="#18233f"/><path d="M3 9v6h4l5 4V5L7 9H3z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg></body></html>`, "_spkraw.png", 500, 500, 1);
{ const s = PNG.sync.read(fs.readFileSync(spk)), o = new PNG({ width: 48, height: 48 }); PNG.bitblt(s, o, 0, 0, 48, 48, 0, 0); fs.writeFileSync(path.join(work, "speaker.png"), PNG.sync.write(o)); imgs.push(["speaker.png", path.join(work, "speaker.png")]); }

const files = [["cover.xhtml", xhtml("표지", `<div class="cover"><img src="cover.png" alt="${esc(vol.title)} 표지"/></div>`)], ["front.xhtml", front], ["contents.xhtml", contents], ...chFiles];
let nav = "<ol>", depth = 0;
nav += `<li><a href="front.xhtml#howto">이 책을 읽는 법</a></li><li><a href="contents.xhtml">차례</a></li>`;
for (const C of chapters) nav += `<li><a href="${cfile(C)}#${cid(C)}">${C.book} ${C.n}장 · ${esc(C.title)}</a><ol>${C.verses.map((v) => `<li><a href="${cfile(C)}#${cid(C)}v${v.n}">${v.n}절</a></li>`).join("")}<li><a href="${cfile(C)}#${cid(C)}w">필수 단어</a></li><li><a href="${cfile(C)}#${cid(C)}s">문법 정리</a></li></ol></li>`;
nav += "</ol>";
const navX = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko"><head><meta charset="utf-8"/><title>차례</title></head>
<body><nav epub:type="toc" id="nav"><h1>차례</h1>${nav}</nav></body></html>`;
let n = 0;
const pt = (l, s, k = "") => `<navPoint id="np${++n}" playOrder="${n}"><navLabel><text>${esc(l)}</text></navLabel><content src="${s}"/>${k}</navPoint>`;
const ncx = `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${vol.uid}"/><meta name="dtb:depth" content="2"/></head><docTitle><text>${esc(vol.title)} ${esc(vol.edition)}</text></docTitle>
<navMap>${pt("이 책을 읽는 법", "front.xhtml#howto")}${pt("차례", "contents.xhtml")}${chapters.map((C) => pt(`${C.book} ${C.n}장 · ${C.title}`, `${cfile(C)}#${cid(C)}`, C.verses.map((v) => pt(`${v.n}절`, `${cfile(C)}#${cid(C)}v${v.n}`)).join(""))).join("")}</navMap></ncx>`;
const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ko">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="bookid">${vol.uid}</dc:identifier><dc:title>${esc(vol.title)} (${esc(vol.edition)})</dc:title><dc:language>ko</dc:language>
<dc:creator>첫열매들 대면 B조 정리</dc:creator><dc:rights>영어 본문: Berean Standard Bible(공유 저작물)</dc:rights><meta property="dcterms:modified">${now}</meta><meta name="cover" content="cover-img"/></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="style.css" media-type="text/css"/>
${imgs.map(([nm, , cov]) => `<item id="${cov ? "cover-img" : "i_" + nm.replace(/\W/g, "_")}" href="${nm}" media-type="${nm.endsWith(".jpg") ? "image/jpeg" : "image/png"}"${cov ? ' properties="cover-image"' : ""}/>`).join("\n")}
${files.map(([f]) => `<item id="${f.replace(".xhtml", "")}" href="${f}" media-type="application/xhtml+xml"/>`).join("\n")}</manifest>
<spine toc="ncx">${files.map(([f]) => `<itemref idref="${f.replace(".xhtml", "")}"/>`).join("")}</spine></package>`;

const zip = new JSZip();
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="utf-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
zip.file("OEBPS/content.opf", opf);
zip.file("OEBPS/nav.xhtml", navX);
zip.file("OEBPS/toc.ncx", ncx);
zip.file("OEBPS/style.css", fs.readFileSync(path.join(here, "epub.css"), "utf8") + `
.bdimg{margin:0.4em 0 0.8em}.bdimg img{width:100%;height:auto}
.sv h3{border-left:0.25em solid #c9973b;padding-left:0.45em;margin-top:2em}
.learn{background:#fff7d6;color:#1d1d1f;border:1px solid #e6c766;padding:0.5em 0.8em;margin:1em 0}.learn .lh{font-weight:bold;font-family:sans-serif}
.chn{color:#b8862f;font-weight:bold;font-family:sans-serif;margin-top:1em}
.lab2{font-family:sans-serif;font-weight:bold;font-size:0.8em;color:#2f6b5a;margin:0.9em 0 0.2em}`);
for (const [nm, pf] of imgs) zip.file("OEBPS/" + nm, fs.readFileSync(pf));
for (const [f, c] of files) zip.file("OEBPS/" + f, c);
const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
const out = path.join(outDir, vol.epubName);
fs.writeFileSync(out, buf);
fs.rmSync(work, { recursive: true });
console.log("완성:", out, (buf.length / 1024).toFixed(0) + "KB");
