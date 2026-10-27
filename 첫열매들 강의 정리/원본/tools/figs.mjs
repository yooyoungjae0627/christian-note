// 정리한 사람이 만든 그림 → JPG: node figs.mjs <원본폴더>
// 이야기 폴더의 figs/NN.html(슬라이드 본문 HTML 조각) + tools/fig.css → slides/NN.jpg (가로 1400)
// html이 jpg보다 새로울 때만 다시 찍는다. Edge 명령줄 화면 찍기라 샌드박스 밖에서 실행.
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { edgeShot } from "./edge.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = process.argv[2];
const css = fs.readFileSync(path.join(here, "fig.css"), "utf8");
let made = 0, kept = 0;
const overflow = [], scaled = [];
// 셋째 인자부터: 찍을 이야기 번호(예: 02 05). 없으면 전부
const only = process.argv.slice(3);
for (const d of fs.readdirSync(root).filter((d) => /^\d\d_/.test(d) && (!only.length || only.includes(d.slice(0, 2)))).sort()) {
  const figDir = path.join(root, d, "figs");
  if (!fs.existsSync(figDir)) continue;
  const outDir = path.join(root, d, "slides");
  fs.mkdirSync(outDir, { recursive: true });
  for (const f of fs.readdirSync(figDir).filter((f) => f.endsWith(".html")).sort()) {
    const src = path.join(figDir, f), out = path.join(outDir, f.replace(/\.html$/, ".jpg"));
    if (!process.env.FORCE && fs.existsSync(out) && fs.statSync(out).mtimeMs > fs.statSync(src).mtimeMs && fs.statSync(out).mtimeMs > fs.statSync(path.join(here, "fig.css")).mtimeMs) { kept++; continue; }
    const tmpHtml = path.join(os.tmpdir(), `fig_${process.pid}.html`), tmpPng = path.join(os.tmpdir(), `fig_${process.pid}.png`);
    const body = fs.readFileSync(src, "utf8");
    const hasSrc = /class="src"/.test(body);
    const page = (extra) => `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}${extra}</style></head><body>${body}</body></html>`;
    // 크기 재기: 높이 제한·잘림을 풀고 검은 바탕에서 왼쪽 정렬·위에서부터 쌓아 찍는다(.src 오른쪽 아래 출처는 뺌).
    // 글 끝 = 56 + 글 높이, 오른쪽 끝 = 80 + 글 폭. 실제 그림(가운데 정렬)에서 쓸 수 있는 칸: 폭 1240, 높이 588(출처 있으면 568)
    const measure = async (zoom) => {
      const probe = `html,body{width:2600px!important;height:auto!important;overflow:visible!important;background:#000!important}.slide{height:auto!important;min-height:700px;justify-content:flex-start!important;align-items:flex-start!important;overflow:visible!important}.src,.title{display:none!important}${zoom < 1 ? `.slide>*{zoom:${zoom}}` : ""}`;
      fs.writeFileSync(tmpHtml, page(probe));
      edgeShot(tmpHtml, tmpPng, 2600, 1600, 1);
      const { data, info } = await sharp(tmpPng).raw().toBuffer({ resolveWithObject: true });
      let bottom = 0, right = 0;
      for (let y = 0; y < info.height; y += 1) for (let x = 0; x < info.width; x += 2) {
        const i = (y * info.width + x) * info.channels;
        if (data[i] + data[i + 1] + data[i + 2] > 60) { bottom = y; if (x > right) right = x; }
      }
      return { w: right - 80, h: bottom - 56 };
    };
    // .title(오른쪽 위 칩)이 있으면 위쪽도 겹치지 않게 높이를 더 줄인다
    const hasTitle = /class="title"/.test(body);
    const hMax = hasTitle ? 540 : hasSrc ? 568 : 588, wMax = 1240;
    let zoom = 1, m = await measure(1);
    for (let k = 0; k < 4 && (m.w > wMax || m.h > hMax); k++) {
      zoom = Math.floor(zoom * Math.min(wMax / m.w, hMax / m.h, 0.99) * 1000) / 1000;
      m = await measure(zoom);
    }
    // 본 그림: 넘치는 그림은 내용 전체를 zoom으로 줄여 1400×700 안에 넣는다(출처는 그대로)
    fs.writeFileSync(tmpHtml, page(zoom < 1 ? `.slide>*:not(.src):not(.title){zoom:${zoom}}` : ""));
    edgeShot(tmpHtml, tmpPng, 1400, 700, 1);
    const meta = await sharp(tmpPng).metadata();
    await sharp(tmpPng).extract({ left: 0, top: 0, width: Math.min(1400, meta.width), height: Math.min(700, meta.height) }).jpeg({ quality: 88 }).toFile(out);
    made++;
    const over = m.w > wMax || m.h > hMax;
    if (zoom < 1) scaled.push(`${d}/${f} ×${zoom}`);
    if (over) overflow.push(`${d}/${f} (폭 ${m.w}/${wMax}, 높이 ${m.h}/${hMax})`);
    console.log(`  그림 ${d}/${f} → slides/${path.basename(out)}${zoom < 1 ? `  (줄임 ×${zoom})` : ""}${over ? "  ✗ 넘침" : ""}`);
  }
}
console.log(`그림: 새로 ${made}장, 그대로 ${kept}장`);
if (scaled.length) console.log(`  넘쳐서 줄인 그림 ${scaled.length}장: ${scaled.join(", ")}`);
overflow.forEach((s) => console.log("  ✗ 넘침:", s));
process.exit(overflow.length ? 1 : 0);
