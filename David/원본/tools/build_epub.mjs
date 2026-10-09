// 다윗의 삶 EPUB 빌드: node build_epub.mjs <원본폴더> <출력폴더> [main|english]
// 원고·구성·강조는 PDF판과 같다. QR 대신 ▶ 시각 링크. 지도·아이콘은 PNG(앱마다 SVG 지원이 달라서).
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import JSZip from "jszip";
import { PNG } from "pngjs";
import { loadBook, esc, inline, ytUrl } from "./parse.mjs";
import { chapterHtml, chLabel, chId, secId, lessonId, videoMark, englishLessonHtml, kjvId, setMode } from "./html.mjs";
import { MAPS } from "./maps.mjs";
import { coverHtml, glossItems } from "./common.mjs";
setMode("epub");

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, outDir, volume = "main"] = process.argv.slice(2);
const book = loadBook(root);
const EN = volume === "english";
const vol = EN ? { ...book, ...book.english } : book;
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const lfile = (L) => `${EN ? "en" : "lesson"}${String(L.n).padStart(2, "0")}.xhtml`;
const enLessons = book.lessons.filter((L) => L.english);
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const xhtml = (title, body, cls = "") => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body${cls ? ` class="${cls}"` : ""}>
${body.replace(/<br>/g, "<br/>")}
</body></html>`;

function edgeShot(html, file, args) {
  const hf = path.join(outDir, "_shot.html");
  fs.writeFileSync(hf, html);
  if (fs.existsSync(file)) fs.rmSync(file);
  execFileSync(EDGE, ["--headless=new", "--no-first-run", "--disable-gpu", "--hide-scrollbars", "--user-data-dir=" + path.join(os.tmpdir(), "dw_edge_s" + process.pid),
    ...args, "--virtual-time-budget=8000", "--screenshot=" + path.resolve(file), "file:///" + path.resolve(hf).split(path.sep).join("/")], { stdio: "ignore", timeout: 120000 });
  for (let i = 0; i < 120 && !fs.existsSync(file); i++) wait(500);
  wait(1000);
  if (!fs.existsSync(file)) throw new Error("Edge 화면 찍기 실패: " + file);
  fs.rmSync(hf);
}
// 표지: PDF판 표지 HTML을 그대로 찍는다
function coverPng(file) {
  const css = fs.readFileSync(path.join(here, "print.css"), "utf8");
  edgeShot(`<!doctype html><html><head><meta charset="utf-8"><style>${css} body{margin:0}</style></head><body>${coverHtml(vol, EN ? "en" : "")}</body></html>`, file,
    ["--force-device-scale-factor=2.2", "--window-size=559,794"]);
}
// SVG 한 장을 PNG로(가로 px 지정). 창을 크게 찍고 pngjs로 잘라 낸다.
function svgToPng(svg, widthPx, file) {
  const vb = svg.match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/);
  const w = widthPx, h = Math.round((widthPx * +vb[2]) / +vb[1]);
  const shot = path.join(outDir, "_raw.png");
  edgeShot(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#fff}svg{display:block;width:${w}px;height:${h}px}</style></head><body>${svg}</body></html>`, shot,
    ["--force-device-scale-factor=1", `--window-size=${Math.max(w, 500)},${Math.max(h, 500)}`]);
  const src = PNG.sync.read(fs.readFileSync(shot)), out = new PNG({ width: w, height: h });
  PNG.bitblt(src, out, 0, 0, w, h, 0, 0);
  fs.writeFileSync(file, PNG.sync.write(out));
  fs.rmSync(shot);
}
const SPEAKER_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#18233f"/><path d="M3 9v6h4l5 4V5L7 9H3z" fill="#fff"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';

const READ_EPUB = `<div class="lab">전자책으로 읽을 때</div>
  <p>글자 크기를 키우거나 줄이면 줄이 화면에 맞게 다시 흐릅니다. 어두운 화면으로 읽어도 됩니다. 쪽 번호는 기기와 글자 크기에 따라 달라지고, 상자 모양은 앱마다 조금씩 다르게 보일 수 있습니다.</p>`;

