// 다윗의 삶 PDF 빌드: node build_pdf.mjs <원본폴더> <출력폴더> [main|english]
//   main    : 「다윗의 삶 말씀판」 — 본문 강의
//   english : 「다윗의 삶 킹제임스 영어 강의」 — 별도 권(사용자 지시, 2026-10-02)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import os from "os";
import * as mupdf from "mupdf";
import { loadBook, esc, inline } from "./parse.mjs";
import { coverHtml, glossItems } from "./common.mjs";
import { chapterHtml, chLabel, chId, secId, lessonId, videoMark, englishLessonHtml, kjvId } from "./html.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, outDir, volume = "main"] = process.argv.slice(2);
const book = loadBook(root);
const EN = volume === "english";
const vol = EN ? { ...book, ...book.english } : book;
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);

function intro() {
  if (!book.intro) return ""; // 사용자 지시(2026-10-02): 들어가며 쪽을 싣지 않는다
  return `<section class="front" id="intro"><h1>들어가며</h1><div class="gold"></div>${book.intro.map((p) => `<p class="bp">${esc(p)}</p>`).join("")}
  <div class="cor">${book.cor.map((p) => `<p>${esc(p)}</p>`).join("")}<div class="vs">${esc(book.corSrc)}</div></div></section>`;
}

async function howtoMain() {
  const L = book.lessons[0];
  const sample = await videoMark(L.vid, "0:00", "pdf");
  return `<section class="front" id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
  <p class="bp">이 책은 ${esc(book.source)} 강의를 녹취하여, 내용과 예화와 순서는 하나도 빼지 않고 문장만 읽기 좋게 다듬은 것입니다. 강의가 하나씩 더해질 때마다 이 책에 한 강씩 이어 붙입니다. 강 표제 쪽, 장 제목과 소제목, 용어 상자, 한눈에 보는 이야기, 용어·인물 풀이는 정리한 사람이 덧붙였습니다.</p>
  <div class="lab">세 단계 강조</div>
  <table class="legend"><tr><td><span class="h1">노란 바탕</span></td><td>중요한 문장</td></tr>
  <tr><td><span class="h2">노란 바탕 + 굵게</span></td><td>더 중요한 문장</td></tr>
  <tr><td><span class="h3">굵게 + 빨간 밑줄</span></td><td>핵심 명제 — 이것만 이어 읽어도 흐름이 보입니다</td></tr>
  <tr><td><span style="background:#f7f1e3;border-left:1mm solid #8a7a52;padding:0 2mm">말씀 상자</span></td><td>강의에서 읽은 구절(강사가 읽은 그대로). 상자 안에도 세 단계 강조</td></tr>
  <tr><td><span style="background:#f7f1e3;border-left:1mm dashed #b39a5f;padding:0 2mm">말씀 상자(언급)</span></td><td>강의에서 말로 언급한 구절(한글KJV 본문, 블레셋을 '필리스티아'로 옮김)</td></tr>
  <tr><td><span style="background:#eef3f8;border-left:1mm solid #6b8bb5;padding:0 2mm">용어 상자</span></td><td>강의 밖의 낯선 말·인물을 짧게 설명한 상자</td></tr></table>
  <p class="bp" style="margin-top:2.5mm">강의 화면의 그림은 싣지 않고 구절을 글로 옮겼습니다. 강마다 첫머리에 지도·그 시대 이야기·연표를 덧붙였습니다. 사무엘기상 구절의 킹제임스 영어 강의는 별도 권 「다윗의 삶 — 킹제임스 영어 강의」에 있습니다.</p>
  <div class="lab">강의 영상 QR</div>
  <div class="howqr">${sample}<p>강 표제·장·소제목 옆의 QR을 <b>휴대폰 카메라로 비추면</b> 그 부분의 강의 영상이 바로 열립니다. PDF로 볼 때는 <b>QR이나 <span style="color:#c0392b">▶ 시각을 클릭하면 해당 구간으로 이동합니다.</span></b></p></div>
  <div class="lab">책의 구성</div>
  <p class="bp">강마다: 강 표제 → 이야기의 무대와 시대 → 시작하며 → 본문 장들 → 마치며 → 한눈에 보는 이야기. 책 끝: 용어·인물 풀이(모든 강 통합).</p></section>`;
}

