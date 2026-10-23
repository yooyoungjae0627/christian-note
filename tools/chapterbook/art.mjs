// 장별 해설서 2판 그림: 지도(지침 §6), 인물 관계도(§5), 표지 선 그림(§2).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const PLACES = JSON.parse(fs.readFileSync(path.join(HERE, "places.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => Math.round(n * 10) / 10;

// ───────────── 글자 상자 배치(지도·관계도 공용) ─────────────
// 모든 글자가 다른 글자·점·선에 가려지지 않게(지침 §5·§6). 자리가 없으면 null.
const textW = (t, s) => [...String(t)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? s * 1.0 : c === " " ? s * 0.32 : s * 0.58), 0);
const hit = (a, b, pad = 2) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
const ANG = [0, Math.PI, -Math.PI / 2, Math.PI / 2, -Math.PI / 4, Math.PI / 4, -3 * Math.PI / 4, 3 * Math.PI / 4, -Math.PI / 8, Math.PI / 8, -7 * Math.PI / 8, 7 * Math.PI / 8];
function place(boxes, W, H, cx, cy, w, h, rings, ang) {
  for (const r of rings) for (const a of ang) {
    const c = Math.cos(a), s = Math.sin(a);
    const x = cx + c * r + (c > 0.3 ? 0 : c < -0.3 ? -w : -w / 2);
    const y = cy + s * r + (s > 0.3 ? 0 : s < -0.3 ? -h : -h / 2);
    const b = { x, y, w, h };
    if (x < 3 || y < 3 || x + w > W - 3 || y + h > H - 3) continue;
    if (!boxes.some((o) => hit(b, o))) return { ...b, r };
  }
  return null;
}