function frontMain() {
  const L = book.lessons[0];
  return xhtml("이 책을 읽는 법", `<section id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
  <p>이 책은 ${esc(book.source)} 강의를 녹취하여, 내용과 예화와 순서는 하나도 빼지 않고 문장만 읽기 좋게 다듬은 것입니다. 강의가 하나씩 더해질 때마다 이 책에 한 강씩 이어 붙입니다. 강 표제, 장 제목과 소제목, 용어 상자, 한눈에 보는 이야기, 용어·인물 풀이는 정리한 사람이 덧붙였습니다.</p>
  <div class="lab">세 단계 강조</div>
  <table class="legend"><tr><td><span class="h1">노란 바탕</span></td><td>중요한 문장</td></tr>
  <tr><td><span class="h2">노란 바탕 + 굵게</span></td><td>더 중요한 문장</td></tr>
  <tr><td><span class="h3">굵게 + 빨간 밑줄</span></td><td>핵심 명제 — 이것만 이어 읽어도 흐름이 보입니다</td></tr>
  <tr><td>말씀 상자</td><td>강의에서 읽은 구절(강사가 읽은 그대로). 상자 안에도 세 단계 강조</td></tr>
  <tr><td>말씀 상자(언급)</td><td>강의에서 말로 언급한 구절(한글KJV 본문, 블레셋을 '필리스티아'로 옮김). 점선 테두리</td></tr>
  <tr><td>용어 상자</td><td>강의 밖의 낯선 말·인물을 짧게 설명한 상자</td></tr></table>
  <p>강의 화면의 그림은 싣지 않고 구절을 글로 옮겼습니다. 강마다 첫머리에 지도·그 시대 이야기·연표를 덧붙였습니다. 사무엘기상 구절의 킹제임스 영어 강의는 별도 권 「다윗의 삶 — 킹제임스 영어 강의」에 있습니다.</p>
  <div class="lab">강의 영상</div>
  <p>강 표제·장·소제목 옆의 <a class="yt" href="${ytUrl(L.vid, "0:00")}">▶ 0:00</a> 같은 빨간 시각 표시를 누르면 그 부분의 강의 영상이 바로 열립니다.</p>
  ${READ_EPUB}
  <div class="lab">책의 구성</div>
  <p>강마다: 강 표제 → 이야기의 무대와 시대 → 시작하며 → 본문 장들 → 마치며 → 한눈에 보는 이야기. 책 끝: 용어·인물 풀이(모든 강 통합).</p></section>`);
}

function frontEnglish() {
  return xhtml("이 책을 읽는 법", `<section id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
  <p>이 책은 「다윗의 삶 말씀판」의 짝이 되는 영어 강의 교재입니다. 말씀판의 각 강에서 읽거나 언급한 사무엘기상 구절을 1611년 킹제임스 성경(KJV) 영어 원문으로 다시 읽습니다. 말씀판에 강이 더해질 때마다 이 책에도 같은 번호의 강을 이어 붙입니다.</p>
  <div class="lab">한 강의 구성</div>
  <p>① <b>문법 강의</b> — 개념 설명 → 문장의 뼈대 분석 → 이렇게 틀리기 쉽습니다 → 확인해 볼까요?<br>② <b>필수 단어</b> — 단어 · 뜻 · 현대 영어 · 나온 절<br>③ <b>직독직해와 구문 강의</b> — 한 절씩: 원문 → 현대 영어 → 청크 직독직해 → 문장의 뼈대 → 구문 강의</p>
  <div class="lab">문장의 뼈대 색깔</div>
  <table class="legend"><tr><td><span class="rl r-s">주어</span></td><td>누가·무엇이</td></tr><tr><td><span class="rl r-v">동사</span></td><td>했다·이다(조동사 포함)</td></tr>
  <tr><td><span class="rl r-o">목적어·보어</span></td><td>무엇을·무엇이</td></tr><tr><td><span class="rl r-m">덧붙은 말</span></td><td>때·곳·까닭·방법 — 빼도 문장이 선다</td></tr></table>
  <div class="lab">고어와 현대 영어</div>
  <p>킹제임스 원문은 강의 대상이므로 그대로 싣고, 고어가 있는 곳에는 <span class="modtag">현대</span> 표시와 함께 오늘날 영어로 바꾼 말을 붙였습니다. 절마다 현대 영어 문장 전체도 실었습니다.</p>
  <div class="lab">듣기 버튼</div>
  <p>절마다 <b>원문 듣기</b>와 <b>현대 영어 듣기</b> 버튼이 있습니다. 누르면 Google 번역 화면이 열리고, 그곳의 스피커 단추를 누르면 미국식 영어로 읽어 줍니다(인터넷 필요).</p>
  ${READ_EPUB}</section>`);
}