function howtoEnglish() {
  return `<section class="front" id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
  <p class="bp">이 책은 「다윗의 삶 말씀판」의 짝이 되는 영어 강의 교재입니다. 말씀판의 각 강에서 읽거나 언급한 사무엘기상 구절을 1611년 킹제임스 성경(KJV) 영어 원문으로 다시 읽습니다. 말씀판에 강이 더해질 때마다 이 책에도 같은 번호의 강을 이어 붙입니다.</p>
  <div class="lab">한 강의 구성</div>
  <p class="bp">① <b>문법 강의</b> — 그 강 구절에 나오는 킹제임스 영어의 구문 해석 원리. 개념 설명 → 문장의 뼈대 분석 → 이렇게 틀리기 쉽습니다 → 확인해 볼까요?<br>② <b>필수 단어</b> — 단어 · 뜻 · 현대 영어 · 나온 절<br>③ <b>직독직해와 구문 강의</b> — 한 절씩: 원문 → 현대 영어 → 청크 직독직해 → 문장의 뼈대 → 구문 강의</p>
  <div class="lab">문장의 뼈대 색깔</div>
  <table class="legend"><tr><td><span class="rl r-s">주어</span></td><td>누가·무엇이</td></tr>
  <tr><td><span class="rl r-v">동사</span></td><td>했다·이다(조동사 포함)</td></tr>
  <tr><td><span class="rl r-o">목적어·보어</span></td><td>무엇을·무엇이</td></tr>
  <tr><td><span class="rl r-m">덧붙은 말</span></td><td>때·곳·까닭·방법 — 빼도 문장이 선다</td></tr></table>
  <div class="lab">고어와 현대 영어 · 듣기</div>
  <p class="bp">킹제임스 원문은 그대로 싣고, 고어(thou·hath·unto·spake 같은 옛 형태)에는 <span class="modtag">현대</span> 표시로 오늘날 영어를 붙였습니다. 절마다 <b>원문 듣기 · 현대 영어 듣기</b> 버튼을 누르면 Google 번역이 열리고, 그곳의 스피커 단추로 미국식 발음을 듣습니다(인터넷 필요).</p></section>`;
}

function toc(pages) {
  const pg = (id) => `<span class="dots"></span><span class="pg">${pages[id] ?? "00"}</span>`;
  const note = EN
    ? `<div class="tocnote">차례의 제목을 클릭하면 그 쪽으로 이동합니다. 절마다 있는 <b>듣기</b> 버튼은 미국식 영어 음성으로 연결됩니다.</div>`
    : `<div class="tocnote">1. 각 제목 옆의 <b>QR을 휴대폰 카메라로 비추면</b> 그 부분의 강의 영상이 열립니다.<br>2. PDF로 볼 때는 <b>QR이나</b> <span class="red">▶ 시각을 클릭하면 해당 구간으로 이동</span>하고, 차례의 제목을 클릭하면 그 쪽으로 이동합니다.</div>`;
  let h = `<section class="front" id="toc"><h1>차례</h1><div class="gold"></div>${note}<div class="toc">`;
  if (EN) {
    for (const L of book.lessons.filter((L) => L.english)) {
      h += `<a class="tl" href="#${kjvId(L)}">제${L.n}강 ${esc(L.title)}<small>${L.english.verses.length}절</small>${pg(kjvId(L))}</a>`;
      h += `<a class="tc" href="#${kjvId(L, "g")}">문법 강의${pg(kjvId(L, "g"))}</a>`;
      L.english.grammar.forEach((g, i) => { h += `<a class="ts" href="#${kjvId(L, "g" + i)}">${esc(g.title)}${pg(kjvId(L, "g" + i))}</a>`; });
      h += `<a class="tc" href="#${kjvId(L, "w")}">필수 단어${pg(kjvId(L, "w"))}</a>`;
      h += `<a class="tc" href="#${kjvId(L, "r")}">직독직해와 구문 강의${pg(kjvId(L, "r"))}</a>`;
    }
  } else {
    for (const L of book.lessons) {
      h += `<a class="tl" href="#${lessonId(L)}">제${L.n}강 ${esc(L.title)}<small>${esc(L.range)}</small>${pg(lessonId(L))}</a>`;
      L.chapters.forEach((c, i) => {
        const lab = chLabel(c);
        h += `<a class="tc" href="#${chId(L, i)}">${lab ? lab + " " : ""}${esc(c.title)}${pg(chId(L, i))}</a>`;
        if (c.sub) h += `<div class="tsub">${esc(c.sub)}</div>`;
        c.secs.forEach((s, j) => { h += `<a class="ts" href="#${secId(L, i, j)}">${esc(s.title)}${pg(secId(L, i, j))}</a>`; });
      });
      h += `<a class="tc" href="#${lessonId(L)}sum">한눈에 보는 ${L.n}강 이야기${pg(lessonId(L) + "sum")}</a>`;
    }
    h += `<a class="tb" href="#gloss">용어·인물 풀이${pg("gloss")}</a>`;
  }
  return h + `</div></section>`;
}

