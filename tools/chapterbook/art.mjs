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
export function mapSvg(map) {
  const W = 640, H = 470;
  const pts = map.places.map((p) => {
    const db = PLACES.places[p.key];
    if (!db) throw new Error("places.json에 없는 지명: " + p.key);
    return { ...db, ...p, name: p.name || db.name };
  });
  let [x0, y0, x1, y1] = map.focus || [
    Math.min(...pts.map((p) => p.at[0])), Math.min(...pts.map((p) => p.at[1])),
    Math.max(...pts.map((p) => p.at[0])), Math.max(...pts.map((p) => p.at[1])),
  ];
  const kx = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
  let w = (x1 - x0) * kx, h = y1 - y0;
  const minSpan = map.minSpan || 0.9;
  w = Math.max(w, minSpan); h = Math.max(h, minSpan * 0.7);
  w *= 1.55; h *= 1.55;
  if (w / h > W / H) h = w * H / W; else w = h * W / H;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  x0 = cx - w / kx / 2; x1 = cx + w / kx / 2; y0 = cy - h / 2; y1 = cy + h / 2;
  const X = (lon) => (lon - x0) / (x1 - x0) * W, Y = (lat) => (y1 - lat) / (y1 - y0) * H;
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
    const line = r.path.map((k) => PLACES.places[k].at);
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
  const S = { main: 19, area: 18, sea: 16, region: 15, river: 14, ctx: 14 };
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
  for (const p of pts) { const x = X(p.at[0]), y = Y(p.at[1]); if (!put(x, y, p.name, p.area ? "area" : "main", p.area ? [0, 14, 28] : [10, 22, 34], true)) throw new Error("지도 이름 자리를 찾지 못함: " + p.name); }
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
  const style = { main: `font-weight="700" fill="#7a1f16"`, area: `font-weight="700" fill="#5b4a2a"`, region: `fill="#8f846c"`, sea: `fill="#3f6f90" font-style="italic"`, river: `fill="#3f6f90" font-style="italic"`, ctx: `fill="#6f685b"` };
  const out = [...base, ...routeSvg, ...ctxDots, ...dots];
  for (const l of labels) {
    if (l.r > 24 && (l.cls === "main" || l.cls === "area")) { const tx = Math.min(Math.max(l.ax, l.x), l.x + l.w), ty = Math.min(Math.max(l.ay, l.y), l.y + l.h); out.push(`<line x1="${f1(l.ax)}" y1="${f1(l.ay)}" x2="${f1(tx)}" y2="${f1(ty)}" stroke="#7a1f16" stroke-width="1"/>`); }
    if (l.cls === "main") out.push(`<rect x="${f1(l.x)}" y="${f1(l.y)}" width="${f1(l.w)}" height="${f1(l.h)}" rx="5" fill="#fffaf0" stroke="#c0392b" stroke-width="1.2"/>`);
    else if (l.cls !== "sea" && l.cls !== "river") out.push(`<rect x="${f1(l.x)}" y="${f1(l.y)}" width="${f1(l.w)}" height="${f1(l.h)}" rx="4" fill="#f3ead2" fill-opacity=".85"/>`);
    out.push(`<text x="${f1(l.x + l.w / 2)}" y="${f1(l.y + l.h / 2 + l.s * 0.36)}" text-anchor="middle" font-size="${l.s}" font-family="Noto Sans KR" ${style[l.cls]}>${esc(l.t)}</text>`);
  }
  out.push(`<g transform="translate(${W - 34},36)"><circle r="18" fill="#fffaf0" stroke="#8a7442"/><path d="M0,-14L5,4L0,0L-5,4Z" fill="#8a7442"/><text y="15" text-anchor="middle" font-size="10" font-family="Noto Sans KR" font-weight="700" fill="#8a7442">N</text></g>`);
  const kmPerPx = (x1 - x0) * kx * 111 / W;
  const nice = [5, 10, 20, 50, 100, 200, 300, 500].find((k) => k / kmPerPx > 60) || 500;
  const bw = nice / kmPerPx;
  out.push(`<g transform="translate(16,${H - 16})"><rect x="0" y="-6" width="${f1(bw)}" height="6" fill="#8a7442"/><rect x="0" y="-6" width="${f1(bw / 2)}" height="6" fill="#fffaf0" stroke="#8a7442" stroke-width=".8"/><text x="${f1(bw + 6)}" y="0" font-size="13" font-family="Noto Sans KR" fill="#6b5d3d">${nice}km</text></g>`);
  out.push(`<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" fill="none" stroke="#8a7442" stroke-width="1.4"/></svg>`);
  return out.join("");
}

