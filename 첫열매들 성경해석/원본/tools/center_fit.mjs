// 자막 상자·띠·잘라 낸 화면 글 그림을 내용이 정가운데에 오도록 다시 자른다(좌우·위아래 여백 똑같이).
// 지침: docs/policy/성경주제별_교재_제작지침.md §0 「자막 상자는 상자만, 보기 좋게」(사용자 지시 2026-11-14
// 「대칭이 안맞잖아 중앙에 이쁘게 배치가 되어야 하잖아」)
//
//   node center_fit.mjs 입력.jpg 출력.jpg [--pad 0.06] [--thr 45]
//     배경색 = 그림 네 가장자리 화소의 중앙값. 배경과 thr 넘게 다른 화소의 묶음 상자(내용)를 찾고,
//     내용 상자 둘레에 똑같은 여백(pad × 내용 상자 높이, 최소 24px)을 두어 자른다. 원본 밖으로 나가는 여백은 배경색으로 채운다.
//   node center_fit.mjs --check 그림.jpg …
//     내용의 왼쪽·오른쪽 여백 차이, 위·아래 여백 차이가 그림 폭·높이의 3%를 넘거나, 내용이 가장자리에 닿으면(잘림 의심) ✗, exit 2.
//     영상 슬라이드(1920×1080)는 슬라이드 디자인 자체가 비대칭일 수 있으니 눈 확인을 함께 한다.
import sharp from 'sharp';

const a = process.argv.slice(2);
const check = a.includes('--check');
const num = (k, d) => { const i = a.indexOf(k); return i >= 0 ? +a[i + 1] : d; };
const pad = num('--pad', 0.06), thr = num('--thr', 45);
const files = a.filter((x, i) => !x.startsWith('--') && !['--pad', '--thr'].includes(a[i - 1]));

async function analyze(f) {
  const { data, info } = await sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height, px = (x, y) => (y * W + x) * 3;
  const edge = [[], [], []];
  for (let x = 0; x < W; x += 2) for (const y of [0, H - 1]) for (let c = 0; c < 3; c++) edge[c].push(data[px(x, y) + c]);
  for (let y = 0; y < H; y += 2) for (const x of [0, W - 1]) for (let c = 0; c < 3; c++) edge[c].push(data[px(x, y) + c]);
  const bg = edge.map(v => v.sort((p, q) => p - q)[v.length >> 1]);
  const ink = (x, y) => { const i = px(x, y); return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]) > thr * 1.5; };
  // 열·행마다 ink 수 → 잡티(1~2화소)는 무시
  const col = new Array(W).fill(0), row = new Array(H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ink(x, y)) { col[x]++; row[y]++; }
  const minC = Math.max(2, Math.round(H * 0.004)), minR = Math.max(2, Math.round(W * 0.002));
  let x0 = col.findIndex(v => v >= minC), x1 = W - 1 - [...col].reverse().findIndex(v => v >= minC);
  let y0 = row.findIndex(v => v >= minR), y1 = H - 1 - [...row].reverse().findIndex(v => v >= minR);
  return { data, W, H, bg, x0, x1, y0, y1 };
}

let bad = false;
if (check) {
  for (const f of files) {
    const r = await analyze(f);
    if (r.x0 < 0) { console.log(`? ${f}: 내용 없음`); continue; }
    const L = r.x0, R = r.W - 1 - r.x1, T = r.y0, B = r.H - 1 - r.y1;
    const msgs = [];
    // 영상 스크린을 편 슬라이드(정확히 1920×1080)는 슬라이드 디자인·배경 그러데이션 그대로라 여기서 판단하지 않는다
    // (스크린 테두리 맞춤·글자 잘림은 screen_crop.mjs --check와 눈 확인으로)
    const slide = Math.abs(r.W / r.H - 16 / 9) < 0.01 && r.W >= 1280;
    if (slide) { console.log(`· ${f} ${r.W}×${r.H} 16:9 영상 슬라이드 — screen_crop --check·눈 확인 대상`); continue; }
    if (!slide && Math.abs(L - R) > r.W * 0.03) msgs.push(`좌우 여백 ${L}/${R}px`);
    if (!slide && Math.abs(T - B) > r.H * 0.03) msgs.push(`위아래 여백 ${T}/${B}px`);
    if (L <= 1 || R <= 1 || T <= 1 || B <= 1) msgs.push('내용이 가장자리에 닿음(잘림 의심)');
    console.log(`${msgs.length ? '✗' : '✓'} ${f} ${r.W}×${r.H} 여백 좌${L} 우${R} 위${T} 아래${B}${msgs.length ? ' — ' + msgs.join(', ') : ''}`);
    if (msgs.length) bad = true;
  }
  process.exit(bad ? 2 : 0);
}