async function lessonHtml(L, marker) {
  const id = lessonId(L);
  let h = `<section class="lesson" id="${id}">${marker(id)}<div class="ln">제 ${L.n} 강</div><h1>${esc(L.title)}</h1><div class="lr">${esc(L.range)}</div><div class="gold"></div>
  <table><tr><td>원 강의</td><td>${esc(L.orig)}</td></tr><tr><td>강의 날짜</td><td>${esc(L.date)}</td></tr><tr><td>강사</td><td>${esc(L.speaker)}</td></tr><tr><td>출처</td><td>${esc(book.source)}</td></tr></table>
  <div class="lq">${await videoMark(L.vid, "0:00", "pdf")}</div></section>`;
  for (let i = 0; i < L.chapters.length; i++) h += await chapterHtml(L, L.chapters[i], i, "pdf", marker);
  h += `<section class="front" id="${id}sum">${marker(id + "sum")}<h1>한눈에 보는 ${L.n}강 이야기</h1><div class="gold"></div><div class="added">정리한 사람이 덧붙인 글</div><ol class="sum">${L.summary.map((s) => `<li>${inline(s)}</li>`).join("")}</ol></section>`;
  return h;
}

function gloss(marker) {
  return `<section class="front" id="gloss">${marker("gloss")}<h1>용어·인물 풀이</h1><div class="gold"></div>${glossItems(book)
    .map((g) => `<div class="gl"><div class="gt">${esc(g.term)}<small>${g.lesson}강</small></div><p>${inline(g.text)}</p></div>`).join("")}</section>`;
}

async function fullHtml(pages, withMarkers) {
  const marker = withMarkers ? (id) => `<span class="mk">@@${id}@@</span>` : () => "";
  let body = coverHtml(vol, EN ? "en" : "");
  if (EN) {
    body += howtoEnglish() + toc(pages);
    for (const L of book.lessons.filter((L) => L.english)) body += `<section class="front enbook">${englishLessonHtml(L, marker)}</section>`;
  } else {
    body += intro() + (await howtoMain()) + toc(pages);
    for (const L of book.lessons) body += await lessonHtml(L, marker);
    body += gloss(marker);
  }
  const css = fs.readFileSync(path.join(here, "print.css"), "utf8");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(vol.title)} ${esc(vol.edition)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

// Edge 명령줄 인쇄(이 PC의 Edge는 원격 제어를 막아 puppeteer를 쓸 수 없다)
export function edgePrint(htmlFile, pdfFile) {
  const prof = path.join(os.tmpdir(), "dw_edge_" + process.pid);
  if (fs.existsSync(pdfFile)) fs.rmSync(pdfFile);
  execFileSync(EDGE, ["--headless=new", "--no-first-run", "--disable-gpu", "--user-data-dir=" + prof, "--no-pdf-header-footer",
    "--virtual-time-budget=15000", "--run-all-compositor-stages-before-draw", "--print-to-pdf=" + path.resolve(pdfFile),
    "file:///" + path.resolve(htmlFile).split(path.sep).join("/")], { stdio: "ignore", timeout: 180000 });
  // Edge가 실행기 프로세스만 먼저 끝내는 경우가 있어 파일이 다 써질 때까지 기다린다
  let last = -1;
  for (let i = 0; i < 240; i++) {
    const sz = fs.existsSync(pdfFile) ? fs.statSync(pdfFile).size : -1;
    if (sz > 0 && sz === last) return;
    last = sz;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error("Edge 인쇄 실패: " + pdfFile);
}
function render(html, file) {
  const hf = file.replace(/\.pdf$/, ".html");
  fs.writeFileSync(hf, html);
  edgePrint(hf, file);
}

function findMarkers(file) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(file), "application/pdf");
  const pages = {};
  for (let i = 0; i < doc.countPages(); i++) {
    const t = doc.loadPage(i).toStructuredText().asText();
    for (const m of t.matchAll(/@@([\w]+)@@/g)) if (!(m[1] in pages)) pages[m[1]] = i + 1;
  }
  return { pages, count: doc.countPages() };
}

fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(outDir, `_pass_${volume}.pdf`);
let pages = {};
for (let pass = 1; pass <= 4; pass++) {
  render(await fullHtml(pages, true), tmp);
  const r = findMarkers(tmp);
  const same = JSON.stringify(r.pages) === JSON.stringify(pages);
  console.log(`[${volume}] pass ${pass}: ${r.count}쪽, 이동점 ${Object.keys(r.pages).length}개${same ? " (변화 없음)" : ""}`);
  pages = r.pages;
  if (same) break;
}
const final = path.join(outDir, vol.pdfName);
render(await fullHtml(pages, false), final);
fs.rmSync(tmp);
fs.writeFileSync(path.join(outDir, `toc_pages_${volume}.json`), JSON.stringify(pages, null, 1));
console.log("완성:", final);
