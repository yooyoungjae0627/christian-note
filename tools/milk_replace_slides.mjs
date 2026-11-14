// 밀크 완성 PDF 안의 슬라이드 그림을 새 그림(스크린만 펴서 잘라 낸 1920×1080 JPEG)으로 바꾼다.
// 밀크는 원고(빌드 원본)가 저장소에 없으므로 완성 PDF를 직접 고친다(주제별 지침 §0 2026-11-14 방식을 밀크에도 — 사용자 지시 2026-11-14).
// - 옛 그림 상자(둥근 모서리 클립) 안에 새 그림을 비율 그대로 맞춰 가운데 둔다(늘이거나 자르지 않음). 새 그림 둘레에 같은 둥근 클립.
// - 쪽 배치·글·링크는 건드리지 않는다.
// node milk_replace_slides.mjs <입력.pdf> <출력.pdf> <대응.json>
//   대응.json = { "<옛 그림 객체 번호>": "새그림.jpg", … }
import fs from "fs";
import path from "path";
import * as mupdf from "mupdf";

const [inPdf, outPdf, mapJson] = process.argv.slice(2);
if (!mapJson) { console.error("사용법: node milk_replace_slides.mjs <입력.pdf> <출력.pdf> <대응.json>"); process.exit(1); }
const MAP = JSON.parse(fs.readFileSync(mapJson, "utf8"));
const doc = mupdf.Document.openDocument(fs.readFileSync(inPdf), "application/pdf").asPDF();
const N = doc.countPages();

function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), comps: buf[i + 9] };
    i += 2 + len;
  }
  throw new Error("JPEG 크기를 읽지 못함");
}
const newRef = {};
for (const [num, file] of Object.entries(MAP)) {
  const buf = fs.readFileSync(file), { w, h, comps } = jpegSize(buf);
  if (comps !== 3) throw new Error(`${file}: RGB JPEG가 아님`);
  const d = doc.newDictionary();
  d.put("Type", doc.newName("XObject")); d.put("Subtype", doc.newName("Image"));
  d.put("Width", w); d.put("Height", h); d.put("BitsPerComponent", 8);
  d.put("ColorSpace", doc.newName("DeviceRGB")); d.put("Filter", doc.newName("DCTDecode"));
  newRef[num] = { ref: doc.addRawStream(buf, d), w, h, file };
}

const rounded = (x0, y0, x1, y1, r) => {
  const k = 0.5523 * r, f = (v) => +v.toFixed(4);
  return [
    `${f(x0 + r)} ${f(y0)} m`, `${f(x1 - r)} ${f(y0)} l`, `${f(x1 - r + k)} ${f(y0)} ${f(x1)} ${f(y0 + r - k)} ${f(x1)} ${f(y0 + r)} c`,
    `${f(x1)} ${f(y1 - r)} l`, `${f(x1)} ${f(y1 - r + k)} ${f(x1 - r + k)} ${f(y1)} ${f(x1 - r)} ${f(y1)} c`,
    `${f(x0 + r)} ${f(y1)} l`, `${f(x0 + r - k)} ${f(y1)} ${f(x0)} ${f(y1 - r + k)} ${f(x0)} ${f(y1 - r)} c`,
    `${f(x0)} ${f(y0 + r)} l`, `${f(x0)} ${f(y0 + r - k)} ${f(x0 + r - k)} ${f(y0)} ${f(x0 + r)} ${f(y0)} c`, "h W n",
  ].join("\n");
};

const done = {}; const log = [];
for (let i = 0; i < N; i++) {
  const po = doc.findPage(i);
  const xo = po.get("Resources").get("XObject");
  if (!xo.isDictionary()) continue;
  const keys = [];
  xo.forEach((v, k) => { if (v.isIndirect() && newRef[v.asIndirect()]) keys.push([k, v.asIndirect()]); });
  if (!keys.length) continue;
  const c = po.get("Contents");
  const parts = c.isArray() ? Array.from({ length: c.length }, (_, k) => c.get(k)) : [c];
  let s = Buffer.concat(parts.map((x) => Buffer.from(x.readStream().asUint8Array()))).toString("latin1");
  for (const [key, num] of keys) {
    const re = new RegExp(`([\\d.]+) 0 0 -([\\d.]+) ([-\\d.]+) ([-\\d.]+) cm\\n((?:(?![^\\n]* cm\\n)[^\\n]*\\n){0,4}?)\\/${key} Do`, "g");
    let hit = 0;
    s = s.replace(re, (all, W0, H0, X, Y, mid) => {
      hit++;
      W0 = +W0; H0 = +H0; X = +X; Y = +Y; // 그림 상자: x ∈ [X, X+W0], y ∈ [Y-H0, Y] (아래로 커지는 좌표)
      const { w, h } = newRef[num], a = w / h;
      let nw = W0, nh = H0, nx = X, ny = Y;
      if (W0 / H0 > a) { nw = H0 * a; nx = X + (W0 - nw) / 2; } else { nh = W0 / a; ny = Y - (H0 - nh) / 2; }
      const r = 0.0152 * W0;
      log.push(`${i + 1}쪽 ${key}(${num}) 상자 ${W0.toFixed(1)}×${H0.toFixed(1)} → ${nw.toFixed(1)}×${nh.toFixed(1)} (${path.basename(newRef[num].file)})`);
      return `${rounded(nx, ny - nh, nx + nw, ny, r)}\n${+nw.toFixed(5)} 0 0 -${+nh.toFixed(5)} ${+nx.toFixed(5)} ${+ny.toFixed(5)} cm\n${mid}/${key} Do`;
    });
    if (!hit) { console.error(`✗ ${i + 1}쪽 ${key}(${num}): 그림 그리기 명령을 찾지 못함`); process.exit(1); }
    xo.put(key, newRef[num].ref);
    done[num] = (done[num] || 0) + hit;
  }
  po.put("Contents", doc.addStream(Buffer.from(s, "latin1"), doc.newDictionary()));
}
const miss = Object.keys(newRef).filter((n) => !done[n]);
if (miss.length) { console.error(`✗ 쪽에서 찾지 못한 그림 객체: ${miss.join(", ")}`); process.exit(1); }
fs.writeFileSync(outPdf, doc.saveToBuffer("garbage=3,compress").asUint8Array());
console.log(log.join("\n"));
console.log(`✓ ${path.basename(outPdf)} | 그림 ${Object.keys(newRef).length}장 바꿈 | ${N}쪽`);
