// 강의 영상 프레임에서 스크린(슬라이드) 부분만 반듯한 직사각형으로 펴서 잘라 낸다.
// 지침: docs/policy/성경주제별_교재_제작지침.md §0 「스크린 펴서 자르기」(사용자 지시 2026-11-14)
//
// 쓰는 법
//   node screen_crop.mjs --quad x1,y1,x2,y2,x3,y3,x4,y4 --out slides/05.jpg [--w 1920 --h 1080] 프레임1.jpg [프레임2.jpg …]
//     quad = 스크린 바깥 테두리 네 모서리(왼쪽 위 → 오른쪽 위 → 오른쪽 아래 → 왼쪽 아래), 원본 프레임 화소 좌표.
//     프레임을 여러 장 주면(같은 슬라이드 구간에서 강사가 움직이는 동안 뽑은 것) 화소별 중앙값으로 합쳐
//     강사를 지운다. 강사가 줄곧 같은 자리에 서 있으면 지워지지 않으니 --check 결과와 그림을 꼭 본다.
//   node screen_crop.mjs --quad … --overlay 확인.jpg 프레임.jpg
//     프레임 위에 quad를 그려 모서리가 스크린 테두리에 딱 붙는지 본다(영상·카메라 구도마다 한 번).
//   --check : 결과 그림의 위·아래·왼쪽·오른쪽 가장자리 띠에 밝은 글자 화소가 있는지(글자 잘림 의심),
//             좌우 여백(글자 덩어리 양옆 빈칸) 차이, 프레임 사이 불일치 비율(강사 잔상 의심)을 출력한다.
//             문제 있으면 exit 2.
import sharp from 'sharp';

const args = process.argv.slice(2);
const opt = { w: 1920, h: 1080, files: [] };
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--quad') opt.quad = args[++i].split(',').map(Number);
  else if (a === '--out') opt.out = args[++i];
  else if (a === '--overlay') opt.overlay = args[++i];
  else if (a === '--w') opt.w = +args[++i];
  else if (a === '--h') opt.h = +args[++i];
  else if (a === '--check') opt.check = true;
  else if (a === '--erase') opt.erase = args[++i];
  else opt.files.push(a);
}
if (!opt.quad || opt.quad.length !== 8 || !opt.files.length || !(opt.out || opt.overlay)) {
  console.error('사용법: node screen_crop.mjs --quad x1,y1,x2,y2,x3,y3,x4,y4 (--out 결과.jpg | --overlay 확인.jpg) [--w 1920 --h 1080] [--check] 프레임.jpg …');
  process.exit(1);
}

async function load(f) {
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

const frames = [];
for (const f of opt.files) frames.push(await load(f));
const { W, H } = frames[0];
for (const fr of frames) if (fr.W !== W || fr.H !== H) { console.error('프레임 크기가 서로 다릅니다'); process.exit(1); }

if (opt.overlay) {
  const q = opt.quad;
  const pts = `${q[0]},${q[1]} ${q[2]},${q[3]} ${q[4]},${q[5]} ${q[6]},${q[7]}`;
  const svg = `<svg width="${W}" height="${H}"><polygon points="${pts}" fill="none" stroke="#ff2d2d" stroke-width="2"/></svg>`;
  await sharp(opt.files[0]).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 92 }).toFile(opt.overlay);
  console.log('overlay →', opt.overlay);
  if (!opt.out) process.exit(0);
}

// 1) 화소별 중앙값 합성 (프레임 1장이면 그대로)
const n = frames.length;
let base, disagree = 0;
if (n === 1) base = frames[0].data;
else {
  base = Buffer.alloc(W * H * 3);
  const v = new Array(n);
  for (let p = 0; p < W * H * 3; p++) {
    for (let k = 0; k < n; k++) v[k] = frames[k].data[p];
    v.sort((a, b) => a - b);
    base[p] = v[n >> 1];
  }
  // 프레임 사이 불일치: 중앙값과 40 넘게 다른 프레임이 절반 가까이면 강사가 오래 머문 화소로 본다
  for (let p = 0; p < W * H; p++) {
    let off = 0;
    for (let k = 0; k < n; k++) {
      const d = Math.abs(frames[k].data[p * 3] - base[p * 3]) + Math.abs(frames[k].data[p * 3 + 1] - base[p * 3 + 1]) + Math.abs(frames[k].data[p * 3 + 2] - base[p * 3 + 2]);
      if (d > 120) off++;
    }
    if (off >= Math.floor(n / 2)) disagree++;
  }
}

