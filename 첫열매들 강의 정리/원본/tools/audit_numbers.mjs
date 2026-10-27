// 전수 검사: 책 안에 권·순번 숫자(제 N권, N 번째 이야기 …)가 남았는지 PDF 모든 쪽과 EPUB 모든 파일에서 찾는다.
// node audit_numbers.mjs <PDF·EPUB이 있는 폴더>   (사용자 지시 2026-10-09: Theme 책에는 권·순번 숫자를 쓰지 않는다)
// 강의 본문 속 "두 번째 질문", "53권"(성경 책 수) 같은 말은 강의 원문이라 대상이 아니다 → 책·이야기 순번 꼴만 찾는다.
import fs from "fs";
import path from "path";
import * as mupdf from "mupdf";
import JSZip from "jszip";

const dir = process.argv[2];
const KO = "(?:첫|두|세|네|다섯|여섯|일곱|여덟|아홉|열|열한|열두|열세|열네|열다섯|열여섯|열일곱|열여덟|열아홉|스무|스물한|스물두|스물세|스물네|스물다섯|스물여섯|스물일곱|스물여덟|스물아홉|서른|서른한|서른두|서른세|서른네)";
const PATTERNS = [
  new RegExp(`\\d+\\s*번째\\s*이야기`), new RegExp(`${KO}\\s*번째\\s*이야기`), // N 번째 이야기
  /제\s*\d+\s*권/, /성경 주제별 교재\s*·\s*\d/, /\d+\s*권으로/, /시리즈의\s*\d/,       // 제 N권, 시리즈 몇 권
]; // 「이야기 34」 같은 차례 쪽 번호는 순번이 아니므로 찾지 않는다
const hit = (t) => PATTERNS.filter((re) => re.test(t)).map((re) => t.match(re)[0]);

let bad = 0, pdfs = 0, epubs = 0;
for (const f of fs.readdirSync(dir).sort()) {
  const full = path.join(dir, f), found = [];
  if (f.endsWith(".pdf")) {
    pdfs++;
    const d = mupdf.Document.openDocument(fs.readFileSync(full), "application/pdf");
    for (let i = 0; i < d.countPages(); i++) { const p = d.loadPage(i), st = p.toStructuredText(); for (const h of hit(st.asText().replace(/\s+/g, " "))) found.push(`${i + 1}쪽 「${h}」`); st.destroy(); p.destroy(); }
    const meta = ["info:Title", "info:Subject"].map((k) => d.getMetaData(k) || "").join(" "); for (const h of hit(meta)) found.push(`메타 「${h}」`);
    d.destroy();
  } else if (f.endsWith(".epub")) {
    epubs++;
    const z = await JSZip.loadAsync(fs.readFileSync(full));
    for (const n of Object.keys(z.files).filter((n) => /\.(xhtml|opf|ncx)$/.test(n))) {
      const t = (await z.file(n).async("string")).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      for (const h of hit(t)) found.push(`${n} 「${h}」`);
    }
  } else continue;
  if (found.length) { bad++; console.log(`✗ ${f}: ${found.slice(0, 6).join(", ")}${found.length > 6 ? ` …외 ${found.length - 6}` : ""}`); }
}
console.log(`전수 검사: PDF ${pdfs}권 · EPUB ${epubs}권, 숫자 남은 책 ${bad}권`);
process.exit(bad ? 1 : 0);
