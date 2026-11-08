// 만화 6컷을 PNG로: node render.mjs <출력 폴더>
import fs from "node:fs";
import path from "node:path";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { panelSvg, captionHtml, bubble, says, W, H, GY } from "/home/user/christian-note/tools/chapterbook/comic.mjs";

// ── 겹침 검사(사용자 지시 2026-11-08 「말풍선이 겹치는 부분 절대로 막아라」) ──
// 말풍선끼리, 말풍선과 얼굴(머리), 말풍선과 효과음 글자, 꼬리가 다른 말풍선·얼굴을 지나는 것, 판 밖으로 나가는 것을 모두 막는다.
const hit = (a, b, pad = 4) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const inBox = ([x, y], b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h;
function heads(p) {
  const out = [];
  for (const a of p.art || []) {
    if (!a.f) continue;
    const x = a.x ?? W / 2, y = a.y ?? GY, s = (a.s ?? 1) * (a.f === "child" ? 0.72 : 1), dir = a.flip ? -1 : 1;
    if (a.pose === "lie") { const cx = x - 34 * dir * s, cy = y - 6 * s; out.push({ who: a.name || a.f, x: cx - 16 * s, y: cy - 16 * s, w: 32 * s, h: 32 * s }); continue; }
    const low = ["kneel", "bow", "sit"].includes(a.pose), cy = y + (low ? -50 : -64) * s, top = cy - (a.crown ? 24 : 17) * s;
    out.push({ who: a.name || a.f, x: x - 16 * s, y: top, w: 32 * s, h: cy + 15 * s - top });
  }
  return out;
}
export function overlaps(p) {
  const bad = [], bs = says(p).map((x) => ({ say: x, ...bubble(x) })), hs = heads(p);
  const fx = (p.sfx || []).map((t) => { const sz = t.s || 15, w = [...t.t].length * sz; return { x: t.x - w / 2, y: t.y - sz, w, h: sz * 1.2 }; });
  bs.forEach((b, i) => {
    const B = b.box, tail = b.say.at || [W / 2, 70];
    if (B.x < 2 || B.y < 2 || B.x + B.w > W - 2 || B.y + B.h > H - 2) bad.push(`말풍선 「${b.say.text}」가 판 밖으로 나감`);
    bs.forEach((c, j) => { if (j > i && hit(B, c.box)) bad.push(`말풍선 「${b.say.text}」와 「${c.say.text}」가 겹침`); });
    hs.forEach((h) => { if (hit(B, h, 1)) bad.push(`말풍선 「${b.say.text}」가 ${h.who}의 얼굴을 가림`); });
    fx.forEach((f) => { if (hit(B, f)) bad.push(`말풍선 「${b.say.text}」가 효과음과 겹침`); });
    // 꼬리: 말풍선 아래 끝에서 at까지 — 다른 말풍선이나 얼굴을 지나면 안 된다(끝점이 얼굴 안이어도 안 된다)
    if (tail[1] > B.y + B.h + 4) {
      const cx = Math.min(Math.max(tail[0], B.x + 12), B.x + B.w - 12), y0 = B.y + B.h;
      for (let k = 1; k <= 20; k++) {
        const t = k / 20, pt = [cx + (tail[0] - cx) * t, y0 + (tail[1] - y0) * t];
        const o = bs.find((c, j) => j !== i && inBox(pt, c.box)); if (o) { bad.push(`말풍선 「${b.say.text}」의 꼬리가 「${o.say.text}」를 지남`); break; }
        const h = hs.find((h) => inBox(pt, h)); if (h) { bad.push(`말풍선 「${b.say.text}」의 꼬리가 ${h.who}의 얼굴에 닿음`); break; }
      }
    }
  });
  return bad;
}
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
.pnum{display:inline-block;width:21px;height:21px;border-radius:50%;background:#18233f;color:#fff;font:700 12px/21px "Noto Sans KR";text-align:center;margin-right:6px;vertical-align:1px;}
.cap{font:500 14.5px/1.55 "Noto Sans KR";color:#1d2433;margin-top:6px;}
.cu{text-decoration:underline;text-decoration-color:#c0392b;text-decoration-thickness:2.5px;text-underline-offset:4px;font-weight:700;}
.note{font:12px/1.5 "Noto Sans KR";color:#6b5d3d;margin-top:10px;}`;
let nbad = 0;
for (const c of COMICS) c.panels.forEach((p, i) => overlaps(p).forEach((m) => { nbad++; console.error(`겹침 ${c.key}-${i + 1}: ${m}`); }));
console.log(`겹침 검사: ${nbad}건`);
if (nbad) process.exit(1);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 860, height: 1200 } });
for (const c of COMICS) {
  const cells = c.panels.map((p, i) => `<div class="panel">${panelSvg(p, c.key + "_" + i)}<div class="cap"><span class="pnum">${i + 1}</span>${captionHtml(p)}</div></div>`).join("");
  const html = `<!doctype html><meta charset="utf-8"><style>${CSS}</style><div class="page"><div class="head"><span class="t">${esc(c.title)}</span><span class="n">만화 6컷 · 속이지 마세요 자신을</span></div><div class="grid">${cells}</div><div class="note">말풍선은 필기 노트의 말을 옮긴 것이며 성경 본문 인용이 아닙니다. 하나님·예수님은 사람 모양으로 그리지 않고 빛으로만 나타냈습니다.</div></div>`;
  await page.setContent(html);
  await page.evaluate(() => document.fonts.ready);
  const el = await page.$(".page");
  const f = path.join(out, `속이지_마세요_자신을_만화_${c.key}.png`);
  await el.screenshot({ path: f });
  console.log(f);
}
await browser.close();
