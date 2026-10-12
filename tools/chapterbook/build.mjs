// 장별 해설서 2판 빌드 — 원고(JSON) → HTML → Edge 인쇄 → 차례 쪽수 맞춤 → mupdf 책갈피 → 고정 배치 EPUB.
//   node tools/chapterbook/build.mjs genesis 12 [13 …]     장별 책
//   node tools/chapterbook/build.mjs genesis all             합본(장별 원고를 그대로 묶음)
//   --out <폴더>  결과를 다른 폴더에(샘플용). 기본은 Genesis/ 또는 Samuel/
// Edge 인쇄는 Claude Code 샌드박스 밖에서 실행한다(README 빌드 환경 메모).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { R, TMP, BOOKS, TOPIC, mod, loadChapter, esc } from "./lib.mjs";
import { chapterParts, learning, sourcesTable, toc, page, howto, cover, qrFile } from "./html.mjs";
import { coverSvg } from "./art.mjs";
import { edgePrint } from "../../David/원본/tools/edge.mjs";

const args = process.argv.slice(2);
const oi = args.indexOf("--out"); const OUTDIR = oi >= 0 ? path.resolve(args.splice(oi, 2)[1]) : null;
const [book, ...rest] = args;
const B = BOOKS[book];
if (!B) { console.error("사용법: build.mjs genesis|1sam|2sam <장…|all>"); process.exit(2); }
const mupdf = await mod("mupdf");
const QR = await mod("qrcode");
const marker = (k) => `<span class="marker">@@${k}@@</span>`;

async function ensureQr(urls) {
  fs.mkdirSync(path.join(TMP, "qr"), { recursive: true });
  for (const u of urls) { const f = qrFile(u); if (!fs.existsSync(f)) await (QR.default || QR).toFile(f, u, { margin: 1, width: 360, errorCorrectionLevel: "M" }); }
}
const urlsOf = (d) => d.sections.flatMap((s) => s.comments.flatMap((c) => c.evidence.filter((e) => e.url && e.type !== "external").map((e) => e.url)));

function measure(pdfFile) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(pdfFile), "application/pdf");
  const found = {};
  for (let i = 0; i < doc.countPages(); i++) {
    const t = doc.loadPage(i).toStructuredText().asText().replace(/\s+/g, "");
    for (const m of t.matchAll(/@@([\w-]+)@@/g)) found[m[1]] ??= i + 1;
  }
  return { found, pages: doc.countPages() };
}
function finish(raw, final, title, nav, pages) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(raw), "application/pdf");
  // 같은 자리에 겹친 링크(Edge가 a 안의 요소마다 만든 것) 정리
  let removed = 0;
  for (let i = 0; i < doc.countPages(); i++) {
    const pg = doc.loadPage(i); const links = pg.getLinks(); const seen = new Set();
    for (const l of links) { const b = l.getBounds().map((n) => Math.round(n)); const k = l.getURI() + "|" + b.join(","); if (seen.has(k)) { pg.deleteLink(l); removed++; } else seen.add(k); }
  }
  doc.setMetaData("info:Title", title); doc.setMetaData("info:Author", "성도 유영재");
  const it = doc.outlineIterator();
  const stack = [];
  for (const [key, label, lvl] of nav) {
    const uri = doc.formatLinkURI({ type: "Fit", chapter: 0, page: pages[key] - 1 });
    while (stack.length > lvl) { it.up(); stack.pop(); }
    if (lvl > stack.length) { /* 들여쓰기: 바로 앞 항목 아래로 */ it.prev(); it.down(); stack.push(1); }
    it.insert({ title: label, uri, open: false });
  }
  fs.writeFileSync(final, doc.saveToBuffer("compress,garbage").asUint8Array());
  return removed;
}
async function epub(final) {
  const tool = path.join(TOPIC, "pdf2epub-chapterbook.mjs");
  fs.writeFileSync(tool, fs.readFileSync(path.join(R, "tools/pdf2epub.mjs")));
  const out = final.replace(/\.pdf$/, ".epub");
  execFileSync(process.execPath, [tool, final, out, "--width", "1150", "--quality", "78"], { stdio: "inherit" });
  // 쪽마다 보이지 않는 글자 층(본문 검색·대조용)
  const J = await mod("jszip"); const JSZip = J.loadAsync ? J : J.default;
  const zip = await JSZip.loadAsync(fs.readFileSync(out));
  const doc = mupdf.Document.openDocument(fs.readFileSync(final), "application/pdf");
  for (const name of Object.keys(zip.files)) {
    const m = name.match(/^OEBPS\/p(\d+)\.xhtml$/); if (!m) continue;
    const text = doc.loadPage(+m[1] - 1).toStructuredText().asText();
    const x = (await zip.file(name).async("string")).replace("</body>", `<div class="text-layer">${esc(text)}</div></body>`);
    zip.file(name, x);
  }
  const css = Object.keys(zip.files).find((n) => /\.css$/.test(n));
  if (css) zip.file(css, (await zip.file(css).async("string")) + ".text-layer{position:absolute;left:0;top:0;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden;font-size:1px;line-height:1px;}");
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  fs.writeFileSync(out, await zip.generateAsync({ type: "nodebuffer", mimeType: "application/epub+zip", compression: "DEFLATE" }));
  return out;
}
function printLoop(name, render) {
  const hf = path.join(TMP, name + ".html"), raw = path.join(TMP, name + "-raw.pdf");
  let pages = {}, nav;
  for (let pass = 0; pass < 5; pass++) {
    const r = render(pages, true); nav = r.nav;
    fs.writeFileSync(hf, r.html); edgePrint(hf, raw);
    const { found, pages: n } = measure(raw);
    const miss = nav.map((x) => x[0]).filter((k) => !found[k]);
    if (miss.length) throw new Error(`${name}: 쪽 표시를 찾지 못함 ${miss.join(",")}`);
    console.log(`${name} 패스 ${pass + 1}: ${n}쪽`);
    if (JSON.stringify(found) === JSON.stringify(pages)) break;
    pages = found;
  }
  const r = render(pages, false); fs.writeFileSync(hf, r.html); edgePrint(hf, raw);
  return { raw, nav: r.nav, pages };
}