// ───────────── 지도 ─────────────
// map = {places:[{key, name?}], routes:[{path:[key…], ref}], minSpan?, focus?}
const MAP_W = 640, MAP_H = 470;
// 지도 투영(경도·위도 → 그림 좌표). mapSvg와 확대 지도 나누기(mapViews)가 같은 계산을 쓴다.
function project(map) {
  const W = MAP_W, H = MAP_H;
  const local = Object.fromEntries(map.places.filter((p) => p.at).map((p) => [p.key, { name: p.name, at: p.at, area: p.area }]));
  const look = (k) => PLACES.places[k] || local[k];
  const pts = map.places.map((p) => { const db = look(p.key); if (!db) throw new Error("places.json에 없는 지명: " + p.key); return { ...db, ...p, name: p.name || db.name }; });
  let [x0, y0, x1, y1] = map.focus || [Math.min(...pts.map((p) => p.at[0])), Math.min(...pts.map((p) => p.at[1])), Math.max(...pts.map((p) => p.at[0])), Math.max(...pts.map((p) => p.at[1]))];
  const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  let w = (x1 - x0) * kx, h = y1 - y0;
  const minSpan = map.minSpan || 0.9;
  w = Math.max(w, minSpan); h = Math.max(h, minSpan * 0.7);
  w *= 1.55; h *= 1.55;
  if (w / h > W / H) h = w * H / W; else w = h * W / H;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = cx - w / kx / 2; x1 = cx + w / kx / 2; y0 = cy - h / 2; y1 = cy + h / 2;
  return { W, H, look, pts, x0, y0, x1, y1, kx, X: (lon) => (lon - x0) / (x1 - x0) * W, Y: (lat) => (y1 - lat) / (y1 - y0) * H };
}
// 한 지도 안에서 점이 몰린 곳(이름을 붙이면 어느 점의 이름인지 헷갈리는 곳)을 찾아 확대 지도로 따로 뺀다.
// view = {title?, keys, minSpan?, focus?} → [{…view, hide:[keys], frames:[{keys, tag}]}, {확대 view} …]
export function mapViews(map) {
  const base = map.views || [{ keys: map.places.map((x) => x.key), minSpan: map.minSpan }];
  const out = [];
  const NUM = "①②③④⑤⑥⑦⑧⑨";
  // 원고가 붙인 번호(①…)보다 뒤 번호부터
  let n = Math.max(base.length, ...base.map((v) => NUM.indexOf((v.title || "")[0]) + 1));
  // 원고에 이미 그 지명들을 좁게 그린 지도가 있으면 확대 지도를 또 만들지 않는다
  const narrow = base.filter((v) => { const pr = project({ places: map.places.filter((x) => v.keys.includes(x.key)), minSpan: v.minSpan, focus: v.focus }); return pr.x1 - pr.x0 <= 2.2; });
  for (const v of base) {
    const places = map.places.filter((x) => v.keys.includes(x.key));
    const pr = project({ places, minSpan: v.minSpan, focus: v.focus });
    const dots = pr.pts.filter((p) => !p.area).map((p) => ({ key: p.key, x: pr.X(p.at[0]), y: pr.Y(p.at[1]) }));
    // 46px 안에 있는 점끼리 묶음
    const parent = Object.fromEntries(dots.map((d) => [d.key, d.key])); const find = (k) => (parent[k] === k ? k : (parent[k] = find(parent[k])));
    for (const a of dots) for (const b of dots) if (a.key < b.key && Math.hypot(a.x - b.x, a.y - b.y) < 32) parent[find(a.key)] = find(b.key);
    const groups = Object.values(dots.reduce((m, d) => ((m[find(d.key)] ||= []).push(d.key), m), {})).filter((g) => g.length >= 2 && g.length < places.length)
      // 이미 좁은 지역을 그린 지도이거나, 확대해도 점이 떨어지지 않는(거의 같은 자리) 묶음은 확대하지 않고 지시선으로 이름을 붙인다
      .filter((g) => !narrow.some((w) => w !== v && g.every((k) => w.keys.includes(k))))
      .filter((g) => pr.x1 - pr.x0 > 2.2 && (() => { const at = g.map((k) => pr.pts.find((p) => p.key === k).at); return Math.max(...at.map((p) => p[0])) - Math.min(...at.map((p) => p[0])) + Math.max(...at.map((p) => p[1])) - Math.min(...at.map((p) => p[1])) > 0.06; })());
    const hide = [], frames = [], zooms = [];
    for (const g of groups) {
      n++; const tag = "확대 " + NUM[n - 1];
      hide.push(...g); frames.push({ keys: g, tag });
      const names = places.filter((p) => g.includes(p.key)).map((p) => p.name || PLACES.places[p.key]?.name || p.key);
      zooms.push({ title: `${NUM[n - 1]} 확대 — ${names.join("·")}`, keys: g, minSpan: 0.9, zoomOf: true });
    }
    out.push({ ...v, title: v.title || (zooms.length ? "① 전체" : undefined), hide, frames }, ...zooms);
  }
  return out;
}
export const mapIssues = [];
export function mapSvg(map) {
  const W = MAP_W, H = MAP_H;
  const { look, pts, x0, y0, x1, y1, kx, X, Y } = project(map);
  const P = (a) => `${f1(X(a[0]))},${f1(Y(a[1]))}`;
  const inside = (a, m = 0) => a[0] > x0 + m && a[0] < x1 - m && a[1] > y0 + m && a[1] < y1 - m;
  const base = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="mapsvg">`,
    `<defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto"><path d="M0,0L10,5L0,10z" fill="#c0392b"/></marker></defs>`,
    `<rect width="${W}" height="${H}" fill="#f3ead2"/>`];
  for (const s of PLACES.seas) base.push(`<polygon points="${s.poly.map(P).join(" ")}" fill="${s.island ? "#f3ead2" : s.lake ? "#a9cde3" : "#c9dfec"}" stroke="#7fa7c2" stroke-width="1.1"/>`);
  for (const r of PLACES.rivers) base.push(`<polyline points="${r.line.map(P).join(" ")}" fill="none" stroke="#6f9bc0" stroke-width="1.8" stroke-linejoin="round"/>`);
  // 장애물: 방위표·축척·점·경로
  const boxes = [{ x: W - 60, y: 8, w: 52, h: 56 }, { x: 8, y: H - 34, w: 170, h: 28 }];
  const routeSvg = [];
  for (const r of map.routes || []) {
    const line = r.path.map((k) => look(k).at);
    for (let i = 0; i + 1 < line.length; i++) {
      const [a, b] = [line[i], line[i + 1]];
      const ax0 = X(a[0]), ay0 = Y(a[1]), bx0 = X(b[0]), by0 = Y(b[1]);
      const dx = bx0 - ax0, dy = by0 - ay0, len = Math.hypot(dx, dy) || 1;
      const bend = Math.min(40, len * 0.18), qx = (ax0 + bx0) / 2 - dy / len * bend, qy = (ay0 + by0) / 2 + dx / len * bend;
      const sh = Math.min(10, len * 0.2);
      const ax = ax0 + dx / len * sh, ay = ay0 + dy / len * sh, bx = bx0 - dx / len * sh, by = by0 - dy / len * sh;
      routeSvg.push(`<path d="M${f1(ax)},${f1(ay)} Q${f1(qx)},${f1(qy)} ${f1(bx)},${f1(by)}" fill="none" stroke="#c0392b" stroke-width="2.4" stroke-dasharray="6 4" marker-end="url(#arr)"/>`);
      for (let t = 0.08; t < 0.95; t += 0.05) { const u = 1 - t; const px = u * u * ax + 2 * u * t * qx + t * t * bx, py = u * u * ay + 2 * u * t * qy + t * t * by; boxes.push({ x: px - 3, y: py - 3, w: 6, h: 6 }); }
    }
  }
  const dots = [], labels = [];
  for (const p of pts) if (!p.area) { const x = X(p.at[0]), y = Y(p.at[1]); boxes.push({ x: x - 7, y: y - 7, w: 14, h: 14 }); dots.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="5.6" fill="#c0392b" stroke="#fff" stroke-width="1.8"/>`); }
  const S = { main: 19, area: 18, sea: 16, region: 15, river: 14, ctx: 14, frame: 15 };
  const put = (x, y, t, cls, rings, required) => {
    const s = S[cls], w = textW(t, s) + 12, h = s + 9;
    let b = place(boxes, W, H, x, y, w, h, rings, ANG);
    if (!b && required) b = place(boxes, W, H, x, y, w, h, [40, 60, 85, 115, 150, 190, 240], ANG.concat(ANG.map((a) => a + Math.PI / 16)));
    if (!b) return false;
    boxes.push(b);
    labels.push({ ...b, t, cls, s, ax: x, ay: y });
    return true;
  };
  // 이 장의 지명 → 반드시(자리가 좁으면 지시선)
  // 확대 지도로 뺀 묶음: 점선 테두리와 "확대 ②" 꼬리표(이름은 확대 지도에)
  const frameSvg = [];
  for (const f of map.frames || []) {
    const ps = pts.filter((p) => f.keys.includes(p.key)).map((p) => [X(p.at[0]), Y(p.at[1])]);
    const fx = Math.min(...ps.map((p) => p[0])) - 14, fy = Math.min(...ps.map((p) => p[1])) - 14, fw = Math.max(...ps.map((p) => p[0])) + 14 - fx, fh = Math.max(...ps.map((p) => p[1])) + 14 - fy;
    frameSvg.push(`<rect x="${f1(fx)}" y="${f1(fy)}" width="${f1(fw)}" height="${f1(fh)}" rx="8" fill="none" stroke="#7a1f16" stroke-width="1.6" stroke-dasharray="5 3"/>`);
    boxes.push({ x: fx - 2, y: fy - 2, w: fw + 4, h: 3 }, { x: fx - 2, y: fy + fh - 1, w: fw + 4, h: 3 }, { x: fx - 2, y: fy, w: 3, h: fh }, { x: fx + fw - 1, y: fy, w: 3, h: fh });
    if (!put(fx + fw / 2, fy + fh / 2, f.tag, "frame", [fh / 2 + 4, fh / 2 + 18, fh / 2 + 34, fh / 2 + 52], true)) throw new Error("확대 꼬리표 자리를 찾지 못함");
  }
  for (const p of pts) { if ((map.hide || []).includes(p.key)) continue; const x = X(p.at[0]), y = Y(p.at[1]); if (!put(x, y, p.name, p.area ? "area" : "main", p.area ? [0, 14, 28] : [10, 22, 34], true)) throw new Error("지도 이름 자리를 찾지 못함: " + p.name); }
  // 바다·강·이웃 땅·주변 성읍 → 온전히 놓을 수 있을 때만
  for (const s of PLACES.seas) if (s.name && s.label && inside(s.label)) put(X(s.label[0]), Y(s.label[1]), s.name, "sea", [0, 16, 32], false);
  for (const r of PLACES.rivers) if (r.name && r.label && inside(r.label)) put(X(r.label[0]), Y(r.label[1]), r.name, "river", [0, 12, 24], false);
  const used = new Set(pts.map((p) => p.key));
  const ctxDots = [];
  for (const [key, p] of Object.entries(PLACES.places)) {
    if (!p.context || used.has(key) || !inside(p.at, (x1 - x0) * 0.03)) continue;
    const x = X(p.at[0]), y = Y(p.at[1]);
    if (p.area) { put(x, y, p.name, "region", [0, 14, 26], false); continue; }
    const dot = { x: x - 4, y: y - 4, w: 8, h: 8 };
    if (boxes.some((o) => hit(dot, o, 1))) continue;
    boxes.push(dot);
    if (put(x, y, p.name, "ctx", [8, 18], false)) ctxDots.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="3" fill="#8f887a"/>`); else boxes.pop();
  }
  const style = { frame: `font-weight="700" fill="#7a1f16"`, main: `font-weight="700" fill="#7a1f16"`, area: `font-weight="700" fill="#5b4a2a"`, region: `fill="#8f846c"`, sea: `fill="#3f6f90" font-style="italic"`, river: `fill="#3f6f90" font-style="italic"`, ctx: `fill="#6f685b"` };
  const out = [...base, ...routeSvg, ...frameSvg, ...ctxDots, ...dots];
  for (const l of labels) {
    if (l.r > 12 && (l.cls === "main" || l.cls === "area")) { const tx = Math.min(Math.max(l.ax, l.x), l.x + l.w), ty = Math.min(Math.max(l.ay, l.y), l.y + l.h); out.push(`<line x1="${f1(l.ax)}" y1="${f1(l.ay)}" x2="${f1(tx)}" y2="${f1(ty)}" stroke="#7a1f16" stroke-width="1"/>`); }
    if (l.cls === "main" || l.cls === "frame") out.push(`<rect x="${f1(l.x)}" y="${f1(l.y)}" width="${f1(l.w)}" height="${f1(l.h)}" rx="5" fill="#fffaf0" stroke="#c0392b" stroke-width="1.2"/>`);
    else if (l.cls !== "sea" && l.cls !== "river") out.push(`<rect x="${f1(l.x)}" y="${f1(l.y)}" width="${f1(l.w)}" height="${f1(l.h)}" rx="4" fill="#f3ead2" fill-opacity=".85"/>`);
    out.push(`<text x="${f1(l.x + l.w / 2)}" y="${f1(l.y + l.h / 2 + l.s * 0.36)}" text-anchor="middle" font-size="${l.s}" font-family="Noto Sans KR" ${style[l.cls]}>${esc(l.t)}</text>`);
  }
  // 이름표가 붙지 않은(지시선 없는) 지명에서, 다른 점이 자기 점보다 이름표에 더 가까우면 헷갈린다 → 기록
  const own = (l) => pts.find((p) => p.name === l.t);
  const dotXY = pts.filter((p) => !p.area).map((p) => [p.name, X(p.at[0]), Y(p.at[1])]);
  const dist = (l, x, y) => Math.hypot(Math.max(l.x - x, 0, x - l.x - l.w), Math.max(l.y - y, 0, y - l.y - l.h));
  mapIssues.length = 0;
  for (const l of labels) if (l.cls === "main" && l.r <= 12) { const o = own(l); if (!o || o.area) continue; const d0 = dist(l, X(o.at[0]), Y(o.at[1])); for (const [nm, x, y] of dotXY) if (nm !== l.t && dist(l, x, y) < d0 - 1) mapIssues.push(`이름표가 다른 점에 더 가까움: ${l.t} ↔ ${nm}`); }
  out.push(`<g transform="translate(${W - 34},36)"><circle r="18" fill="#fffaf0" stroke="#8a7442"/><path d="M0,-14L5,4L0,0L-5,4Z" fill="#8a7442"/><text y="15" text-anchor="middle" font-size="10" font-family="Noto Sans KR" font-weight="700" fill="#8a7442">N</text></g>`);
  const kmPerPx = (x1 - x0) * kx * 111 / W;
  const nice = [5, 10, 20, 50, 100, 200, 300, 500].find((k) => k / kmPerPx > 60) || 500;
  const bw = nice / kmPerPx;
  out.push(`<g transform="translate(16,${H - 16})"><rect x="0" y="-6" width="${f1(bw)}" height="6" fill="#8a7442"/><rect x="0" y="-6" width="${f1(bw / 2)}" height="6" fill="#fffaf0" stroke="#8a7442" stroke-width=".8"/><text x="${f1(bw + 6)}" y="0" font-size="13" font-family="Noto Sans KR" fill="#6b5d3d">${nice}km</text></g>`);
  out.push(`<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#8a7442" stroke-width="1.4"/></svg>`);
  return out.join("");
}