// 2) 원근 보정: 결과 사각형 (0,0)-(w,h) → quad 로 가는 호모그래피
function homography(src, dst) {
  // src: 결과 좌표 4점, dst: 원본 좌표 4점. dst = H·src
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  // 가우스 소거
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  return b.map((bv, i) => bv / A[i][i]);
}
const q = opt.quad;
const { w, h } = opt;
const Hm = homography([[0, 0], [w, 0], [w, h], [0, h]], [[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]]);
const out = Buffer.alloc(w * h * 3);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const X = x + 0.5, Y = y + 0.5;
  const den = Hm[6] * X + Hm[7] * Y + 1;
  const sx = (Hm[0] * X + Hm[1] * Y + Hm[2]) / den - 0.5;
  const sy = (Hm[3] * X + Hm[4] * Y + Hm[5]) / den - 0.5;
  const x0 = Math.max(0, Math.min(W - 2, Math.floor(sx))), y0 = Math.max(0, Math.min(H - 2, Math.floor(sy)));
  const fx = Math.min(1, Math.max(0, sx - x0)), fy = Math.min(1, Math.max(0, sy - y0));
  for (let c = 0; c < 3; c++) {
    const p00 = base[(y0 * W + x0) * 3 + c], p10 = base[(y0 * W + x0 + 1) * 3 + c];
    const p01 = base[((y0 + 1) * W + x0) * 3 + c], p11 = base[((y0 + 1) * W + x0 + 1) * 3 + c];
    out[(y * w + x) * 3 + c] = Math.round(p00 * (1 - fx) * (1 - fy) + p10 * fx * (1 - fy) + p01 * (1 - fx) * fy + p11 * fx * fy);
  }
}
// 3) --erase x,y,w,h[;x,y,w,h…] (결과 좌표): 중앙값으로도 안 지워진 강사 잔상을 배경으로 메운다.
//    글자가 없는 배경 영역에만 쓴다(줄마다 사각형 바로 바깥 왼쪽·오른쪽 화소를 이어 칠함).
//    가린 자리에 글자가 있었으면 메우지 말고, 그 글자가 보이는 다른 프레임을 더 넣는다. 글자를 지어 넣지 않는다.
if (opt.erase) for (const r of opt.erase.split(';')) {
  const [ex, ey, ew, eh] = r.split(',').map(Number);
  const L = Math.max(0, ex - 1), R = Math.min(w - 1, ex + ew);
  for (let y = Math.max(0, ey); y < Math.min(h, ey + eh); y++) for (let x = Math.max(0, ex); x < Math.min(w, ex + ew); x++) {
    const t = ex === 0 ? 1 : (R === w - 1 && ex + ew >= w ? 0 : (x - L) / (R - L));
    for (let c = 0; c < 3; c++) {
      const a = out[(y * w + L) * 3 + c], b = out[(y * w + R) * 3 + c];
      out[(y * w + x) * 3 + c] = Math.round(ex === 0 ? b : (ex + ew >= w ? a : a * (1 - t) + b * t));
    }
  }
}
await sharp(out, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 94 }).toFile(opt.out);
console.log(`→ ${opt.out} ${w}×${h} (프레임 ${n}장 중앙값)`);

if (opt.check) {
  let bad = false;
  const lum = (x, y) => { const i = (y * w + x) * 3; return 0.299 * out[i] + 0.587 * out[i + 1] + 0.114 * out[i + 2]; };
  // 배경 밝기(가운데 아래쪽 넓은 영역의 중앙값)
  const samp = [];
  for (let y = Math.floor(h * 0.05); y < h * 0.95; y += 7) for (let x = Math.floor(w * 0.05); x < w * 0.95; x += 7) samp.push(lum(x, y));
  samp.sort((a, b) => a - b);
  const bg = samp[samp.length >> 1];
  const isInk = (x, y) => Math.abs(lum(x, y) - bg) > 70;
  // 가장자리 띠(1.2%)에 글자 화소가 있으면 잘림 의심
  const band = Math.max(4, Math.round(Math.min(w, h) * 0.012));
  const edges = { 위: 0, 아래: 0, 왼쪽: 0, 오른쪽: 0 };
  for (let x = 0; x < w; x++) for (let y = 0; y < band; y++) { if (isInk(x, y)) edges.위++; if (isInk(x, h - 1 - y)) edges.아래++; }
  for (let y = 0; y < h; y++) for (let x = 0; x < band; x++) { if (isInk(x, y)) edges.왼쪽++; if (isInk(w - 1 - x, y)) edges.오른쪽++; }
  for (const [k, v] of Object.entries(edges)) if (v > band * 3) { console.log(`✗ ${k} 가장자리에 글자·물체 화소 ${v}개 — 잘림이나 테두리 남음 의심`); bad = true; }
  // 좌우 여백: 글자 덩어리의 가장 왼쪽·오른쪽 열
  let minX = w, maxX = -1;
  for (let x = band; x < w - band; x++) { let c = 0; for (let y = band; y < h - band; y += 2) if (isInk(x, y)) c++; if (c >= 3) { if (x < minX) minX = x; if (x > maxX) maxX = x; } }
  if (maxX >= 0) console.log(`좌우 여백: 왼쪽 ${minX}px · 오른쪽 ${w - 1 - maxX}px (슬라이드 디자인이 대칭이면 비슷해야 함 — 스크린 테두리 quad가 맞는지 판단용)`);
  if (n > 1) { const r = disagree / (W * H); console.log(`프레임 불일치 화소 ${(r * 100).toFixed(2)}%`); }
  console.log(bad ? '검사: 확인 필요' : '검사: 가장자리 이상 없음');
  if (bad) process.exit(2);
}
