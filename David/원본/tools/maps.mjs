// 이야기의 무대 지도(벡터 SVG). 위치는 위도·경도 근삿값이며 고대 지명의 위치는 학계의 일반적 비정을 따른다.
const C = { land: "#f3ead6", sea: "#cfe0ee", water: "#6b9ac4", ink: "#18233f", dot: "#2b3a67", gold: "#c9973b", red: "#c0392b", grey: "#8a7a52" };
const FONT = `font-family="Noto Sans KR, sans-serif"`;

function proj(b, ky) {
  const kx = ky * Math.cos((32 * Math.PI) / 180);
  const W = (b.lon1 - b.lon0) * kx, H = (b.lat1 - b.lat0) * ky;
  return { W, H, p: (lat, lon) => [((lon - b.lon0) * kx).toFixed(1), ((b.lat1 - lat) * ky).toFixed(1)], kx };
}
const poly = (P, pts) => pts.map(([a, o]) => P.p(a, o).join(",")).join(" ");

const COAST = [[30.9, 34.0], [30.9, 34.17], [31.29, 34.24], [31.52, 34.43], [31.67, 34.55], [31.8, 34.63], [32.05, 34.75], [32.33, 34.85], [32.5, 34.89], [32.69, 34.94], [32.83, 34.96], [32.92, 35.07], [33.05, 35.1], [33.05, 34.0]];
const DEAD = [[31.78, 35.52], [31.7, 35.58], [31.45, 35.59], [31.25, 35.55], [31.1, 35.5], [31.02, 35.46], [31.05, 35.4], [31.25, 35.42], [31.45, 35.47], [31.65, 35.47], [31.76, 35.49]];
const JORDAN = [[32.71, 35.57], [32.6, 35.565], [32.48, 35.56], [32.35, 35.55], [32.22, 35.545], [32.1, 35.53], [31.95, 35.54], [31.85, 35.545], [31.78, 35.535]];

function place(P, lat, lon, label, { dx = 6, dy = 3, anchor = "start", star = false, size = 9, bold = false, color = C.ink } = {}) {
  const [x, y] = P.p(lat, lon).map(Number);
  const mark = star
    ? `<path d="M${x},${y - 6} L${x + 1.8},${y - 1.8} L${x + 6},${y - 1.6} L${x + 2.8},${y + 1.2} L${x + 3.8},${y + 5.6} L${x},${y + 3.2} L${x - 3.8},${y + 5.6} L${x - 2.8},${y + 1.2} L${x - 6},${y - 1.6} L${x - 1.8},${y - 1.8} Z" fill="${C.gold}" stroke="${C.ink}" stroke-width=".6"/>`
    : `<circle cx="${x}" cy="${y}" r="2.4" fill="${C.dot}"/>`;
  const lines = label.split("\n");
  const txt = lines.map((t, i) => `<tspan x="${x + dx}" dy="${i ? size * 1.2 : 0}"${i ? ` font-size="${size * 0.82}" fill="${C.grey}" font-weight="400"` : ""}>${t}</tspan>`).join("");
  return `${mark}<text x="${x + dx}" y="${y + dy}" ${FONT} font-size="${size}" font-weight="${bold ? 700 : 500}" fill="${color}" text-anchor="${anchor}">${txt}</text>`;
}
const label = (P, lat, lon, t, { size = 8.5, color = C.water, italic = true, anchor = "middle", rotate = 0 } = {}) => {
  const [x, y] = P.p(lat, lon);
  return `<text x="${x}" y="${y}" ${FONT} font-size="${size}" fill="${color}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ""}${rotate ? ` transform="rotate(${rotate} ${x} ${y})"` : ""}>${t}</text>`;
};
function scaleBar(P, km, x, y) {
  const w = (km / 94.5) * P.kx;
  return `<g ${FONT} font-size="7.5" fill="${C.ink}"><rect x="${x}" y="${y}" width="${w.toFixed(1)}" height="2.4" fill="${C.ink}"/><text x="${x}" y="${y - 3}">0</text><text x="${(x + w).toFixed(1)}" y="${y - 3}" text-anchor="end">${km}km</text></g>`;
}
const north = (x, y) => `<g><path d="M${x},${y} l5,13 l-5,-4 l-5,4 z" fill="${C.ink}"/><text x="${x}" y="${y + 23}" ${FONT} font-size="8" text-anchor="middle" fill="${C.ink}">북</text></g>`;
const arrowDefs = `<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.red}"/></marker></defs>`;

