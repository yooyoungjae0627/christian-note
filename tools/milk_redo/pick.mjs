// 그림마다 받을 1080p 구간(4초)을 고른다: 강사 위치가 서로 겹치지 않게(화소별 중앙값으로 지워지게).
// node pick.mjs <scan폴더> <seg.json> <quad1080> <out.json> [창 개수=6] [fallback 파일=시각들 …]
import fs from "fs"; import path from "path"; import sharp from "sharp";
const [scanDir, segJson, quadS, outJson, Kstr = "6", ...fb] = process.argv.slice(2);
const K = +Kstr, Q = quadS.split(",").map((v) => +v / 3);
const W = 160, H = 90;
function homo(src, dst) { const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
  return b.map((v, i) => v / A[i][i]); }
const Hm = homo([[0, 0], [W, 0], [W, H], [0, H]], [[Q[0], Q[1]], [Q[2], Q[3]], [Q[4], Q[5]], [Q[6], Q[7]]]);
const map = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const X = x + 0.5, Y = y + 0.5, w = Hm[6] * X + Hm[7] * Y + 1; map.push([Math.round((Hm[0] * X + Hm[1] * Y + Hm[2]) / w), Math.round((Hm[3] * X + Hm[4] * Y + Hm[5]) / w)]); }
async function warp(t) { const { data, info } = await sharp(path.join(scanDir, String(t).padStart(5, "0") + ".jpg")).greyscale().raw().toBuffer({ resolveWithObject: true });
  const o = new Uint8Array(W * H); map.forEach(([u, v], i) => { o[i] = data[Math.min(info.height - 1, Math.max(0, v)) * info.width + Math.min(info.width - 1, Math.max(0, u))]; }); return o; }
const seg = JSON.parse(fs.readFileSync(segJson, "utf8"));
const fbMap = {}; for (const a of fb) { const [k, ts] = a.split("="); fbMap[k] = ts.split(",").map(Number); }
const out = {};
for (const s of seg) {
  let ts = s.hits.map((h) => h[0]);
  const key = Object.keys(fbMap).find((k) => s.file.includes(k)); if (key) ts = fbMap[key];
  if (!ts.length) { console.log(s.file, "구간 없음"); continue; }
  const step = Math.max(1, Math.floor(ts.length / 150)); const cand = ts.filter((_, i) => i % step === 0);
  const F = []; for (const t of cand) F.push(await warp(t));
  const M = new Uint8Array(W * H); const tmp = new Array(F.length);
  for (let p = 0; p < W * H; p++) { for (let k = 0; k < F.length; k++) tmp[k] = F[k][p]; tmp.sort((a, b) => a - b); M[p] = tmp[F.length >> 1]; }
  const masks = F.map((f) => { const m = new Uint8Array(W * H); for (let p = 0; p < W * H; p++) if (Math.abs(f[p] - M[p]) > 28) m[p] = 1;
    const d = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m[y * W + x]) for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && xx >= 0 && yy < H && xx < W) d[yy * W + xx] = 1; } return d; });
  const area = masks.map((m) => m.reduce((a, b) => a + b, 0));
  const cnt = new Uint8Array(W * H); const sel = [];
  for (let k = 0; k < Math.min(K, cand.length); k++) {
    let best = -1, bs = Infinity;
    for (let c = 0; c < cand.length; c++) { if (sel.some((j) => Math.abs(cand[j] - cand[c]) < 5)) continue;
      let sc = area[c] * 0.2; for (let p = 0; p < W * H; p++) if (masks[c][p]) sc += cnt[p] * cnt[p] + cnt[p]; if (sc < bs) { bs = sc; best = c; } }
    if (best < 0) break; sel.push(best); for (let p = 0; p < W * H; p++) cnt[p] += masks[best][p];
  }
  let worst = 0; for (let p = 0; p < W * H; p++) worst = Math.max(worst, cnt[p]);
  const times = sel.map((j) => cand[j]).sort((a, b) => a - b);
  out[s.file] = { times, worst, k: sel.length };
  console.log(s.file.padEnd(30), "창", sel.length, "가장 많이 가린 칸", worst + "/" + sel.length, times.join(","));
}
fs.writeFileSync(outJson, JSON.stringify(out, null, 1));
