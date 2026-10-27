// 성경 주제별 교재 PDF 빌드: node build_pdf.mjs <원본폴더> <출력폴더>
// 이야기가 더해질 때마다 책 전체를 다시 찍어 같은 이름으로 덮어쓴다.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as mupdf from "mupdf";
import { loadBook, esc, ordinal, tocId, sid } from "./parse.mjs";
import { chapterHtml, storyTitleHtml, summaryHtml, quizHtml, answersHtml, faqHtml, glossHtml, tocItems, videoMark } from "./html.mjs";
import { coverHtml } from "./common.mjs";
import { edgePrint } from "./edge.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, outDir] = process.argv.slice(2);
const book = loadBook(root);

async function howto() {
  const vid = book.stories[0].vid, sample = vid ? await videoMark(vid, "0:00") : "";
  return `<section class="front" id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
  <p class="bp">이 책은 「${book.series}」 시리즈의 한 권으로, 첫열매들(FIRSTFRUITS) 예배 강의 <b>하나를 한 권</b>으로 엮은 교재입니다. 강의를 녹취하여 내용과 예화와 순서는 하나도 빼지 않고 문장만 읽기 좋게 다듬었습니다. 장 제목과 소제목, 그림 캡션, 용어 상자, 뒷부분(한눈에 보는 이야기, 개념 문제, 예상 질문과 답변, 용어·인물 풀이)은 정리한 사람이 덧붙였습니다.</p>
  <div class="lab">세 단계 강조</div>
  <table class="legend"><tr><td><span class="h1">노란 바탕</span></td><td>중요한 문장</td></tr>
  <tr><td><span class="h2">노란 바탕 + 굵게</span></td><td>더 중요한 문장</td></tr>
  <tr><td><span class="h3">굵게 + 빨간 밑줄</span></td><td>핵심 명제 — 이것만 이어 읽어도 흐름이 보입니다</td></tr>
  <tr><td><span class="lgbox v">성경 구절 상자</span></td><td>강의 슬라이드의 구절을 글자 그대로 옮긴 상자</td></tr>
  <tr><td><span class="lgbox n">용어 상자</span></td><td>강의 밖의 낯선 말·인물을 짧게 설명한 상자</td></tr></table>
  ${vid ? `<div class="lab">강의 영상 QR</div>
  <div class="howqr">${sample}<p>장·소제목 옆과 답안, 예상 질문 옆의 QR을 <b>휴대폰 카메라로 비추면</b> 그 부분의 강의 영상이 바로 열립니다. PDF로 볼 때는 <b>QR이나 <span class="red">▶ 시각을 클릭하면 해당 구간으로 이동합니다.</span></b></p></div>` : `<div class="lab">강의 영상</div>
  <p class="bp">이 강의는 유튜브 링크를 받지 않아 영상 구간 이동(QR·▶)이 없습니다.</p>`}
  <div class="lab">이야기 표제 쪽</div>
  <p class="bp">이야기마다 첫 쪽에 원 강의 정보와 <b>그 이야기의 강의 그림 색깔 표</b>가 있습니다. 왼쪽 아래의 <span class="totoc demo"><span class="arr">◀</span> 목차로 이동</span> 단추를 누르면 차례에서 그 이야기 항목으로 돌아갑니다. 각 장과 뒷부분 제목 아래에도 같은 단추가 있어, 누르면 차례의 그 장 항목으로 갑니다.</p>
  <div class="lab">책의 구성</div>
  <p class="bp">이 책을 읽는 법 → 차례 → [이야기 표제 → 시작하며 → 본문 장들 → 마치며 → 한눈에 보는 이야기 → 개념 문제 → 답안 → 예상 질문과 답변 → 용어·인물 풀이]</p></section>`;
}

