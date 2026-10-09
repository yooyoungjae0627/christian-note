// EPUB 기본 검사(어느 교재든): node check_epub.mjs <파일.epub> [더 …]
// mimetype 첫 항목·무압축, XML 문법, 내부 링크·그림 연결, nav·ncx 있음, mupdf로 열림. 하나라도 어긋나면 exit 1
import fs from "fs";
import JSZip from "jszip";
import { XMLValidator } from "fast-xml-parser";
import * as mupdf from "mupdf";

let bad = 0;
for (const f of process.argv.slice(2)) {
  const buf = fs.readFileSync(f), problems = [];
  if (buf.readUInt32LE(0) !== 0x04034b50 || buf.readUInt16LE(8) !== 0 || buf.toString("latin1", 30, 38) !== "mimetype") problems.push("mimetype이 첫 항목·무압축이 아님");
  const zip = await JSZip.loadAsync(buf);
  const names = new Set(Object.keys(zip.files));
  const opfPath = (await zip.file("META-INF/container.xml").async("string")).match(/full-path="([^"]+)"/)[1];
  const base = opfPath.replace(/[^/]*$/, "");
  let xml = 0, links = 0;
  for (const n of [...names].filter((n) => /\.(xhtml|opf|ncx|xml)$/.test(n))) {
    const s = await zip.file(n).async("string");
    const v = XMLValidator.validate(s);
    if (v !== true) problems.push(`XML 오류 ${n}: ${v.err.msg}`);
    xml++;
    const dir = n.replace(/[^/]*$/, "");
    for (const [, h] of s.matchAll(/(?:href|src)="([^"#]+)(?:#[^"]*)?"/g)) {
      if (/^(https?:|mailto:)/.test(h) || n.endsWith(".opf")) continue;
      const target = (dir + h).replace(/[^/]+\/\.\.\//g, "");
      if (!names.has(target)) problems.push(`${n}: 없는 대상 ${h}`); else links++;
    }
  }
  const opf = await zip.file(opfPath).async("string");
  if (!/properties="nav"/.test(opf)) problems.push("nav 차례 없음");
  if (!/application\/x-dtbncx\+xml/.test(opf)) problems.push("toc.ncx 없음");
  for (const [, h] of opf.matchAll(/<item [^>]*href="([^"]+)"/g)) if (!names.has(base + h)) problems.push("opf 항목 파일 없음: " + h);
  let pages = 0;
  try { const d = mupdf.Document.openDocument(buf, "application/epub+zip"); pages = d.countPages(); d.destroy(); } catch (e) { problems.push("mupdf로 열리지 않음: " + e.message); }
  console.log(`${problems.length ? "✗" : "✓"} ${f} | XML ${xml}개 | 내부 연결 ${links}개 | mupdf ${pages}쪽`);
  problems.slice(0, 20).forEach((p) => console.log("   ", p));
  if (problems.length) bad++;
}
process.exit(bad ? 1 : 0);
