// 만화 6컷을 PNG로: node render.mjs <출력 폴더>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { panelSvg, captionHtml } from "/home/user/christian-note/tools/chapterbook/comic.mjs";
import { COMICS } from "./comics.mjs";
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
const CSS = `body{margin:0;background:#fffdf7;font-family:"Noto Sans KR";}
.page{width:860px;padding:22px 24px 18px;box-sizing:border-box;background:#fffdf7;}
.head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:3px solid #c9973b;padding-bottom:6px;margin-bottom:12px;}
.head .t{font:900 21px/1.3 "Noto Sans KR";color:#18233f;}
.head .n{font:500 13px "Noto Sans KR";color:#8a7442;}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;}
.panel{position:relative;}
.panel svg{width:100%;height:auto;display:block;border-radius:6px;}
.pnum{position:absolute;left:7px;top:7px;width:24px;height:24px;border-radius:50%;background:#18233f;color:#fff;font:700 13px/24px "Noto Sans KR";text-align:center;}
.cap{font:500 14.5px/1.55 "Noto Sans KR";color:#1d2433;margin-top:6px;}
.cu{text-decoration:underline;text-decoration-color:#c0392b;text-decoration-thickness:2.5px;text-underline-offset:4px;font-weight:700;}
.note{font:12px/1.5 "Noto Sans KR";color:#6b5d3d;margin-top:10px;}`;
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 860, height: 1200 } });
for (const c of COMICS) {
  const cells = c.panels.map((p, i) => `<div class="panel"><div class="pnum">${i + 1}</div>${panelSvg(p, c.key + "_" + i)}<div class="cap">${captionHtml(p)}</div></div>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="page"><div class="head"><span class="t">${esc(c.title)}</span><span class="n">만화 6컷 · 자신을 속임</span></div><div class="grid">${cells}</div><div class="note">말풍선은 필기 노트의 말을 옮긴 것이며 성경 본문 인용이 아닙니다. 하나님·예수님은 사람 모양으로 그리지 않고 빛으로만 나타냈습니다.</div></div>`;
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$(".page");
  const f = path.join(out, `자신을_속임_만화_${c.key}.png`);
  await el.screenshot({ path: f });
  console.log(f);
}
await browser.close();
