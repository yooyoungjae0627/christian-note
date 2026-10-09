// 「다윗의 삶 — 영어로 읽는 사무엘기」 PDF: node build_samuel_pdf.mjs <원본폴더> <출력폴더>
// 사무엘상 1장부터 한 절씩: 칠판(청크 직독직해) → 쉬운 설명 → 문법·구문 설명. 영어는 현대 영어(BSB)만.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as mupdf from "mupdf";
import { esc, inline } from "./parse.mjs";
import { loadSamuel } from "./samuel.mjs";
import { boardHtml, boardCss, roleLegendHtml, ROLE } from "./board.mjs";
import { coverHtml } from "./common.mjs";
import { ttsButton } from "./html.mjs";
import { edgePrint } from "./edge.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, outDir] = process.argv.slice(2);
const book = JSON.parse(fs.readFileSync(path.join(root, "book.json"), "utf8"));
const vol = { ...book, ...book.english };
const chapters = loadSamuel(root);
const cid = (C) => `${C.book === "사무엘상" ? "s1" : "s2"}c${C.n}`;
const bookEn = (C) => (C.book === "사무엘상" ? "1 Samuel" : "2 Samuel");

function howto() {
  return `<section class="front" id="howto"><h1>이 책을 읽는 법</h1><div class="gold"></div>
  <p class="bp">이 책은 사무엘상 1장부터 한 절씩 차례로 영어로 읽어 가는 <b>영어 구문·문법 교재</b>입니다. 영어 본문은 오늘날의 쉬운 현대 영어 성경인 ${esc(vol.textSource)}을 씁니다. 장이 하나씩 더해질 때마다 이 책에 이어 붙입니다.</p>
  <div class="lab">한 절의 순서</div>
  <p class="bp">① <b>칠판</b> — 선생님이 칠판에 쓰듯 한 절을 청크(의미 덩어리)로 끊어 쓰고, 그 아래 노란 분필로 직독직해를 적었습니다. 맨 아래 ★는 그 절의 핵심 한 줄입니다.<br>② <b>쉬운 설명</b> — 이 절이 무슨 이야기인지 쉽게 풀었습니다.<br>③ <b>문법·구문 설명</b> — 문장이 어떻게 짜여 있는지, 어떤 문법이 쓰였는지 설명합니다.</p>
  <div class="lab">칠판의 색 분필</div>
  <p class="bp rlgs">${roleLegendHtml()}<br>단어 밑의 색 밑줄과 그 위의 글자가 문장 성분입니다. 빨간 빗금(/)에서 끊어 앞에서부터 차례로 뜻을 붙여 읽으세요.</p>
  <div class="lab">듣기</div>
  <p class="bp">절마다 있는 <b>듣기</b> 버튼을 누르면 Google 번역 화면이 열리고, 그곳의 스피커 단추를 누르면 그 절을 미국식 영어로 읽어 줍니다(인터넷 필요). 소리 내어 따라 읽기를 권합니다.</p>
  <div class="lab">장마다 끝에</div>
  <p class="bp">그 장의 필수 단어와 문법 정리가 있습니다.</p></section>`;
}

function toc(pages) {
  const pg = (id) => `<span class="dots"></span><span class="pg">${pages[id] ?? "00"}</span>`;
  let h = `<section class="front" id="toc"><h1>차례</h1><div class="gold"></div><div class="tocnote">차례의 제목을 클릭하면 그 쪽으로 이동합니다.</div><div class="toc">`;
  for (const C of chapters) {
    const id = cid(C);
    h += `<a class="tl" href="#${id}">${C.book} ${C.n}장 · ${esc(C.title)}<small>${C.verses.length}절</small>${pg(id)}</a>`;
    h += `<div class="tvs">${C.verses.map((v) => `<a href="#${id}v${v.n}">${v.n}절 <span>${pages[id + "v" + v.n] ?? ""}</span></a>`).join("")}</div>`;
    h += `<a class="tc" href="#${id}w">${C.n}장 필수 단어${pg(id + "w")}</a><a class="tc" href="#${id}s">${C.n}장 문법 정리${pg(id + "s")}</a>`;
  }
  return h + `</div></section>`;
}