// ───────────── 인물 관계도 ─────────────
// 배치·선·글자 자리는 rel.mjs(직각 계보도, 겹침 검사 relationIssues)
import { REL, relationSvg, relationIssues, hasGenBand } from "./rel.mjs";
export { relationSvg, relationIssues };
// 범례: 이 관계도에 쓰인 종류만, HTML 칩(겹치지 않고 줄바꿈)
export function relLegendHtml(relations, people) {
  const band = people && hasGenBand(people, relations) ? `<span class="chip"><svg viewBox="0 0 26 10" class="lg"><rect x="0" y="0" width="26" height="10" rx="3" fill="#efe3c4"/></svg>옅은 띠 = 같은 세대(두 줄로 나눔)</span>` : "";
  const kinds = [...new Set(relations.map((r) => (REL[r.type] ? r.type : "other")))];
  return `<div class="rel-legend">` + kinds.map((k) => {
    const s = REL[k];
    const line = s.double ? `<svg viewBox="0 0 26 10" class="lg"><line x1="0" y1="3" x2="26" y2="3" stroke="${s.stroke}" stroke-width="1.6"/><line x1="0" y1="7" x2="26" y2="7" stroke="${s.stroke}" stroke-width="1.6"/></svg>` : `<svg viewBox="0 0 26 10" class="lg"><line x1="0" y1="5" x2="26" y2="5" stroke="${s.stroke}" stroke-width="2.2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/></svg>`;
    return `<span class="chip">${line}${s.name}</span>`;
  }).join("") + band + `</div>`;
}

