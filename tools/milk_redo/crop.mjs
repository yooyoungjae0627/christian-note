// 그림마다: 받은 1080p 구간에서 프레임을 뽑고(초당 3장), 옛 그림과 같은 슬라이드인 무대 화면만 골라
// screen_crop.mjs로 펴서 중앙값 합성 → out/<옛그림이름>.jpg. --check 결과를 모은다.
// node crop.mjs <hd폴더> <pick.json> <seg.json> <reg.json> <옛그림폴더> <quad> <out폴더> [이름 일부만]
import fs from "fs"; import path from "path"; import { execFileSync } from "child_process"; import sharp from "sharp";
const [hd, pickJ, segJ, regJ, oldDir, quadS, outDir, only] = process.argv.slice(2);
const FF = process.env.TEMP + "/books_e/bin/ffmpeg.exe";
const pick = JSON.parse(fs.readFileSync(pickJ)), seg = Object.fromEntries(JSON.parse(fs.readFileSync(segJ)).map((s) => [s.file, s])), REG = JSON.parse(fs.readFileSync(regJ));
const Q = quadS.split(",").map(Number); const DW = 128, DH = 72;
function homo(src, dst) { const A = [], b = []; for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
  for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]]; for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
  return b.map((v, i) => v / A[i][i]); }
async function desc(file, s, ox = 0, oy = 0) {
  const { data, info } = await sharp(file).greyscale().raw().toBuffer({ resolveWithObject: true });
  const q = Q.map((v, k) => v * s + (k % 2 ? oy : ox)); const H = homo([[0, 0], [DW, 0], [DW, DH], [0, DH]], [[q[0], q[1]], [q[2], q[3]], [q[4], q[5]], [q[6], q[7]]]);
  const out = new Float32Array(DW * DH);
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) { let sm = 0, n = 0; for (const dy of [0.25, 0.75]) for (const dx of [0.25, 0.75]) { const X = x + dx, Y = y + dy, w = H[6] * X + H[7] * Y + 1; const u = Math.round((H[0] * X + H[1] * Y + H[2]) / w), v = Math.round((H[3] * X + H[4] * Y + H[5]) / w); if (u >= 0 && v >= 0 && u < info.width && v < info.height) { sm += data[v * info.width + u]; n++; } } out[y * DW + x] = n ? sm / n : 0; }
  let m = 0; for (const v of out) m += v; m /= out.length; let sd = 0; for (let i = 0; i < out.length; i++) { out[i] -= m; sd += out[i] * out[i]; } sd = Math.sqrt(sd) || 1; for (let i = 0; i < out.length; i++) out[i] /= sd; return out; }
const corr = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
fs.mkdirSync(outDir, { recursive: true });
const files = fs.readdirSync(hd).filter((f) => f.endsWith(".mp4"));
const startOf = (f) => parseFloat(f);
const report = [];
for (const [name, p] of Object.entries(pick)) {
  if (only && !name.includes(only)) continue;
  const r = REG[name]; const od = await desc(path.join(oldDir, name), r.s, r.ox, r.oy);
  const fdir = path.join(hd, "fr_" + name.replace(".png", "")); fs.rmSync(fdir, { recursive: true, force: true }); fs.mkdirSync(fdir);
  for (const t of p.times) { const f = files.find((x) => Math.abs(startOf(x) - (t - 1)) < 0.01); if (!f) { console.log(name, "구간 파일 없음", t); continue; }
    execFileSync(FF, ["-loglevel", "error", "-i", path.join(hd, f), "-vf", "fps=1", "-q:v", "2", path.join(fdir, `${t}_%02d.jpg`)]); }
  const frames = fs.readdirSync(fdir).filter((f) => f.endsWith(".jpg"));
  const sc = []; for (const f of frames) sc.push([f, corr(od, await desc(path.join(fdir, f), 1))]);
  const mx = Math.max(...sc.map((x) => x[1]));
  const keep = sc.filter((x) => x[1] >= Math.max(0.5, mx - 0.1)).map((x) => path.join(fdir, x[0]));
  const out = path.join(outDir, name.replace(".png", ".jpg"));
  let chk = "", code = 0;
  try { chk = execFileSync("node", ["screen_crop.mjs", "--quad", quadS, "--out", out, "--check", ...keep], { encoding: "utf8" }); }
  catch (e) { chk = (e.stdout || "") + (e.stderr || ""); code = e.status; }
  report.push({ name, frames: frames.length, keep: keep.length, max: +mx.toFixed(3), code, chk: chk.trim().split("\n").slice(-4).join(" | ") });
  console.log(name, `프레임 ${frames.length} 고름 ${keep.length} max ${mx.toFixed(2)} check ${code}`, chk.trim().split("\n").slice(-3).join(" | "));
}
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 1));
