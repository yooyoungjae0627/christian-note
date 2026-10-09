// 공란 감사: 본문 쪽 가운데 아래 공란이 큰 쪽을 찾는다(다음 쪽이 새 섹션으로 시작하는 쪽은 제외).
// node audit.mjs <pdf> <toc_pages.json>
import fs from "fs";
import * as mupdf from "mupdf";

const [pdf, tocJson] = process.argv.slice(2);
const pages = JSON.parse(fs.readFileSync(tocJson, "utf8"));
// 새 쪽에서 시작하는 섹션(이야기 표제·뒷부분)
const starts = new Set(Object.entries(pages).filter(([id]) => /^S\d+(sum|quiz|ans|faq|gl)?$/.test(id)).map(([, p]) => p));
const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
const MM = 72 / 25.4, TOP = 16 * MM, BOTTOM = (210 - 19) * MM, H = BOTTOM - TOP;
const first = Math.min(...[...starts]);
const low = [];
for (let i = first; i < doc.countPages(); i++) {
  const pno = i + 1;
  if (starts.has(pno + 1) || pno === doc.countPages()) continue; // 섹션 끝 쪽의 공란은 허용
  let maxY = 0;
  const pg = doc.loadPage(i), st = pg.toStructuredText("preserve-images");
  st.walk({
    onImageBlock(b) { maxY = Math.max(maxY, b[3]); },
    beginLine(b) { if (b[1] < BOTTOM) maxY = Math.max(maxY, b[3]); },
  });
  st.destroy(); pg.destroy();
  const fill = (maxY - TOP) / H;
  if (fill < 0.8) low.push(`${pno}쪽 ${(fill * 100).toFixed(0)}%`);
}
console.log(low.length ? "공란이 큰 본문 쪽(80% 미만): " + low.join(", ") : "공란이 큰 본문 쪽 없음");
