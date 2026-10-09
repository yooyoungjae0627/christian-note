// PDF·EPUB 공용: 표지, 용어·인물 풀이 목록
import { esc } from "./parse.mjs";

// 표지 도형: 왕관 아래 매끄러운 돌 다섯 개(좌우 대칭)
export const COVER_ART = `<svg width="60mm" height="46mm" viewBox="0 0 120 92">
  <path d="M22 50 L22 20 L41 36 L60 12 L79 36 L98 20 L98 50 Z" fill="none" stroke="#f1d28e" stroke-width="3" stroke-linejoin="round"/>
  <rect x="22" y="53" width="76" height="6" rx="2" fill="#f1d28e"/>
  <circle cx="60" cy="12" r="3.4" fill="#f1d28e"/><circle cx="22" cy="20" r="3" fill="#f1d28e"/><circle cx="98" cy="20" r="3" fill="#f1d28e"/>
  ${[24, 42, 60, 78, 96].map((x) => `<ellipse cx="${x}" cy="80" rx="7" ry="5.2" fill="#e9ecf5" opacity=".92"/>`).join("")}
</svg>`;

export function coverHtml(book, theme = "") {
  return `<div class="cover${theme ? " cover-" + theme : ""}"><div class="ed">${esc(book.edition)}</div><div class="en">${esc(book.titleEn)}</div>
  <h1>${esc(book.title)}</h1><div class="sub">${esc(book.subtitle)}</div><div class="art">${COVER_ART}</div>
  ${book.coverBottom ? `<div class="bar"></div><div class="bot">${book.coverBottom.map(esc).join("<br>")}</div>` : ""}</div>`;
}

// 같은 용어는 처음 나온 강 것만 싣고 가나다순
export function glossItems(book) {
  const seen = new Set(), items = [];
  for (const L of book.lessons) for (const g of [...L.notes, ...L.gloss]) { if (!seen.has(g.term)) { seen.add(g.term); items.push(g); } }
  return items.sort((a, b) => a.term.localeCompare(b.term, "ko"));
}
