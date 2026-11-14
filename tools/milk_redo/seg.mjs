// 옛 PDF 그림(전체 화면 캡처)마다 저화질 1초 프레임에서 같은 슬라이드가 무대 화면으로 보이는 시각을 찾는다.
// node seg.mjs <scan폴더(640x360 1fps)> <옛그림폴더> <접두어 m1_> <quad1080 8개> <out.json>
import fs from "fs"; import path from "path"; import sharp from "sharp";
const [scanDir, oldDir, prefix, quadS, outJson, regJson] = process.argv.slice(2);
const REG = regJson ? JSON.parse(fs.readFileSync(regJson, 'utf8')) : {};
const Q = quadS.split(",").map(Number);
const DW = 128, DH = 72;
// 사각형 → 작은 회색 기술자(원근 펴기, 최근접)
function homo(src, dst) { const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
  return b.map((v, i) => v / A[i][i]); }
async function desc(file, scale, ox = 0, oy = 0) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const q = Q.map((v, k) => v * scale + (k % 2 ? oy : ox));
  const H = homo([[0, 0], [DW, 0], [DW, DH], [0, DH]], [[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]]);
  const out = new Float32Array(DW * DH);
  // 각 칸을 2x2 표본 평균
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { let s = 0, n = 0;
    for (const dy of [0.25, 0.75]) for (const dx of [0.25, 0.75]) { const X = x + dx, Y = y + dy; const w = H[6] * X + H[7] * Y + 1; const u = Math.round((H[0] * X + H[1] * Y + H[2]) / w), v = Math.round((H[3] * X + H[4] * Y + H[5]) / w);
      if (u >= 0 && v >= 0 && u < info.width && v < info.height) { s += data[v * info.width + u]; n++; } }
    out[y * DW + x] = n ? s / n : 0; }
  let m = 0; for (const v of out) m += v; m /= out.length; let sd = 0; for (let i = 0; i < out.length; i++) { out[i] -= m; sd += out[i] * out[i]; } sd = Math.sqrt(sd) || 1; for (let i = 0; i < out.length; i++) out[i] /= sd;
  return out;
}
const corr = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const olds = fs.readdirSync(oldDir).filter((f) => f.startsWith(prefix) && f.endsWith(".png")).sort();
const od = []; for (const f of olds) { const r = REG[f]; if (!r) throw new Error("reg 없음 " + f); od.push(await desc(path.join(oldDir, f), r.s, r.ox, r.oy)); }
const frames = fs.readdirSync(scanDir).filter((f) => /^\d+\.jpg$/.test(f)).sort();
const C = []; // C[t] = [corr per old]
const cacheF = path.join(scanDir, "desc_" + DW + ".bin"); let SD;
if (fs.existsSync(cacheF)) { const b = fs.readFileSync(cacheF); SD = []; for (let k = 0; k < frames.length; k++) SD.push(new Float32Array(b.buffer, b.byteOffset + k * DW * DH * 4, DW * DH)); }
else { SD = []; for (const f of frames) SD.push(await desc(path.join(scanDir, f), 640 / 1920)); fs.writeFileSync(cacheF, Buffer.concat(SD.map((d) => Buffer.from(d.buffer)))); }
for (const d of SD) C.push(od.map((o) => corr(o, d)));
const WIN = JSON.parse(fs.readFileSync(process.argv[8], "utf8"));
const inW = (i, t) => { const w = WIN[olds[i]]; return t >= w.lo && t <= w.hi; };
const res = olds.map((f, i) => {
  let mx = -1; C.forEach((row, k) => { if (inW(i, k + 1)) mx = Math.max(mx, row[i]); });
  const thr = Math.max(0.5, mx - 0.12);
  const hits = [];
  C.forEach((row, k) => { const t = k + 1; if (!inW(i, t) || row[i] < thr) return;
    // 같은 시각을 구간으로 가진 다른 그림이 더 잘 맞으면 그 그림의 화면
    for (let j = 0; j < olds.length; j++) if (j !== i && inW(j, t) && row[j] > row[i] + 0.01) return;
    hits.push([t, +row[i].toFixed(3)]); });
  return { file: f, n: hits.length, maxCorr: mx.toFixed(3), hits };
});
fs.writeFileSync(outJson, JSON.stringify(res));
for (const r of res) { const ts = r.hits.map((h) => h[0]); console.log(r.file.padEnd(32), "n", String(r.n).padStart(4), "max", r.maxCorr, ts.length ? `${ts[0]}s~${ts.at(-1)}s` : "-"); }