function land() {
  const b = { lon0: 34.25, lon1: 35.85, lat0: 31.0, lat1: 32.95 };
  const P = proj(b, 200);
  const z = { lon0: 34.72, lon1: 35.47, lat0: 31.6, lat1: 31.95 };
  const [zx0, zy0] = P.p(z.lat1, z.lon0).map(Number), [zx1, zy1] = P.p(z.lat0, z.lon1).map(Number);
  const [gx, gy] = P.p(32.82, 35.59).map(Number);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.W.toFixed(0)} ${P.H.toFixed(0)}" class="map land" role="img" aria-label="이스라엘 땅 전체 지도">
  <rect width="100%" height="100%" fill="${C.land}"/>
  <polygon points="${poly(P, COAST)}" fill="${C.sea}"/>
  <ellipse cx="${gx}" cy="${gy}" rx="${(0.065 * P.kx).toFixed(1)}" ry="${(0.1 * 200).toFixed(1)}" fill="${C.sea}" stroke="${C.water}" stroke-width=".8"/>
  <polyline points="${poly(P, JORDAN)}" fill="none" stroke="${C.water}" stroke-width="1.6"/>
  <polygon points="${poly(P, DEAD)}" fill="${C.sea}" stroke="${C.water}" stroke-width=".8"/>
  ${label(P, 32.25, 34.47, "지중해", { size: 10 })}
  ${label(P, 32.8, 35.5, "갈릴리 바다", { size: 7.5, anchor: "end" })}
  ${label(P, 32.2, 35.6, "요단강", { size: 7.5, anchor: "start" })}
  ${label(P, 31.42, 35.62, "염해", { size: 8, anchor: "start" })}
  ${label(P, 31.33, 35.62, "(사해)", { size: 7, anchor: "start" })}
  ${label(P, 31.2, 34.62, "블레셋 땅", { size: 9, color: C.red })}
  <rect x="${zx0}" y="${zy0}" width="${(zx1 - zx0).toFixed(1)}" height="${(zy1 - zy0).toFixed(1)}" fill="none" stroke="${C.red}" stroke-width="1" stroke-dasharray="3 2"/>
  <text x="${zx0}" y="${(zy1 + 9).toFixed(1)}" ${FONT} font-size="7" fill="${C.red}">아래 확대 지도 범위</text>
  ${place(P, 31.52, 34.46, "가사", { dx: -5, anchor: "end" })}
  ${place(P, 31.67, 34.57, "아스글론", { dx: -5, anchor: "end" })}
  ${place(P, 31.8, 34.65, "아스돗", { dx: -5, anchor: "end" })}
  ${place(P, 31.78, 34.85, "에그론", { dx: 0, dy: -6, anchor: "middle" })}
  ${place(P, 31.7, 34.85, "가드", { dx: -5, dy: 8, anchor: "end" })}
  ${place(P, 31.69, 34.96, "엘라 골짜기", { dx: 2, dy: 12, size: 8.5 })}
  ${place(P, 31.82, 35.23, "기브아", { star: true, bold: true, dx: 8, dy: 0 })}
  ${place(P, 31.7, 35.2, "베들레헴", { dx: 6, dy: 9 })}
  ${place(P, 31.53, 35.1, "헤브론", { dx: 6, dy: 3 })}
  ${place(P, 32.48, 35.4, "길보아 산\n사울이 죽은 곳", { dx: -6, anchor: "end" })}
  ${place(P, 32.37, 35.56, "아벨므홀라", { dx: -6, dy: 12, anchor: "end", size: 8 })}
  ${north(16, 8)}${scaleBar(P, 20, 10, P.H - 10)}
