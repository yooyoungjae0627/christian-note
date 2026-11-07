// 표지 미리보기: node cover_preview.mjs <원본> NN <out.png>  (책과 똑같은 표지 HTML을 Edge로 찍는다. 샌드박스 밖에서 실행)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadBook } from "./parse.mjs";
import { coverHtml } from "./common.mjs";
import { edgeShot } from "./edge.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const [root, nn, out] = process.argv.slice(2);
process.argv[4] = nn; // loadBook은 세 번째 인자를 책 번호로 읽는다
const book = loadBook(root);
const html = path.resolve(out.replace(/\.png$/i, "") + "_cover.html");
fs.writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>${fs.readFileSync(path.join(here, "print.css"), "utf8")} body{margin:0}</style></head><body>${coverHtml(book)}</body></html>`);
edgeShot(html, path.resolve(out), 559, 794, 1);
fs.rmSync(html);
console.log("표지 미리보기:", out);
