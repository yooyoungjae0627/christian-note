// 글자 없는 배경 칸(주로 왼쪽 아래 여백)에 남은 강사를 메우고, 슬라이드 번호만 실제 프레임에서 가져온다.
// - 칸이 그림 왼쪽 끝에 닿으면 칸 오른쪽 바로 바깥 열의 색으로 줄마다 메운다(세로로 살짝 흐리게).
//   그 밖의 경우 칸 양옆 열 사이를 줄마다 이어 칠한다.
// - 번호 칸(nx0,ny0,nx1,ny1)은 번호가 또렷이 보이는 실제 프레임(펴진 것) 하나에서 그대로 가져온다.
// node fillbox.mjs <base.jpg> <out.jpg> x0,y0,x1,y1 [번호프레임.jpg nx0,ny0,nx1,ny1]
import sharp from "sharp"; import fs from "fs"; import path from "path";
const [base, out, boxS, numFrame, numS] = process.argv.slice(2);
const B = await sharp(base).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const W = B.info.width, H = B.info.height, o = Buffer.from(B.data);
// 칸 여러 개는 ";"로 — 앞 칸을 메운 결과를 다음 칸의 기준으로 쓴다(글자·가로줄을 피해 칸을 나눌 때)
for (const bs of boxS.split(";")) {
  const parts = bs.split(","); const [x0, y0, x1, y1] = parts.map(Number);
  const S = Buffer.from(o);
  // 다섯째 값 r: 오른쪽 바깥 열을 그대로 이어 붙인다(가려진 가로줄을 이어 그을 때 — 줄 모양만, 글자 아님)
  // 다섯째 값 v: 칸 위·아래 바깥 줄 사이를 세로로 이어 칠한다(가로줄 왼쪽 빈 자리 등)
  if (parts[4] === "v") { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const t = (y - y0 + 1) / (y1 - y0 + 1), i = (y * W + x) * 3, a = ((y0 - 1) * W + x) * 3, b = (y1 * W + x) * 3; for (let c = 0; c < 3; c++) o[i + c] = Math.round(S[a + c] * (1 - t) + S[b + c] * t); } continue; }
  if (parts[4] === "r") { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 3, j = (y * W + x1) * 3; for (let c = 0; c < 3; c++) o[i + c] = S[j + c]; } continue; }
  const px = (x, y, c) => S[(Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 3 + c];
  for (let y = y0; y < Math.min(H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(W, x1); x++) {
    const i = (y * W + x) * 3;
    for (let c = 0; c < 3; c++) {
      // 세로 9화소 평균으로 결을 줄인 양옆 기준색
      let r = 0, l = 0; for (let d = -4; d <= 4; d++) { r += px(x1, y + d, c); l += px(x0 - 1, y + d, c); } r /= 9; l /= 9;
      const v = x0 <= 0 ? r : x1 >= W ? l : l + (r - l) * (x - x0 + 1) / (x1 - x0 + 1);
      o[i + c] = Math.round(v);
    }
  }
}
let note = "";
if (numFrame) {
  const [a, b, c2, d] = numS.split(",").map(Number);
  let nf = numFrame;
  // 폴더를 주면 번호 획(어두운 이웃이 있는 밝은 화소)이 가장 많고 넓은 밝은 덩어리(흰 옷)는 적은 프레임을 고른다
  if (fs.statSync(numFrame).isDirectory()) {
    let best = null, bs = 0;
    for (const f of fs.readdirSync(numFrame).filter((x) => x.endsWith(".jpg"))) {
      const Fb = await sharp(path.join(numFrame, f)).removeAlpha().raw().toBuffer(); const lm = (x, y) => { const i = (y * W + x) * 3; return (Fb[i] * 77 + Fb[i + 1] * 150 + Fb[i + 2] * 29) >> 8; };
      let thin = 0, bright = 0, tot = 0;
      for (let y = b; y < d; y++) for (let x = a; x < c2; x++) { tot++; if (lm(x, y) > 150) { bright++; if ([[3, 0], [-3, 0], [0, 3], [0, -3]].some(([dx, dy]) => lm(Math.min(W - 1, Math.max(0, x + dx)), Math.min(H - 1, Math.max(0, y + dy))) < 70)) thin++; } }
      if (bright / tot < 0.2 && thin > bs) { bs = thin; best = f; }
    }
    if (!best || bs < 25) { note = " | 번호가 또렷한 프레임 없음(번호 칸은 메운 배경)"; nf = null; } else nf = path.join(numFrame, best);
  }
  if (nf) {
  const N = await sharp(nf).removeAlpha().raw().toBuffer();
  // 번호 글자의 밝은 획만 옮긴다(칸 테두리·옆에 걸친 사람이 따라오지 않게). 획 둘레 2px는 부드럽게.
  const lum = (buf, i) => (buf[i] * 77 + buf[i + 1] * 150 + buf[i + 2] * 29) >> 8;
  const g = new Float32Array((c2 - a) * (d - b));
  for (let y = b; y < d; y++) for (let x = a; x < c2; x++) { const i = (y * W + x) * 3; const v = lum(N, i) - lum(o, i); g[(y - b) * (c2 - a) + (x - a)] = Math.max(0, Math.min(1, (v - 40) / 60)); }
  for (let y = b; y < d; y++) for (let x = a; x < c2; x++) {
    let al = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy - b, xx = x + dx - a; if (yy >= 0 && xx >= 0 && yy < d - b && xx < c2 - a) al = Math.max(al, g[yy * (c2 - a) + xx] * (1 - 0.3 * Math.max(Math.abs(dx), Math.abs(dy)))); }
    const i = (y * W + x) * 3; for (let c = 0; c < 3; c++) o[i + c] = Math.round(N[i + c] * al + o[i + c] * (1 - al));
  }
  note = ` | 번호 칸 ← ${nf.split(/[\\/]/).pop()}`;
  }
}
await sharp(o, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
console.log(`→ ${out} | 메운 칸 ${boxS}${note}`);
