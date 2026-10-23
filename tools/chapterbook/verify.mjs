// 장별 해설서 2판 완성본 검사 — PDF: 차례·「차례로」 버튼 등 내부 링크가 제자리로 가는지, QR을 300dpi로 실제 판독해 링크 주소와 같은지,
// 원고의 영상 근거 주소가 모두 PDF에 있는지, 책갈피가 있는지. EPUB: tools/check_epub.mjs.
//   node tools/chapterbook/verify.mjs genesis 1 2 …|all [--all-book]   (합본은 --all-book)
//   node tools/chapterbook/verify.mjs genesis unit 1 2 …            창세기 단원별 책
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { R, BOOKS, TOPIC, mod, loadChapter } from "./lib.mjs";
const args = process.argv.slice(2);
const allBook = args.includes("--all-book");
const [book, ...rest] = args.filter((a) => a !== "--all-book");
const B = BOOKS[book];
const units = rest[0] === "unit" ? await import("./units.mjs") : null;
const chs = units ? [] : rest[0] === "all" ? [...Array(B.chapters)].map((_, i) => i + 1) : rest.map(Number);
const mupdf = await mod("mupdf");
const jsQR = (await mod("jsqr")).default || (await mod("jsqr"));
const checker = path.join(TOPIC, "check_epub-chapterbook.mjs");
fs.writeFileSync(checker, fs.readFileSync(path.join(R, "tools/check_epub.mjs")));
let bad = 0;
const results = [];
function checkPdf(file, urls) {
  const doc = mupdf.Document.openDocument(fs.readFileSync(file), "application/pdf");
  const errors = []; let internal = 0, toToc = 0, qr = 0, yt = 0; const found = new Set();
  const tocPage = (() => { for (let i = 0; i < Math.min(8, doc.countPages()); i++) if (/CONTENTS/.test(doc.loadPage(i).toStructuredText().asText())) return i; return -1; })();
  for (let i = 0; i < doc.countPages(); i++) {
    const page = doc.loadPage(i), links = page.getLinks();
    for (const l of links.filter((l) => !l.isExternal())) {
      internal++;
      try { const d = doc.resolveLinkDestination(l.getURI()); if (d.page < 0 || d.page >= doc.countPages()) errors.push(`${i + 1}쪽 내부 링크 목적지 이상`); if (d.page === tocPage && i !== tocPage) toToc++; }
      catch (e) { errors.push(`${i + 1}쪽 깨진 내부 링크 ${e.message}`); }
    }
    const video = links.filter((l) => l.isExternal() && /youtu/.test(l.getURI()));
    yt += video.length; video.forEach((l) => found.add(l.getURI()));
    const qrs = video.filter((l) => { const b = l.getBounds(); const w = b[2] - b[0], h = b[3] - b[1]; return w > 30 && w < 50 && h > 30 && Math.abs(w - h) < 4; });
    if (qrs.length) {
      const s = 300 / 72, pm = page.toPixmap(mupdf.Matrix.scale(s, s), mupdf.ColorSpace.DeviceRGB, false, true);
      const px = pm.getPixels(), W = pm.getWidth(), H = pm.getHeight(), n = pm.getNumberOfComponents();
      for (const l of qrs) {
        const b = l.getBounds();
        const x0 = Math.max(0, Math.floor((b[0] - 4) * s)), y0 = Math.max(0, Math.floor((b[1] - 4) * s)), x1 = Math.min(W, Math.ceil((b[2] + 4) * s)), y1 = Math.min(H, Math.ceil((b[3] + 4) * s));
        const w = x1 - x0, h = y1 - y0, rgba = new Uint8ClampedArray(w * h * 4);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const a = ((y + y0) * W + x + x0) * n, c = (y * w + x) * 4; rgba[c] = px[a]; rgba[c + 1] = px[a + 1]; rgba[c + 2] = px[a + 2]; rgba[c + 3] = 255; }
        const dec = jsQR(rgba, w, h);
        if (dec?.data === l.getURI()) qr++; else errors.push(`${i + 1}쪽 QR 판독 불일치: ${dec?.data ?? "판독 실패"}`);
      }
      pm.destroy();
    }
  }
  for (const u of urls) if (!found.has(u)) errors.push(`영상 근거 주소가 PDF에 없음 ${u}`);
  const outline = doc.loadOutline() || [];
  if (!outline.length) errors.push("책갈피 없음");
  if (tocPage < 0) errors.push("차례 쪽 없음");
  return { pages: doc.countPages(), internal, toToc, youtube: yt, qr, outline: outline.length, errors };
}
const targets = units ? rest.slice(1).map(Number).map((n) => { const u = units.loadUnit(n); return { name: units.unitOut(u), urls: u.parts.flatMap((x) => urlsOf(x.d)) }; }) : allBook ? [{ name: B.all, urls: chs.flatMap((c) => urlsOf(loadChapter(book, c))) }] : chs.map((c) => ({ name: B.out(c), urls: urlsOf(loadChapter(book, c)) }));
function urlsOf(d) { return [...new Set(d.sections.flatMap((s) => s.comments.flatMap((c) => c.evidence.filter((e) => e.url && e.type === "transcript").map((e) => e.url))))]; }
for (const t of targets) {
  const pdf = path.join(R, B.dir, t.name + ".pdf"), epub = pdf.replace(/\.pdf$/, ".epub");
  if (!fs.existsSync(pdf) || !fs.existsSync(epub)) { console.log(`${t.name}: 파일 없음`); bad++; continue; }
  const r = checkPdf(pdf, t.urls);
  let ep = "통과";
  try { execFileSync(process.execPath, [checker, epub], { stdio: "pipe" }); } catch (e) { ep = "실패 " + String(e.stdout || e.message).slice(0, 300); r.errors.push("EPUB " + ep); }
  if (r.errors.length) bad++;
  results.push({ file: t.name, ...r, epub: ep });
  console.log(`${t.name}: ${r.errors.length ? "실패" : "통과"} · ${r.pages}쪽 · 내부 링크 ${r.internal}(차례로 ${r.toToc}) · 유튜브 링크 ${r.youtube} · QR 판독 ${r.qr} · 책갈피 ${r.outline} · EPUB ${ep}`);
  for (const e of r.errors.slice(0, 10)) console.log("   - " + e);
}
fs.writeFileSync(path.join(R, BOOKS[book].src, allBook ? "verify-all.json" : `verify-${rest.join("_") || "x"}.json`.slice(0, 80)), JSON.stringify(results, null, 1));
process.exit(bad ? 1 : 0);