// 차례 항목: [제목, 파일#위치, 깊이(0=강, 1=장, 2=소제목), 부제]
function tocItems() {
  const it = [];
  if (EN) {
    for (const L of enLessons) {
      const f = lfile(L);
      it.push([`제${L.n}강 ${L.title}`, `${f}#${kjvId(L)}`, 0, `${L.english.verses.length}절`]);
      it.push(["문법 강의", `${f}#${kjvId(L, "g")}`, 1]);
      L.english.grammar.forEach((g, i) => it.push([g.title, `${f}#${kjvId(L, "g" + i)}`, 2]));
      it.push(["필수 단어", `${f}#${kjvId(L, "w")}`, 1]);
      it.push(["직독직해와 구문 강의", `${f}#${kjvId(L, "r")}`, 1]);
    }
  } else {
    for (const L of book.lessons) {
      const f = lfile(L);
      it.push([`제${L.n}강 ${L.title}`, `${f}#${lessonId(L)}`, 0, L.range]);
      L.chapters.forEach((c, i) => {
        it.push([`${chLabel(c) ? chLabel(c) + " " : ""}${c.title}`, `${f}#${chId(L, i)}`, 1, c.sub]);
        c.secs.forEach((s, j) => it.push([s.title, `${f}#${secId(L, i, j)}`, 2]));
      });
      it.push([`한눈에 보는 ${L.n}강 이야기`, `${f}#${lessonId(L)}sum`, 1]);
    }
    it.push(["용어·인물 풀이", "gloss.xhtml#gloss", 0]);
  }
  return it;
}

function contentsXhtml() {
  const note = EN ? "차례의 제목을 누르면 그곳으로 이동합니다. 절마다 있는 <b>듣기</b> 버튼은 미국식 영어 음성으로 연결됩니다."
    : "1. 빨간 <b>▶ 시각</b>을 누르면 그 부분의 강의 영상이 열립니다.<br>2. 차례의 제목을 누르면 그곳으로 이동합니다.";
  const cls = ["tl", "tc", "ts"];
  const h = tocItems().map(([t, href, d, sub]) => `<a class="${cls[d]}" href="${href}">${esc(t)}${d === 0 && sub ? `<small>${esc(sub)}</small>` : ""}</a>${d === 1 && sub ? `<div class="tsub">${esc(sub)}</div>` : ""}`).join("");
  return xhtml("차례", `<section id="toc"><h1>차례</h1><div class="gold"></div><div class="tocnote">${note}</div><div class="toc">${h}</div></section>`);
}

async function lessonXhtml(L) {
  if (EN) return xhtml(`제${L.n}강 ${L.title} — 킹제임스 영어 강의`, `<section>${englishLessonHtml(L)}</section>`);
  const id = lessonId(L);
  let h = `<section class="lesson" id="${id}"><div class="ln">제 ${L.n} 강</div><h1>${esc(L.title)}</h1><div>${esc(L.range)}</div><div class="gold"></div>
  <table><tr><td>원 강의</td><td>${esc(L.orig)}</td></tr><tr><td>강의 날짜</td><td>${esc(L.date)}</td></tr><tr><td>강사</td><td>${esc(L.speaker)}</td></tr><tr><td>출처</td><td>${esc(book.source)}</td></tr></table>
  <p>${await videoMark(L.vid, "0:00", "epub")} 강의 영상 처음부터 보기</p></section>`;
  for (let i = 0; i < L.chapters.length; i++) h += await chapterHtml(L, L.chapters[i], i, "epub");
  h += `<section id="${id}sum"><h1>한눈에 보는 ${L.n}강 이야기</h1><div class="gold"></div><div class="added">정리한 사람이 덧붙인 글</div><ol class="sum">${L.summary.map((s) => `<li>${inline(s)}</li>`).join("")}</ol></section>`;
  return xhtml(`제${L.n}강 ${L.title}`, h);
}

function glossXhtml() {
  return xhtml("용어·인물 풀이", `<section id="gloss"><h1>용어·인물 풀이</h1><div class="gold"></div>${glossItems(book)
    .map((g) => `<div class="gl"><div class="gt">${esc(g.term)}<small>${g.lesson}강</small></div><p>${inline(g.text)}</p></div>`).join("")}</section>`);
}

