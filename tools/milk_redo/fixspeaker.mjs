// 중앙값으로도 남은 강사 잔상을 지운다(강사가 한자리에 오래 서 있던 슬라이드).
// 1) 펴 놓은 프레임들의 화소별 밝기 흔들림(표준편차)이 큰 곳 = 움직이는 사람.
//    아래 가장자리에 닿는 덩어리만 남긴다(무대에 선 사람은 바닥에 닿는다 — 슬라이드 글이 바뀌는 곳은 건드리지 않음).
// 2) 그 자리를 같은 줄의 양옆 배경 화소로 이어 메운다(글자가 없는 배경 보정).
// 3) 왼쪽 아래 슬라이드 번호 자리는 메우지 않고, 번호가 가장 또렷한 실제 프레임에서 그 칸을 가져온다.
//    어느 프레임에서도 번호가 보이지 않으면 그렇다고 알린다(지어 그리지 않음).
// node fixspeaker.mjs <중앙값.jpg> <out.jpg> <펴진 프레임 폴더> [--no-number]
import sharp from "sharp"; import fs from "fs"; import path from "path";
const [base, out, wdir, flag] = process.argv.slice(2);
const B = await sharp(base).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = B.info.width, H = B.info.height, o = Buffer.from(B.data);
const files = fs.readdirSync(wdir).filter((f) => f.endsWith(".jpg")).sort();
const F = []; for (const f of files) F.push(await sharp(path.join(wdir, f)).removeAlpha().raw().toBuffer());
const n = F.length, L = (buf, p) => (buf[p * 3] * 77 + buf[p * 3 + 1] * 150 + buf[p * 3 + 2] * 29) >> 8;
// 1) 흔들림
const sd = new Float32Array(W * H);
for (let p = 0; p < W * H; p++) { let s = 0, s2 = 0; for (let k = 0; k < n; k++) { const v = L(F[k], p); s += v; s2 += v * v; } const m = s / n; sd[p] = Math.sqrt(Math.max(0, s2 / n - m * m)); }
let mask = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) if (sd[p] > 14) mask[p] = 1;
const dil = (m, r) => { const t = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) for (let dy = -r; dy <= r; dy++) { const yy = y + dy; if (yy < 0 || yy >= H) continue; for (let dx = -r; dx <= r; dx++) { const xx = x + dx; if (xx >= 0 && xx < W) t[yy * W + xx] = 1; } } return t; };
mask = dil(mask, 6);
// 아래 가장자리에 닿는 덩어리만
const lab = new Int32Array(W * H).fill(-1), keep = new Set(); let id = 0;
for (let p = 0; p < W * H; p++) if (mask[p] && lab[p] < 0) { const st = [p]; lab[p] = id; let touch = false, area = 0;
  while (st.length) { const q = st.pop(); area++; const x = q % W, y = (q / W) | 0; if (y >= H - 25) touch = true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const r = yy * W + xx; if (mask[r] && lab[r] < 0) { lab[r] = id; st.push(r); } } }
  if (touch && area > 1500) keep.add(id); id++; }
const NB = { x0: 10, y0: 975, x1: 175, y1: 1070 }; // 슬라이드 번호 칸
const inNB = (x, y) => x >= NB.x0 && x < NB.x1 && y >= NB.y0 && y < NB.y1;
let filled = 0;
for (let y = 0; y < H; y++) { let x = 0; while (x < W) { const p = y * W + x; if (!(lab[p] >= 0 && keep.has(lab[p])) || inNB(x, y)) { x++; continue; }
    let e = x; while (e < W && lab[y * W + e] >= 0 && keep.has(lab[y * W + e]) && !inNB(e, y)) e++;
    const a = x - 1, b = e; for (let xx = x; xx < e; xx++) { const t = a < 0 ? 1 : b >= W ? 0 : (xx - a) / (b - a); const i = (y * W + xx) * 3, ia = (y * W + Math.max(a, 0)) * 3, ib = (y * W + Math.min(b, W - 1)) * 3;
      for (let c = 0; c < 3; c++) o[i + c] = Math.round((a < 0 ? B.data[ib + c] : b >= W ? B.data[ia + c] : B.data[ia + c] * (1 - t) + B.data[ib + c] * t)); filled++; }
    x = e; } }
// 3) 번호 칸: 얇은 밝은 획(어두운 이웃이 있는 밝은 화소)이 가장 많고, 넓은 밝은 덩어리(흰 옷)는 적은 프레임
let note = "";
if (flag !== "--no-number") {
  let best = -1, bs = 0;
  for (let k = 0; k < n; k++) { let thin = 0, bright = 0, tot = 0;
    for (let y = NB.y0; y < NB.y1; y++) for (let x = NB.x0; x < NB.x1; x++) { const v = L(F[k], y * W + x); tot++; if (v > 150) { bright++; let dark = false; for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) if (L(F[k], (y + dy) * W + x + dx) < 70) dark = true; if (dark) thin++; } }
    if (bright / tot < 0.2 && thin > bs) { bs = thin; best = k; } }
  if (best >= 0 && bs > 25) { for (let y = NB.y0; y < NB.y1; y++) for (let x = NB.x0; x < NB.x1; x++) { const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) o[i + c] = F[best][i + c]; } note = `번호 칸 ← ${files[best]} (획 ${bs})`; }
  else note = "번호가 또렷한 프레임 없음 — 번호 칸은 중앙값 그대로";
}
await sharp(o, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
console.log(`→ ${out} | 메운 화소 ${filled} | ${note}`);
