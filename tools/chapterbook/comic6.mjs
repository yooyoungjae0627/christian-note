// 「만화로 보는 이야기」(사용자 지시 2026-11-02: "지도 다음에 전체 내용을 만화 삽화로") — 단원 전체를 칸 만화 6칸 안팎으로.
// 원고: 단원 원고와 같은 폴더의 <책>-comicNN.json
//   { "panels": [ { "ref": "20:1-2", "cap": "칸 아래 설명", "sky": "day|night|dusk", "items": [["person", x, y, s, {…}], …],
//                   "say": [{ "t": "말", "x": 20, "y": 14, "w": 170, "to": [x, y], "god": true }] } ] }
// 그림은 선 그림 SVG(400×300 판). 하나님·천사는 사람 모습으로 그리지 않고 하늘의 빛으로만, 사람 얼굴에는 눈·입을 그리지 않는다(표지 규칙과 같음).
// 말풍선의 말은 「소설로 먼저 읽기」와 같은 규칙 — 근거 절에 있는 말을 요즘 말투로(지침 §2-4).
import fs from "node:fs";
import path from "node:path";
import { esc, chapterVerses } from "./lib.mjs";
import { useBook, unitDir, loadUnit } from "./units.mjs";
import { textW } from "./rel.mjs";

export const comicFile = (book, n) => { useBook(book); return path.join(unitDir(), `${book}-comic${String(n).padStart(2, "0")}.json`); };
export const hasComic = (book, n) => fs.existsSync(comicFile(book, n));
export const loadComic = (book, n) => JSON.parse(fs.readFileSync(comicFile(book, n), "utf8"));

