// 강사가 한자리(주로 왼쪽 아래)에 오래 서 있어 중앙값에 남은 잔상을, 그 칸이 "깨끗한" 실제 프레임들로만 다시 만든다.
// 칸 안에서 무늬(가로·세로 밝기 차) 에너지가 가장 낮은 프레임들 = 사람이 없는 프레임(배경이 단순한 칸일 때).
// 그 프레임들의 중앙값으로 칸을 바꾸고 가장자리 24px는 부드럽게 섞는다. 새로 그린 화소는 없다.
// node clearpatch.mjs <base.jpg> <out.jpg> <펴진 프레임 폴더> x0,y0,x1,y1 [고를 비율=0.3]
import sharp from "sharp"; import fs from "fs"; import path from "path";
const [base, out, wdir, boxS, fracS = "0.3"] = process.argv.slice(2);
const [x0, y0, x1, y1] = boxS.split(",").map(Number);
const B = await sharp(base).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = B.info.width, H = B.info.height, o = Buffer.from(B.data);
const files = fs.readdirSync(wdir).filter((f) => f.endsWith(".jpg")).sort();
const F = []; for (const f of files) F.push(await sharp(path.join(wdir, f)).removeAlpha().raw().toBuffer());
const L = (buf, x, y) => { const i = (y * W + x) * 3; return (buf[i] * 77 + buf[i + 1] * 150 + buf[i + 2] * 29) >> 8; };
const energy = F.map((f) => { let e = 0; for (let y = y0; y < y1 - 2; y += 2) for (let x = x0; x < x1 - 2; x += 2) e += Math.abs(L(f, x + 2, y) - L(f, x, y)) + Math.abs(L(f, x, y + 2) - L(f, x, y)); return e; });
const order = energy.map((e, k) => [e, k]).sort((a, b) => a[0] - b[0]);
// 다섯째 인자에 프레임 이름(쉼표)을 주면 그 프레임들만 쓴다(눈으로 고른 깨끗한 프레임)
let sel;
if (/\.jpg/.test(fracS)) sel = fracS.split(",").map((n) => files.indexOf(n)).filter((k) => k >= 0);
else { const mm = Math.max(3, Math.round(F.length * +fracS)); sel = order.slice(0, mm).map((x) => x[1]); }
const m = sel.length;
const v = new Array(m), FE = 24;
for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
  // 그림 가장자리에 닿은 변은 섞지 않는다(가장자리 잔상이 남지 않게)
  const d = Math.min(x0 === 0 ? 1e9 : x - x0, x1 >= W ? 1e9 : x1 - 1 - x, y0 === 0 ? 1e9 : y - y0, y1 >= H ? 1e9 : y1 - 1 - y), t = Math.min(1, (d + 1) / FE);
  const i = (y * W + x) * 3;
  for (let c = 0; c < 3; c++) { for (let k = 0; k < m; k++) v[k] = F[sel[k]][i + c]; v.sort((a, b) => a - b); const med = v[m >> 1]; o[i + c] = Math.round(med * t + B.data[i + c] * (1 - t)); }
}
await sharp(o, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
console.log(`→ ${out} | 칸 ${boxS} | ${F.length}장 중 깨끗한 ${m}장: ${sel.map((k) => files[k]).join(" ")}`);
