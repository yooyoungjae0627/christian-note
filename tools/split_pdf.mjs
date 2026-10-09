// PDF를 크기 한도 이하 조각으로 나눈다(노션 무료 요금제 파일당 5MiB — 사용자 지시 2026-10-09).
// node split_pdf.mjs <입력.pdf> <출력폴더> [한도MiB=4.8]  → <이름>_1of3.pdf … , 쪽 범위를 JSON으로 출력
// 쪽 순서 그대로 균등하게 나누고, 조각 하나라도 한도를 넘으면 조각 수를 늘려 다시 나눈다.
import fs from "fs";
import path from "path";
import * as mupdf from "mupdf";

const [inPdf, outDir, limitMiB = "4.8"] = process.argv.slice(2);
const LIMIT = Number(limitMiB) * 1048576;
const src = mupdf.Document.openDocument(fs.readFileSync(inPdf), "application/pdf").asPDF();
const N = src.countPages(), base = path.basename(inPdf, ".pdf");
const total = fs.statSync(inPdf).size;

const srcBuf = fs.readFileSync(inPdf);
function build(a, b) { // a..b (0부터, 끝 포함)
  // 쪽을 옮겨 붙이면(graftPage) 링크가 빠진다 → 붙인 뒤 원본 쪽의 링크를 같은 자리에 다시 만든다(2026-10-09).
  // (범위 밖 쪽을 지우는 방식은 공용 글꼴이 조각마다 남아 너무 커져 쓰지 않는다)
  // 바깥 링크(유튜브)는 그대로, 안쪽 링크(차례 이동)는 같은 조각 안의 쪽으로 가는 것만 옮긴다.
  const d = new mupdf.PDFDocument(), map = d.newGraftMap();
  for (let i = a; i <= b; i++) map.graftPage(-1, src, i);
  for (let i = a; i <= b; i++) {
    const sp = src.loadPage(i), dp = d.loadPage(i - a);
    for (const l of sp.getLinks()) {
      let uri = l.getURI();
      if (!l.isExternal()) {
        let t = -1; try { t = src.resolveLinkDestination(uri).page; } catch {}
        if (t < a || t > b) continue;
        uri = `#page=${t - a + 1}`;
      }
      dp.createLink(l.getBounds(), uri);
    }
    sp.destroy(); dp.destroy();
  }
  // asUint8Array()는 WASM 메모리를 그대로 보는 창이라 destroy 뒤에는 내용이 바뀐다 → 곧바로 복사(2026-10-09 조각 파일 깨짐 사고)
  const buf = Buffer.from(d.saveToBuffer("garbage=4,compress").asUint8Array());
  d.destroy();
  return buf;
}

for (let k = Math.max(2, Math.ceil(total / LIMIT)); k <= N; k++) {
  const parts = [], per = Math.ceil(N / k);
  let ok = true;
  for (let p = 0; p < k; p++) {
    const a = p * per, b = Math.min(N - 1, a + per - 1);
    if (a > b) break;
    const buf = build(a, b);
    if (buf.length > LIMIT) { ok = false; break; }
    parts.push({ a, b, buf });
  }
  if (!ok) continue;
  fs.mkdirSync(outDir, { recursive: true });
  const out = parts.map((p, i) => {
    const f = path.join(outDir, `${base}_${i + 1}of${parts.length}.pdf`);
    fs.writeFileSync(f, p.buf);
    return { file: f, from: p.a + 1, to: p.b + 1, mib: +(p.buf.length / 1048576).toFixed(2) };
  });
  // 확인: 조각 쪽 수 합 = 원본 쪽 수
  const sum = out.reduce((s, o) => s + mupdf.Document.openDocument(fs.readFileSync(o.file), "application/pdf").countPages(), 0);
  console.log(JSON.stringify({ src: base, pages: N, parts: out, pageSumOk: sum === N }));
  process.exit(sum === N ? 0 : 1);
}
console.error("나눌 수 없음: " + base);
process.exit(1);
