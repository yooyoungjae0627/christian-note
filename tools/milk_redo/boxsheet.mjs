// 프레임마다 칸 부분을 작게 늘어놓는다(깨끗한 프레임 고르기용)
import sharp from "sharp"; import fs from "fs";
const [wdir, out, boxS] = process.argv.slice(2); const [x0, y0, x1, y1] = boxS.split(",").map(Number);
const fl = fs.readdirSync(wdir).filter((f) => f.endsWith(".jpg")).sort().slice(0, 72);
const tw = 150, th = Math.round(tw * (y1 - y0) / (x1 - x0)); const C = 9; const c = [];
for (let i = 0; i < fl.length; i++) { const x = (i % C) * (tw + 4), y = Math.floor(i / C) * (th + 18);
  c.push({ input: await sharp(wdir + "/" + fl[i]).extract({ left: x0, top: y0, width: x1 - x0, height: y1 - y0 }).resize(tw, th).toBuffer(), left: x, top: y + 16 });
  c.push({ input: Buffer.from(`<svg width="${tw}" height="16"><text x="1" y="12" font-size="12">${fl[i]}</text></svg>`), left: x, top: y }); }
await sharp({ create: { width: C * (tw + 4), height: Math.ceil(fl.length / C) * (th + 18), channels: 3, background: "#fff" } }).composite(c).jpeg({ quality: 80 }).toFile(out);
