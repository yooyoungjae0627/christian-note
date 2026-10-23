// 관계도·지도만 모아 찍어 보는 검수용 도구 — 책과 같은 폭(본문 폭)으로 인쇄해 쪽 그림을 만든다.
//   node tools/chapterbook/figures.mjs genesis 1 2 …|all     → %TEMP%/chapterbook2/figures/<책>/p001.png …
// Edge 인쇄는 샌드박스 밖에서 실행한다.
import fs from "node:fs";
import path from "node:path";
import { TMP, BOOKS, mod, loadChapter, esc } from "./lib.mjs";
import { CSS } from "./html.mjs";
import { relationSvg, relLegendHtml, mapSvg, mapViews } from "./art.mjs";
import { edgePrint } from "../../David/원본/tools/edge.mjs";

const [book, ...rest] = process.argv.slice(2);
const B = BOOKS[book];
const chs = rest[0] === "all" || !rest.length ? [...Array(B.chapters)].map((_, i) => i + 1) : rest.map(Number);
let body = "";
for (const ch of chs) {
  const d = loadChapter(book, ch);
  body += `<section class="front"><h1 style="font-size:12pt">${B.ko} ${ch}장 — 관계도</h1>`;
  if (d.people?.length && d.relations?.length) body += `<div class="figure relfig">${relationSvg(d.people, d.relations)}${relLegendHtml(d.relations, d.people)}</div>`;
  body += `</section>`;
  if (d.map?.places?.length) {
    const views = mapViews(d.map);
    body += `<section class="front"><h1 style="font-size:12pt">${B.ko} ${ch}장 — 지도</h1>`;
    for (const v of views) {
      const places = d.map.places.filter((x) => v.keys.includes(x.key));
      const routes = (d.map.routes || []).map((r) => ({ ...r, path: r.path.filter((k) => v.keys.includes(k)) })).filter((r) => r.path.length > 1);
      body += `<div class="figure">${v.title ? `<div class="map-title">${esc(v.title)}</div>` : ""}${mapSvg({ places, routes, minSpan: v.minSpan, focus: v.focus, hide: v.hide, frames: v.frames })}</div>`;
    }
    body += `</section>`;
  }
}
const dir = path.join(TMP, "figures", book); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const hf = path.join(dir, "figures.html"), pdf = path.join(dir, "figures.pdf");
fs.writeFileSync(hf, `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><style>${CSS}</style></head><body>${body}</body></html>`);
edgePrint(hf, pdf);
const mupdf = await mod("mupdf");
const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
for (let i = 0; i < doc.countPages(); i++) {
  const pix = doc.loadPage(i).toPixmap(mupdf.Matrix.scale(1.5, 1.5), mupdf.ColorSpace.DeviceRGB, false, true);
  fs.writeFileSync(path.join(dir, `p${String(i + 1).padStart(3, "0")}.png`), pix.asPNG());
}
console.log(dir, doc.countPages() + "쪽");
