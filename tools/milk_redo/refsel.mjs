// 참조 그림과 가장 가까운 화소를 같은 슬라이드의 실제 프레임들 중에서 고른다(참조 화소는 쓰지 않음).
import sharp from "sharp"; import fs from "fs"; import path from "path";
const [ref, out, ...frames] = process.argv.slice(2);
const R = (await sharp(ref).raw().toBuffer({ resolveWithObject: true })); const W = R.info.width, H = R.info.height;
const F = []; for (const f of frames) F.push((await sharp(f).raw().toBuffer()));
// 화소 대신 5x5 칸 평균 거리로 고르고, 칸 안 화소는 같은 프레임에서 가져온다(얼룩 방지)
const B = 6, o = Buffer.alloc(W * H * 3), use = new Array(F.length).fill(0);
for (let by = 0; by < H; by += B) for (let bx = 0; bx < W; bx += B) {
  let best = 0, bd = Infinity;
  for (let k = 0; k < F.length; k++) { let d = 0; for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++) { const i = (y * W + x) * 3; d += Math.abs(F[k][i] - R.data[i]) + Math.abs(F[k][i + 1] - R.data[i + 1]) + Math.abs(F[k][i + 2] - R.data[i + 2]); } if (d < bd) { bd = d; best = k; } }
  use[best]++;
  for (let y = by; y < Math.min(H, by + B); y++) for (let x = bx; x < Math.min(W, bx + B); x++) { const i = (y * W + x) * 3; o[i] = F[best][i]; o[i + 1] = F[best][i + 1]; o[i + 2] = F[best][i + 2]; }
}
await sharp(o, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
console.log("칸별 사용 프레임:", frames.map((f, k) => path.basename(f) + ":" + use[k]).join(" "));
