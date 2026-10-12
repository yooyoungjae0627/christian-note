// PDF 쪽을 PNG로 찍어 시각 검수한다(저장소 밖 %TEMP%/chapterbook2/review).
//   node tools/chapterbook/render.mjs <pdf> [쪽 …|all] [--scale 1.2]
import fs from "node:fs";
import path from "node:path";
import { TMP, mod } from "./lib.mjs";
const args = process.argv.slice(2);
const si = args.indexOf("--scale"); const scale = si >= 0 ? +args.splice(si, 2)[1] : 1.2;
const [pdf, ...pages] = args;
const mupdf = await mod("mupdf");
const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
const n = doc.countPages();
const list = !pages.length || pages[0] === "all" ? [...Array(n)].map((_, i) => i + 1) : pages.map(Number);
const dir = path.join(TMP, "review", path.basename(pdf, ".pdf")); fs.mkdirSync(dir, { recursive: true });
for (const p of list) {
  const pix = doc.loadPage(p - 1).toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false, true);
  fs.writeFileSync(path.join(dir, `p${String(p).padStart(3, "0")}.png`), pix.asPNG());
}
console.log(dir, list.length + "쪽");