function chapterHtml(C, mk) {
  const id = cid(C);
  let h = `<section class="front schap" id="${id}">${mk(id)}<div class="chn">${C.book} ${C.n}장 · ${bookEn(C)} ${C.n}</div><h1>${esc(C.title)}</h1><div class="gold"></div>
  ${C.intro.map((p) => `<p class="bp">${inline(p)}</p>`).join("")}
  <div class="learn"><div class="lh">이 장에서 배우는 문법</div><ul>${C.learn.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></div></section>`;
  for (const v of C.verses) {
    const ref = `${bookEn(C)} ${C.n}:${v.n}`, refKo = `${C.book} ${C.n}:${v.n}`;
    h += `<div class="sv" id="${id}v${v.n}">${mk(id + "v" + v.n)}<div class="svh"><span class="svn">${C.n}장 ${v.n}절</span>${ttsButton(v.text)}</div>
    ${boardHtml({ ref, refKo, chunks: v.chunks, key: v.key })}
    <div class="lab2">쉬운 설명</div>${v.easy.map((p) => `<p class="bp">${inline(p)}</p>`).join("")}
    <div class="lab2">문법 · 구문 설명</div>${v.gram.map((p) => `<p class="bp gram">${inline(p)}</p>`).join("")}</div>`;
  }
  h += `<section class="front" id="${id}w">${mk(id + "w")}<h1>${C.book} ${C.n}장 필수 단어</h1><div class="gold"></div>
  <table class="words"><thead><tr><th>단어</th><th>뜻</th><th>나온 절</th></tr></thead><tbody>${C.words.map((w) => `<tr><td class="w">${esc(w.w)}</td><td>${esc(w.ko)}</td><td class="r">${esc(w.ref)}</td></tr>`).join("")}</tbody></table></section>`;
  h += `<section class="front" id="${id}s">${mk(id + "s")}<h1>${C.book} ${C.n}장 문법 정리</h1><div class="gold"></div><ol class="sum">${C.sum.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></section>`;
  return h;
}

function fullHtml(pages, withMarkers) {
  const mk = withMarkers ? (id) => `<span class="mk0">@@${id}@@</span>` : () => "";
  const css = fs.readFileSync(path.join(here, "print.css"), "utf8") + boardCss("fonts/") + `
.mk0{position:absolute;font-size:1px;color:#fff}
.tvs{display:flex;flex-wrap:wrap;gap:1mm 1.2mm;margin:1.4mm 0 2mm 2mm}
.tvs a{font:8pt "Noto Sans KR",sans-serif;color:#2b3a67;background:#f1efe8;border-radius:1mm;padding:.4mm 1.6mm}
.tvs a span{color:#8a7a52;margin-left:.6mm}
.schap .chn{color:#c9973b;font:700 10pt "Noto Sans KR",sans-serif;margin-top:4mm}
.learn{background:#fff7d6;border:.3mm solid #e6c766;border-radius:2mm;padding:2.4mm 4mm;margin-top:4mm}
.learn .lh{font:700 9.6pt "Noto Sans KR",sans-serif;color:#18233f;margin-bottom:1mm}
.learn ul{margin:0;padding-left:5mm;font:9pt/1.75 "Noto Sans KR",sans-serif}
.sv{margin-top:7mm}
.svh{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.6mm;break-after:avoid}
.svn{font:700 11pt "Noto Sans KR",sans-serif;color:#18233f;border-left:1.2mm solid #c9973b;padding-left:2.4mm}
.sv .lab2{font:700 8.4pt "Noto Sans KR",sans-serif;color:#2f6b5a;margin:3.4mm 0 .8mm;letter-spacing:.05em;break-after:avoid}
p.bp.gram{font-size:9.9pt}
.rlgs .rlg{display:inline-block;margin-right:3mm;font:9pt "Noto Sans KR",sans-serif}
.rlgs .rlg b{font:700 10pt "Patrick Hand",sans-serif;color:#18233f;padding:0 .6mm}
`;
  let body = coverHtml(vol, "en") + howto() + toc(pages);
  for (const C of chapters) body += chapterHtml(C, mk);
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(vol.title)} ${esc(vol.edition)}</title><style>${css}</style></head><body>${body}</body></html>`;
}

function findMarkers(file) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(file), "application/pdf");
  const pages = {};
  for (let i = 0; i < doc.countPages(); i++) for (const m of doc.loadPage(i).toStructuredText().asText().matchAll(/@@(\w+)@@/g)) if (!(m[1] in pages)) pages[m[1]] = i + 1;
  return { pages, count: doc.countPages() };
}

fs.mkdirSync(path.join(outDir, "fonts"), { recursive: true });
for (const f of fs.readdirSync(path.join(here, "fonts"))) fs.copyFileSync(path.join(here, "fonts", f), path.join(outDir, "fonts", f));
const tmp = path.join(outDir, "_pass_samuel.pdf");
let pages = {};
for (let pass = 1; pass <= 4; pass++) {
  const hf = path.join(outDir, "_pass_samuel.html");
  fs.writeFileSync(hf, fullHtml(pages, true));
  edgePrint(hf, tmp);
  const r = findMarkers(tmp);
  const same = JSON.stringify(r.pages) === JSON.stringify(pages);
  console.log(`[samuel] pass ${pass}: ${r.count}쪽, 이동점 ${Object.keys(r.pages).length}개${same ? " (변화 없음)" : ""}`);
  pages = r.pages;
  if (same) break;
}
const hf = path.join(outDir, "samuel_print.html");
fs.writeFileSync(hf, fullHtml(pages, false));
const final = path.join(outDir, vol.pdfName);
edgePrint(hf, final);
fs.rmSync(tmp);
console.log("완성:", final);
