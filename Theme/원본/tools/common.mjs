// PDF·EPUB 공용: 표지
import { esc } from "./parse.mjs";

// 표지 도형(2026-10-09 다시 그림, 첫열매들 교리에 맞춤):
// - 곡식 한 단(한 묶음): 초실절에 흔드는 것은 열매 하나가 아니라 '한 단' — 머리이신 그리스도와 몸인 성도가 한 사람(첫열매들 그리스도). 교회 이름의 뜻.
// - 위의 빛: 말씀(빛). 아래의 펼친 성경: 말씀이 바탕.
// - 십자가는 쓰지 않는다(교회에 십자가를 두지 않는다 — 14번째 이야기 「교회는 건물이 아닙니다」).
const ear = (x, y, ang, s) => {
  // 이삭 하나: 줄기 끝에서 위로 낟알 7쌍
  let k = "";
  for (let i = 0; i < 7; i++) {
    const d = i * 3.1 * s;
    k += `<ellipse cx="${-2.3 * s}" cy="${-d}" rx="${1.55 * s}" ry="${2.7 * s}" transform="rotate(-22 ${-2.3 * s} ${-d})"/>`;
    k += `<ellipse cx="${2.3 * s}" cy="${-d - 1.4 * s}" rx="${1.55 * s}" ry="${2.7 * s}" transform="rotate(22 ${2.3 * s} ${-d - 1.4 * s})"/>`;
  }
  k += `<ellipse cx="0" cy="${-22.5 * s}" rx="${1.4 * s}" ry="${2.6 * s}"/>`;
  return `<g transform="translate(${x} ${y}) rotate(${ang})">${k}<line x1="0" y1="${-22 * s}" x2="0" y2="${-30 * s}" stroke-width=".5"/></g>`;
};

function sheaf() {
  const n = 9, bandY = 128, base = 178;
  let stalks = "", ears = "";
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5; // -0.5 … 0.5
    const topX = 100 + t * 82, topY = 60 + Math.abs(t) * 34;
    const botX = 100 + t * 46;
    const midX = 100 + t * 7;
    stalks += `<path d="M${botX} ${base} Q${midX} ${bandY + 18} ${midX} ${bandY} Q${midX} ${bandY - 26} ${topX} ${topY}"/>`;
    const ang = Math.atan2(topX - midX, -(topY - (bandY - 26))) * 57.3;
    ears += ear(topX, topY, ang, 1.05 - Math.abs(t) * 0.25);
  }
  return `<g fill="none" stroke="#e8c983" stroke-width="1.15" stroke-linecap="round">${stalks}</g>
  <g fill="#f3d999" stroke="#c9973b" stroke-width=".35">${ears}</g>
  <path d="M86 ${bandY - 3} Q100 ${bandY + 3} 114 ${bandY - 3} L114 ${bandY + 4} Q100 ${bandY + 10} 86 ${bandY + 4} Z" fill="#c9973b" stroke="#f3d999" stroke-width=".5"/>
  <path d="M97 ${bandY + 6} q-5 9 -9 12 M103 ${bandY + 6} q5 9 9 12" fill="none" stroke="#c9973b" stroke-width="1.6" stroke-linecap="round"/>`;
}

export const COVER_ART = `<svg width="78mm" height="78mm" viewBox="0 0 200 200">
  <defs><radialGradient id="glow" cx="50%" cy="34%" r="62%"><stop offset="0" stop-color="#f6dfa4" stop-opacity=".55"/><stop offset=".45" stop-color="#e8c983" stop-opacity=".16"/><stop offset="1" stop-color="#e8c983" stop-opacity="0"/></radialGradient></defs>
  <circle cx="100" cy="98" r="96" fill="url(#glow)"/>
  <g stroke="#f1d28e" stroke-linecap="round" opacity=".75">
    ${Array.from({ length: 13 }, (_, i) => { const a = (-90 + (i - 6) * 13) / 57.3, r0 = 30, r1 = i % 2 ? 44 : 54; return `<line x1="${100 + Math.cos(a) * r0}" y1="${44 + Math.sin(a) * r0}" x2="${100 + Math.cos(a) * r1}" y2="${44 + Math.sin(a) * r1}" stroke-width="${i % 2 ? 0.9 : 1.4}"/>`; }).join("")}
  </g>
  ${sheaf()}
  <path d="M100 176 C86 170 62 169 38 172 L38 190 C62 187 86 188 100 194 Z" fill="#1b2650" fill-opacity=".55" stroke="#e9ecf5" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M100 176 C114 170 138 169 162 172 L162 190 C138 187 114 188 100 194 Z" fill="#1b2650" fill-opacity=".55" stroke="#e9ecf5" stroke-width="1.6" stroke-linejoin="round"/>
  <line x1="100" y1="176" x2="100" y2="194" stroke="#e8c983" stroke-width="1.4"/>
</svg>`;

export function coverHtml(book) {
  const motto = (book.coverMotto || []).map(esc).join("<br>");
  // 강의별 한 권: 제목 = 강의 제목(길이에 따라 글자 크기), 그 위에 시리즈 이름과 권 번호
  const len = [...book.title].length, fs = len <= 8 ? 30 : len <= 13 ? 25 : len <= 18 ? 21 : 18;
  const head = book.only
    ? `<div class="head"><div class="ser">${esc(book.series)} · 제 ${Number(book.only)}권</div><h1 style="font-size:${fs}pt">${esc(book.title)}</h1><div class="sub">${esc(book.subtitle)}</div></div>`
    : `<h1>${esc(book.title)}</h1><div class="sub">${esc(book.subtitle)}</div>`;
  return `<div class="cover"><div class="frame"></div><div class="en">${esc(book.titleEn)}</div>
  ${head}<div class="art">${book.coverArt || COVER_ART}</div>
  ${motto ? `<div class="motto">${motto}</div>` : ""}
  <div class="bar"></div><div class="bot">${book.coverBottom.map(esc).join("<br>")}</div></div>`;
}