// ───────────── 인물 관계도 ─────────────
// people:[{id,name,gen,role?}], relations:[{from,to,type,label,directed?}]
const REL = {
  spouse: { stroke: "#b8860b", width: 3.2, dash: "", double: true, name: "부부" },
  parent: { stroke: "#4f6390", width: 2, dash: "", name: "부모·자녀" },
  sibling: { stroke: "#4f6390", width: 2, dash: "4 3", name: "형제·자매" },
  kin: { stroke: "#4f6390", width: 2, dash: "1.5 4", name: "친척" },
  ruler: { stroke: "#2c6e49", width: 2.2, dash: "", name: "왕·신하·주인" },
  enemy: { stroke: "#c0392b", width: 2.4, dash: "7 4", name: "적대·갈등" },
  god: { stroke: "#c9973b", width: 2.6, dash: "", name: "주와의 관계" },
  other: { stroke: "#7b7466", width: 2, dash: "", name: "그 밖의 관계" },
};
export function relationSvg(people, relations) {
  const NAME = 19, TAG = 14, boxH = 54, rowH = 150, top = 26;
  const gens = [...new Set(people.map((p) => p.gen ?? 0))].sort((a, b) => a - b);
  const rows = gens.map((g) => people.filter((p) => (p.gen ?? 0) === g));
  const pw = (p) => Math.max(92, textW(p.name, NAME) + 40);
  const adj = (a, b) => relations.find((r) => (r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id));
  const gapOf = (a, b) => { const r = adj(a, b); return Math.max(46, r?.label ? textW(r.label, TAG) + 34 : 46); };
  const rowWidth = (row) => row.reduce((s, p, i) => s + pw(p) + (i ? gapOf(row[i - 1], p) : 0), 0);
  const W = Math.max(640, ...rows.map((r) => rowWidth(r) + 40));
  const pos = {};
  rows.forEach((row, gi) => {
    let x = (W - rowWidth(row)) / 2;
    row.forEach((p, i) => {
      if (i) x += gapOf(row[i - 1], p);
      const w = pw(p); pos[p.id] = { x: x + w / 2, y: top + gi * rowH + boxH / 2, w, p, row: gi, idx: i }; x += w;
    });
  });
  const H = top + (rows.length - 1) * rowH + boxH + 26;
  const boxes = Object.values(pos).map((n) => ({ x: n.x - n.w / 2, y: n.y - boxH / 2, w: n.w, h: boxH }));
  const lines = [], tags = [];
  for (const r of relations) {
    const a = pos[r.from], b = pos[r.to];
    if (!a || !b) throw new Error(`관계도 인물 없음: ${r.from}→${r.to}`);
    const st = REL[r.type] || REL.other;
    const dash = st.dash ? ` stroke-dasharray="${st.dash}"` : "";
    const arrow = r.directed ? ` marker-end="url(#rar-${REL[r.type] ? r.type : "other"})"` : "";
    let lab;
    if (a.row === b.row && Math.abs(a.idx - b.idx) > 1) {
      // 같은 줄, 사이에 다른 사람이 있으면 위로 휘는 곡선
      const [l, rr] = a.x < b.x ? [a, b] : [b, a];
      const y = l.y - boxH / 2, cy = y - 50;
      lines.push(`<path d="M${f1(l.x)},${f1(y)} C${f1(l.x)},${f1(cy)} ${f1(rr.x)},${f1(cy)} ${f1(rr.x)},${f1(y)}" fill="none" stroke="${st.stroke}" stroke-width="${st.width}"${dash}${arrow}/>`);
      lab = { x: (l.x + rr.x) / 2, y: cy + 12, cand: [[0, 0], [0, -10], [50, 0], [-50, 0], [0, 14]] };
    } else {
      const edge = (p, q) => { const dx = q.x - p.x, dy = q.y - p.y; const s = Math.min((p.w / 2) / Math.abs(dx || 1e-9), (boxH / 2) / Math.abs(dy || 1e-9)); return [p.x + dx * s, p.y + dy * s]; };
      const [ax, ay] = edge(a, b), [bx, by] = edge(b, a);
      if (st.double) { const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l * 2.6, ny = dx / l * 2.6; lines.push(`<line x1="${f1(ax + nx)}" y1="${f1(ay + ny)}" x2="${f1(bx + nx)}" y2="${f1(by + ny)}" stroke="${st.stroke}" stroke-width="1.8"/><line x1="${f1(ax - nx)}" y1="${f1(ay - ny)}" x2="${f1(bx - nx)}" y2="${f1(by - ny)}" stroke="${st.stroke}" stroke-width="1.8"/>`); }
      else lines.push(`<line x1="${f1(ax)}" y1="${f1(ay)}" x2="${f1(bx)}" y2="${f1(by)}" stroke="${st.stroke}" stroke-width="${st.width}"${dash}${arrow}/>`);
      const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      const mx = (ax + bx) / 2, my = (ay + by) / 2, c = [];
      for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.22, 0.78]) for (const o of [0, 16, -16, 30, -30, 44, -44]) c.push([ax + dx * t + nx * o - mx, ay + dy * t + ny * o - my]);
      lab = { x: mx, y: my, cand: c };
    }
    if (r.label) {
      const w = textW(r.label, TAG) + 16, h = TAG + 10;
      let b0 = null;
      for (const [ox, oy] of lab.cand) { const bb = { x: lab.x + ox - w / 2, y: lab.y + oy - h / 2, w, h }; if (bb.x > 2 && bb.x + w < W - 2 && bb.y > 2 && bb.y + h < H - 2 && !boxes.some((o) => hit(bb, o, 1))) { b0 = bb; break; } }
      if (!b0) throw new Error(`관계 낱말 자리를 찾지 못함: ${r.label}`);
      boxes.push(b0); tags.push({ ...b0, t: r.label, c: st.stroke });
    }
  }
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${H}" class="relsvg">`,
    `<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#5a4a2a" flood-opacity=".22"/></filter>` + Object.entries(REL).map(([k, s]) => `<marker id="rar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0L10,5L0,10z" fill="${s.stroke}"/></marker>`).join("") + `</defs>`,
    `<rect width="${f1(W)}" height="${H}" rx="12" fill="#fbf7ec"/>`, ...lines];
  for (const { x, y, w, p } of Object.values(pos)) {
    const [fill, stroke, color, band] = p.role === "god" ? ["#1c284e", "#c9973b", "#f6e7c1", "#c9973b"] : p.role === "enemy" ? ["#fff4f2", "#c0392b", "#7a1f16", "#c0392b"] : ["#fffdf7", "#b39a5f", "#18233f", "#c9973b"];
    out.push(`<g filter="url(#sh)"><rect x="${f1(x - w / 2)}" y="${f1(y - boxH / 2)}" width="${f1(w)}" height="${boxH}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/></g><rect x="${f1(x - w / 2 + 12)}" y="${f1(y - boxH / 2)}" width="${f1(w - 24)}" height="4" rx="2" fill="${band}"/>`);
    out.push(`<text x="${f1(x)}" y="${f1(y + NAME * 0.38)}" text-anchor="middle" font-size="${NAME}" font-weight="700" font-family="Noto Sans KR" fill="${color}">${esc(p.name)}</text>`);
  }
  for (const t of tags) out.push(`<rect x="${f1(t.x)}" y="${f1(t.y)}" width="${f1(t.w)}" height="${f1(t.h)}" rx="${f1(t.h / 2)}" fill="#fff" stroke="${t.c}" stroke-width="1.2"/><text x="${f1(t.x + t.w / 2)}" y="${f1(t.y + t.h / 2 + TAG * 0.36)}" text-anchor="middle" font-size="${TAG}" font-weight="500" font-family="Noto Sans KR" fill="${t.c}">${esc(t.t)}</text>`);
  out.push(`</svg>`);
  return out.join("");
}
// 범례: 이 관계도에 쓰인 종류만, HTML 칩(겹치지 않고 줄바꿈)
export function relLegendHtml(relations) {
  const kinds = [...new Set(relations.map((r) => (REL[r.type] ? r.type : "other")))];
  return `<div class="rel-legend">` + kinds.map((k) => {
    const s = REL[k];
    const line = s.double ? `<svg viewBox="0 0 26 10" class="lg"><line x1="0" y1="3" x2="26" y2="3" stroke="${s.stroke}" stroke-width="1.6"/><line x1="0" y1="7" x2="26" y2="7" stroke="${s.stroke}" stroke-width="1.6"/></svg>` : `<svg viewBox="0 0 26 10" class="lg"><line x1="0" y1="5" x2="26" y2="5" stroke="${s.stroke}" stroke-width="2.2"${s.dash ? ` stroke-dasharray="${s.dash}"` : ""}/></svg>`;
    return `<span class="chip">${line}${s.name}</span>`;
  }).join("") + `</div>`;
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
