// 옛 그림마다 FIRSTFRUITS 로고(영상 위 고정 표시)로 영상 프레임 좌표와의 대응(축척 s, 이동 ox, oy)을 찾는다.
// old(x,y) = s*frame(x,y) + (ox,oy)
// node reg.mjs <logo1080.png 원본프레임> <옛그림폴더> <접두어> <out.json>
import fs from "fs"; import path from "path"; import sharp from "sharp";
const [frameRef, oldDir, prefix, outJson] = process.argv.slice(2);
const LX = 30, LY = 25, LW = 220, LH = 85; // 1080p 프레임에서 로고 상자
const ref = await sharp(frameRef).greyscale().raw().toBuffer({ resolveWithObject: true });
const T = new Float32Array(LW * LH); for (let y = 0; y < LH; y++) for (let x = 0; x < LW; x++) T[y * LW + x] = ref.data[(LY + y) * ref.info.width + LX + x];
const res = {};
for (const f of fs.readdirSync(oldDir).filter((f) => f.startsWith(prefix) && f.endsWith(".png")).sort()) {
  const { data, info } = await sharp(path.join(oldDir, f)).greyscale().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const at = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi + 1 >= W || yi + 1 >= info.height) return 0; const fx = x - xi, fy = y - yi; const i = yi * W + xi; return data[i] * (1 - fx) * (1 - fy) + data[i + 1] * fx * (1 - fy) + data[i + W] * (1 - fx) * fy + data[i + W + 1] * fx * fy; };
  let best = { e: Infinity };
  const score = (s, ox, oy, step) => { let e = 0, n = 0; for (let y = 0; y < LH; y += step) for (let x = 0; x < LW; x += step) { const d = at(s * (LX + x) + ox, s * (LY + y) + oy) - T[y * LW + x]; e += d * d; n++; } return e / n; };
  const s0 = W / 1920;
  for (let s = s0 * 0.97; s <= s0 * 1.05; s += s0 * 0.004) for (let ox = -40; ox <= 20; ox += 2) for (let oy = -40; oy <= 20; oy += 2) { const e = score(s, ox, oy, 4); if (e < best.e) best = { e, s, ox, oy }; }
  // 다듬기
  const b0 = { ...best };
  for (let s = b0.s - s0 * 0.004; s <= b0.s + s0 * 0.004; s += s0 * 0.0008) for (let ox = b0.ox - 2; ox <= b0.ox + 2; ox += 0.5) for (let oy = b0.oy - 2; oy <= b0.oy + 2; oy += 0.5) { const e = score(s, ox, oy, 2); if (e < best.e || best.step !== 2) best = { e, s, ox, oy, step: 2 }; }
  res[f] = { s: +best.s.toFixed(5), ox: +best.ox.toFixed(2), oy: +best.oy.toFixed(2), rms: +Math.sqrt(best.e).toFixed(1) };
  console.log(f, JSON.stringify(res[f]));
}
fs.writeFileSync(outJson, JSON.stringify(res));
