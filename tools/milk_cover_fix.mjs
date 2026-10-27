// 밀크 표지 하단의 개인 이름 문구를 지운다(배경·그림은 보존).
// 원고(빌드 원본)가 없는 완성 PDF에 사용한다. 새 문구를 명시한 경우에만 Edge로 만든 투명 PDF를 얹는다.
// node milk_cover_fix.mjs <입력.pdf> <출력.pdf> ["찾을 문구"] ["새 문구"]   (새 문구를 얹을 때만 Edge 필요)
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import * as mupdf from "mupdf";

const [inPdf, outPdf, FIND = "성도 유영재 성경 공부 교재", NEW = ""] = process.argv.slice(2);
const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(fs.existsSync);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "milkcov_"));

function lineOf(doc, text) {
  const p = doc.loadPage(0), st = p.toStructuredText(), j = JSON.parse(st.asJSON());
  st.destroy(); p.destroy();
  for (const b of j.blocks) for (const l of b.lines || []) if (l.text.trim() === text) return l;
  return null;
}
function brightest(doc, bb) {
  const s = 4, p = doc.loadPage(0), pm = p.toPixmap(mupdf.Matrix.scale(s, s), mupdf.ColorSpace.DeviceRGB, false, true);
  const W = pm.getWidth(), px = pm.getPixels(); let best = [255, 255, 255], bl = -1;
  for (let y = Math.round(bb.y * s); y < Math.round((bb.y + bb.h) * s); y++) for (let x = Math.round(bb.x * s); x < Math.round((bb.x + bb.w) * s); x++) {
    const i = (y * W + x) * 3, l = px[i] + px[i + 1] + px[i + 2]; if (l > bl) { bl = l; best = [px[i], px[i + 1], px[i + 2]]; }
  }
  pm.destroy(); p.destroy();
  return "#" + best.map((v) => v.toString(16).padStart(2, "0")).join("");
}
// 투명 배경 한 쪽짜리 PDF에 새 문구를 찍는다
function overlay(l, color, top) {
  const centered = Math.abs(l.bbox.x + l.bbox.w / 2 - 210) < 6;
  const pos = centered ? "left:0;right:0;text-align:center" : `left:${l.bbox.x}pt`;
  const html = path.join(tmp, "ov.html"), pdf = path.join(tmp, "ov.pdf");
  fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:148mm 210mm;margin:0}html,body{margin:0;background:transparent}
  div{position:absolute;${pos};top:${top}pt;font:${centered ? 400 : 500} ${l.font.size}pt/1 "Noto Sans KR",sans-serif;color:${color};white-space:nowrap}</style></head><body><div>${NEW}</div></body></html>`);
  if (fs.existsSync(pdf)) fs.rmSync(pdf);
  execFileSync(EDGE, ["--headless=new", "--mute-audio", "--no-first-run", "--disable-gpu", "--user-data-dir=" + path.join(tmp, "edge"), "--no-pdf-header-footer", "--print-to-pdf=" + pdf, "file:///" + html.split(path.sep).join("/")], { stdio: "ignore", timeout: 120000 });
  for (let i = 0; i < 100 && !(fs.existsSync(pdf) && fs.statSync(pdf).size > 0); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
  return fs.readFileSync(pdf);
}

const src = mupdf.Document.openDocument(fs.readFileSync(inPdf), "application/pdf");
const old = lineOf(src, FIND);
if (!old) { console.error(`✗ ${path.basename(inPdf)}: 표지에서 「${FIND}」 줄을 찾지 못함`); process.exit(1); }
const color = NEW ? brightest(src, old.bbox) : "";

// 새 문구를 명시한 경우에만 위치를 맞춰 얹는다.
let ovBuf;
if (NEW) {
  let top = old.bbox.y;
  ovBuf = overlay(old, color, top);
  { const o = mupdf.Document.openDocument(ovBuf, "application/pdf"), nl = lineOf(o, NEW); o.destroy(); if (!nl) throw new Error("새 문구 PDF에서 글줄을 찾지 못함"); top += old.bbox.y - nl.bbox.y; }
  ovBuf = overlay(old, color, top);
}

const doc = src.asPDF();
const page = doc.loadPage(0);
// 1) 옛 글줄의 글자만 지운다(그림·선·배경은 그대로, 검은 상자 없음)
const pad = 1.2, r = [old.bbox.x - pad, old.bbox.y - pad, old.bbox.x + old.bbox.w + pad, old.bbox.y + old.bbox.h + pad];
const red = page.createAnnotation("Redact"); red.setRect(r);
page.applyRedactions(false, mupdf.PDFPage.REDACT_IMAGE_NONE, mupdf.PDFPage.REDACT_LINE_ART_NONE, mupdf.PDFPage.REDACT_TEXT_REMOVE);
// 2) 새 문구가 있으면 Form XObject로 붙인다.
let ov;
if (NEW) {
  ov = mupdf.Document.openDocument(ovBuf, "application/pdf").asPDF();
  const ovPage = ov.findPage(0), ovContents = ovPage.get("Contents");
  const parts = ovContents.isArray() ? Array.from({ length: ovContents.length }, (_, i) => ovContents.get(i)) : [ovContents];
  const body = Buffer.concat(parts.map((c) => Buffer.from(c.readStream().asUint8Array())));
  const mb = ovPage.get("MediaBox");
  const form = doc.newDictionary();
  form.put("Type", doc.newName("XObject")); form.put("Subtype", doc.newName("Form"));
  form.put("BBox", doc.graftObject(mb)); form.put("Resources", doc.graftObject(ovPage.get("Resources")));
  const xo = doc.addStream(body, form);
  const pobj = doc.findPage(0);
  let res = pobj.get("Resources"); if (!res.isDictionary()) { res = doc.newDictionary(); pobj.put("Resources", res); }
  let xobjs = res.get("XObject"); if (!xobjs.isDictionary()) { xobjs = doc.newDictionary(); res.put("XObject", xobjs); }
  xobjs.put("CoverLine", xo);
  const cont = pobj.get("Contents");
  const arr = doc.newArray();
  arr.push(doc.addStream(Buffer.from("q\n"), doc.newDictionary()));
  if (cont.isArray()) for (let i = 0; i < cont.length; i++) arr.push(cont.get(i)); else arr.push(cont);
  arr.push(doc.addStream(Buffer.from("\nQ\nq /CoverLine Do Q\n"), doc.newDictionary()));
  pobj.put("Contents", arr);
}
fs.writeFileSync(outPdf, doc.saveToBuffer("garbage=1,compress").asUint8Array());
ov?.destroy(); page.destroy(); doc.destroy();
try { fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 400 }); } catch {} // Edge가 프로필을 늦게 놓아 지우지 못할 때가 있다(결과와 무관)

// 확인: 옛 문구가 없고, 명시한 경우에만 새 문구가 옛 자리에 있다.
const chk = mupdf.Document.openDocument(fs.readFileSync(outPdf), "application/pdf");
const gone = !lineOf(chk, FIND), nl = NEW ? lineOf(chk, NEW) : null, n = chk.countPages(); chk.destroy();
const dy = nl ? Math.abs(nl.bbox.y - old.bbox.y) : 99, dx = nl ? Math.abs(nl.bbox.x + nl.bbox.w / 2 - (Math.abs(old.bbox.x + old.bbox.w / 2 - 210) < 6 ? 210 : old.bbox.x + nl.bbox.w / 2)) : 99;
const ok = gone && (!NEW || (nl && dy < 1.5 && dx < 3));
console.log(`${ok ? "✓" : "✗"} ${path.basename(outPdf)} | 옛 문구 ${gone ? "지움" : "남음"} | 새 문구 ${NEW ? (nl ? `y ${nl.bbox.y.toFixed(1)}(옛 ${old.bbox.y.toFixed(1)})` : "없음") : "추가하지 않음"} | ${n}쪽`);
process.exit(ok ? 0 : 1);
