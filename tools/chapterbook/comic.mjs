// 장별 해설서 「만화로 보는 이야기」 — 18컷 · 3쪽(쪽마다 6컷). 사용자 지시 2026-11-02.
// 그림체: 지브리 풍(사용자 지시 2026-11-02) — 자연스러운 비율, 큰 눈과 눈빛, 부드러운 갈색 선, 파스텔 색, 뭉게구름 하늘과 겹겹의 언덕.
// 하나님은 사람 모양·얼굴로 그리지 않는다(빛 glow + 말풍선). 천사도 얼굴 없는 빛 모양. 십자가는 그리지 않는다.
// 컷 = {v:"1:3", bg:"sky", art:[{m:"sun",x,y,s} | {f:"man|woman|child|angel",x,y,s,c,pose,face,name,flip,old,crown}], sfx?:[{t:"쿵!",x,y,r}], cap:"내레이션", u:["밑줄 조각"], say?:{text:"본문 글자 그대로", v:"1:3", who?:"하나님", at:[x,y]} 또는 말풍선 2개까지 [{…},{…}](주고받는 대사)}
// 컷 그림: <원고 폴더>/만화그림/NN/PP.jpg가 있으면(comicart.mjs가 이미지 생성 AI로 그림) 그 그림을 바탕에 깔고 말풍선만 얹는다.
// pose: stand raise point give walk run cry kneel pray bow sit staff angry lie · face: normal happy sad surprise angry sleep cry fear pray proud
import fs from "node:fs";
import path from "node:path";
import { R, BOOKS, chapterFile } from "./lib.mjs";
import * as old from "./comic6.mjs";
const f1 = (n) => Math.round(n * 10) / 10;
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const W = 240, H = 150, GY = 132; // 판 크기, 땅 높이(사람 발 기본 y)

// ───────────── 배경 ─────────────
const grad = (id, a, b) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
// [하늘 위, 하늘 아래, 땅, 먼 언덕(없으면 생략), 구름 여부]
export const BG = {
  sky: ["#5fa8e0", "#d6ecfa", "#9cc77a", "#bcd9a0", 1],
  dawn: ["#f2a37a", "#fde4c6", "#b9a77a", "#d8c49a", 1],
  night: ["#0e1838", "#34497e", "#2d3b4a", "#3b4d60", 0],
  dark: ["#050507", "#16161e", "#0e0e12", "", 0],
  desert: ["#8cc4ea", "#f6e7c8", "#e6c48a", "#efd5a2", 1],
  garden: ["#6ab4e6", "#dff2fb", "#7fbf62", "#a6d68a", 1],
  water: ["#6aa8dc", "#d8eefa", "#4f8fc0", "", 1],
  field: ["#6ab0e2", "#e2f2fb", "#b4cc6a", "#cfe0a0", 1],
  tent: ["#8a6440", "#c69a6a", "#7a5434", "", 0],
  palace: ["#c9b48a", "#efe2c2", "#b89a6a", "", 0], // 이집트 집·궁 안(돌기둥·채색 벽)
  city: ["#8fb8e2", "#eef2f8", "#c9b48a", "#ddd0b0", 1],
  storm: ["#4a5666", "#9aa6b4", "#4a6a7a", "#5a7a8a", 0],
  fire: ["#ffb070", "#ffe8c8", "#8a5a3a", "#a87a5a", 0],
};