// ───────────── 표지 선 그림 ─────────────
// 십자가·하나님 얼굴·사람 얼굴은 그리지 않는다.
const G = `<g fill="none" stroke="#e8c983" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">`;
const T = `<g fill="none" stroke="#b9c5d7" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`;
const D = `<g fill="#f6e3a5">`;
export const MOTIFS = {
  tent: (x, y, s = 1) => `${G}<path d="M${x - 48 * s} ${y}L${x} ${y - 62 * s}L${x + 48 * s} ${y}Z"/><path d="M${x} ${y - 62 * s}L${x} ${y}M${x - 14 * s} ${y}L${x} ${y - 30 * s}L${x + 14 * s} ${y}"/><path d="M${x - 48 * s} ${y}L${x - 62 * s} ${y + 6 * s}M${x + 48 * s} ${y}L${x + 62 * s} ${y + 6 * s}"/></g>`,
  altar: (x, y, s = 1) => `${G}<path d="M${x - 30 * s} ${y}H${x + 30 * s}V${y - 16 * s}H${x - 30 * s}Z M${x - 24 * s} ${y - 16 * s}H${x + 24 * s}V${y - 30 * s}H${x - 24 * s}Z M${x - 30 * s} ${y - 8 * s}H${x + 30 * s} M${x - 6 * s} ${y}V${y - 16 * s}M${x + 10 * s} ${y - 16 * s}V${y - 30 * s}"/></g>${D}<path d="M${x} ${y - 32 * s}C${x + 14 * s} ${y - 46 * s} ${x - 2 * s} ${y - 58 * s} ${x + 4 * s} ${y - 72 * s}C${x - 16 * s} ${y - 58 * s} ${x - 12 * s} ${y - 44 * s} ${x} ${y - 32 * s}Z"/></g>`,
  path: (x, y, s = 1) => `${T}<path d="M${x - 120 * s} ${y + 10 * s}C${x - 60 * s} ${y - 30 * s} ${x - 20 * s} ${y + 30 * s} ${x + 40 * s} ${y - 10 * s}S${x + 110 * s} ${y - 40 * s} ${x + 130 * s} ${y - 70 * s}" stroke-dasharray="2 7"/></g>`,
  stars: (x, y, s = 1) => `${D}` + [[0, 0], [-60, 18], [52, 22], [-28, -24], [30, -30], [80, -8], [-88, -10]].map(([dx, dy]) => `<circle cx="${x + dx * s}" cy="${y + dy * s}" r="${2.6 * s}"/>`).join("") + `</g>`,
  glow: (x, y, s = 1) => `${T}` + [0, 30, 60, 90, 120, 150, 180].map((a) => { const r = a * Math.PI / 180; return `<path d="M${f1(x + Math.cos(r) * 40 * s)} ${f1(y - Math.sin(r) * 40 * s)}L${f1(x + Math.cos(r) * 58 * s)} ${f1(y - Math.sin(r) * 58 * s)}"/>`; }).join("") + `</g>`,
  city: (x, y, s = 1) => `${G}<path d="M${x - 50 * s} ${y}V${y - 34 * s}H${x - 36 * s}V${y - 44 * s}H${x - 22 * s}V${y - 34 * s}H${x - 8 * s}V${y - 56 * s}H${x + 8 * s}V${y - 34 * s}H${x + 22 * s}V${y - 44 * s}H${x + 36 * s}V${y - 34 * s}H${x + 50 * s}V${y}Z M${x - 6 * s} ${y}V${y - 14 * s}Q${x} ${y - 22 * s} ${x + 6 * s} ${y - 14 * s}V${y}"/></g>`,
  pyramid: (x, y, s = 1) => `${G}<path d="M${x - 44 * s} ${y}L${x} ${y - 46 * s}L${x + 44 * s} ${y}Z M${x} ${y - 46 * s}L${x + 10 * s} ${y}"/></g>${T}<path d="M${x + 30 * s} ${y}L${x + 56 * s} ${y - 26 * s}L${x + 82 * s} ${y}"/></g>`,
  sling: (x, y, s = 1) => `${G}<path d="M${x - 50 * s} ${y - 60 * s}Q${x - 10 * s} ${y + 10 * s} ${x + 20 * s} ${y - 20 * s}Q${x + 30 * s} ${y - 34 * s} ${x + 14 * s} ${y - 40 * s}Q${x} ${y - 30 * s} ${x + 20 * s} ${y - 20 * s}"/><path d="M${x + 14 * s} ${y - 40 * s}Q${x + 40 * s} ${y - 70 * s} ${x + 60 * s} ${y - 66 * s}"/></g>${D}` + [[-40, 18], [-18, 24], [6, 20], [28, 26], [50, 18]].map(([dx, dy]) => `<ellipse cx="${x + dx * s}" cy="${y + dy * s}" rx="${7 * s}" ry="${5.4 * s}"/>`).join("") + `</g>`,
  spear: (x, y, s = 1) => `${G}<path d="M${x - 70 * s} ${y + 20 * s}L${x + 70 * s} ${y - 60 * s}"/><path d="M${x + 70 * s} ${y - 60 * s}L${x + 52 * s} ${y - 58 * s}L${x + 62 * s} ${y - 46 * s}Z"/></g>`,
  crown: (x, y, s = 1) => `${G}<path d="M${x - 40 * s} ${y}L${x - 46 * s} ${y - 40 * s}L${x - 20 * s} ${y - 20 * s}L${x} ${y - 48 * s}L${x + 20 * s} ${y - 20 * s}L${x + 46 * s} ${y - 40 * s}L${x + 40 * s} ${y}Z M${x - 40 * s} ${y - 8 * s}H${x + 40 * s}"/></g>`,
  harp: (x, y, s = 1) => `${G}<path d="M${x - 30 * s} ${y}Q${x - 44 * s} ${y - 50 * s} ${x - 20 * s} ${y - 80 * s}Q${x + 20 * s} ${y - 60 * s} ${x + 34 * s} ${y - 70 * s}L${x + 30 * s} ${y}Z"/>${[-18, -8, 2, 12, 22].map((d) => `<path d="M${x + d * s} ${y}V${y - (52 + d) * s}"/>`).join("")}</g>`,
  mountain: (x, y, s = 1) => `${G}<path d="M${x - 90 * s} ${y}L${x - 30 * s} ${y - 60 * s}L${x} ${y - 30 * s}L${x + 40 * s} ${y - 80 * s}L${x + 100 * s} ${y}"/></g>`,
  valley: (x, y, s = 1) => `${G}<path d="M${x - 110 * s} ${y - 70 * s}Q${x - 60 * s} ${y - 60 * s} ${x - 30 * s} ${y}M${x + 110 * s} ${y - 70 * s}Q${x + 60 * s} ${y - 60 * s} ${x + 30 * s} ${y}"/></g>${T}<path d="M${x - 30 * s} ${y + 4 * s}Q${x} ${y + 12 * s} ${x + 30 * s} ${y + 4 * s}"/></g>`,
  ark: (x, y, s = 1) => `${G}<path d="M${x - 40 * s} ${y}H${x + 40 * s}V${y - 30 * s}H${x - 40 * s}Z M${x - 48 * s} ${y - 30 * s}H${x + 48 * s}"/><path d="M${x - 30 * s} ${y - 30 * s}C${x - 36 * s} ${y - 56 * s} ${x - 14 * s} ${y - 64 * s} ${x - 4 * s} ${y - 46 * s}M${x + 30 * s} ${y - 30 * s}C${x + 36 * s} ${y - 56 * s} ${x + 14 * s} ${y - 64 * s} ${x + 4 * s} ${y - 46 * s}"/></g>`,
  well: (x, y, s = 1) => `${G}<ellipse cx="${x}" cy="${y - 30 * s}" rx="${36 * s}" ry="${10 * s}"/><path d="M${x - 36 * s} ${y - 30 * s}V${y}Q${x} ${y + 12 * s} ${x + 36 * s} ${y}V${y - 30 * s}"/></g>`,
  sheaf: (x, y, s = 1) => `${G}${[-14, -7, 0, 7, 14].map((d) => `<path d="M${x} ${y}Q${x + d * s} ${y - 40 * s} ${x + d * 2 * s} ${y - 70 * s}"/>`).join("")}<path d="M${x - 14 * s} ${y - 30 * s}Q${x} ${y - 24 * s} ${x + 14 * s} ${y - 30 * s}"/></g>`,
  ladder: (x, y, s = 1) => `${G}<path d="M${x - 20 * s} ${y}L${x - 4 * s} ${y - 140 * s}M${x + 20 * s} ${y}L${x + 4 * s} ${y - 140 * s}"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${x - 20 * s + i * 2.7 * s} ${y - i * 24 * s}H${x + 20 * s - i * 2.7 * s}"/>`).join("")}</g>`,
  coat: (x, y, s = 1) => `${G}<path d="M${x - 24 * s} ${y}V${y - 50 * s}L${x - 46 * s} ${y - 36 * s}L${x - 34 * s} ${y - 66 * s}L${x - 10 * s} ${y - 74 * s}Q${x} ${y - 66 * s} ${x + 10 * s} ${y - 74 * s}L${x + 34 * s} ${y - 66 * s}L${x + 46 * s} ${y - 36 * s}L${x + 24 * s} ${y - 50 * s}V${y}Z"/></g>${T}<path d="M${x - 24 * s} ${y - 20 * s}H${x + 24 * s}M${x - 24 * s} ${y - 36 * s}H${x + 24 * s}"/></g>`,
  water: (x, y, s = 1) => `${T}${[0, 1, 2].map((i) => `<path d="M${x - 100 * s} ${y + i * 12 * s}Q${x - 75 * s} ${y - 8 * s + i * 12 * s} ${x - 50 * s} ${y + i * 12 * s}T${x} ${y + i * 12 * s}T${x + 50 * s} ${y + i * 12 * s}T${x + 100 * s} ${y + i * 12 * s}"/>`).join("")}</g>`,
  sword: (x, y, s = 1) => `${G}<path d="M${x} ${y}V${y - 90 * s}L${x - 6 * s} ${y - 78 * s}M${x} ${y - 90 * s}L${x + 6 * s} ${y - 78 * s}M${x - 22 * s} ${y - 14 * s}H${x + 22 * s}M${x - 6 * s} ${y - 78 * s}V${y - 14 * s}M${x + 6 * s} ${y - 78 * s}V${y - 14 * s}"/></g>`,
  tree: (x, y, s = 1) => `${G}<path d="M${x} ${y}V${y - 46 * s}M${x} ${y - 30 * s}L${x - 18 * s} ${y - 48 * s}M${x} ${y - 36 * s}L${x + 20 * s} ${y - 54 * s}"/><ellipse cx="${x}" cy="${y - 70 * s}" rx="${40 * s}" ry="${28 * s}"/></g>`,
  rain: (x, y, s = 1) => `${T}${[-60, -30, 0, 30, 60].map((d) => `<path d="M${x + d * s} ${y - 70 * s}L${x + (d - 8) * s} ${y - 50 * s}M${x + (d + 12) * s} ${y - 40 * s}L${x + (d + 4) * s} ${y - 20 * s}"/>`).join("")}</g>`,
  bow: (x, y, s = 1) => `${G}<path d="M${x - 90 * s} ${y}A${90 * s} ${70 * s} 0 0 1 ${x + 90 * s} ${y}"/></g>${T}<path d="M${x - 70 * s} ${y}A${70 * s} ${52 * s} 0 0 1 ${x + 70 * s} ${y}"/></g>`,
  boat: (x, y, s = 1) => `${G}<path d="M${x - 80 * s} ${y - 30 * s}H${x + 80 * s}L${x + 60 * s} ${y}H${x - 60 * s}Z M${x - 40 * s} ${y - 30 * s}V${y - 60 * s}H${x + 40 * s}V${y - 30 * s}"/></g>`,
  hand: (x, y, s = 1) => `${G}<path d="M${x - 20 * s} ${y}V${y - 40 * s}M${x - 20 * s} ${y - 40 * s}V${y - 62 * s}M${x - 8 * s} ${y - 40 * s}V${y - 70 * s}M${x + 4 * s} ${y - 40 * s}V${y - 68 * s}M${x + 16 * s} ${y - 38 * s}V${y - 60 * s}M${x - 20 * s} ${y}Q${x} ${y + 8 * s} ${x + 18 * s} ${y - 6 * s}L${x + 30 * s} ${y - 30 * s}"/></g>`,
};
const GLOW_BG = `<defs><radialGradient id="cglow"><stop stop-color="#fff7d0" stop-opacity=".45"/><stop offset="1" stop-color="#fff7d0" stop-opacity="0"/></radialGradient></defs><ellipse cx="170" cy="140" rx="112" ry="92" fill="url(#cglow)"/>`;
const GROUND = `${T}<path d="M24 300Q170 276 316 300"/></g>`;
// cover = [{m:"tent", x:120, y:270, s:1}, …]  (viewBox 340×350)
export function coverSvg(cover) {
  if (!cover?.length) throw new Error("표지 그림(cover)이 없음");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 350">${GLOW_BG}` + cover.map((c) => {
    if (!MOTIFS[c.m]) throw new Error("없는 표지 그림: " + c.m);
    return MOTIFS[c.m](c.x ?? 170, c.y ?? 260, c.s ?? 1);
  }).join("") + GROUND + `</svg>`;
}
