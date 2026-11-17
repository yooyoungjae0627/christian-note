// 펴 놓은 프레임들(같은 슬라이드, 1920×1080)을 화소별 "가장 흔한 값"으로 합친다.
// 강사가 한 자리를 절반 넘게 가려도, 움직이는 동안 몸의 색은 계속 바뀌고 배경 색은 그대로라
// 배경이 가장 큰 무리를 이룬다(중앙값은 이때 강사 색을 고른다).
// 밝기 32칸 막대그래프에서 이웃 칸까지 합친 수가 가장 많은 칸의 프레임 색 평균을 쓴다.
// node mode.mjs <out.jpg> 펴진프레임.jpg …
import sharp from "sharp";
const [out, ...files] = process.argv.slice(2);
const F = []; let W, H;
for (const f of files) { const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true }); W = info.width; H = info.height; F.push(data); }
const n = F.length, o = Buffer.alloc(W * H * 3), bins = new Int32Array(34), lum = new Uint8Array(n);
for (let p = 0; p < W * H; p++) {
  bins.fill(0);
  for (let k = 0; k < n; k++) { const i = p * 3; const l = (F[k][i] * 77 + F[k][i + 1] * 150 + F[k][i + 2] * 29) >> 8; lum[k] = l >> 3; bins[(l >> 3) + 1]++; }
  let best = 1, bc = -1;
  for (let b = 1; b <= 32; b++) { const c = bins[b - 1] + 2 * bins[b] + bins[b + 1]; if (c > bc) { bc = c; best = b - 1; } }
  let r = 0, g = 0, bl = 0, m = 0;
  for (let k = 0; k < n; k++) if (Math.abs(lum[k] - best) <= 1) { const i = p * 3; r += F[k][i]; g += F[k][i + 1]; bl += F[k][i + 2]; m++; }
  const i = p * 3; o[i] = Math.round(r / m); o[i + 1] = Math.round(g / m); o[i + 2] = Math.round(bl / m);
}
await sharp(o, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
console.log(`→ ${out} (${n}장 최빈값)`);