// ───────────── 사람 — 지브리 풍(사용자 지시 2026-11-02): 자연스러운 비율, 큰 눈과 눈빛, 부드러운 갈색 선, 파스텔 색 ─────────────
// 하나님은 사람 모양으로 그리지 않는다(빛·말풍선만).
const SKIN = "#f8dcc4", INK = "#4a3426", HAIR = { man: "#5a3a24", woman: "#2e2018", child: "#6a4428", old: "#e9e6e0" };
function face(kind, hy, f) {
  const o = [];
  const L = `stroke="${INK}" stroke-linecap="round" fill="none"`;
  const ey = hy + 1, ex = [-3.4, 4.6];
  const eye = (x) => `<ellipse cx="${x}" cy="${ey}" rx="2.1" ry="2.8" fill="#3a2618"/><circle cx="${x + 0.7}" cy="${ey - 1}" r="0.85" fill="#fff"/><circle cx="${x - 0.6}" cy="${ey + 1}" r="0.4" fill="#fff" opacity=".8"/>`;
  const closed = (x, up) => `<path d="M${x - 2.4},${ey + (up ? 0.6 : -0.4)} Q${x},${ey + (up ? -1.8 : 1.8)} ${x + 2.4},${ey + (up ? 0.6 : -0.4)}" ${L} stroke-width="1.1"/>`;
  if (f === "happy" || f === "proud") o.push(closed(ex[0], true), closed(ex[1], true));
  else if (f === "sleep" || f === "pray") o.push(closed(ex[0], false), closed(ex[1], false));
  else if (f === "cry") o.push(closed(ex[0], false), closed(ex[1], false));
  else if (f === "surprise") o.push(...ex.map((x) => `<ellipse cx="${x}" cy="${ey}" rx="2.5" ry="3.2" fill="#fff" stroke="${INK}" stroke-width=".6"/><circle cx="${x}" cy="${ey + 0.3}" r="1.5" fill="#3a2618"/><circle cx="${x + 0.5}" cy="${ey - 0.4}" r=".5" fill="#fff"/>`));
  else o.push(eye(ex[0]), eye(ex[1]));
  // 속눈썹(여자)
  if (kind === "woman" && !["happy", "sleep", "pray", "cry", "proud"].includes(f)) o.push(...ex.map((x) => `<path d="M${x - 2.4},${ey - 2.4} Q${x},${ey - 3.6} ${x + 2.6},${ey - 2.6}" ${L} stroke-width="1"/>`));
  // 눈썹
  const by = ey - 4.6;
  const bro = { angry: [[-1, 1.2], [1.2, -1]], sad: [[1, -0.8], [-0.8, 1]], fear: [[1, -0.8], [-0.8, 1]], surprise: [[-0.6, -0.6], [-0.6, -0.6]] }[f] || [[0, -0.2], [-0.2, 0]];
  ex.forEach((x, i) => o.push(`<path d="M${x - 2},${by + bro[i][0]} Q${x},${by - 0.8} ${x + 2},${by + bro[i][1]}" stroke="${kind === "old" ? "#bdb6aa" : HAIR[kind] || INK}" stroke-width="1" stroke-linecap="round" fill="none"/>`));
  // 코: 작은 선
  o.push(`<path d="M1.6,${hy + 3} Q2.6,${hy + 4.6} 1.4,${hy + 5}" ${L} stroke-width=".7" opacity=".7"/>`);
  // 입
  const my = hy + 7.2;
  o.push({
    happy: `<path d="M-1.2,${my - 0.4} Q1.2,${my + 3} 3.6,${my - 0.4} Z" fill="#c8504a" stroke="${INK}" stroke-width=".6"/>`,
    proud: `<path d="M-0.8,${my} Q1.2,${my + 1.6} 3.2,${my}" ${L} stroke-width=".9"/>`,
    sad: `<path d="M-0.6,${my + 1} Q1.2,${my - 0.6} 3,${my + 1}" ${L} stroke-width=".9"/>`,
    cry: `<path d="M-0.8,${my + 1.4} Q1.2,${my - 1} 3.2,${my + 1.4} Z" fill="#c8504a" stroke="${INK}" stroke-width=".6"/>`,
    surprise: `<ellipse cx="1.2" cy="${my + 0.6}" rx="1.4" ry="1.9" fill="#a83a34" stroke="${INK}" stroke-width=".6"/>`,
    angry: `<path d="M-0.8,${my + 0.6} L3.2,${my}" ${L} stroke-width="1"/>`,
    fear: `<path d="M-1,${my} Q0,${my - 0.8} 1,${my} T3,${my}" ${L} stroke-width=".8"/>`,
    sleep: `<ellipse cx="1.2" cy="${my}" rx=".9" ry=".6" fill="#a8605a"/>`,
    pray: `<path d="M0,${my} Q1.2,${my + 0.7} 2.4,${my}" ${L} stroke-width=".8"/>`,
  }[f] || `<path d="M-0.4,${my} Q1.2,${my + 1.4} 2.8,${my}" ${L} stroke-width=".9"/>`);
  // 볼 홍조
  o.push(`<ellipse cx="-6" cy="${hy + 5}" rx="2.4" ry="1.3" fill="#f29a90" opacity=".45"/><ellipse cx="8" cy="${hy + 5}" rx="2" ry="1.2" fill="#f29a90" opacity=".45"/>`);
  if (f === "cry") o.push(`<path d="M${ex[0] - 1},${ey + 2} Q${ex[0] - 2.4},${ey + 6} ${ex[0] - 1},${ey + 7.4} Q${ex[0] + 0.4},${ey + 6} ${ex[0] - 1},${ey + 2} Z M${ex[1] + 1},${ey + 2} Q${ex[1] - 0.4},${ey + 6} ${ex[1] + 1},${ey + 7.4} Q${ex[1] + 2.4},${ey + 6} ${ex[1] + 1},${ey + 2} Z" fill="#9ccdf0" opacity=".9"/>`);
  if (f === "fear") o.push(`<path d="M10,${hy - 6} Q8,${hy - 2} 10,${hy} Q12,${hy - 2} 10,${hy - 6} Z" fill="#cfe8fa" stroke="${INK}" stroke-width=".5"/>`);
  return o.join("");
}
function hair(kind, hy, o, back) {
  const S = `stroke="${INK}" stroke-width="1" stroke-linejoin="round"`;
  const hc = HAIR[kind] || HAIR.man;
  if (back) {
    // 뒷머리(머리 뒤에 먼저 그림)
    if (kind === "woman") return `<path d="M-11,${hy - 4} Q-15,${hy + 14} -12,${hy + 30} Q-4,${hy + 34} 2,${hy + 30} Q12,${hy + 32} 13,${hy + 22} Q14,${hy + 8} 11,${hy - 4} Z" fill="${hc}" ${S}/>`;
    return "";
  }
  if (kind === "woman") {
    const hairF = `<path d="M-11,${hy + 2} Q-12,${hy - 12} 0,${hy - 12} Q12,${hy - 12} 11,${hy + 2} Q8,${hy - 6} 3,${hy - 6} Q4,${hy - 3} 1,${hy - 2} Q0,${hy - 6} -4,${hy - 6} Q-8,${hy - 4} -11,${hy + 2} Z" fill="${hc}" ${S}/>`;
    const veil = o.veil === false ? "" : `<path d="M-13,${hy + 4} Q-14,${hy - 15} 0,${hy - 15} Q14,${hy - 15} 13,${hy + 4} Q14,${hy + 16} 15,${hy + 26} L10,${hy + 26} Q10,${hy + 10} 9,${hy + 2} Q8,${hy - 9} 0,${hy - 9} Q-8,${hy - 9} -9,${hy + 2} Q-10,${hy + 12} -12,${hy + 22} L-15,${hy + 20} Q-14,${hy + 12} -13,${hy + 4} Z" fill="${o.veil || "#efe2c4"}" ${S}/>`;
    return hairF + veil;
  }
  if (kind === "child") return `<path d="M-11,${hy + 1} Q-12,${hy - 12} 0,${hy - 12} Q12,${hy - 12} 11,${hy + 1} Q9,${hy - 5} 5,${hy - 6} Q4,${hy - 3} 0,${hy - 3} Q2,${hy - 6} -1,${hy - 7} Q-7,${hy - 6} -11,${hy + 1} Z" fill="${hc}" ${S}/>`;
  if (kind === "old") return `<path d="M-6,${hy + 7} Q-7,${hy + 22} 1,${hy + 25} Q9,${hy + 22} 8,${hy + 7} Q4,${hy + 10} 1,${hy + 9.5} Q-2,${hy + 10} -6,${hy + 7} Z" fill="#f4f2ee" ${S}/>` + `<path d="M-13,${hy + 3} Q-14,${hy - 15} 0,${hy - 15} Q14,${hy - 15} 13,${hy + 3} Q13,${hy + 14} 15,${hy + 22} L10,${hy + 22} Q10,${hy + 8} 9,${hy + 1} Q8,${hy - 8} 0,${hy - 8} Q-8,${hy - 8} -9,${hy + 1} Q-10,${hy + 10} -11,${hy + 18} L-15,${hy + 16} Z" fill="${o.cloth || "#e4dccb"}" ${S}/>`;
  // 어른 남자: 갈색 머리 + 짧은 수염 + 머릿수건
  return `<path d="M-8,${hy + 6} Q-6,${hy + 13} 1,${hy + 14} Q8,${hy + 13} 9,${hy + 6} Q5,${hy + 9} 1,${hy + 9} Q-3,${hy + 9} -8,${hy + 6} Z" fill="${hc}" opacity=".9"/>` + `<path d="M-12.5,${hy + 3} Q-13.5,${hy - 15} 0,${hy - 15} Q13.5,${hy - 15} 12.5,${hy + 3} Q13,${hy + 12} 14,${hy + 18} L9.5,${hy + 18} Q9.5,${hy + 7} 9,${hy + 1} Q8,${hy - 8} 0,${hy - 8} Q-8,${hy - 8} -9,${hy + 1} Q-9.5,${hy + 8} -10,${hy + 15} L-14,${hy + 13} Z" fill="${o.cloth || "#ece2cc"}" ${S}/><path d="M-9,${hy - 6} Q0,${hy - 9.5} 9,${hy - 6}" fill="none" stroke="#b9895a" stroke-width="1.6"/><path d="M-8.5,${hy - 3} Q-4,${hy - 7} 0,${hy - 6} Q4,${hy - 7} 8.5,${hy - 3}" fill="${hc}" stroke="none"/>`;
}
export function person(o) {
  const { x, y = GY, s = 1, c = "#7a8ab0", pose = "stand", flip = false } = o;
  const kind = (o.kind || "man") === "man" && o.old ? "old" : o.kind || "man";
  const f = o.face || (pose === "pray" || pose === "kneel" ? "pray" : pose === "lie" ? "sleep" : pose === "cry" ? "cry" : "normal");
  const sc = s * (kind === "child" ? 0.72 : 1), dir = flip ? -1 : 1;
  const R = 11, g = [];
  const S = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
  const shade = (d) => `<path d="${d}" fill="#3a2a40" opacity=".14"/>`;
  if (pose === "lie") {
    g.push(`<path d="M-24,-1 Q-26,-13 -12,-14 L26,-12 Q34,-7 28,-1 Z" fill="${c}" ${S}/>` + shade(`M-24,-1 Q-14,-5 28,-1 L26,-4 Q0,-7 -24,-4 Z`) + `<ellipse cx="30" cy="-3" rx="3.4" ry="2.4" fill="#8a6a4a" ${S}/>`);
    g.push(`<g transform="translate(-34,-6) rotate(-12)">${hair(kind, 0, o, true)}<circle cx="0" cy="0" r="${R}" fill="${SKIN}" ${S}/>${hair(kind, 0, o)}${face(kind, 0, f)}</g>`);
    return `<g transform="translate(${f1(x)},${f1(y)}) scale(${f1(dir * sc)},${f1(sc)})">${g.join("")}</g>`;
  }
  const low = pose === "kneel" || pose === "bow" || pose === "sit";
  const hy = low ? -50 : -64, sh = hy + R + 3;
  const wHem = kind === "woman" ? 15 : 13;
  // 다리·신발
  if (!low) g.push(`<path d="M-5,-10 L-5,-2 M5,-10 L5,-2" stroke="${SKIN}" stroke-width="3.4" stroke-linecap="round"/><path d="M-8,-1 Q-5,-4 -1.5,-1 Z M2,-1 Q5,-4 8.5,-1 Z" fill="#8a6a4a" ${S}/>`);
  else g.push(`<ellipse cx="-10" cy="-1.6" rx="5" ry="2.2" fill="#8a6a4a" ${S}/>`);
  // 뒷머리
  g.push(hair(kind, hy, o, true));
  // 겉옷: 흐르는 주름, 허리띠, 옅은 그늘
  const hemY = low ? -2 : -7;
  g.push(`<path d="M-6,${sh} Q-11,${sh + 6} -12,${sh + 18} Q-${wHem},${hemY - 6} -${wHem + 1},${hemY} Q0,${hemY + 3} ${wHem + 1},${hemY} Q${wHem},${hemY - 6} 12,${sh + 18} Q11,${sh + 6} 6,${sh} Q0,${sh + 3} -6,${sh} Z" fill="${c}" ${S}/>`);
  g.push(shade(`M4,${sh + 2} Q11,${sh + 8} 12,${sh + 18} Q${wHem},${hemY - 6} ${wHem + 1},${hemY} Q8,${hemY + 2} 4,${hemY + 1} Q7,${sh + 20} 4,${sh + 2} Z`));
  g.push(`<path d="M-3,${sh + 14} Q-4,${hemY - 6} -6,${hemY} M3,${sh + 16} Q3,${hemY - 8} 5,${hemY}" fill="none" stroke="${INK}" stroke-width=".6" opacity=".4"/>`);
  g.push(`<path d="M-11,${sh + 15} Q0,${sh + 18} 11,${sh + 15}" fill="none" stroke="${o.belt || "#c9a46a"}" stroke-width="2.6" stroke-linecap="round"/>`);
  g.push(`<path d="M-4,${sh + 0.6} Q0,${sh + 5} 4,${sh + 0.6}" fill="${SKIN}" ${S}/>`);
  // 팔
  const arm = (d) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="6.2" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="4.4" stroke-linecap="round"/>`;
  const hand = (hx, hyy) => `<circle cx="${hx}" cy="${hyy}" r="2.4" fill="${SKIN}" ${S}/>`;
  const a = sh + 3;
  const A = {
    stand: [[`M-8,${a} Q-12,${a + 10} -12,${a + 19}`, -12, a + 21], [`M8,${a} Q12,${a + 10} 12,${a + 19}`, 12, a + 21]],
    raise: [[`M-8,${a} Q-15,${a - 4} -17,${a - 15}`, -17, a - 17], [`M8,${a} Q15,${a - 4} 17,${a - 15}`, 17, a - 17]],
    point: [[`M-8,${a} Q-12,${a + 10} -12,${a + 19}`, -12, a + 21], [`M8,${a} Q18,${a + 1} 26,${a - 3}`, 28, a - 3]],
    give: [[`M-8,${a} Q-3,${a + 10} 6,${a + 11}`, 8, a + 11], [`M8,${a} Q16,${a + 7} 22,${a + 6}`, 24, a + 6]],
    walk: [[`M-8,${a} Q-15,${a + 8} -17,${a + 15}`, -18, a + 16], [`M8,${a} Q14,${a + 9} 17,${a + 17}`, 18, a + 18]],
    run: [[`M-8,${a} Q-16,${a - 1} -20,${a - 7}`, -21, a - 8], [`M8,${a} Q16,${a + 10} 22,${a + 9}`, 23, a + 9]],
    cry: [[`M-8,${a} Q-3,${a - 2} -2,${a - 9}`, -2, a - 10], [`M8,${a} Q4,${a - 2} 4,${a - 9}`, 4, a - 10]],
    kneel: [[`M-8,${a} Q-3,${a + 5} 0,${a + 1}`, 1, a], [`M8,${a} Q5,${a + 5} 2,${a + 1}`, 2, a - 1]],
    pray: [[`M-8,${a} Q-3,${a + 5} 0,${a + 1}`, 1, a], [`M8,${a} Q5,${a + 5} 2,${a + 1}`, 2, a - 1]],
    bow: [[`M-8,${a} Q-2,${a + 11} 8,${a + 13}`, 10, a + 13], [`M8,${a} Q14,${a + 11} 20,${a + 13}`, 22, a + 13]],
    sit: [[`M-8,${a} Q-12,${a + 10} -4,${a + 14}`, -3, a + 14], [`M8,${a} Q12,${a + 10} 5,${a + 14}`, 5, a + 14]],
    staff: [[`M-8,${a} Q-12,${a + 10} -12,${a + 19}`, -12, a + 21], [`M8,${a} Q15,${a + 5} 16,${a + 10}`, 16, a + 11]],
    angry: [[`M-8,${a} Q-15,${a + 3} -12,${a + 12}`, -11, a + 13], [`M8,${a} Q15,${a + 3} 12,${a + 12}`, 11, a + 13]],
  }[pose] || [];
  if (pose === "staff") g.push(`<path d="M16,${a - 26} Q22,${a - 34} 16,${a - 36} M16,${a - 28} L17,0" fill="none" stroke="#7a5a3a" stroke-width="2.4" stroke-linecap="round"/>`);
  for (const [d, hx, hyy] of A) g.push(arm(d), hand(hx, hyy));
  // 머리
  g.push(`<path d="M-11,${hy + 1} Q-11,${hy + 10} 0,${hy + 11.5} Q11,${hy + 10} 11,${hy + 1} Q11,${hy - 11} 0,${hy - 11} Q-11,${hy - 11} -11,${hy + 1} Z" fill="${SKIN}" ${S}/>`);
  g.push(`<ellipse cx="-10.6" cy="${hy + 2}" rx="1.8" ry="2.6" fill="${SKIN}" ${S}/>`);
  g.push(hair(kind, hy, o));
  g.push(face(kind, hy, f));
  if (o.crown) g.push(`<path d="M-8,${hy - 12} L-9,${hy - 20} L-4,${hy - 15} L0,${hy - 22} L4,${hy - 15} L9,${hy - 20} L8,${hy - 12} Z" fill="#f0c850" ${S}/>`);
  return `<g transform="translate(${f1(x)},${f1(y)}) scale(${f1(dir * sc)},${f1(sc)})">${g.join("")}</g>`;
}
export function angel(o) {
  // 천사: 날개 달린 빛 모양(얼굴 없음)
  const { x, y = GY, s = 1 } = o;
  return `<g transform="translate(${f1(x)},${f1(y)}) scale(${f1(s)})"><ellipse cx="0" cy="-36" rx="26" ry="40" fill="#fff7d0" opacity=".55"/><path d="M-4,-56 Q-34,-74 -40,-40 Q-26,-46 -6,-40 Z M4,-56 Q34,-74 40,-40 Q26,-46 6,-40 Z" fill="#fffdf2" stroke="#d8b860" stroke-width="1.1"/><path d="M-9,-52 L-15,0 L15,0 L9,-52 Z" fill="#fffaf0" stroke="#d8b860" stroke-width="1.2"/><circle cx="0" cy="-62" r="8" fill="#fff3c0" stroke="#d8b860" stroke-width="1.2"/></g>`;
}

// ───────────── 사물·동물(원점 = 바닥 가운데) ─────────────
const ST = (c = "#4a3426", w = 1.2) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
export const THINGS = {
  sun: () => `<circle r="16" cy="-16" fill="#ffd34d" ${ST("#e0a800")}/>` + [...Array(10)].map((_, i) => { const a = i * Math.PI / 5; return `<path d="M${f1(Math.cos(a) * 21)},${f1(-16 + Math.sin(a) * 21)} L${f1(Math.cos(a) * 28)},${f1(-16 + Math.sin(a) * 28)}" ${ST("#e0a800", 2)}/>`; }).join(""),
  moon: () => `<path d="M6,-30 A15,15 0 1 0 6,0 A11,11 0 1 1 6,-30 Z" fill="#f6efc0" ${ST("#b8a860")}/>`,
  star: () => `<path d="M0,-12 L3,-4 L11,-4 L5,1 L7,9 L0,4 L-7,9 L-5,1 L-11,-4 L-3,-4 Z" fill="#fff3a0" ${ST("#c8b040", 0.8)}/>`,
  stars: () => [[-40, -10], [-15, -30], [10, -5], [35, -25], [55, -8], [-55, -32], [25, -40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff6c0"/>`).join(""),
  glow: () => `<circle cy="-30" r="34" fill="#fff8d6" opacity=".55"/><circle cy="-30" r="20" fill="#fffbe8" opacity=".9"/>` + [...Array(12)].map((_, i) => { const a = i * Math.PI / 6; return `<path d="M${f1(Math.cos(a) * 24)},${f1(-30 + Math.sin(a) * 24)} L${f1(Math.cos(a) * 40)},${f1(-30 + Math.sin(a) * 40)}" ${ST("#f0d070", 1.8)}/>`; }).join(""),
  light: () => `<path d="M-14,-120 L14,-120 L60,0 L-60,0 Z" fill="#fff8d0" opacity=".55"/>`,
  cloud: () => `<path d="M-30,0 Q-40,-14 -24,-18 Q-20,-32 -4,-28 Q6,-40 20,-28 Q36,-30 34,-14 Q44,-6 32,0 Z" fill="#ffffff" ${ST("#9aa8b8")}/>`,
  darkcloud: () => `<path d="M-30,0 Q-40,-14 -24,-18 Q-20,-32 -4,-28 Q6,-40 20,-28 Q36,-30 34,-14 Q44,-6 32,0 Z" fill="#6b7685" ${ST("#3f4855")}/>`,
  rain: () => [-30, -15, 0, 15, 30].map((d) => `<path d="M${d},-40 L${d - 6},-24 M${d + 7},-20 L${d + 1},-4" ${ST("#5b8fc0", 1.6)}/>`).join(""),
  wave: () => [0, 10].map((o) => `<path d="M-60,${-8 + o} Q-45,${-18 + o} -30,${-8 + o} T0,${-8 + o} T30,${-8 + o} T60,${-8 + o}" fill="none" ${ST("#2f6f9f", 2)}/>`).join(""),
  sea: () => `<rect x="-130" y="-22" width="260" height="22" fill="#4f8fc0"/><path d="M-130,-22 Q-110,-28 -90,-22 T-50,-22 T-10,-22 T30,-22 T70,-22 T110,-22 T150,-22" fill="none" ${ST("#2f6f9f", 1.6)}/>`,
  river: () => `<path d="M-120,0 Q-60,-14 0,-6 T120,-8 L120,0 Z" fill="#6fa8d6" ${ST("#3f78a8")}/>`,
  mountain: () => `<path d="M-70,0 L-28,-58 L-8,-32 L20,-70 L70,0 Z" fill="#a89a7c" ${ST("#5b4f3a")}/><path d="M20,-70 L10,-56 L20,-58 L28,-54 Z M-28,-58 L-34,-48 L-26,-50 Z" fill="#fff"/>`,
  hill: () => `<path d="M-80,0 Q-30,-40 20,-26 Q50,-18 80,0 Z" fill="#9fc27a" ${ST("#5b7a3a")}/>`,
  tree: () => `<path d="M-4,0 L-3,-30 L3,-30 L4,0 Z" fill="#8a5a2a" ${ST()}/><circle cx="0" cy="-42" r="18" fill="#5fae5a" ${ST("#2f6a2f")}/><circle cx="-12" cy="-32" r="11" fill="#6fbe62" ${ST("#2f6a2f")}/><circle cx="12" cy="-32" r="11" fill="#6fbe62" ${ST("#2f6a2f")}/>`,
  fruittree: () => THINGS.tree() + [[-8, -44], [8, -36], [-14, -30], [12, -48], [2, -28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#d83a2a"/>`).join(""),
  fruit: () => `<circle cy="-6" r="6" fill="#d83a2a" ${ST("#7a1a10")}/><path d="M0,-12 L2,-16 M2,-14 Q6,-18 8,-14" fill="none" ${ST("#2f6a2f")}/>`,
  plant: () => `<path d="M0,0 L0,-18 M0,-8 Q-10,-12 -12,-20 M0,-12 Q10,-16 12,-24" fill="none" ${ST("#2f8a2f", 2)}/>`,
  grass: () => [-30, -15, 0, 15, 30].map((d) => `<path d="M${d - 4},0 L${d},-10 L${d + 4},0" fill="#6fbe62" ${ST("#2f6a2f", 0.8)}/>`).join(""),
  sheaf: () => [-6, -3, 0, 3, 6].map((d) => `<path d="M0,0 Q${d},-18 ${d * 2},-32" fill="none" ${ST("#c8a040", 1.8)}/>`).join("") + `<path d="M-6,-12 L6,-12" ${ST("#8a6a20", 2)}/>`,
  tent: () => `<path d="M-40,0 L0,-46 L40,0 Z" fill="#c9a77a" ${ST("#5b4a2a")}/><path d="M0,-46 L0,0 M-10,0 L0,-22 L10,0" fill="#5b4a2a" ${ST("#5b4a2a")}/>`,
  altar: () => `<path d="M-22,0 L-22,-12 L22,-12 L22,0 Z M-18,-12 L-18,-22 L18,-22 L18,-12 Z" fill="#b8b0a0" ${ST("#5b554a")}/><path d="M-12,-22 L-6,-24 L0,-22 L6,-24 L12,-22" fill="none" ${ST("#5b554a")}/>`,
  fire: () => `<path d="M-12,0 Q-16,-14 -6,-22 Q-6,-12 0,-12 Q-4,-26 6,-34 Q6,-20 12,-14 Q16,-6 12,0 Z" fill="#ff8a2a" ${ST("#c04a10")}/><path d="M-5,0 Q-6,-8 0,-14 Q2,-6 6,-4 Q7,-1 5,0 Z" fill="#ffd34d"/>`,
  smoke: () => `<path d="M0,0 Q-10,-14 0,-26 Q10,-38 0,-52" fill="none" ${ST("#9a9a9a", 4)} opacity=".6"/>`,
  wood: () => [-6, 0, 6].map((d) => `<rect x="-16" y="${-8 + d / 3 - 4}" width="32" height="5" rx="2" fill="#a8743a" ${ST("#5b3a1a", 0.8)} transform="rotate(${d * 2} 0 -6)"/>`).join(""),
  knife: () => `<path d="M-14,0 L8,-16 L10,-14 L-12,2 Z" fill="#d8dde3" ${ST("#5b6670")}/><path d="M8,-16 L14,-20" ${ST("#6b4a2c", 3)}/>`,
  sword: () => `<g transform="rotate(38 0 -6)"><path d="M0,-12 L0,-50 L-3,-44 M0,-50 L3,-44" fill="none" ${ST("#7a8590", 2.6)}/><ellipse cx="0" cy="-10" rx="4.5" ry="2.4" fill="#a87a20" ${ST("#5a4020", .8)}/><path d="M0,-8 L0,0" ${ST("#6b4a2c", 3)}/></g>`,
  flamesword: () => `<g transform="rotate(38 0 -6)"><path d="M0,-12 L0,-54" ${ST("#c04a10", 3)}/><path d="M0,-54 Q-8,-44 0,-34 Q8,-24 0,-14" fill="none" ${ST("#ff8a2a", 3)}/><ellipse cx="0" cy="-10" rx="4.5" ry="2.4" fill="#a87a20" ${ST("#5a4020", .8)}/><path d="M0,-8 L0,0" ${ST("#6b4a2c", 3)}/></g>`,
  pot: () => `<path d="M-16,-20 Q-18,0 0,0 Q18,0 16,-20 Z" fill="#8a4a2a" ${ST()}/><path d="M-18,-20 L18,-20" ${ST("#2b2b2b", 2)}/><path d="M-6,-24 Q-2,-30 -6,-36 M4,-24 Q8,-30 4,-36" fill="none" ${ST("#aaa", 1.4)}/><ellipse cy="-20" rx="15" ry="3" fill="#b8402a"/>`,
  bread: () => `<ellipse cy="-6" rx="14" ry="7" fill="#d8a050" ${ST("#8a5a20")}/><path d="M-6,-10 L-4,-5 M0,-11 L2,-6 M6,-10 L8,-5" ${ST("#8a5a20", 0.8)}/>`,
  jar: () => `<path d="M-8,-30 L8,-30 L6,-26 Q16,-18 12,-4 Q8,0 0,0 Q-8,0 -12,-4 Q-16,-18 -6,-26 Z" fill="#c8804a" ${ST("#6b3a1a")}/>`,
  well: () => `<ellipse cy="-20" rx="26" ry="7" fill="#3a5a7a" ${ST()}/><path d="M-26,-20 L-26,0 Q0,8 26,0 L26,-20" fill="#b8a888" ${ST()}/><path d="M-26,-12 Q0,-4 26,-12" fill="none" ${ST("#7a6a4a", 0.8)}/>`,
  stone: () => `<path d="M-14,0 Q-16,-12 -4,-16 Q10,-18 14,-8 Q16,0 10,0 Z" fill="#a8a8a0" ${ST("#5b5b55")}/>`,
  pillar: () => `<path d="M-6,0 L-5,-34 Q0,-38 5,-34 L6,0 Z" fill="#b8b0a0" ${ST("#5b554a")}/>`,
  ladder: () => `<path d="M-14,0 L-4,-130 M14,0 L4,-130" fill="none" ${ST("#d8b860", 2.4)}/>` + [...Array(8)].map((_, i) => { const t = (i + 1) / 9, y = -130 * t, h = 14 - 10 * t; return `<path d="M${f1(-h)},${f1(y)} L${f1(h)},${f1(y)}" ${ST("#d8b860", 1.8)}/>`; }).join(""),
  ark: () => `<path d="M-70,-10 L70,-10 L58,8 L-58,8 Z" fill="#8a5a2a" ${ST()}/><path d="M-52,-10 L-52,-36 L52,-36 L52,-10 Z" fill="#a8743a" ${ST()}/><path d="M-58,-36 L0,-52 L58,-36 Z" fill="#7a4a1a" ${ST()}/><rect x="-10" y="-30" width="20" height="14" fill="#5b3a1a"/>`,
  rainbow: () => ["#e04a3a", "#f0a030", "#f0e040", "#5ab04a", "#3a7ad0", "#7a4ab0"].map((c, i) => `<path d="M${-90 + i * 6},0 A${90 - i * 6},${70 - i * 5} 0 0 1 ${90 - i * 6},0" fill="none" stroke="${c}" stroke-width="5.5" opacity=".85"/>`).join(""),
  tower: () => `<path d="M-40,0 L40,0 L34,-18 L-34,-18 Z M-32,-18 L32,-18 L26,-36 L-26,-36 Z M-24,-36 L24,-36 L18,-54 L-18,-54 Z M-16,-54 L16,-54 L10,-72 L-10,-72 Z" fill="#c8a070" ${ST("#6b4a2a")}/><path d="M-6,0 L-6,-10 Q0,-16 6,-10 L6,0" fill="#5b3a1a"/>`,
  brick: () => [[-12, 0], [4, 0], [-4, -8]].map(([x, y]) => `<rect x="${x}" y="${y - 7}" width="14" height="7" fill="#b8603a" ${ST("#6b2a1a", 0.8)}/>`).join(""),
  city: () => `<path d="M-50,0 L-50,-30 L-40,-30 L-40,-40 L-28,-40 L-28,-30 L-14,-30 L-14,-50 L4,-50 L4,-30 L16,-30 L16,-42 L30,-42 L30,-30 L50,-30 L50,0 Z" fill="#d8c8a8" ${ST("#6b5a3a")}/><path d="M-6,0 L-6,-14 Q0,-20 6,-14 L6,0" fill="#5b4a2a"/>`,
  ruin: () => `<path d="M-50,0 L-44,-22 L-30,-14 L-22,-30 L-8,-12 L6,-26 L20,-10 L34,-20 L50,0 Z" fill="#6b5a4a" ${ST("#2b2b2b")}/>` + THINGS.smoke().replace("<path", `<path transform="translate(-20,-20)"`) + THINGS.smoke().replace("<path", `<path transform="translate(18,-16)"`),
  brimstone: () => [[-30, -60], [0, -80], [28, -54], [-12, -40], [16, -30]].map(([x, y]) => `<g transform="translate(${x},${y}) scale(.5)">${THINGS.fire()}</g>`).join(""),
  pyramid: () => `<path d="M-44,0 L0,-46 L44,0 Z" fill="#e2c17a" ${ST("#8a6a2a")}/><path d="M0,-46 L10,0" ${ST("#8a6a2a")}/>`,
  silver: () => [[-8, 0], [0, -4], [8, 0], [0, 4]].map(([x, y]) => `<ellipse cx="${x}" cy="${y - 5}" rx="5" ry="3" fill="#d8dde3" ${ST("#7a8590", 0.8)}/>`).join(""),
  gold: () => `<path d="M-8,-4 L-4,-12 L4,-12 L8,-4 Z" fill="#e8b830" ${ST("#8a6a10")}/><circle cx="12" cy="-6" r="4" fill="none" ${ST("#e8b830", 2)}/>`,
  ring: () => `<circle cy="-6" r="6" fill="none" ${ST("#e8b830", 2.4)}/><circle cy="-12" r="2" fill="#7ad0e8"/>`,
  coat: () => `<path d="M-10,0 L-10,-26 L-20,-20 L-16,-34 L-6,-38 Q0,-34 6,-38 L16,-34 L20,-20 L10,-26 L10,0 Z" fill="#c84a3a" ${ST()}/><path d="M-10,-14 L10,-14 M-10,-6 L10,-6" ${ST("#f0c040", 1.6)}/>`,
  cave: () => `<path d="M-60,0 Q-60,-50 0,-56 Q60,-50 60,0 Z" fill="#8a7a62" ${ST("#4a3f2f")}/><path d="M-22,0 Q-22,-30 0,-32 Q22,-30 22,0 Z" fill="#2b241a"/>`,
  grave: () => `<path d="M-30,0 L-30,-6 Q0,-16 30,-6 L30,0 Z" fill="#9a8a72" ${ST("#4a3f2f")}/>`,
  bed: () => `<rect x="-36" y="-14" width="72" height="10" rx="3" fill="#a8743a" ${ST()}/><path d="M-32,-4 L-32,0 M32,-4 L32,0" ${ST()}/>`,
  door: () => `<rect x="-14" y="-44" width="28" height="44" fill="#7a4a1a" ${ST()}/><circle cx="8" cy="-22" r="1.8" fill="#e8b830"/>`,
  house: () => `<path d="M-34,0 L-34,-30 L34,-30 L34,0 Z" fill="#d8c09a" ${ST("#6b5a3a")}/><path d="M-38,-30 L38,-30 L38,-36 L-38,-36 Z" fill="#b89a6a" ${ST("#6b5a3a")}/><rect x="-8" y="-20" width="16" height="20" fill="#6b4a2a"/>`,
  rod: () => `<path d="M0,0 L4,-40" ${ST("#a8743a", 3)}/><path d="M1,-12 L-4,-14 M2,-24 L7,-26" ${ST("#d8c09a", 2)}/>`,
  mandrake: () => `<path d="M0,0 L0,-8" ${ST("#6b4a2a", 3)}/><path d="M0,-8 Q-12,-16 -10,-24 M0,-8 Q12,-16 10,-24 M0,-8 Q0,-20 0,-26" fill="none" ${ST("#2f8a2f", 2)}/><circle cx="-4" cy="-16" r="2.6" fill="#f0c040"/><circle cx="5" cy="-18" r="2.6" fill="#f0c040"/>`,
  // 동물
  snake: () => `<path d="M-40,0 Q-30,-14 -18,-4 Q-6,6 6,-6 Q16,-16 26,-8 Q32,-4 34,-14" fill="none" ${ST("#3a7a2a", 4.5)}/><circle cx="35" cy="-15" r="3.4" fill="#3a7a2a"/>`,
  sheep: () => `<path d="M-18,0 L-16,-8 M14,0 L12,-8" ${ST("#2b2b2b", 2)}/><ellipse cy="-14" rx="20" ry="11" fill="#f6f2e8" ${ST()}/><ellipse cx="20" cy="-18" rx="7" ry="5" fill="#3a3a3a"/>`,
  ram: () => THINGS.sheep() + `<path d="M18,-22 Q12,-30 20,-30 Q26,-28 22,-22" fill="none" ${ST("#8a6a3a", 2.2)}/>`,
  goat: () => `<path d="M-16,0 L-14,-8 M12,0 L10,-8" ${ST("#2b2b2b", 2)}/><ellipse cy="-14" rx="18" ry="9" fill="#6b5a4a" ${ST()}/><path d="M16,-18 L24,-22 L22,-14 Z" fill="#6b5a4a" ${ST()}/><path d="M20,-22 L18,-30" ${ST("#2b2b2b", 1.6)}/>`,
  camel: () => `<path d="M-22,0 L-20,-20 M-8,0 L-8,-20 M10,0 L10,-20 M20,0 L20,-20" ${ST("#2b2b2b", 2.4)}/><path d="M-26,-20 Q-24,-42 -10,-30 Q0,-48 12,-28 Q20,-24 24,-24 L30,-44 Q36,-46 38,-40 L30,-18 Q10,-16 -26,-20 Z" fill="#c8a06a" ${ST()}/>`,
  donkey: () => `<path d="M-16,0 L-14,-12 M12,0 L10,-12" ${ST("#2b2b2b", 2.2)}/><ellipse cy="-18" rx="20" ry="9" fill="#8a8a8a" ${ST()}/><path d="M16,-22 L28,-30 L30,-24 L20,-16 Z" fill="#8a8a8a" ${ST()}/><path d="M24,-30 L22,-38 M27,-30 L28,-38" ${ST("#2b2b2b", 1.6)}/>`,
  cattle: () => `<path d="M-18,0 L-16,-12 M14,0 L12,-12" ${ST("#2b2b2b", 2.4)}/><ellipse cy="-20" rx="22" ry="11" fill="#a8743a" ${ST()}/><ellipse cx="24" cy="-22" rx="7" ry="6" fill="#a8743a" ${ST()}/><path d="M22,-28 Q18,-34 22,-34 M28,-28 Q32,-34 28,-34" fill="none" ${ST()}/>`,
  dove: () => `<path d="M-10,-6 Q0,-14 10,-8 Q14,-10 16,-6 Q10,-2 4,-2 Q-4,0 -10,-6 Z" fill="#fff" ${ST()}/><path d="M-2,-8 Q2,-22 10,-20 Q6,-12 2,-8" fill="#f0f0f0" ${ST()}/>`,
  raven: () => `<path d="M-10,-6 Q0,-14 10,-8 Q14,-10 16,-6 Q10,-2 4,-2 Q-4,0 -10,-6 Z" fill="#222" ${ST()}/><path d="M-2,-8 Q2,-22 10,-20 Q6,-12 2,-8" fill="#333" ${ST()}/>`,
  bird: () => `<path d="M-10,-4 Q-5,-10 0,-4 Q5,-10 10,-4" fill="none" ${ST("#3a3a3a", 1.8)}/>`,
  fish: () => `<path d="M-14,-6 Q0,-16 12,-6 Q0,4 -14,-6 Z M12,-6 L20,-12 L20,0 Z" fill="#7ab0d8" ${ST("#2f6f9f")}/>`,
  whale: () => `<path d="M-40,-8 Q-20,-30 20,-20 Q36,-16 40,-8 Q20,0 -40,-8 Z M-40,-8 L-52,-18 L-50,-2 Z" fill="#4f6f90" ${ST("#2b3f55")}/>`,
  beast: () => `<path d="M-16,0 L-14,-10 M12,0 L10,-10" ${ST("#2b2b2b", 2.4)}/><ellipse cy="-16" rx="20" ry="9" fill="#c89a4a" ${ST()}/><circle cx="20" cy="-22" r="9" fill="#a8743a" ${ST()}/>`,
  earth: () => `<circle cy="-30" r="30" fill="#4f8fc0" ${ST("#2f5f8a")}/><path d="M-20,-44 Q-8,-50 0,-40 Q8,-34 -6,-28 Q-18,-22 -20,-44 Z M6,-20 Q20,-24 22,-12 Q12,-4 6,-20 Z" fill="#8ab060"/>`,
  water: () => `<path d="M-120,0 L-120,-30 Q-90,-38 -60,-30 T0,-30 T60,-30 T120,-30 L120,0 Z" fill="#3f6f9f" opacity=".85"/>`,
  mist: () => [0, 1, 2].map((i) => `<path d="M-70,${-6 - i * 9} Q-35,${-14 - i * 9} 0,${-6 - i * 9} T70,${-6 - i * 9}" fill="none" stroke="#ffffff" stroke-width="4" opacity=".7"/>`).join(""),
  dust: () => `<path d="M-24,0 Q-20,-10 -8,-8 Q0,-16 10,-8 Q22,-10 24,0 Z" fill="#c8a878" ${ST("#8a6a3a")}/>`,
  hand: () => `<path d="M-8,0 L-8,-18 M-8,-18 L-10,-30 M-2,-18 L-2,-34 M4,-18 L5,-32 M8,-14 L12,-26" fill="none" ${ST("#f0d070", 2.4)}/>`,
  tablet: () => `<rect x="-14" y="-30" width="28" height="30" rx="4" fill="#e8dcc0" ${ST("#6b5a3a")}/>`,
  scroll: () => `<rect x="-18" y="-22" width="36" height="20" fill="#f3e6c4" ${ST("#8a6a3a")}/><circle cx="-18" cy="-12" r="4" fill="#c8a06a"/><circle cx="18" cy="-12" r="4" fill="#c8a06a"/>`,
  heart: () => `<path d="M0,0 Q-20,-14 -12,-24 Q-4,-30 0,-20 Q4,-30 12,-24 Q20,-14 0,0 Z" fill="#e05a6a" ${ST("#8a2a3a")}/>`,
  fx_sweat: () => `<path d="M0,-14 Q-6,-4 0,0 Q6,-4 0,-14 Z" fill="#cfe8fa" ${ST("#111", 1.3)}/>`,
  fx_bang: () => `<path d="M-3,-26 L3,-26 L1.6,-8 L-1.6,-8 Z" fill="#111"/><circle cy="-3" r="2.4" fill="#111"/>`,
  fx_bang2: () => `<g transform="translate(-6,0)"><path d="M-3,-26 L3,-26 L1.6,-8 L-1.6,-8 Z" fill="#111"/><circle cy="-3" r="2.4" fill="#111"/></g><g transform="translate(6,0)"><path d="M-3,-26 L3,-26 L1.6,-8 L-1.6,-8 Z" fill="#111"/><circle cy="-3" r="2.4" fill="#111"/></g>`,
  fx_q: () => `<path d="M-6,-20 Q-6,-28 0,-28 Q7,-28 7,-21 Q7,-16 1,-13 L1,-9" fill="none" ${ST("#111", 3)}/><circle cx="1" cy="-3" r="2.2" fill="#111"/>`,
  fx_zzz: () => `<path d="M0,-6 L8,-6 L0,0 L8,0 M10,-18 L20,-18 L10,-10 L20,-10 M22,-32 L34,-32 L22,-22 L34,-22" fill="none" ${ST("#111", 1.8)}/>`,
  fx_anger: () => [0, 90, 180, 270].map((r) => `<path d="M3,-3 Q8,-3 8,-9" transform="rotate(${r} 0 -10) translate(0,-10)" fill="none" ${ST("#c0392b", 2.4)}/>`).join(""),
  fx_shine: () => [[0, -20, 7], [-14, -8, 4], [12, -6, 5]].map(([x, y, r]) => `<path d="M${x},${y - r} L${x + r * 0.3},${y - r * 0.3} L${x + r},${y} L${x + r * 0.3},${y + r * 0.3} L${x},${y + r} L${x - r * 0.3},${y + r * 0.3} L${x - r},${y} L${x - r * 0.3},${y - r * 0.3} Z" fill="#fff6b0" ${ST("#111", 1)}/>`).join(""),
  fx_shock: () => [...Array(12)].map((_, i) => { const t = i * Math.PI / 6; return `<path d="M${f1(Math.cos(t) * 22)},${f1(-20 + Math.sin(t) * 22)} L${f1(Math.cos(t) * 32)},${f1(-20 + Math.sin(t) * 32)}" ${ST("#111", 1.6)}/>`; }).join(""),
  fx_speed: () => [0, 7, 14, 21].map((d) => `<path d="M-40,${-28 + d} L-8,${-28 + d}" ${ST("#111", 1.2)} opacity=".7"/>`).join(""),
  fx_tears: () => `<path d="M-6,-4 Q-10,4 -6,8 Q-2,4 -6,-4 Z M6,-4 Q2,4 6,8 Q10,4 6,-4 Z" fill="#7ab8e8" ${ST("#111", .9)}/>`,
  fx_note: () => `<path d="M0,0 L0,-18 L10,-21 L10,-4" fill="none" ${ST("#111", 1.8)}/><ellipse cx="-2.5" cy="0" rx="3.5" ry="2.6" fill="#111"/><ellipse cx="7.5" cy="-3" rx="3.5" ry="2.6" fill="#111"/>`,
  bow: () => `<path d="M-4,-44 Q14,-24 -4,-4" fill="none" ${ST("#7a5a3a", 2.6)}/><path d="M-4,-44 L-4,-4" ${ST("#d8c8a8", .9)}/><path d="M-12,-24 L16,-24" ${ST("#7a5a3a", 1.4)}/><path d="M16,-24 L11,-27 L11,-21 Z" fill="#9aa4ae" ${ST("#4a3426", .8)}/>`,
  quiver: () => `<path d="M-5,0 L-7,-30 L5,-30 L5,0 Z" fill="#a8743a" ${ST()}/><path d="M-4,-30 L-6,-40 M0,-30 L0,-42 M3,-30 L5,-40" ${ST("#7a5a3a", 1.2)}/>`,
  rope: () => `<path d="M-26,-6 Q-18,-14 -10,-6 T6,-6 T22,-6" fill="none" ${ST("#b8955a", 3)}/><path d="M-26,-6 Q-18,-14 -10,-6 T6,-6 T22,-6" fill="none" stroke="#7a5a2a" stroke-width=".8" stroke-dasharray="2 2"/>`,
  gate: () => `<path d="M-46,0 L-46,-60 L46,-60 L46,0 L22,0 L22,-34 Q0,-54 -22,-34 L-22,0 Z" fill="#d8c49a" ${ST()}/><path d="M-50,-60 L-50,-68 L-38,-68 L-38,-62 L-26,-62 L-26,-68 L-14,-68 L-14,-62 L-2,-62 L-2,-68 L10,-68 L10,-62 L22,-62 L22,-68 L34,-68 L34,-62 L50,-62 L50,-60 Z" fill="#c9b08a" ${ST()}/>`,
  window: () => `<path d="M-34,0 L-34,-70 L34,-70 L34,0 Z" fill="#e2d2b0" ${ST("#8a7a5a", 1.4)}/><rect x="-16" y="-60" width="32" height="26" rx="12" fill="#3a4a5a" ${ST()}/><path d="M0,-60 L0,-34 M-16,-46 L16,-46" ${ST("#d8c49a", 2)}/>`,
  scales: () => `<path d="M0,0 L0,-40 M-24,-36 L24,-36" ${ST("#8a6a3a", 2)}/><path d="M-24,-36 L-30,-20 M-24,-36 L-18,-20 M24,-36 L18,-20 M24,-36 L30,-20" ${ST("#8a6a3a", .9)}/><path d="M-32,-20 Q-24,-14 -16,-20 Z M16,-20 Q24,-14 32,-20 Z" fill="#e8c060" ${ST()}/><path d="M-8,0 L8,0" ${ST("#8a6a3a", 3)}/>`,
  veil: () => `<path d="M-12,-40 Q0,-48 12,-40 L16,0 L-16,0 Z" fill="#f2ead8" opacity=".9" ${ST()}/>`,
  thicket: () => `<path d="M-34,0 Q-38,-18 -24,-22 Q-22,-36 -6,-30 Q6,-40 18,-28 Q34,-30 32,-12 Q40,-4 34,0 Z" fill="#5f8f4a" ${ST("#3a5a2a")}/><path d="M-20,-10 L-12,-18 M0,-14 L8,-24 M16,-8 L24,-18" ${ST("#3a5a2a", 1.2)}/>`,
  dew: () => [[-30, -40], [-6, -52], [18, -36], [36, -50], [-18, -24], [6, -20]].map(([x, y]) => `<path d="M${x},${y - 5} Q${x - 3},${y} ${x},${y + 2} Q${x + 3},${y} ${x},${y - 5} Z" fill="#cfe8fa" ${ST("#5a8ab0", .6)}/>`).join(""),
  oil: () => `<path d="M-6,-30 Q-10,-38 -2,-40 L6,-40 Q12,-36 8,-30 Q14,-20 10,-8 Q6,0 0,0 Q-8,0 -10,-8 Q-14,-20 -6,-30 Z" fill="#d8b060" ${ST()}/><path d="M10,-36 Q18,-34 20,-24 Q21,-18 19,-14" fill="none" ${ST("#e8c040", 1.8)}/>`,
  feast: () => `<rect x="-44" y="-14" width="88" height="8" rx="2" fill="#a8743a" ${ST()}/><path d="M-38,-6 L-38,0 M38,-6 L38,0" ${ST()}/><ellipse cx="-22" cy="-17" rx="10" ry="4" fill="#d8a050" ${ST()}/><path d="M2,-26 L2,-14 L10,-14 L10,-26 Z" fill="#a83a4a" ${ST()}/><circle cx="26" cy="-18" r="5" fill="#d83a2a" ${ST()}/>`,
  spotted: () => `<path d="M-18,0 L-16,-8 M14,0 L12,-8" ${ST("#4a3426", 2)}/><ellipse cy="-14" rx="20" ry="11" fill="#f6f2e8" ${ST()}/>` + [[-10, -16], [2, -10], [8, -19], [-4, -21]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#7a5a3a"/>`).join("") + `<ellipse cx="20" cy="-18" rx="7" ry="5" fill="#5a4a3a"/>`,
  baby: () => `<ellipse cy="-6" rx="11" ry="6" fill="#f3ead6" ${ST()}/><circle cx="-10" cy="-8" r="4.5" fill="${SKIN}" ${ST()}/>`,
};

// ───────────── 말풍선 ─────────────
const tw = (t, s) => [...String(t)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? s : c === " " ? s * 0.32 : s * 0.56), 0);
function wrap(text, size, maxW) {
  const words = String(text).split(" "), lines = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (tw(t, size) <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  // 낱말 하나가 너무 길면 글자 단위로 자른다
  return lines.flatMap((l) => { if (tw(l, size) <= maxW) return [l]; const out = []; let c = ""; for (const ch of l) { if (tw(c + ch, size) > maxW) { out.push(c); c = ch; } else c += ch; } return c ? [...out, c] : out; });
}
export function bubble(say) {
  const size = 10.5, maxW = say.maxW || 150, lines = wrap(say.text, size, maxW);
  const w = Math.min(maxW, Math.max(...lines.map((l) => tw(l, size)))) + 14, h = lines.length * (size + 3.5) + 9;
  const [tx, ty] = say.at || [W / 2, 70];
  const bx = Math.min(Math.max(tx - w / 2, 4), W - w - 4), by = say.top ?? (say.who ? 14 : 4);
  const god = say.who === "하나님" || say.who === "주";
  const fill = god ? "#fff8e0" : "#ffffff", stroke = "#4a3426";
  const cx = Math.min(Math.max(tx, bx + 12), bx + w - 12);
  const tail = ty > by + h + 4 ? `<path d="M${f1(cx - 6)},${f1(by + h - 1)} L${f1(tx)},${f1(ty)} L${f1(cx + 6)},${f1(by + h - 1)} Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/><path d="M${f1(cx - 5)},${f1(by + h - 1.2)} L${f1(cx + 5)},${f1(by + h - 1.2)}" stroke="${fill}" stroke-width="2.4"/>` : "";
  const ww = tw(say.who || "", 8) + 8;
  const wx = bx < 34 ? bx + w - ww - 6 : bx + 6;
  const who = say.who ? `<rect x="${f1(wx)}" y="${f1(by - 11)}" width="${f1(ww)}" height="11.5" rx="3" fill="${god ? "#c9973b" : "#3a3a3a"}"/><text x="${f1(wx + ww / 2)}" y="${f1(by - 2.6)}" text-anchor="middle" font-size="8" font-weight="700" fill="#ffffff" font-family="Noto Sans KR">${esc(say.who)}</text>` : "";
  const text = lines.map((l, i) => `<text x="${f1(bx + w / 2)}" y="${f1(by + 8 + size * 0.86 + i * (size + 3.5))}" text-anchor="middle" font-size="${size}" font-weight="700" fill="#1a1a1a" font-family="Noto Sans KR">${esc(l)}</text>`).join("");
  return { svg: `<rect x="${f1(bx)}" y="${f1(by)}" width="${f1(w)}" height="${f1(h)}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/>${tail}${who}${text}`, box: { x: bx, y: by, w, h }, lines };
}

// ───────────── 신문 만화 색 ─────────────
function ink(hex) {
  let h = hex.slice(1); if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  if (l < 40) return "#111111";
  const m = (c, p) => Math.round(Math.min(255, (c * 0.5 + l * 0.5) * 0.92 + p * 0.08));
  return "#" + [m(r, 251), m(g, 246), m(b, 232)].map((n) => n.toString(16).padStart(2, "0")).join("");
}
const CLOUDS = [[48, 26, 1], [172, 20, 0.8], [118, 46, 0.55]].map(([x, y, k]) => `<g transform="translate(${x},${y}) scale(${k})" opacity=".95"><path d="M-30,6 Q-34,-4 -22,-6 Q-20,-18 -6,-16 Q2,-26 16,-18 Q30,-20 30,-6 Q40,-2 34,6 Z" fill="#ffffff"/><path d="M-30,6 Q0,0 34,6 Q20,10 -24,10 Z" fill="#c8dcef" opacity=".8"/></g>`).join("");
const newsprint = (svg) => svg.replace(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g, ink);
function sfx(t) {
  const size = t.s || 15;
  return `<text x="${f1(t.x)}" y="${f1(t.y)}" transform="rotate(${t.r || -8} ${f1(t.x)} ${f1(t.y)})" text-anchor="middle" font-size="${size}" font-weight="900" font-family="Noto Sans KR" fill="#c0503a">${esc(t.t)}</text>`;
}

// ───────────── 한 컷 그림 ─────────────
export const says = (p) => [].concat(p.say || []);
export const artDir = (book, ch) => path.join(R, BOOKS[book].src, "만화그림", String(ch).padStart(2, "0"));
export const artFile = (book, ch, i) => path.join(artDir(book, ch), String(i + 1).padStart(2, "0") + ".jpg");
// 그림 컷의 말풍선은 그림 바깥 위 띠에 둔다 — 그림 위에 얹으면 얼굴을 가린다(사용자 지시 2026-11-02 "얼굴이 안 보이잖아, 지면을 더 활용").
// 꼬리는 그림 쪽으로 내려 말하는 사람(at x) 위를 가리킨다. 말풍선 2개면 나란히(길면 위아래).
export const ART_H = 130; // 그림 컷 비율 240×135(16:9) — 생성 그림(16:10)의 위아래를 조금 잘라 지면을 아낀다
function sayStrip(p) {
  const ss = says(p);
  if (!ss.length) return `<div class="says"></div>`;
  return `<div class="says">${ss.map((s, i) => {
    const x = (s.at?.[0] ?? W / 2) / W, n = ss.length, t = Math.round(Math.min(.88, Math.max(.12, n === 1 ? x : (x - i / n) * n)) * 100);
    const god = s.who === "하나님" || s.who === "주";
    return `<div class="sb${god ? " god" : ""}" style="--t:${t}%">${s.who ? `<b class="who">${esc(s.who)}</b>` : ""}${esc(s.text)}</div>`;
  }).join("")}</div>`;
}
export function panelSvg(p, id, img) {
  // 테두리는 .pic(CSS)에 — 말풍선이 많은 쪽은 그림 칸 높이가 줄어 위아래가 더 잘리므로(slice) 테두리를 그림 안에 두지 않는다
  if (img) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${ART_H}" preserveAspectRatio="xMidYMid slice" class="panel-svg"><image href="${img}" x="0" y="0" width="${W}" height="${ART_H}" preserveAspectRatio="xMidYMid slice"/></svg>`;
  const bg = BG[p.bg || "sky"];
  if (!bg) throw new Error("없는 배경: " + p.bg);
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="panel-svg"><defs>${grad("g" + id, bg[0], bg[1])}</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#g${id})"/>`];
  if (bg[4] && p.clouds !== false) out.push(CLOUDS);
  if (p.ground !== false) {
    if (bg[3]) out.push(`<path d="M0,${GY - 22} Q40,${GY - 40} 90,${GY - 26} Q140,${GY - 14} 180,${GY - 30} Q215,${GY - 42} ${W},${GY - 24} L${W},${GY} L0,${GY} Z" fill="${bg[3]}" opacity=".9"/>`);
    out.push(`<path d="M0,${GY - 6} Q${W / 2},${GY - 13} ${W},${GY - 6} L${W},${H} L0,${H} Z" fill="${bg[2]}"/><path d="M0,${GY + 4} Q${W / 2},${GY - 2} ${W},${GY + 4} L${W},${H} L0,${H} Z" fill="#000" opacity=".06"/>`);
    if (["sky", "garden", "field"].includes(p.bg || "sky")) out.push([16, 52, 96, 140, 176, 218].map((gx, k) => `<path d="M${gx},${GY + 6 + (k % 2) * 6} q2,-6 4,-7 M${gx + 3},${GY + 6 + (k % 2) * 6} q1,-5 4,-5" fill="none" stroke="#4f8a3a" stroke-width="1" opacity=".55"/>`).join(""));
  }
  const tags = [];
  for (const a of p.art || []) {
    const x = a.x ?? W / 2, y = a.y ?? GY, s = a.s ?? 1;
    if (a.f) {
      if (a.f === "angel") out.push(angel({ x, y, s }));
      else out.push(person({ ...a, x, y, s, kind: a.f }));
      if (a.name) tags.push({ x, y, t: a.name });
    } else {
      if (!THINGS[a.m]) throw new Error("없는 만화 그림: " + a.m);
      out.push(`<g transform="translate(${f1(x)},${f1(y)}) scale(${f1((a.flip ? -1 : 1) * s)},${f1(s)})${a.r ? ` rotate(${a.r})` : ""}"${a.o ? ` opacity="${a.o}"` : ""}>${THINGS[a.m]()}</g>`);
      if (a.name) tags.push({ x, y, t: a.name });
    }
  }
  // 이름표: 발 아래(얼굴 대신 누구인지 알려 줌)
  for (const t of tags) {
    const w = tw(t.t, 8) + 8, ty = Math.min(t.y + 3, H - 12);
    out.push(`<rect x="${f1(t.x - w / 2)}" y="${f1(ty)}" width="${f1(w)}" height="11" rx="3" fill="#ffffff" fill-opacity=".88" stroke="#2b2b2b" stroke-width=".6"/><text x="${f1(t.x)}" y="${f1(ty + 8.4)}" text-anchor="middle" font-size="8" font-weight="700" fill="#1a1a1a" font-family="Noto Sans KR">${esc(t.t)}</text>`);
  }
  for (const t of p.sfx || []) out.push(sfx(t));
  for (const x of says(p)) out.push(bubble(x).svg);
  out.push(`<rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="5" fill="none" stroke="#4a3426" stroke-width="2"/></svg>`);
  return out.join("");
}

// 내레이션: u 조각마다 밑줄(지침 — 중요한 부분에 밑줄, 사용자 지시 2026-11-02)
export function captionHtml(p) {
  const cap = p.cap;
  const rs = (p.u || []).map((t) => ({ s: cap.indexOf(t), e: cap.indexOf(t) + t.length })).sort((a, b) => a.s - b.s);
  let o = "", pos = 0;
  for (const r of rs) { if (r.s < pos) continue; o += esc(cap.slice(pos, r.s)) + `<span class="cu">${esc(cap.slice(r.s, r.e))}</span>`; pos = r.e; }
  return o + esc(cap.slice(pos));
}

export const PANELS = 18, PER_PAGE = 6;
// 쪽 그리기: items = [{ch, i, x(컷), id}] — 6컷씩 한 쪽. 그림(만화그림/CC/PP.jpg)이 있으면 그림 컷(말풍선은 그림 밖 위 띠).
function pagesHtml(book, items, { first, mk, head }) {
  const pages = Math.ceil(items.length / PER_PAGE);
  let o = "";
  for (let pg = 0; pg < pages; pg++) {
    const part = items.slice(pg * PER_PAGE, (pg + 1) * PER_PAGE), arts = part.every((t) => fs.existsSync(artFile(book, t.ch, t.i)));
    o += `<div class="comic-page"${pg === 0 ? ` id="${first}"` : ""}>${pg === 0 ? mk(first) : ""}<div class="comic-head"><span class="ct">만화로 보는 이야기</span><span class="cn">${esc(head)} · ${pg + 1} / ${pages}</span></div><div class="comic-grid${arts ? " arts" : ""}">`;
    part.forEach((t, k) => {
      const n = pg * PER_PAGE + k + 1, img = arts ? "data:image/jpeg;base64," + fs.readFileSync(artFile(book, t.ch, t.i)).toString("base64") : null;
      o += img ? `<div class="panel art">${sayStrip(t.x)}<div class="pic"><div class="pnum">${n}</div>${panelSvg(t.x, t.id, img)}</div><div class="cap">`
        : `<div class="panel"><div class="pnum">${n}</div>${panelSvg(t.x, t.id)}<div class="cap">`;
      o += `<span class="pv">${esc(t.x.v)}</span>${captionHtml(t.x)}</div></div>`;
    });
    o += `</div>${pg === pages - 1 ? `<div class="comic-note">그림은 이야기를 돕는 그림입니다. 하나님은 사람 모양으로 그리지 않고 빛으로만 나타냈습니다. 말풍선은 표준킹제임스성경 본문 그대로이고, 아래 글의 <span class="cu">밑줄</span>은 중요한 부분입니다.</div>` : ""}</div>`;
  }
  return o;
}
const CSS = `<style>
.comic-page{break-before:page;break-inside:avoid;height:174mm;display:flex;flex-direction:column;}
.comic-head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.5mm solid #c9973b;padding-bottom:1mm;margin-bottom:2mm;}
.comic-head .ct{font:900 12pt/1.3 "Noto Sans KR";color:#18233f;}
.comic-head .cn{font:500 7.6pt "Noto Sans KR";color:#8a7442;}
.comic-grid{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:repeat(3,1fr);gap:2.4mm 2.6mm;flex:1;}
.panel{position:relative;display:flex;flex-direction:column;break-inside:avoid;}
.panel svg.panel-svg{width:100%;height:auto;display:block;border-radius:1mm;}
.panel .pnum{position:absolute;left:1.2mm;top:1.2mm;width:4.4mm;height:4.4mm;border-radius:50%;background:#18233f;color:#fff;font:700 6.6pt/4.4mm "Noto Sans KR";text-align:center;z-index:2;}
.panel .cap{font:500 7.9pt/1.5 "Noto Sans KR";color:#1d2433;margin-top:1mm;}
.panel .pv{font:700 6.4pt "Noto Sans KR";color:#a67a2a;margin-right:1mm;}
.cu{text-decoration:underline;text-decoration-color:#c0392b;text-decoration-thickness:.45mm;text-underline-offset:.7mm;font-weight:700;}
.comic-note{font:7pt/1.5 "Noto Sans KR";color:#6b5d3d;margin-top:1.6mm;}
/* 그림 컷(이미지 생성 그림): 말풍선 띠 → 그림 → 내레이션. subgrid로 같은 줄 두 컷의 그림 높이를 맞춘다. 말풍선은 그림 밖(얼굴을 가리지 않음). */
/* 그림 줄은 minmax(0, 본래 높이) — 말풍선·내레이션이 길어 한 쪽을 넘치면 그림 칸만 줄어든다(3줄째가 다음 쪽으로 밀려 본문과 겹치던 일, 2026-11-02). */
.comic-grid.arts{grid-template-rows:repeat(3,auto minmax(0,34.4mm) auto);gap:0 2.6mm;align-content:space-between;min-height:0;}
.panel.art{display:grid;grid-row:span 3;grid-template-rows:subgrid;}
.panel.art .pic{min-height:0;overflow:hidden;border:.55mm solid #4a3426;border-radius:1.4mm;}
.panel.art .pic svg.panel-svg{height:100%;border-radius:0;}
.panel.art .says{display:flex;flex-wrap:wrap;gap:1mm 1.6mm;align-items:flex-end;padding-bottom:1.9mm;}
.panel.art .sb{position:relative;flex:1 1 40%;background:#fff;border:.3mm solid #4a3426;border-radius:2.6mm;padding:1mm 1.8mm;font:700 7pt/1.32 "Noto Sans KR";color:#1a1a1a;text-align:center;}
.panel.art .sb.god{background:#fff8e0;border-color:#b8862b;}
.panel.art .sb::after{content:"";position:absolute;left:var(--t);bottom:-1.9mm;width:2.6mm;height:2.4mm;margin-left:-1.3mm;background:inherit;border-right:.3mm solid #4a3426;border-bottom:.3mm solid #4a3426;transform:skewX(-25deg) rotate(45deg) translateY(-1.1mm);}
.panel.art .sb.god::after{border-color:#b8862b;}
.panel.art .who{display:inline-block;background:#3a3a3a;color:#fff;font:700 6pt/1.5 "Noto Sans KR";border-radius:.8mm;padding:0 1.1mm;margin-right:1.2mm;vertical-align:.2mm;}
.panel.art .sb.god .who{background:#c9973b;}
.panel.art .pic{position:relative;}
.panel.art .cap{margin:.8mm 0 1.4mm;line-height:1.42;}
.comic-grid.arts~.comic-note{margin-top:.6mm;font-size:6.6pt;}
</style>`;
// 장 하나(장 원고의 comic 18컷)
export function chapterComicHtml(book, ch, d, { p = "", mk = () => "", bookKo }) {
  return CSS + pagesHtml(book, d.comic.map((x, i) => ({ ch, i, x, id: `${p}c${ch}p${i}` })), { first: p + "comic", mk, head: `${bookKo} ${ch}장` });
}

// ───────────── 단원 책(창세기 30권 등) ─────────────
// 단원 원고 폴더의 <책>-comicNN.json:
//   새 형식 { "from": "chapters", "panels": [[장, 컷 번호(1–18)], …] } — 장 원고 comic의 컷을 골라 18컷 · 3쪽(사용자 지시 2026-11-02, 지브리 풍 그림)
//   옛 형식 { "panels": [ { ref, cap, items, say } … ] } — 6칸 한 쪽(comic6.mjs). 장 원고에 comic이 아직 없는 단원에만 남는다.
export const comicFile = old.comicFile;
export const hasComic = old.hasComic;
export const loadComic = old.loadComic;
const isNew = (c) => c.from === "chapters";
const chapterDoc = (book, ch) => JSON.parse(fs.readFileSync(chapterFile(book, ch), "utf8"));
const vnum = (r) => { const [c, v] = String(r).split(":").map((x) => parseInt(x)); return c * 1000 + v; };
// 단원 범위(from–to) 안의 장 원고 컷에서 고르게 18컷을 뽑는다 — 처음·끝 컷은 꼭 넣는다
export function pickPanels(book, unit) {
  const lo = vnum(unit.from), hi = vnum(unit.to), all = [];
  for (let ch = Math.floor(lo / 1000); ch <= Math.floor(hi / 1000); ch++) {
    let d; try { d = chapterDoc(book, ch); } catch { continue; }
    (d.comic || []).forEach((x, i) => { const v = vnum(x.v); if (v >= lo && v <= hi) all.push([ch, i + 1]); });
  }
  const k6 = Math.floor(Math.min(all.length, PANELS) / PER_PAGE) * PER_PAGE;
  if (!k6) return [];
  return [...Array(k6).keys()].map((k) => all[Math.round((k * (all.length - 1)) / Math.max(1, k6 - 1))]);
}
export function checkComic(book, n) {
  const c = loadComic(book, n);
  if (!isNew(c)) return old.checkComic(book, n);
  const E = [];
  if (!c.panels?.length || c.panels.length > PANELS || c.panels.length % PER_PAGE) E.push(`컷 수 ${c.panels?.length}(6의 배수, ${PANELS} 이하)`);
  let prev = 0;
  for (const [ch, k] of c.panels || []) {
    let x; try { x = chapterDoc(book, ch).comic?.[k - 1]; } catch {}
    if (!x) { E.push(`${ch}장 ${k}컷 없음`); continue; }
    if (vnum(x.v) < prev) E.push(`${ch}장 ${k}컷 절 순서 거꾸로`); prev = vnum(x.v);
  }
  return E;
}
export function comicHtml(book, n, { title, bookKo }, mk = () => "") {
  const c = loadComic(book, n);
  if (!isNew(c)) return old.COMIC_CSS + old.comicHtml(book, n, { title, bookKo }, mk);
  const docs = {};
  const items = c.panels.map(([ch, k], j) => { const d = (docs[ch] ||= chapterDoc(book, ch)); return { ch, i: k - 1, x: d.comic[k - 1], id: `u${j}c${ch}p${k}` }; });
  return CSS + pagesHtml(book, items, { first: "comic", mk, head: `${bookKo} ${title}` });
}
// build.mjs는 comic.COMIC_CSS + comicHtml(...)로 넣는다 — CSS는 형식에 맞춰 comicHtml이 직접 붙이므로 비워 둔다
export const COMIC_CSS = "";
