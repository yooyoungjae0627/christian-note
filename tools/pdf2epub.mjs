// PDF → 고정 배치(fixed-layout) EPUB3. 원고(빌드 원본)가 없고 완성 PDF만 있는 교재(밀크 시리즈)에 쓴다.
// 쪽마다 그림 한 장 + PDF의 링크(유튜브 구간 이동·차례 이동)를 같은 자리의 투명 링크로 옮긴다 → 디자인·QR·구간 이동이 그대로.
// 차례: PDF 책갈피(outline)가 있으면 그것, 없으면 쪽 목록.
// node pdf2epub.mjs <입력.pdf> [출력.epub] [--width 1200] [--quality 82] [--title 제목]
import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as mupdf from "mupdf";
import JSZip from "jszip";

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d; };
const WIDTH = +opt("--width", 1200), QUALITY = +opt("--quality", 82);
let title = opt("--title", "");
const [inPdf, outEpub = inPdf.replace(/\.pdf$/i, ".epub")] = args;
if (!inPdf) { console.error("사용법: node pdf2epub.mjs <입력.pdf> [출력.epub]"); process.exit(2); }

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const doc = mupdf.Document.openDocument(fs.readFileSync(inPdf), "application/pdf");
const N = doc.countPages();
title ||= (doc.getMetaData("info:Title") || path.basename(inPdf, ".pdf")).trim() || path.basename(inPdf, ".pdf");
const pfile = (i) => `p${String(i + 1).padStart(4, "0")}.xhtml`;

const zip = new JSZip();
zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);