</svg>`;
  return { svg, caption: "이스라엘 땅 — ★ 기브아(사울의 궁정, 18장의 무대). 지중해 해안의 다섯 성읍은 블레셋 땅. 아벨므홀라는 메랍의 남편 아드리엘의 고향 므홀랏으로 보는 곳(18:19)." };
}

function gibeah() {
  const b = { lon0: 34.72, lon1: 35.47, lat0: 31.6, lat1: 31.95 };
  const P = proj(b, 600);
  const pt = (a, o) => P.p(a, o).join(",");
  const route = (pts, dash = "") => `<polyline points="${pts.map(([a, o]) => pt(a, o)).join(" ")}" fill="none" stroke="${C.red}" stroke-width="1.6" ${dash ? `stroke-dasharray="${dash}"` : ""} marker-end="url(#ar)"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${P.W.toFixed(0)} ${P.H.toFixed(0)}" class="map" role="img" aria-label="기브아 주변 확대 지도">
  ${arrowDefs}<rect width="100%" height="100%" fill="${C.land}"/>
  ${label(P, 31.9, 34.92, "세펠라(낮은 언덕 지대)", { size: 8.5, color: C.grey })}
  ${label(P, 31.645, 35.3, "유다 산지", { size: 9, color: C.grey })}
  ${route([[31.7, 35.18], [31.71, 35.08], [31.695, 34.985]])}
  ${route([[31.7, 34.95], [31.7, 34.875]], "4 2")}
  ${route([[31.705, 34.95], [31.765, 34.87]], "4 2")}
  ${route([[31.7, 34.99], [31.76, 35.08], [31.815, 35.205]])}
  ${label(P, 31.643, 35.09, "① 베들레헴에서 형들에게(17장)", { size: 7.5, color: C.red, italic: false })}
  ${label(P, 31.752, 34.925, "② 블레셋을 쫓음(17:52)", { size: 7.5, color: C.red, italic: false, anchor: "start" })}
  ${label(P, 31.795, 35.07, "③ 골리앗의 머리를 들고 사울 앞으로", { size: 7.5, color: C.red, italic: false })}
  ${place(P, 31.82, 35.23, "기브아\n사울의 궁정 · 18장의 무대", { star: true, bold: true, dx: 9, dy: 1, size: 10 })}
  ${place(P, 31.78, 35.23, "예루살렘\n아직 여부스 사람의 성", { dx: 7, dy: 6, size: 8.5 })}
  ${place(P, 31.87, 35.28, "믹마스\n요나단의 싸움(14장)", { dx: 7, dy: -2, size: 8.5 })}
  ${place(P, 31.7, 35.2, "베들레헴\n다윗의 고향", { dx: 7, dy: 6, size: 9 })}
  ${place(P, 31.69, 34.96, "엘라 골짜기", { dx: 0, dy: 15, anchor: "middle", size: 9, bold: true })}
  ${place(P, 31.7, 34.85, "가드\n골리앗의 고향", { dx: -6, dy: 2, anchor: "end", size: 9 })}
  ${place(P, 31.78, 34.85, "에그론", { dx: -6, dy: 3, anchor: "end", size: 9 })}
  ${north(P.W - 14, 6)}${scaleBar(P, 10, P.W - 70, P.H - 8)}
</svg>`;
  return { svg, caption: "기브아 주변 확대 — ① 다윗이 베들레헴에서 엘라 골짜기로 가서 골리앗을 쓰러뜨리고 ② 이스라엘은 블레셋을 가드와 에그론까지 쫓았으며 ③ 다윗은 골리앗의 머리를 들고 기브아의 사울 앞에 섰습니다. 거리는 직선으로 베들레헴–엘라 골짜기 약 23km, 엘라 골짜기–기브아 약 29km." };
}

import { PEOPLE } from "./people.mjs";
export const MAPS = { land, gibeah, ...PEOPLE };
export function mapSvg(key) {
  const f = MAPS[key];
  if (!f) throw new Error("모르는 지도: " + key);
  return f();
}
