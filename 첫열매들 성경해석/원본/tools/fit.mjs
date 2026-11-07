// 쪽 공란 맞춤(지침 ① §7 쪽 나눔): 그림은 줄이지 않고, 같은 소제목 안에서 앞뒤 문단으로 옮겨 공란이 가장 적은 자리를 고른다.
// 결과는 이야기 폴더의 layout.json에 남고, build_pdf.mjs가 그대로 쓴다.
// node fit.mjs <원본폴더> <출력폴더>
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import * as mupdf from "mupdf";
import { loadBook } from "./parse.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, outDir] = process.argv.slice(2);
const MM = 72 / 25.4, TOP = 16 * MM, BOTTOM = (210 - 19) * MM, H = BOTTOM - TOP;

function measure() {
  execFileSync(process.execPath, [path.join(here, "build_pdf.mjs"), root, outDir, ...process.argv.slice(4, 5)], { env: { ...process.env, FAST: "1" }, stdio: "inherit" });
  const pages = JSON.parse(fs.readFileSync(path.join(outDir, "toc_pages_fast.json"), "utf8"));
  const doc = mupdf.Document.openDocument(fs.readFileSync(path.join(outDir, "_pass.pdf")), "application/pdf");
  const book = loadBook(root);
  const res = { cost: 0, cands: [], pages: doc.countPages() };
  for (const S of book.stories) {
    const p0 = pages[`S${S.n}`], p1 = pages[`S${S.n}sum`]; // 본문 = 표제 다음 쪽 ~ 한눈에 보는 이야기 앞 쪽
    const order = S.chapters.flatMap((c) => [...c.blocks, ...c.secs.flatMap((s) => s.blocks)]).filter((b) => b.t === "img").map((b) => b.file);
    let imgNo = 0;
    const info = [];
    for (let pno = p0 + 1; pno < p1; pno++) {
      let maxY = 0, firstImg = null, firstTop = 1e9;
      const imgs = [];
      // 쪽·구조 텍스트를 바로 놓아 준다(1600쪽이 넘으면 WASM 메모리가 바닥남)
      const pg = doc.loadPage(pno - 1), st = pg.toStructuredText("preserve-images");
      st.walk({
        onImageBlock(b) { imgs.push(b); maxY = Math.max(maxY, b[3]); if (b[1] < firstTop) { firstTop = b[1]; firstImg = imgs.length - 1; } },
        beginLine(b) { if (b[1] < BOTTOM) { maxY = Math.max(maxY, b[3]); firstTop = Math.min(firstTop, b[1]); if (b[1] <= firstTop) firstImg = null; } },
      });
      st.destroy(); pg.destroy();
      // 쪽 맨 위가 그림인가(제목 없이)
      const startsWithImg = firstImg !== null ? order[imgNo + firstImg] : null;
      imgNo += imgs.length;
      info.push({ pno, fill: (maxY - TOP) / H, startsWithImg });
    }
    for (let k = 0; k < info.length - 1; k++) {
      const gap = Math.max(0, 0.85 - info[k].fill);
      res.cost += gap;
      if (gap > 0 && info[k + 1].startsWithImg) res.cands.push({ S, file: info[k + 1].startsWithImg, gap, pno: info[k].pno });
    }
  }
  res.cost += res.pages * 0.05;
  doc.destroy();
  return res;
}

const lay = (S) => path.join(S.dir, "layout.json");
const readLay = (S) => (fs.existsSync(lay(S)) ? JSON.parse(fs.readFileSync(lay(S), "utf8")) : {});
const writeLay = (S, o) => { const c = Object.fromEntries(Object.entries(o).filter(([, v]) => v)); fs.writeFileSync(lay(S), JSON.stringify(c, null, 1)); };

let best = measure();
console.log(`시작: 공란 비용 ${best.cost.toFixed(2)}, ${best.pages}쪽, 옮길 후보 ${best.cands.length}개`);
const tried = new Set();
for (let it = 0; it < 14; it++) {
  const cand = best.cands.sort((a, b) => b.gap - a.gap).find((c) => !tried.has(c.S.n + ":" + c.file + "+") || !tried.has(c.S.n + ":" + c.file + "-"));
  if (!cand) break;
  const o = readLay(cand.S), cur = o[cand.file] || 0;
  const key = cand.S.n + ":" + cand.file;
  const dir = !tried.has(key + "+") ? "+" : "-";
  tried.add(key + dir);
  writeLay(cand.S, { ...o, [cand.file]: cur + (dir === "+" ? 1 : -1) });
  const r = measure();
  if (r.cost < best.cost - 0.01) { console.log(`✓ ${cand.S.n}/${cand.file} ${dir}1 (${cand.pno}쪽 공란): 비용 ${best.cost.toFixed(2)} → ${r.cost.toFixed(2)}, ${r.pages}쪽`); best = r; tried.delete(key + "+"); tried.delete(key + "-"); }
  else { console.log(`✗ ${cand.S.n}/${cand.file} ${dir}1: 비용 ${r.cost.toFixed(2)} (나아지지 않아 되돌림)`); writeLay(cand.S, o); }
}
console.log(`끝: 공란 비용 ${best.cost.toFixed(2)}, ${best.pages}쪽`);
