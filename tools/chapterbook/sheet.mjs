// 검수용 쪽 모음 그림: node tools/chapterbook/sheet.mjs <png폴더> <시작> <끝> <출력.png> [열]
import fs from "node:fs"; import path from "node:path"; import { mod } from "./lib.mjs";
const sharp = (await mod("sharp")).default || (await mod("sharp"));
const [dir, from, to, out, cols = 4] = process.argv.slice(2);
const files = fs.readdirSync(dir).filter((f) => /^p\d+\.png$/.test(f)).sort().slice(+from - 1, +to);
const meta = await sharp(path.join(dir, files[0])).metadata(); const w = 420, h = Math.round(meta.height * w / meta.width);
const rows = Math.ceil(files.length / cols);
const comp = await Promise.all(files.map(async (f, i) => ({ input: await sharp(path.join(dir, f)).resize(w, h).toBuffer(), left: (i % cols) * (w + 8), top: Math.floor(i / cols) * (h + 8) })));
await sharp({ create: { width: cols * (w + 8), height: rows * (h + 8), channels: 3, background: "#888" } }).composite(comp).png().toFile(out);
console.log(out);