const manifest = [], spine = [];
let W0 = 0, H0 = 0, linkCount = 0, extCount = 0;
for (let i = 0; i < N; i++) {
  const page = doc.loadPage(i);
  const [x0, y0, x1, y1] = page.getBounds();
  const pw = x1 - x0, ph = y1 - y0, s = WIDTH / pw;
  const W = Math.round(pw * s), H = Math.round(ph * s);
  if (i === 0) { W0 = W; H0 = H; }
  const pm = page.toPixmap(mupdf.Matrix.scale(s, s), mupdf.ColorSpace.DeviceRGB, false, true);
  const jpg = pm.asJPEG(QUALITY);
  pm.destroy();
  const img = `img/p${String(i + 1).padStart(4, "0")}.jpg`;
  zip.file("OEBPS/" + img, jpg);
  // 링크: 쪽 좌표(pt) → 그림 좌표(px)
  const links = page.getLinks().map((l) => {
    const [a, b, c, d] = l.getBounds();
    const box = `left:${((a - x0) * s).toFixed(1)}px;top:${((b - y0) * s).toFixed(1)}px;width:${((c - a) * s).toFixed(1)}px;height:${((d - b) * s).toFixed(1)}px`;
    let href;
    if (l.isExternal()) { href = l.getURI(); extCount++; }
    else { try { const t = doc.resolveLinkDestination(l.getURI()).page; if (t >= 0 && t < N) href = pfile(t); } catch {} }
    if (!href) return "";
    linkCount++;
    return `<a class="lk" href="${esc(href)}" style="${box}"></a>`;
  }).join("");
  page.destroy();
  zip.file("OEBPS/" + pfile(i), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko"><head><meta charset="UTF-8"/><title>${esc(title)} ${i + 1}</title><meta name="viewport" content="width=${W}, height=${H}"/><link rel="stylesheet" href="fl.css"/></head><body style="width:${W}px;height:${H}px"><div class="pg" style="width:${W}px;height:${H}px"><img src="${img}" alt="${i + 1}쪽" width="${W}" height="${H}"/>${links}</div></body></html>`);
  manifest.push(`<item id="i${i}" href="${img}" media-type="image/jpeg"${i === 0 ? ' properties="cover-image"' : ""}/>`, `<item id="x${i}" href="${pfile(i)}" media-type="application/xhtml+xml"/>`);
  spine.push(`<itemref idref="x${i}"/>`);
}
zip.file("OEBPS/fl.css", "html,body{margin:0;padding:0;}.pg{position:relative;overflow:hidden;}.pg img{position:absolute;left:0;top:0;}.lk{position:absolute;display:block;}");

// 차례: 책갈피 → nav / ncx
const outline = (() => { try { return doc.loadOutline() || []; } catch { return []; } })();
const entries = [];
const walk = (items, depth) => {
  for (const it of items) {
    let p = it.page;
    if (p == null && it.uri) { try { p = doc.resolveLinkDestination(it.uri).page; } catch {} }
    if (p != null && p >= 0 && p < N && it.title) entries.push({ t: it.title.trim(), p, depth });
    if (it.down) walk(it.down, depth + 1);
  }
};
walk(outline, 0);
// 책갈피가 없으면 PDF 앞쪽(차례 쪽)의 내부 링크 글자를 차례로 쓴다
if (!entries.length) {
  for (let i = 0; i < Math.min(N, 8); i++) {
    const page = doc.loadPage(i), st = page.toStructuredText(), lines = JSON.parse(st.asJSON(1)).blocks.flatMap((b) => b.lines || []);
    for (const l of page.getLinks()) {
      if (l.isExternal()) continue;
      let p; try { p = doc.resolveLinkDestination(l.getURI()).page; } catch { continue; }
      const [a, b, c, d] = l.getBounds(), mid = (b + d) / 2;
      const t = lines.filter((ln) => ln.bbox.y <= mid && ln.bbox.y + ln.bbox.h >= mid && ln.bbox.x < c && ln.bbox.x + ln.bbox.w > a).sort((u, v) => u.bbox.x - v.bbox.x).map((ln) => ln.text).join(" ").replace(/\s+\d+\s*$/, "").trim();
      if (t && p >= 0 && p < N && !entries.some((e) => e.p === p && e.t === t)) entries.push({ t, p, depth: /^\d+장|^[0-9]+\./.test(t) || entries.length === 0 ? 0 : 1 });
    }
    st.destroy(); page.destroy();
  }
  entries.forEach((e) => (e.depth = 0)); // 깊이는 PDF마다 달라 한 단계로
  if (entries.length < 3) entries.length = 0;
}
if (!entries.length) for (let i = 0; i < N; i++) entries.push({ t: `${i + 1}쪽`, p: i, depth: 0 });
const navOl = (() => {
  // 깊이를 살려 중첩 목록으로
  let h = "<ol>", d = 0, open = false;
  for (const e of entries) {
    const dd = Math.min(e.depth, d + 1);
    if (dd > d) { h += "<ol>"; open = false; } else { if (open) h += "</li>"; for (; d > dd; d--) h += "</ol></li>"; }
    d = dd;
    h += `<li><a href="${pfile(e.p)}">${esc(e.t)}</a>`; open = true;
  }
  if (open) h += "</li>";
  for (; d > 0; d--) h += "</ol></li>";
  return h + "</ol>";
})();
zip.file("OEBPS/nav.xhtml", `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko"><head><meta charset="UTF-8"/><title>차례</title></head><body><nav epub:type="toc" id="toc"><h1>차례</h1>${navOl}</nav><nav epub:type="landmarks" hidden=""><ol><li><a epub:type="cover" href="${pfile(0)}">표지</a></li></ol></nav></body></html>`);
let np = 0;
const uid = "urn:uuid:" + crypto.createHash("md5").update(path.basename(inPdf)).digest("hex").replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, "$1-$2-$3-$4-$5");
zip.file("OEBPS/toc.ncx", `<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="${uid}"/></head><docTitle><text>${esc(title)}</text></docTitle><navMap>${entries.map((e) => `<navPoint id="n${++np}" playOrder="${np}"><navLabel><text>${esc(e.t)}</text></navLabel><content src="${pfile(e.p)}"/></navPoint>`).join("")}</navMap></ncx>`);
const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
zip.file("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="ko"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">${uid}</dc:identifier><dc:title>${esc(title)}</dc:title><dc:language>ko</dc:language><meta property="dcterms:modified">${now}</meta><meta property="rendition:layout">pre-paginated</meta><meta property="rendition:spread">none</meta><meta property="rendition:orientation">portrait</meta><meta name="cover" content="i0"/><meta name="original-resolution" content="${W0}x${H0}"/></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="fl.css" media-type="text/css"/>${manifest.join("")}</manifest><spine toc="ncx">${spine.join("")}</spine></package>`);
doc.destroy();

const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", mimeType: "application/epub+zip" });
fs.writeFileSync(outEpub, buf);
console.log(`완성: ${outEpub} | ${N}쪽 | 링크 ${linkCount}개(유튜브 등 바깥 ${extCount}) | 차례 ${entries.length}항목 | ${(buf.length / 1048576).toFixed(1)}MB`);
