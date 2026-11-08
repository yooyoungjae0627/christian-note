// 강의 노트 md → PDF(A4). node pdf.mjs <노트.md> <출력.pdf>
// 의존: /tmp/topicbook/node_modules/marked, 전역 playwright (클라우드 세션은 bash tools/cloud_setup.sh 후)
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
const { marked } = await import(pathToFileURL(path.join(os.tmpdir(), "topicbook/node_modules/marked/lib/marked.esm.js")).href);
const { chromium } = await import(pathToFileURL(path.join(execSync("npm root -g").toString().trim(), "playwright/index.mjs")).href);
const [src, out] = process.argv.slice(2);
const dir = path.dirname(path.resolve(src));
let md = fs.readFileSync(src, "utf8");
// 그림은 data URI로 넣어 PDF 하나로 완결
md = md.replace(/!\[([^\]]*)\]\(([^)]+\.png)\)/g, (_, alt, p) => `<img class="comic" alt="${alt}" src="data:image/png;base64,${fs.readFileSync(path.join(dir, p)).toString("base64")}">`);
// 「만화 6컷」 제목과 그림을 한 쪽에 붙인다(제목만 앞쪽 끝에 홀로 남지 않게)
const body = marked.parse(md).replace(/<h3>([^<]*만화 6컷[^<]*)<\/h3>\s*<p>(<img class="comic"[^>]*>)<\/p>/g, '<div class="comicpage"><h3>$1</h3>$2</div>');
const css = `@page{size:A4;margin:16mm 15mm 16mm;}
body{font:10.5pt/1.75 "Noto Sans KR";color:#1d2433;word-break:keep-all;}
h1{font:900 19pt/1.35 "Noto Sans KR";color:#18233f;border-bottom:1mm solid #c9973b;padding-bottom:2mm;margin:0 0 4mm;}
h2{font:900 15pt/1.4 "Noto Sans KR";color:#18233f;margin:0 0 3mm;padding:2mm 3mm;background:#f4ecd8;border-left:2mm solid #c9973b;break-before:page;}
h3{font:800 12pt/1.4 "Noto Sans KR";color:#8a5a1a;margin:5mm 0 2mm;break-after:avoid;}
h1+blockquote+p+hr+h2,hr+h2:first-of-type{break-before:auto;}
p{margin:1.5mm 0;}
ul{margin:1mm 0 2mm;padding-left:6mm;} li{margin:.6mm 0;}
strong{color:#7a2e1a;}
blockquote{margin:2.5mm 0;padding:2mm 4mm;background:#eef3f8;border-left:1.2mm solid #4a78a8;border-radius:1mm;font-size:9.6pt;break-inside:avoid;}
blockquote p{margin:0;}
a{color:#2f5f9a;text-decoration:none;}
code{font-size:8.6pt;background:#f2f0ea;padding:0 1mm;border-radius:.6mm;}
hr{border:0;border-top:.3mm solid #d8cfb8;margin:4mm 0;}
.comicpage{break-before:page;break-inside:avoid;} .comicpage h3{margin-top:0;} img.comic{width:100%;display:block;}
table{border-collapse:collapse;width:100%;font-size:9pt;break-inside:auto;}
th,td{border:.3mm solid #c9b98f;padding:1.4mm 2mm;vertical-align:top;}
th{background:#f4ecd8;}
h2:last-of-type{break-before:page;}`;
const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><style>${css}</style><body>${body}</body></html>`;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(html, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true,
  displayHeaderFooter: true, headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;text-align:center;font:8px 'Noto Sans KR';color:#8a7442;">강의 필기 노트 — 속이지 마세요 자신을 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>` });
await browser.close();
console.log(out);