const INK = "#2a2522", SKIN = "#ecc7a2", SW = 2.4;
const ln = (d, c = INK, w = SW, extra = "") => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const sh = (d, fill, extra = "") => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${SW}" stroke-linejoin="round" ${extra}/>`;
const g = (x, y, s, flip, body) => `<g transform="translate(${x},${y}) scale(${flip ? -s : s},${s})">${body}</g>`;
// 팔: 바깥선(검정) 위에 옷 색 — 손은 살색 동그라미
const arm = (x1, y1, x2, y2, robe) => ln(`M${x1},${y1}L${x2},${y2}`, INK, 11) + ln(`M${x1},${y1}L${x2},${y2}`, robe, 7) + `<circle cx="${x2}" cy="${y2}" r="4.6" fill="${SKIN}" stroke="${INK}" stroke-width="1.8"/>`;
const ARMS = { // [뒤팔 끝, 앞팔 끝] — 어깨는 (∓12,-74). 2026-11-02 옛 만화체(큰 머리)로 바꾸며 다시 잡음
  down: [[-18, -40], [18, -40]], raise: [[-18, -40], [26, -120]], forward: [[-18, -40], [36, -60]], reach: [[-18, -40], [40, -76]],
  pray: [[12, -60], [20, -62]], wide: [[-38, -72], [38, -72]], hold: [[14, -50], [28, -52]], cry: [[4, -100], [14, -100]],
};
// 얼굴(오른쪽을 보는 4분의 3 얼굴) — 사용자 지시 2026-11-02 「뚱딴지·꺼벙이 같은 옛 만화처럼」: 큰 머리, 점 눈, 눈썹, 입으로 감정을 보인다.
// mood: calm(기본) smile sad angry surprise cry sleep worry
function face(cx, cy, mood = "calm") {
  const e1 = cx + 7, e2 = cx + 21, ey = cy - 2, my = cy + 13, mx = cx + 15;
  let o = `<circle cx="${cx + 3}" cy="${cy + 9}" r="5" fill="#f4a3a0" opacity=".55"/><circle cx="${cx + 27}" cy="${cy + 9}" r="4" fill="#f4a3a0" opacity=".55"/>`;
  const dot = (x, r = 1) => `<ellipse cx="${x}" cy="${ey}" rx="${2.8 * r}" ry="${3.8 * r}" fill="${INK}"/><circle cx="${x + 1}" cy="${ey - 1.4}" r="${0.9 * r}" fill="#fff"/>`;
  const arc = (x, up = true) => ln(`M${x - 4},${ey + (up ? 1 : -1)}q4,${up ? -5 : 5} 8,0`, INK, 2.2);
  const brow = (x, tilt) => ln(`M${x - 5},${ey - 9 + tilt}L${x + 5},${ey - 9 - tilt}`, INK, 2.2);
  if (mood === "smile") o += arc(e1) + arc(e2) + brow(e1, 0) + brow(e2, 0) + sh(`M${mx - 7},${my - 2}q7,9 14,0z`, "#c0392b");
  else if (mood === "sad") o += dot(e1) + dot(e2) + brow(e1, -2.5) + brow(e2, 2.5) + ln(`M${mx - 6},${my + 2}q6,-6 12,0`, INK, 2.2);
  else if (mood === "angry") o += dot(e1) + dot(e2) + brow(e1, 3) + brow(e2, -3) + ln(`M${mx - 6},${my}h12`, INK, 2.4);
  else if (mood === "surprise") o += dot(e1, 1.3) + dot(e2, 1.3) + brow(e1, 0) + brow(e2, 0) + `<ellipse cx="${mx}" cy="${my}" rx="4" ry="5" fill="${INK}"/>`;
  else if (mood === "cry") o += arc(e1, false) + arc(e2, false) + brow(e1, -2.5) + brow(e2, 2.5) + ln(`M${mx - 7},${my}q3.5,-4 7,0t7,0`, INK, 2) + sh(`M${e1 - 2},${ey + 4}q-4,9 0,12q4,-3 0,-12z`, "#7fc4ea") + sh(`M${e2 + 1},${ey + 4}q-4,9 0,12q4,-3 0,-12z`, "#7fc4ea");
  else if (mood === "sleep") o += ln(`M${e1 - 4},${ey}h8M${e2 - 4},${ey}h8`, INK, 2.2) + ln(`M${mx - 4},${my}q4,3 8,0`, INK, 2);
  else if (mood === "worry") o += dot(e1) + dot(e2) + brow(e1, -2) + brow(e2, 2) + ln(`M${mx - 6},${my}q3,-3 6,0t6,0`, INK, 2);
  else o += dot(e1) + dot(e2) + brow(e1, 0) + brow(e2, 0) + ln(`M${mx - 5},${my - 1}q5,4 10,0`, INK, 2.2);
  return o + ln(`M${cx + 31},${cy + 1}q4,3 0,6`, INK, 1.8); // 코
}
// 머리: 큰 동그라미 + 머릿수건·너울·머리카락·수염·관 — (cx,cy)는 머리 가운데
function head(cx, cy, o, mood) {
  let b = `<circle cx="${cx}" cy="${cy}" r="30" fill="${SKIN}" stroke="${INK}" stroke-width="${SW}"/>`;
  b += face(cx - 4, cy, mood);
  if (o.beard) b += sh(`M${cx - 20},${cy + 2}Q${cx - 14},${cy + 44} ${cx + 16},${cy + 36}Q${cx + 32},${cy + 30} ${cx + 30},${cy + 10}Q${cx + 22},${cy + 22} ${cx + 8},${cy + 22}Q${cx - 6},${cy + 20} ${cx - 20},${cy + 2}Z`, o.beard === true ? "#e4e4e0" : o.beard) + ln(`M${cx + 6},${cy + 14}q5,3 10,0`, INK, 2);
  if (o.veil) b += sh(`M${cx - 34},${cy + 34}Q${cx - 40},${cy - 30} ${cx},${cy - 36}Q${cx + 36},${cy - 34} ${cx + 32},${cy - 10}Q${cx + 14},${cy - 26} ${cx - 8},${cy - 22}Q${cx - 22},${cy - 14} ${cx - 22},${cy + 34}Z`, o.veil);
  else if (o.egypt) b += sh(`M${cx - 34},${cy + 34}L${cx - 30},${cy - 24}Q${cx},${cy - 44} ${cx + 30},${cy - 24}L${cx + 30},${cy - 12}Q${cx},${cy - 26} ${cx - 20},${cy - 10}L${cx - 22},${cy + 34}Z`, "#e8c85a") + ln(`M${cx - 30},${cy - 4}h10M${cx - 31},${cy + 8}h10M${cx - 32},${cy + 20}h10M${cx - 18},${cy - 30}l40,0`, "#2f5fa8", 3);
  else if (o.cloth === false) b += sh(`M${cx - 30},${cy - 2}Q${cx - 30},${cy - 34} ${cx},${cy - 32}Q${cx + 28},${cy - 32} ${cx + 30},${cy - 12}Q${cx + 14},${cy - 24} ${cx + 2},${cy - 18}Q${cx - 10},${cy - 26} ${cx - 18},${cy - 12}Q${cx - 22},${cy - 4} ${cx - 30},${cy - 2}Z`, o.hair || "#3a2a20");
  else b += sh(`M${cx - 34},${cy + 30}L${cx - 32},${cy - 14}Q${cx - 28},${cy - 38} ${cx},${cy - 38}Q${cx + 30},${cy - 38} ${cx + 33},${cy - 14}L${cx + 26},${cy - 14}Q${cx + 22},${cy - 28} ${cx},${cy - 28}Q${cx - 20},${cy - 28} ${cx - 22},${cy - 4}L${cx - 24},${cy + 30}Z`, o.cloth || "#efe3c8") + ln(`M${cx - 30},${cy - 20}Q${cx},${cy - 34} ${cx + 31},${cy - 18}`, o.band || "#7a3b2a", 3);
  if (o.crown) b += sh(`M${cx - 16},${cy - 34}L${cx - 18},${cy - 52}L${cx - 8},${cy - 42}L${cx},${cy - 56}L${cx + 8},${cy - 42}L${cx + 18},${cy - 52}L${cx + 16},${cy - 34}Z`, "#e8b83a");
  return b;
}