const [inp, out] = files;

// --text: 반투명 자막 상자처럼 뒤에 강사·배경이 비치는 그림. 글자 화소(밝은 글자·진한 색 글자)는 원본 그대로 두고,
// 나머지는 상자 색 한 가지로 고르게 칠한 뒤 글자 묶음이 정가운데에 오도록 사방 같은 여백으로 자른다.
// 글자 화소는 원본에서 그대로 옮기므로 글자를 새로 그리지 않는다. 결과는 반드시 눈으로 확인(강사 옷의 밝은 부분이 글자로 잡히면 --lum을 올림).
if (a.includes('--text')) {
  const lumT = num('--lum', 165);
  const { data, info } = await sharp(inp).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const L = new Float32Array(W * H), M = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r0 = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    L[i] = 0.299 * r0 + 0.587 * g + 0.114 * b;
    const sat = Math.max(r0, g, b) - Math.min(r0, g, b);
    if (L[i] > lumT || (sat > 90 && L[i] > 110)) M[i] = 1;
  }
  // 상자 색: 글자가 아닌 화소 중 어두운 쪽 절반의 중앙값(강사 비침보다 상자 바탕에 가깝게)
  const cs = [[], [], []];
  for (let i = 0; i < W * H; i += 3) if (!M[i]) for (let c = 0; c < 3; c++) cs[c].push(data[i * 3 + c]);
  const box = cs.map(v => { v.sort((p, q) => p - q); return v[Math.floor(v.length * 0.3)]; });
  // 글자 묶음 상자
  const col = new Array(W).fill(0), row = new Array(H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M[y * W + x]) { col[x]++; row[y]++; }
  const x0 = col.findIndex(v => v >= 2), x1 = W - 1 - [...col].reverse().findIndex(v => v >= 2);
  const y0 = row.findIndex(v => v >= 2), y1 = H - 1 - [...row].reverse().findIndex(v => v >= 2);
  if (x0 < 0) { console.error('글자를 찾지 못했습니다'); process.exit(1); }
  // 글자 둘레 2px 늘려 안티에일리어싱 가장자리 보존(그 부분은 상자 색 쪽으로 반쯤 섞음)
  const keep = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (M[y * W + x]) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
      const k = (dx === 0 && dy === 0) ? 1 : (Math.max(Math.abs(dx), Math.abs(dy)) === 1 ? 0.75 : 0.35);
      if (keep[Y * W + X] < k) keep[Y * W + X] = k;
    }
  }
  const ch = y1 - y0 + 1, cw = x1 - x0 + 1, p = Math.max(28, Math.round(ch * pad * 1.5));
  const ow = cw + 2 * p, oh = ch + 2 * p, o = Buffer.alloc(ow * oh * 3);
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const sx = x0 - p + x, sy = y0 - p + y, j = (y * ow + x) * 3;
    const k = (sx >= 0 && sy >= 0 && sx < W && sy < H) ? keep[sy * W + sx] : 0;
    for (let c = 0; c < 3; c++) o[j + c] = Math.round(k ? data[(sy * W + sx) * 3 + c] * k + box[c] * (1 - k) : box[c]);
  }
  await sharp(o, { raw: { width: ow, height: oh, channels: 3 } }).jpeg({ quality: 94 }).toFile(out);
  console.log(`→ ${out} ${ow}×${oh} (글자 ${cw}×${ch}, 여백 사방 ${p}px, 상자 색 rgb(${box.join(',')}))`);
  process.exit(0);
}

const r = await analyze(inp);
if (r.x0 < 0) { console.error('내용을 찾지 못했습니다'); process.exit(1); }
const cw = r.x1 - r.x0 + 1, ch = r.y1 - r.y0 + 1;
const p = Math.max(24, Math.round(ch * pad));
const left = r.x0 - p, top = r.y0 - p, w = cw + 2 * p, h = ch + 2 * p;
const ext = { top: Math.max(0, -top), left: Math.max(0, -left), bottom: Math.max(0, top + h - r.H), right: Math.max(0, left + w - r.W) };
const extended = await sharp(r.data, { raw: { width: r.W, height: r.H, channels: 3 } })
  .extend({ ...ext, background: { r: r.bg[0], g: r.bg[1], b: r.bg[2] } }).png().toBuffer();
await sharp(extended)
  .extract({ left: left + ext.left, top: top + ext.top, width: w, height: h })
  .jpeg({ quality: 94 }).toFile(out);
console.log(`→ ${out} ${w}×${h} (내용 ${cw}×${ch}, 여백 사방 ${p}px)`);