function navXhtml(firstBody) {
  // 깊이에 맞춰 중첩 목록을 만든다
  let html = "", depth = -1;
  for (const [t, href, d] of tocItems()) {
    if (d > depth) html += "<ol>".repeat(d - depth);
    else { html += "</li>"; if (d < depth) html += "</ol></li>".repeat(depth - d); }
    html += `<li><a href="${href}">${esc(t)}</a>`;
    depth = d;
  }
  html += "</li>" + "</ol></li>".repeat(depth) + "</ol>";
  const head = `<li><a href="front.xhtml#howto">이 책을 읽는 법</a></li><li><a href="contents.xhtml">차례</a></li>`;
  html = html.replace(/^<ol>/, "<ol>" + head);
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko">
<head><meta charset="utf-8"/><title>차례</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><nav epub:type="toc" id="nav"><h1>차례</h1>${html}</nav>
<nav epub:type="landmarks" hidden=""><ol><li><a epub:type="cover" href="cover.xhtml">표지</a></li><li><a epub:type="toc" href="contents.xhtml">차례</a></li><li><a epub:type="bodymatter" href="${firstBody}">본문</a></li></ol></nav></body></html>`;
}

function ncx(uid) {
  let n = 0;
  const pt = (label, src, kids = "") => `<navPoint id="np${++n}" playOrder="${n}"><navLabel><text>${esc(label)}</text></navLabel><content src="${src}"/>${kids}</navPoint>`;
  let pts = pt("이 책을 읽는 법", "front.xhtml#howto") + pt("차례", "contents.xhtml");
  // 강(깊이 0)과 그 아래 장(깊이 1)까지
  const items = tocItems().filter((x) => x[2] <= 1);
  for (let i = 0; i < items.length; i++) {
    const [t, href, d] = items[i];
    if (d !== 0) continue;
    let kids = "";
    for (let j = i + 1; j < items.length && items[j][2] === 1; j++) kids += pt(items[j][0], items[j][1]);
    pts += pt(t, href, kids);
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uid}"/><meta name="dtb:depth" content="2"/></head>
<docTitle><text>${esc(vol.title)} ${esc(vol.edition)}</text></docTitle><navMap>${pts}</navMap></ncx>`;
}

fs.mkdirSync(outDir, { recursive: true });
const coverFile = path.join(outDir, `_cover_${volume}.png`);
coverPng(coverFile);
const extraImgs = [];
if (!EN) {
  const usedMaps = [...new Set(book.lessons.flatMap((L) => L.chapters.flatMap((c) => [...c.blocks, ...c.secs.flatMap((s) => s.blocks)])).filter((b) => b.t === "map").map((b) => b.key))];
  for (const k of usedMaps) { const f = path.join(outDir, `map_${k}.png`); svgToPng(MAPS[k]().svg, 1100, f); extraImgs.push([`map_${k}.png`, f]); }
} else {
  const f = path.join(outDir, "speaker.png"); svgToPng(SPEAKER_SVG, 48, f); extraImgs.push(["speaker.png", f]);
}
const uid = EN ? book.english.uid : `urn:uuid:4d1f0b2a-6a51-4c0e-9d1e-da0d1d5a${book.only ? "2" + book.only.padStart(3, "0") : "1e01"}`; // 강별 책은 강마다 다른 uid // 책이 커져도 같은 책으로 인식되도록 고정
const files = [
  ["cover.xhtml", xhtml("표지", `<div class="cover"><img src="cover.png" alt="${esc(vol.title)} 표지"/></div>`, "cover")],
  ["front.xhtml", EN ? frontEnglish() : frontMain()],
  ["contents.xhtml", contentsXhtml()],
];
for (const L of EN ? enLessons : book.lessons) files.push([lfile(L), await lessonXhtml(L)]);
if (!EN) files.push(["gloss.xhtml", glossXhtml()]);

const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="ko">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="bookid">${uid}</dc:identifier><dc:title>${esc(vol.title)} (${esc(vol.edition)})</dc:title><dc:language>ko</dc:language>
<dc:creator>${esc(book.source)} 강의 · 첫열매들 대면 B조 정리</dc:creator><meta property="dcterms:modified">${now}</meta><meta name="cover" content="cover-img"/>
</metadata>
<manifest>
<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
<item id="css" href="style.css" media-type="text/css"/>
<item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/>
${extraImgs.map(([n]) => `<item id="${n.replace(".png", "")}" href="${n}" media-type="image/png"/>`).join("\n")}
${files.map(([f, c]) => `<item id="${f.replace(".xhtml", "")}" href="${f}" media-type="application/xhtml+xml"${/<svg[\s>]/.test(c) ? ' properties="svg"' : ""}/>`).join("\n")}
</manifest>
<spine toc="ncx">
${files.map(([f]) => `<itemref idref="${f.replace(".xhtml", "")}"/>`).join("\n")}
</spine>
</package>`;

const zip = new JSZip();
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="utf-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
zip.file("OEBPS/content.opf", opf);
zip.file("OEBPS/nav.xhtml", navXhtml(files[3][0]));
zip.file("OEBPS/toc.ncx", ncx(uid));
zip.file("OEBPS/style.css", fs.readFileSync(path.join(here, "epub.css")));
zip.file("OEBPS/cover.png", fs.readFileSync(coverFile));
for (const [n, f] of extraImgs) zip.file("OEBPS/" + n, fs.readFileSync(f));
for (const [f, c] of files) zip.file("OEBPS/" + f, c);
const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
const out = path.join(outDir, vol.epubName);
fs.writeFileSync(out, buf);
fs.rmSync(coverFile);
for (const [, f] of extraImgs) fs.rmSync(f);
console.log("완성:", out, (buf.length / 1024).toFixed(0) + "KB");