function toc(pages) {
  const pg = (id) => `<span class="dots"></span><span class="pg">${pages[id] ?? "00"}</span>`;
  let h = `<section class="front" id="toc"><h1>차례</h1><div class="gold"></div>
  <div class="tocnote">${book.stories[0].vid ? `1. 각 제목 옆의 <b>QR을 휴대폰 카메라로 비추면</b> 그 부분의 강의 영상이 열립니다.<br>2. PDF로 볼 때는 <b>QR이나</b> <span class="red">▶ 시각을 클릭하면 해당 구간으로 이동</span>하고, 차례의 제목을 클릭하면 그 쪽으로 이동합니다.` : `차례의 제목을 클릭하면 그 쪽으로 이동합니다.`}</div><div class="toc">`;
  for (const S of book.stories) {
    const cls = ["tl", "tc", "ts"];
    h += `<div class="tstory" id="${tocId(S)}">`;
    for (const [t, id, d, sub] of tocItems(S)) {
      h += `<a class="${cls[d]}"${d ? ` id="toc-${id}"` : ""} href="#${id}">${esc(t)}${pg(id)}</a>`;
      if (d === 0 && sub) h += `<div class="tsub0">${esc(sub)}</div>`;
      else if (d === 1 && sub) h += `<div class="tsub">${esc(sub)}</div>`;
    }
    h += `</div>`;
  }
  return h + `</div></section>`;
}

async function fullHtml(pages, withMarkers) {
  const marker = withMarkers ? (id) => `<span class="mk">@@${id}@@</span>` : () => "";
  let body = coverHtml(book) + (await howto()) + toc(pages);
  for (const S of book.stories) {
    body += await storyTitleHtml(book, S, marker);
    for (let i = 0; i < S.chapters.length; i++) body += await chapterHtml(S, S.chapters[i], i, marker);
    body += summaryHtml(S, marker) + quizHtml(S, marker) + (await answersHtml(S, marker)) + (await faqHtml(book, S, marker)) + glossHtml(S, marker);
  }
  const css = fs.readFileSync(path.join(here, "print.css"), "utf8");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(book.title)}</title><style>${css}</style></head><body>${body}</body></html>`;
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
    const pg = doc.loadPage(i), st = pg.toStructuredText(), t = st.asText();
    st.destroy(); pg.destroy(); // 1600쪽이 넘으면 놓아 주지 않을 때 WASM 메모리가 바닥남
    for (const m of t.matchAll(/@@([\w-]+)@@/g)) if (!(m[1] in pages)) pages[m[1]] = i + 1;
  }
  const count = doc.countPages();
  doc.destroy();
  return { pages, count };
}

fs.mkdirSync(outDir, { recursive: true });
const tmp = path.join(outDir, "_pass.pdf");
let pages = {};
// fit.mjs가 그림 위치를 시험할 때: 한 번만 찍고 끝(차례 쪽 번호는 맞추지 않음)
if (process.env.FAST) {
  render(await fullHtml({}, true), tmp);
  fs.writeFileSync(path.join(outDir, "toc_pages_fast.json"), JSON.stringify(findMarkers(tmp).pages));
  process.exit(0);
}
for (let pass = 1; pass <= 5; pass++) {
  render(await fullHtml(pages, true), tmp);
  const r = findMarkers(tmp);
  const same = JSON.stringify(r.pages) === JSON.stringify(pages);
  console.log(`pass ${pass}: ${r.count}쪽, 이동점 ${Object.keys(r.pages).length}개${same ? " (변화 없음)" : ""}`);
  pages = r.pages;
  if (same) break;
}
// Edge(Chromium)는 이동점(named destination)의 높이를 쪽 위 여백(16mm)만큼 덜 내려 적는다.
// 그대로 두면 「목차로 이동」을 눌렀을 때 차례 항목이 화면 맨 위가 아니라 16mm 아래에 온다 → 여백만큼 바로잡는다.
const TOP_MARGIN_PT = (16 * 72) / 25.4;
function fixDests(file) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(file), "application/pdf");
  const dests = doc.getTrailer().get("Root").get("Dests");
  let n = 0;
  dests.forEach((v) => {
    const arr = v.resolve();
    if (arr.get(1).asName() !== "XYZ") return;
    arr.put(3, arr.get(3).asNumber() - TOP_MARGIN_PT);
    n++;
  });
  fs.writeFileSync(file, doc.saveToBuffer("compress").asUint8Array());
  return n;
}

const final = path.join(outDir, book.pdfName);
render(await fullHtml(pages, false), final);
console.log(`이동점 높이 바로잡음: ${fixDests(final)}개`);
fs.rmSync(tmp); fs.rmSync(tmp.replace(/\.pdf$/, ".html"));
fs.writeFileSync(path.join(outDir, "toc_pages.json"), JSON.stringify(pages, null, 1));
console.log("완성:", final);