const P = {
  // 서 있는 사람(큰 머리 만화체) — (x,y)는 발 가운데, 키 약 150. o: robe, cloth, hair, beard, veil, egypt, crown, pose, mood, flip, wood, staff, knife, fire, baby, bow, skin
  person(x, y, s = 1, o = {}) {
    const robe = o.robe || "#c4875a"; const [ba, fa] = ARMS[o.pose || "down"];
    let b = "";
    if (o.wood) b += `<g transform="rotate(-16,-20,-60)">${sh("M-44,-82h32v42h-32z", "#a8743f")}${ln("M-44,-71h32M-44,-60h32M-44,-49h32", "#6e4a26", 1.6)}${ln("M-46,-76l36,0M-46,-46l36,0", INK, 2)}</g>`;
    b += arm(-12, -74, ba[0], ba[1], robe);
    b += sh("M-15,-84Q0,-88 15,-84L25,-3Q0,3 -25,-3Z", robe);
    b += ln("M-19,-44L19,-44", o.sash || "#7a3b2a", 4);
    b += `<ellipse cx="-10" cy="0" rx="9" ry="4.4" fill="${INK}"/><ellipse cx="11" cy="0" rx="9" ry="4.4" fill="${INK}"/>`;
    b += head(2, -112, o, o.mood);
    b += arm(12, -74, fa[0], fa[1], robe);
    if (o.staff) b += ln(`M${fa[0] + 2},${fa[1] - 40}L${fa[0] + 2},0`, "#7a5230", 4.4);
    if (o.knife) b += sh(`M${fa[0] + 3},${fa[1] - 2}l14,-16l3,3l-14,15z`, "#cfd6dc");
    if (o.fire) b += sh(`M${fa[0] - 6},${fa[1] + 2}h14l-2,12h-10z`, "#8a5a3a") + sh(`M${fa[0] + 1},${fa[1] + 1}q-6,-9 0,-17q6,8 0,17z`, "#f39a2b");
    if (o.baby) b += sh(`M${fa[0] - 20},${fa[1] - 6}q16,-14 30,0q-2,14 -16,14q-14,0 -14,-14z`, "#f6f0e2") + `<circle cx="${fa[0] + 4}" cy="${fa[1] - 11}" r="8" fill="${SKIN}" stroke="${INK}" stroke-width="1.8"/>` + ln(`M${fa[0] + 3},${fa[1] - 12}h2M${fa[0] + 8},${fa[1] - 12}h2`, INK, 1.6);
    if (o.bow) b += ln(`M${fa[0] + 4},${fa[1] - 30}Q${fa[0] + 24},${fa[1]} ${fa[0] + 4},${fa[1] + 30}`, "#7a5230", 3.4) + ln(`M${fa[0] + 4},${fa[1] - 30}L${fa[0] + 4},${fa[1] + 30}`, INK, 1.2);
    if (o.skin) b += sh("M-28,-76q-10,10 -6,26q10,6 16,-4q2,-14 -10,-22z", "#9b6b43");
    return g(x, y, s, o.flip, b);
  },
  // 앉은 사람(기본은 슬픈 얼굴, tears면 우는 얼굴)
  sit(x, y, s = 1, o = {}) {
    const robe = o.robe || "#7f8fa6";
    let b = sh("M-18,-54Q0,-58 18,-54L32,-2Q0,4 -32,-2Z", robe);
    b += head(0, -82, { veil: o.veil ?? "#d9cfe0", cloth: o.cloth, beard: o.beard, hair: o.hair }, o.mood || (o.tears ? "cry" : "sad"));
    b += arm(-12, -48, -20, -20, robe) + arm(12, -48, 22, -20, robe);
    return g(x, y, s, o.flip, b);
  },
  // 엎드려 절하는 사람(오른쪽을 향함) — 얼굴은 땅을 향해 보이지 않는다
  kneel(x, y, s = 1, o = {}) {
    const robe = o.robe || "#9b8a6a";
    let b = sh("M-36,0Q-42,-34 -14,-44Q12,-50 24,-28L28,0Z", robe) + `<circle cx="34" cy="-16" r="20" fill="${SKIN}" stroke="${INK}" stroke-width="${SW}"/>`;
    if (o.cloth !== false) b += sh("M16,-28Q30,-48 52,-24L46,-16Q32,-34 22,-14Z", o.cloth || "#efe3c8");
    else b += sh("M16,-26Q30,-44 50,-26Q34,-34 18,-18Z", o.hair || "#3a2a20");
    b += arm(14, -32, 50, -2, robe);
    return g(x, y, s, o.flip, b);
  },
  // 누운 사람(묶인 이삭·잠든 왕) — (x,y)는 몸 가운데 아래, 머리는 오른쪽
  lying(x, y, s = 1, o = {}) {
    const robe = o.robe || "#d9a35e";
    let b = "";
    if (o.blanket) b += sh("M-50,-6h100v-8h-100z", "#8a6d9e");
    b += sh("M-46,-8Q-48,-28 -30,-28L22,-26Q30,-16 22,-6L-40,-4Z", robe);
    b += `<g transform="translate(40,-20) scale(.62) rotate(-90)">${head(0, 0, { cloth: o.cloth, crown: o.crown, beard: o.beard, hair: o.hair }, o.mood || (o.crown ? "sleep" : "calm"))}</g>`;
    if (o.rope) b += ln("M-26,-30L-24,-2M-6,-29L-4,-3M12,-28L14,-4", "#b8935a", 3.2);
    if (o.blanket) b += sh("M-48,-20Q-10,-34 22,-24L24,-6L-46,-4Z", o.blanket);
    return g(x, y, s, o.flip, b);
  },
  donkey(x, y, s = 1, o = {}) {
    const c = "#9d928a";
    let b = ln("M-26,-34L-30,0M-12,-32L-14,0M16,-32L18,0M28,-34L32,0", INK, 5) + ln("M-26,-34L-30,0M-12,-32L-14,0M16,-32L18,0M28,-34L32,0", c, 2.6);
    b += sh("M-38,-44Q-40,-66 -10,-66L24,-66Q44,-64 40,-42Q36,-28 0,-28L-28,-30Q-38,-32 -38,-44Z", c);
    b += sh("M30,-60L48,-88Q58,-96 66,-84L70,-70Q66,-62 58,-66L46,-58Z", c) + sh("M50,-90l-2,-16l8,12z", c) + sh("M58,-92l4,-15l4,14z", c);
    b += ln("M-38,-50q-10,4 -10,16", INK, 2.4);
    if (o.saddle !== false) b += sh("M-12,-68h28l-2,16h-24z", "#b5483a");
    return g(x, y, s, o.flip, b);
  },
  sheep(x, y, s = 1, o = {}) {
    let b = ln("M-14,-12L-14,0M10,-12L10,0", INK, 4);
    b += sh("M-22,-18q-8,-14 6,-20q4,-12 18,-6q14,-6 18,8q10,8 0,18q-6,6 -18,4q-8,6 -18,0q-10,2 -6,-4z", o.wool || "#f7f4ec");
    b += sh("M18,-30q12,-4 16,6q0,10 -10,10q-8,-2 -6,-16z", o.ram ? "#6b5a4a" : "#5d5752");
    if (o.ram) b += ln("M20,-30q-4,-14 8,-14q10,2 6,12q-4,6 -8,2", "#c9a46a", 4);
    return g(x, y, s, o.flip, b);
  },
  bush(x, y, s = 1) { return g(x, y, s, false, sh("M-40,0q-10,-24 10,-30q4,-20 26,-14q18,-14 30,4q20,0 16,22q4,10 -6,18z", "#6f9d5a") + ln("M-20,-14q6,-8 12,0M8,-22q6,-6 12,2", "#4b7340", 2)); },
  tree(x, y, s = 1) { return g(x, y, s, false, sh("M-6,0L-4,-60L4,-60L6,0Z", "#7a5230") + sh("M-34,-58q-10,-30 16,-34q8,-24 34,-12q26,-2 20,24q8,22 -18,24q-14,10 -30,2q-24,4 -22,-4z", "#5f8f4e")); },
  tent(x, y, s = 1) { return g(x, y, s, false, sh("M-60,0L-34,-62L34,-62L60,0Z", "#cfa66a") + sh("M-12,0L0,-40L12,0Z", "#5a4030") + ln("M-34,-62L-46,0M34,-62L46,0", "#9b7240", 2)); },
  well(x, y, s = 1) { return g(x, y, s, false, sh("M-34,-10q0,-14 34,-14q34,0 34,14v14q0,12 -34,12q-34,0 -34,-12z", "#b9ada0") + `<ellipse cx="0" cy="-10" rx="26" ry="8" fill="#5fa8d8" stroke="${INK}" stroke-width="2"/>` + ln("M-30,0h-2M-14,6v6M10,6v6M28,0h2", INK, 1.6)); },
  altar(x, y, s = 1, o = {}) {
    let b = "";
    for (const [r, n] of [[0, 4], [1, 4], [2, 3]]) for (let i = 0; i < n; i++) b += sh(`M${-52 + i * 26 + r * 8},${-r * 18 - 18}h24v17h-24z`, ["#b9ada0", "#a99c8f", "#c7bcb0"][(i + r) % 3]);
    if (o.wood !== false) b += sh("M-44,-62h90v8h-90z", "#a8743f") + sh("M-40,-70h82v8h-82z", "#946336");
    return g(x, y, s, false, b);
  },
  fire(x, y, s = 1) { return g(x, y, s, false, sh("M-18,0q-10,-24 6,-40q0,14 8,16q-4,-22 10,-36q2,20 12,26q8,14 0,34z", "#f39a2b") + sh("M-6,0q-4,-12 4,-20q2,10 8,12q2,-6 6,-10q4,10 0,18z", "#ffd54d")); },
  smoke(x, y, s = 1) { return g(x, y, s, false, `<path d="M0,0q-16,-20 0,-40q16,-20 0,-44q-12,-18 4,-36" fill="none" stroke="#9aa3ad" stroke-width="8" stroke-linecap="round" opacity=".55"/>`); },
  palace(x, y, s = 1) { return g(x, y, s, false, sh("M-80,0V-90H80V0Z", "#e9dcc2") + sh("M-90,-90L0,-122L90,-90Z", "#c9a46a") + [-60, -30, 0, 30, 60].map((c) => sh(`M${c - 6},0V-84H${c + 6}V0Z`, "#f7f0e2")).join("")); },
  mountain(x, y, s = 1, o = {}) { return g(x, y, s, false, sh("M-130,0L-30,-130L10,-96L50,-150L150,0Z", o.c || "#a9a07f", 'opacity=".95"') + ln("M50,-150l-14,24l14,-6l12,8z", "#f5efe0", 2)); },
  hills(x, y, s = 1, o = {}) { return g(x, y, s, false, `<path d="M-220,0Q-150,-60 -60,-26Q20,-70 110,-28Q170,-50 220,-20V40H-220Z" fill="${o.c || "#e6cf98"}"/>`); },
  coins(x, y, s = 1) { return g(x, y, s, false, [[-10, 0], [6, 0], [-2, -8], [14, -6], [-16, -6]].map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx="9" ry="4.4" fill="#f0c94a" stroke="${INK}" stroke-width="1.6"/>`).join("")); },
  // ── 2026-11-02 창세기 전체용으로 더한 조각 ──
  camel(x, y, s = 1, o = {}) {
    const c = "#c99a5e";
    let b = ln("M-26,-40L-28,0M-12,-38L-12,0M18,-38L20,0M30,-40L34,0", INK, 5) + ln("M-26,-40L-28,0M-12,-38L-12,0M18,-38L20,0M30,-40L34,0", c, 2.6);
    b += sh("M-40,-50Q-42,-70 -24,-72Q-14,-98 0,-74Q12,-96 24,-72Q42,-70 40,-48Q36,-34 0,-34L-30,-36Q-40,-38 -40,-50Z", c);
    b += sh("M34,-62Q50,-70 52,-96Q56,-108 70,-104L76,-96Q70,-90 62,-94Q60,-66 42,-46Z", c) + ln("M-40,-54q-8,6 -6,16", INK, 2.4);
    if (o.load) b += sh("M-20,-86h40v14h-40z", o.load === true ? "#b5483a" : o.load);
    return g(x, y, s, o.flip, b);
  },
  ox(x, y, s = 1, o = {}) {
    const c = o.c || "#8a5a3a";
    let b = ln("M-24,-26L-24,0M-10,-26L-10,0M16,-26L16,0M28,-26L28,0", INK, 6) + ln("M-24,-26L-24,0M-10,-26L-10,0M16,-26L16,0M28,-26L28,0", c, 3.4);
    b += sh("M-36,-36Q-38,-58 -10,-58L26,-58Q42,-56 40,-36Q38,-24 0,-24L-28,-24Q-36,-26 -36,-36Z", c);
    b += sh("M34,-54Q52,-58 56,-44Q56,-30 42,-30Z", c) + ln("M40,-56q-4,-10 4,-12M50,-56q6,-8 0,-14", "#efe3c8", 3);
    return g(x, y, s, o.flip, b);
  },
  goat(x, y, s = 1, o = {}) { return P.sheep(x, y, s, { ...o, wool: o.wool || "#8c7a68" }); },
  dove(x, y, s = 1, o = {}) { return g(x, y, s, o.flip, sh("M-14,0q8,-14 24,-8q8,-8 14,-2q-6,2 -8,6q-10,12 -30,4z", "#fbfbf7") + sh("M-4,-6q6,-18 20,-14q-6,10 -12,14z", "#eef0f2") + (o.leaf ? sh("M22,-6q8,-4 10,2q-6,4 -10,-2z", "#6f9d5a") : "")); },
  birds(x, y, s = 1) { return g(x, y, s, false, [[0, 0], [24, -10], [44, 4]].map(([a, b]) => ln(`M${a - 8},${b}q4,-6 8,0q4,-6 8,0`, INK, 2)).join("")); },
  fish(x, y, s = 1, o = {}) { return g(x, y, s, o.flip, sh("M-16,0q14,-12 28,0q-14,12 -28,0z", "#7fb3d5") + sh("M12,0l10,-8v16z", "#7fb3d5")); },
  serpent(x, y, s = 1, o = {}) { return g(x, y, s, o.flip, ln("M-30,0q10,-14 20,0t20,0t20,-8q6,-10 0,-22", INK, 9) + ln("M-30,0q10,-14 20,0t20,0t20,-8q6,-10 0,-22", "#6f9d5a", 5.5) + sh("M24,-28q8,-8 14,0q-4,6 -14,0z", "#6f9d5a")); },
  fruittree(x, y, s = 1, o = {}) { return P.tree(x, y, s) + g(x, y, s, false, [[-20, -76], [4, -92], [22, -70], [-6, -66], [14, -84]].map(([a, b]) => `<circle cx="${a}" cy="${b}" r="5" fill="${o.fruit || "#e0533d"}" stroke="${INK}" stroke-width="1.4"/>`).join("")); },
  palm(x, y, s = 1) { return g(x, y, s, false, sh("M-4,0Q-2,-50 4,-96L10,-96Q6,-50 6,0Z", "#9b7240") + ["M6,-96q-30,-6 -44,12", "M6,-96q30,-8 42,10", "M6,-96q-18,-20 -38,-18", "M6,-96q20,-20 36,-16"].map((d) => ln(d, "#5f8f4e", 7)).join("")); },
  grain(x, y, s = 1, o = {}) { return g(x, y, s, false, [-14, 0, 14].map((a) => ln(`M${a},0L${a / 2},-46`, "#b89a45", 2.4) + sh(`M${a / 2 - 4},-46q4,-18 8,0q-4,6 -8,0z`, o.c || "#e3c35a")).join("") + (o.bound ? ln("M-8,-18h16", "#7a5230", 3) : "")); },
  sack(x, y, s = 1, o = {}) { return g(x, y, s, false, sh("M-16,0q-6,-24 6,-34l-4,-6h28l-4,6q12,10 6,34z", "#d9c49a") + ln("M-8,-34h16", "#7a5230", 2.4) + (o.cup ? sh("M-6,-46h12l-2,8h-8z", "#cfd6dc") : "")); },
  cup(x, y, s = 1) { return g(x, y, s, false, sh("M-10,-26h20l-4,16h-12z", "#d8dde2") + sh("M-3,-10h6v8h-6zM-9,-2h18v2h-18z", "#c8cfd6")); },
  coat(x, y, s = 1, o = {}) { return g(x, y, s, false, sh("M-20,-60h40l10,60h-60z", "#d9a35e") + ["#c0392b", "#2f7fa8", "#e8b83a", "#6f9d5a"].map((c, i) => `<rect x="-24" y="${-50 + i * 12}" width="48" height="6" fill="${c}" opacity=".85"/>`).join("") + (o.blood ? sh("M-6,-30q6,-8 10,0q-2,8 -10,0z", "#9b1c1c") : "")); },
  pit(x, y, s = 1) { return g(x, y, s, false, `<ellipse cx="0" cy="0" rx="44" ry="13" fill="#2f2620" stroke="${INK}" stroke-width="${SW}"/>` + ln("M-44,0q0,-8 10,-10M44,0q0,-8 -10,-10", "#8f8273", 4)); },
  prison(x, y, s = 1) { return g(x, y, s, false, sh("M-70,0V-110H70V0Z", "#8f8a86") + [-40, -20, 0, 20, 40].map((a) => ln(`M${a},-96V-30`, "#3a3632", 4)).join("") + sh("M-48,-100h96v6h-96zM-48,-34h96v6h-96z", "#5e5852")); },
  throne(x, y, s = 1) { return g(x, y, s, false, sh("M-26,0V-40H26V0Z", "#c9a46a") + sh("M-22,-40V-96Q0,-106 22,-96V-40Z", "#b5483a") + sh("M-30,-44h60v8h-60z", "#e8b83a")); },
  pyramid(x, y, s = 1) { return g(x, y, s, false, sh("M-90,0L0,-110L90,0Z", "#e3c27e") + ln("M0,-110L20,0", "#c9a35a", 2)); },
  river(x, y, s = 1) { return g(x, y, s, false, `<path d="M-220,0Q-100,-14 0,0T220,0V26H-220Z" fill="#7fb3d5" stroke="${INK}" stroke-width="2"/>` + ln("M-150,10q10,-4 20,0M40,12q10,-4 20,0", "#e8f3fa", 2)); },
  sea(x, y, s = 1) { return g(x, y, s, false, `<path d="M-220,0q20,-10 40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0V60H-220Z" fill="#5e9ccd" stroke="${INK}" stroke-width="2"/>`); },
  ark(x, y, s = 1) { return g(x, y, s, false, sh("M-110,-40H110L90,0H-90Z", "#9b6b3a") + sh("M-70,-80H70V-40H-70Z", "#b98a52") + sh("M-80,-80L0,-104L80,-80Z", "#7a5230") + [-40, 0, 40].map((a) => sh(`M${a - 8},-70h16v14h-16z`, "#5a4030")).join("") + ln("M-100,-26H100M-94,-12H94", "#7a5230", 2)); },
  rainbow(x, y, s = 1) { return g(x, y, s, false, ["#e0533d", "#f39a2b", "#f5d64a", "#6fbf6a", "#4f8fd1", "#7a5ab5"].map((c, i) => `<path d="M${-150 + i * 9},0A${150 - i * 9},${110 - i * 9} 0 0,1 ${150 - i * 9},0" fill="none" stroke="${c}" stroke-width="9" opacity=".85"/>`).join("")); },
  rain(x, y, s = 1) { return g(x, y, s, false, [...Array(18)].map((_, i) => ln(`M${-180 + i * 21},${(i * 37) % 90}l-6,16`, "#9cc3e6", 2.4)).join("")); },
  tower(x, y, s = 1) { return g(x, y, s, false, sh("M-70,0L-60,-40H60L70,0Z", "#d7b98a") + sh("M-50,-40L-42,-80H42L50,-40Z", "#cfae7c") + sh("M-32,-80L-26,-116H26L32,-80Z", "#c7a470") + sh("M-18,-116L-12,-146H12L18,-116Z", "#bf9a64") + ln("M-50,-20h100M-36,-60h72M-22,-98h44", "#9b7a4a", 2)); },
  city(x, y, s = 1, o = {}) { return g(x, y, s, false, [[-80, 40, 50], [-38, 30, 70], [-4, 40, 44], [36, 34, 62], [74, 30, 40]].map(([a, w, h]) => sh(`M${a - w / 2},0V${-h}H${a + w / 2}V0Z`, o.c || "#d9c7a6") + sh(`M${a - 5},${-h + 12}h10v10h-10z`, "#5a4030")).join("")); },
  ladder(x, y, s = 1) { return g(x, y, s, false, ln("M-20,0L10,-220M20,0L50,-220", "#c9a46a", 5) + [...Array(9)].map((_, i) => ln(`M${-20 + i * 3.4},${-i * 24}h40`, "#c9a46a", 3.4)).join("")); },
  stone(x, y, s = 1, o = {}) { return g(x, y, s, false, o.pillar ? sh("M-10,0V-58Q0,-66 10,-58V0Z", "#b9ada0") + (o.oil ? sh("M-8,-60q8,-6 16,0", "#e8b83a") : "") : sh("M-22,0q-4,-18 10,-22q14,-6 28,6q8,8 4,16z", "#b9ada0")); },
  cave(x, y, s = 1) { return g(x, y, s, false, sh("M-100,0Q-90,-90 0,-100Q90,-90 100,0Z", "#a99c8f") + `<path d="M-34,0Q-32,-50 0,-52Q32,-50 34,0Z" fill="#2f2620"/>`); },
  grave(x, y, s = 1) { return g(x, y, s, false, sh("M-40,0q0,-20 40,-20q40,0 40,20z", "#b9ada0") + sh("M-6,-20v-26h12v26z", "#9a8f83")); },
  bed(x, y, s = 1) { return g(x, y, s, false, sh("M-60,0V-26H60V0Z", "#a8743f") + sh("M-60,-26V-50H-48V-26Z", "#946336") + sh("M-50,-34h104v8h-104z", "#e9dcc2")); },
  bowl(x, y, s = 1, o = {}) { return g(x, y, s, false, sh("M-18,-14h36q-2,14 -18,14q-16,0 -18,-14z", "#a8743f") + `<ellipse cx="0" cy="-14" rx="18" ry="4.4" fill="${o.c || "#b5483a"}" stroke="${INK}" stroke-width="1.6"/>` + (o.steam ? ln("M-6,-22q-4,-8 0,-14M6,-22q-4,-8 0,-14", "#9aa3ad", 2) : "")); },
  sun(x, y, s = 1) { return g(x, y, s, false, `<circle r="22" fill="#ffd54d" stroke="${INK}" stroke-width="2"/>` + [...Array(8)].map((_, i) => { const a = (i * Math.PI) / 4; return ln(`M${Math.cos(a) * 30},${Math.sin(a) * 30}L${Math.cos(a) * 40},${Math.sin(a) * 40}`, "#f1b52a", 3); }).join("")); },
  earth(x, y, s = 1) { return g(x, y, s, false, `<circle r="40" fill="#5e9ccd" stroke="${INK}" stroke-width="2.4"/>` + sh("M-20,-24q16,-6 22,6q-6,14 -20,10q-10,-6 -2,-16z", "#6f9d5a") + sh("M8,10q18,-6 22,8q-10,14 -24,4z", "#6f9d5a")); },
  waters(x, y, s = 1) { return g(x, y, s, false, [0, 1, 2].map((r) => ln(`M-180,${r * 14}q20,-8 40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0t40,0`, "#9cc3e6", 3)).join("")); },
  tablet(x, y, s = 1) { return g(x, y, s, false, sh("M-16,0V-34Q-16,-42 -8,-42H8Q16,-42 16,-34V0Z", "#cfc6b8") + ln("M-9,-30h18M-9,-22h18M-9,-14h18", "#8f8273", 1.6)); },
  ring(x, y, s = 1) { return g(x, y, s, false, `<circle r="7" fill="none" stroke="#e8b83a" stroke-width="3.4"/><circle r="7" fill="none" stroke="${INK}" stroke-width="1" opacity=".5"/>`); },
  staff(x, y, s = 1) { return g(x, y, s, false, ln("M0,0L4,-90", "#7a5230", 4) + ln("M4,-90q8,-6 6,-14", "#7a5230", 4)); },
  chariot(x, y, s = 1, o = {}) { return g(x, y, s, o.flip, sh("M-30,-20h50l10,-30h-14l-6,16h-40z", "#e8b83a") + `<circle cx="-6" cy="-14" r="14" fill="none" stroke="${INK}" stroke-width="3"/>` + ln("M-6,-28V0M-20,-14H8", INK, 2)); },
  dream(x, y, s = 1, o = {}) { return g(x, y, s, false, `<ellipse cx="0" cy="0" rx="${o.w || 90}" ry="${o.h || 56}" fill="#f5f0ff" stroke="#8a7ab5" stroke-width="2.4" stroke-dasharray="6 4"/><circle cx="${-(o.w || 90) * 0.4}" cy="${(o.h || 56) + 10}" r="7" fill="#f5f0ff" stroke="#8a7ab5" stroke-width="2"/><circle cx="${-(o.w || 90) * 0.5}" cy="${(o.h || 56) + 24}" r="4" fill="#f5f0ff" stroke="#8a7ab5" stroke-width="2"/>`); },
  // 하나님·천사: 하늘의 빛(사람 모습 없음)
  light(x, y, s = 1) {
    return g(x, y, s, false, `<defs><radialGradient id="lg${x}${y}" cx="50%" cy="0%" r="100%"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#ffe9a3" stop-opacity=".75"/><stop offset="1" stop-color="#ffe9a3" stop-opacity="0"/></radialGradient></defs><path d="M-30,0L-110,260L110,260L30,0Z" fill="url(#lg${x}${y})"/><g transform="translate(0,26)">` + sh("M-46,6q-6,-16 12,-18q8,-14 26,-6q16,-12 30,4q20,-2 18,16q-4,10 -20,8h-52q-14,0 -14,-4z", "#fffdf5") + [-60, -36, 36, 60].map((a) => ln(`M${a},${18}l${a / 3},${14}`, "#f1c44a", 2.4)).join("") + "</g>");
  },
  stars(x, y, s = 1) { return g(x, y, s, false, [[-150, 20], [-110, 50], [-60, 14], [-20, 44], [30, 18], [80, 46], [130, 16], [160, 52], [-170, 70], [110, 80]].map(([a, b], i) => `<path d="M${a},${b - 5}l1.6,3.6l3.9,.4l-2.9,2.6l.9,3.8l-3.5,-2l-3.5,2l.9,-3.8l-2.9,-2.6l3.9,-.4z" fill="#fff4c2" opacity="${i % 3 ? 0.85 : 1}"/>`).join("")); },
  moon(x, y, s = 1) { return g(x, y, s, false, `<path d="M0,-18a18,18 0 1,0 14,30a14,14 0 1,1 -14,-30z" fill="#fff1b8"/>`); },
  zzz(x, y, s = 1) { return g(x, y, s, false, `<text x="0" y="0" font-size="18" font-weight="700" fill="#cfd8ff" font-family="Noto Sans KR">Z</text><text x="14" y="-14" font-size="13" font-weight="700" fill="#cfd8ff" font-family="Noto Sans KR">z</text>`); },
};

const SKY = {
  day: ["#cfe7f6", "#fbf2dc"], dusk: ["#f3c58f", "#fbe7c6"], night: ["#1c2647", "#3d4d78"], desert: ["#f6dfae", "#fbf1d8"],
};
// 말풍선: 낱말 단위로 줄을 나눈다
function wrap(t, w, fs) {
  const words = String(t).split(" "), lines = [];
  let cur = "";
  for (const wd of words) { const nx = cur ? cur + " " + wd : wd; if (textW(nx, fs) > w && cur) { lines.push(cur); cur = wd; } else cur = nx; }
  if (cur) lines.push(cur);
  return lines;
}
function bubble(b) {
  const FS = 15, w = b.w || 170, lines = wrap(b.t, w - 22, FS), h = lines.length * FS * 1.4 + 16;
  const x = b.x, y = b.y, [tx, ty] = b.to || [x + w / 2, y + h + 20];
  const cx = Math.min(Math.max(tx, x + 24), x + w - 24), base = ty > y ? y + h : y;
  const stroke = b.god ? "#c9973b" : INK, fill = b.god ? "#fffaf0" : "#ffffff";
  const tb = b.god ? 13 : 9;
  let o = `<path d="M${cx - tb},${base}L${tx},${ty}L${cx + tb},${base}Z" fill="${fill}" stroke="${stroke}" stroke-width="2.2" stroke-linejoin="round"/>`;
  o += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(18, h / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="2.2"/>`;
  o += `<path d="M${cx - 8},${base}L${cx + 8},${base}" stroke="${fill}" stroke-width="3.4"/>`;
  lines.forEach((l, i) => { o += `<text x="${x + w / 2}" y="${y + 8 + FS * 1.05 + i * FS * 1.4}" font-size="${FS}" font-weight="700" text-anchor="middle" fill="${b.god ? "#7a5418" : INK}" font-family="Noto Sans KR, sans-serif">${esc(l)}</text>`; });
  return o;
}

export function panelSvg(p, i) {
  const [s0, s1] = SKY[p.sky || "day"];
  let o = `<svg class="cpanel" viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="sky${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s0}"/><stop offset="1" stop-color="${s1}"/></linearGradient><clipPath id="cp${i}"><rect x="2" y="2" width="396" height="296" rx="10"/></clipPath></defs><g clip-path="url(#cp${i})"><rect width="400" height="300" fill="url(#sky${i})"/>`;
  o += `<path d="M0,250Q100,236 200,248Q300,258 400,244V300H0Z" fill="${p.ground || (p.sky === "night" ? "#4a4f63" : "#e2c88e")}"/>`;
  for (const [k, x, y, s, opt] of p.items || []) { if (!P[k]) throw new Error("만화 그림 조각 없음: " + k); o += P[k](x, y, s, opt || {}); }
  for (const b of p.say || []) o += bubble(b);
  o += `</g><rect x="2" y="2" width="396" height="296" rx="10" fill="none" stroke="${INK}" stroke-width="4"/></svg>`;
  return o;
}

// 지도 다음에 들어가는 칸 만화 쪽
export function comicHtml(book, n, { title, bookKo }, mk = () => "") {
  const c = loadComic(book, n);
  let o = `<div class="comic" id="comic">${mk("comic")}<div class="lab">만화로 보는 이야기 — ${esc(bookKo)} ${esc(title)}</div><div class="cgrid">`;
  c.panels.forEach((p, i) => { o += `<figure class="cell">${panelSvg(p, `${n}-${i}`)}<figcaption><b>${i + 1}</b>${esc(p.cap)} <span class="cref">${esc(bookKo)} ${esc(p.ref)}</span></figcaption></figure>`; });
  return o + `</div></div>`; // 하나님·천사를 빛으로 그린 까닭은 지침 §2-5에 — 안내 줄을 넣으면 한 쪽을 넘는다
}
export const COMIC_CSS = `<style>
.comic{break-before:page;break-inside:avoid;}
.comic .lab{margin-top:0;}
.comic .cgrid{display:grid;grid-template-columns:1fr 1fr;gap:2.2mm 3mm;}
.comic .cell{margin:0;break-inside:avoid;}
.comic svg.cpanel{display:block;width:100%;height:auto;}
.comic figcaption{font:500 7.3pt/1.5 "Noto Sans KR",sans-serif;color:#2b2b2b;margin-top:1.2mm;}
.comic figcaption b{display:inline-block;min-width:4.2mm;height:4.2mm;line-height:4.2mm;text-align:center;border-radius:50%;background:#18233f;color:#fff;font-size:6.8pt;margin-right:1.2mm;}
.comic .cref{color:#8a6420;font-size:7pt;white-space:nowrap;}
.comic .cnote{font:6.8pt/1.5 "Noto Sans KR",sans-serif;color:#7a7a7a;margin-top:1.6mm;}
</style>`;

// 원고 검사(빌드 전에 build.mjs가 부름): 칸 근거가 단원 안, 말풍선은 근거 절에 말이 있을 때만·옛 말투 금지, 6–8칸
export function checkComic(book, n) {
  useBook(book);
  const E = [];
  let c; try { c = loadComic(book, n); } catch (e) { return ["만화 원고 JSON 오류 " + e.message]; }
  const u = loadUnit(n), text = {};
  for (const p of u.parts) for (const v of chapterVerses(book, p.ch)) { const [ch, x] = v.ref.split(":").map(Number); if (x >= p.from && x <= p.to) text[`${ch}:${x}`] = v.ko; }
  if (!Array.isArray(c.panels) || c.panels.length < 4 || c.panels.length > 8) E.push(`칸 수 ${c.panels?.length}(4–8)`);
  (c.panels || []).forEach((p, i) => {
    const at = `${i + 1}번째 칸`;
    const m = String(p.ref).match(/^(\d+):(\d+)(?:-(\d+))?$/);
    if (!m) { E.push(`${at} 근거 형식 ${p.ref}`); return; }
    let src = "";
    for (let v = +m[2]; v <= +(m[3] || m[2]); v++) { const k = `${m[1]}:${v}`; if (!text[k]) E.push(`${at} 근거 ${k}가 단원 밖`); else src += " " + text[k]; }
    if (!p.cap) E.push(`${at} 설명 없음`);
    for (const b of p.say || []) {
      if (!/[“”‘’]|말하|말씀|이르|대답|외치|물어|물었|부르|명령|맹세/.test(src)) E.push(`${at} 말풍선이 있는데 근거 절에 인물의 말이 없음`);
      if (/(하리라|하노라|느니라|이니라|하였더라|도다|할지니라|소서|나이다)(?=[\s.,!?]|$)/.test(b.t)) E.push(`${at} 말풍선 옛 말투: ${b.t}`);
    }
    try { panelSvg(p, `chk${i}`); } catch (e) { E.push(`${at} ${e.message}`); }
  });
  return E;
}