const outDir = OUTDIR || path.join(R, B.dir);
fs.mkdirSync(outDir, { recursive: true });
const results = [];
if (rest[0] === "all") {
  // 합본: all [시작-끝 권번호]  예) all 1-13 1  → 창세기_합본_1-1권(01-13장)
  const [r0, r1] = (rest[1] || `1-${B.chapters}`).split("-").map(Number); const vol = rest[2];
  const chs = [...Array(r1 - r0 + 1)].map((_, i) => r0 + i);
  const bookNo = { genesis: 1, "1sam": 2, "2sam": 3 }[book];
  const pad = (n) => String(n).padStart(2, "0");
  const allName = vol ? `${B.ko}_합본_${bookNo}-${vol}권(${pad(r0)}-${pad(r1)}장)` : B.all;
  const ds = chs.map((c) => loadChapter(book, c));
  await ensureQr(ds.flatMap(urlsOf));
  const render = (pages, withMk) => {
    const mk = withMk ? marker : () => "";
    let nav = [], body = "", allC = [];
    for (const [i, d] of ds.entries()) {
      const ch = chs[i], p = `c${ch}-`;
      const a = chapterParts(book, ch, d, { p, qr: true, mk });
      const l = learning(book, ch, d, a.comments, { p, mk, inBook: true });
      nav.push([p + "chapter", `${ch}장 ${d.subtitle}`, 0], ...a.nav.slice(1).map(([k, t]) => [k, t, 1]), ...l.nav.map(([k, t]) => [k, t, 1]));
      body += a.html + l.html; allC.push(...Object.values(a.comments));
    }
    nav.push(["sources", "참고한 자료", 0]);
    const tocNav = nav.filter((x) => x[2] === 0);
    const html = cover(book, vol ? `${B.ko}<br/>합본 ${bookNo}-${vol}권` : `${B.ko}<br/>합본 해설`, `${B.ko} ${r0}–${r1}장 — 교회 강의와 교리로 풀어 읽기`, coverSvg(ds[0].cover), ds[0].motto) + howto(book, mk) + toc(tocNav, pages, mk) + body + sourcesTable(allC, mk);
    return { html: page(`${B.ko} 합본 성경 공부 교재`, html), nav };
  };
  const { raw, nav, pages } = printLoop(`${book}-all-${r0}`, render);
  const final = path.join(outDir, allName + ".pdf");
  finish(raw, final, allName, nav, pages);
  results.push({ book, chapter: "all", pdf: final, epub: await epub(final) });
} else {
  const failed = [];
  for (const ch of rest.map(Number)) {
   try {
    const d = loadChapter(book, ch);
    await ensureQr(urlsOf(d));
    const render = (pages, withMk) => {
      const mk = withMk ? marker : () => "";
      const a = chapterParts(book, ch, d, { qr: true, mk });
      const l = learning(book, ch, d, a.comments, { mk });
      const nav = [...a.nav, ...l.nav, ["sources", "참고한 자료", 0]];
      const html = cover(book, `${B.ko}<br/>${ch}장 해설`, `${d.subtitle} — 교회 강의와 교리로 풀어 읽기`, coverSvg(d.cover), d.motto) + howto(book, mk) + toc(nav, pages, mk) + a.html + l.html + sourcesTable(Object.values(a.comments), mk);
      return { html: page(`${B.ko} ${ch}장 성경 공부 교재`, html), nav };
    };
    const { raw, nav, pages } = printLoop(`${book}-${ch}`, render);
    const final = path.join(outDir, B.out(ch) + ".pdf");
    const removed = finish(raw, final, B.out(ch), nav, pages);
    results.push({ book, chapter: ch, pdf: final, epub: await epub(final), dupLinksRemoved: removed });
   } catch (e) { console.error(`!! ${book} ${ch}장 빌드 실패: ${e.message}`); failed.push(ch); }
  }
  if (failed.length) { console.error("실패한 장: " + failed.join(" ")); process.exitCode = 1; }
}
console.log(JSON.stringify(results, null, 1));
