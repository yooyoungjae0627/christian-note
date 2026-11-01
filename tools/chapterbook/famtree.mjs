// 인물 관계도 3판(사용자 지시 2026-11-02: "크게, 한 쪽을 절대 넘지 않게, 겹치는 것 없이, 선은 단순하게")
// 선은 가계만 긋는다 — 부부(옆자리 이중선), 부모→자녀(바로 아래 줄로 내리는 버스선), 옆자리끼리의 짧은 관계선.
// 그 밖의 관계(하나님·천사와의 관계, 떨어진 자리끼리의 관계)는 선 없이 그림 아래 표에만 싣는다.
import { REL, textW } from "./rel.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const NAME = 26, BOX_H = 60, COL_GAP = 34, PAD = 16, TOP = 14, LANE = 16, TAG = 16;
const boxW = (p) => Math.max(96, textW(p.name, NAME) + 36);
const tagW = (t) => textW(t, TAG) + 16;

// 옆자리 두 사람 사이에 그을 관계 하나(부부 먼저, 하나님·천사와 부모 관계는 빼고)
function sideRel(relations, byId, a, b) {
  const rs = relations.filter((r) => ((r.from === a && r.to === b) || (r.from === b && r.to === a)) && r.type !== "parent" && byId[r.from].role !== "god" && byId[r.to].role !== "god");
  return rs.find((r) => r.type === "spouse") || rs[0] || null;
}

export function familyGeometry(people, relations) {
  const byId = Object.fromEntries(people.map((p) => [p.id, { ...p }]));
  for (const r of relations) if (!byId[r.from] || !byId[r.to]) throw new Error(`관계도 인물 없음: ${r.from}→${r.to}`);
  // 줄: 원고의 세대(gen) — 부부는 같은 줄로 맞춘다
  for (const r of relations) if (r.type === "spouse") { const a = byId[r.from], b = byId[r.to]; a.gen = b.gen = Math.min(a.gen ?? 0, b.gen ?? 0); }
  const gens = [...new Set(Object.values(byId).map((p) => p.gen ?? 0))].sort((a, b) => a - b);
  const spouseOf = {};
  for (const r of relations) if (r.type === "spouse") { (spouseOf[r.from] ||= []).push(r.to); (spouseOf[r.to] ||= []).push(r.from); }
  const parentsOf = {};
  for (const r of relations) if (r.type === "parent") (parentsOf[r.to] ||= []).push(r.from);

  // 부모 자리 가운데(옆자리 부부면 두 상자 사이, 아니면 부모 상자 가운데의 평균)
  const parentMid = (id, prow) => {
    const ps = (parentsOf[id] || []).map((q) => byId[q]).filter((q) => q.row === prow);
    if (!ps.length) return null;
    if (ps.length === 2 && (spouseOf[ps[0].id] || []).includes(ps[1].id)) { const [L, R] = ps[0].x < ps[1].x ? ps : [ps[1], ps[0]]; return (L.x + L.w + R.x) / 2; }
    return ps.reduce((a, q) => a + q.cx, 0) / ps.length;
  };
  const rows = [];
  let y = TOP;
  for (const [ri, g] of gens.entries()) {
    let ids = people.filter((p) => (byId[p.id].gen ?? 0) === g).map((p) => p.id);
    // 자녀 줄은 부모 자리의 평균 x 순서로(선이 엇갈리지 않게)
    if (ri > 0) {
      const xOf = (id) => parentMid(id, ri - 1);
      const keyed = ids.map((id, i) => ({ id, i, x: xOf(id) }));
      const withX = keyed.filter((k) => k.x !== null).sort((a, b) => a.x - b.x);
      ids = [...withX.map((k) => k.id), ...keyed.filter((k) => k.x === null).map((k) => k.id)]; // 부모가 그림에 없는 사람은 줄 끝에
    }
    // 부부는 옆자리로
    const seq = [];
    for (const id of ids) {
      if (seq.includes(id)) continue;
      seq.push(id);
      for (const s of spouseOf[id] || []) if (ids.includes(s) && !seq.includes(s)) seq.push(s);
    }
    // 옆자리끼리 관계 낱말이 있으면 그 사이를 낱말 폭만큼 벌린다(낱말은 선 위 가운데에 얹는다)
    const gaps = seq.slice(1).map((id, i) => { const r = sideRel(relations, byId, seq[i], id); return r && r.label && !(REL[r.type] || {}).double ? Math.max(COL_GAP, tagW(r.label) + 22) : COL_GAP; });
    const w = seq.reduce((a, id) => a + boxW(byId[id]), 0) + gaps.reduce((a, b) => a + b, 0);
    rows.push({ seq, w, y });
    seq.forEach((id) => { byId[id].row = ri; });
    // x: 첫 줄은 0을 가운데로. 자녀는 부모 바로 아래(부모 자리 가운데)에 두고, 겹치면 오른쪽으로 민다
    let x = -w / 2;
    seq.forEach((id, i) => {
      const p = byId[id]; p.w = boxW(p);
      const want = ri > 0 ? parentMid(id, ri - 1) : null;
      const minX = i ? byId[seq[i - 1]].x + byId[seq[i - 1]].w + gaps[i - 1] : -Infinity;
      p.x = Math.max(want === null ? x : want - p.w / 2, minX); p.cx = p.x + p.w / 2; x = p.x + p.w + (gaps[i] ?? 0);
    });
    y += BOX_H + LANE * 2; // 아래 통로는 아래에서 다시 넓힌다
  }
  // 전체를 가운데로
  const all = Object.values(byId), x0 = Math.min(...all.map((p) => p.x)), x1 = Math.max(...all.map((p) => p.x + p.w));
  const W = Math.max(640, x1 - x0 + PAD * 2), off = (W - (x1 - x0)) / 2 - x0;
  for (const p of all) { p.x += off; p.cx += off; }

  // 선 고르기
  const lines = [], tableOnly = [];
  const adj = (a, b) => a.row === b.row && Math.abs(rows[a.row].seq.indexOf(a.id) - rows[b.row].seq.indexOf(b.id)) === 1;
  const used = new Set();
  for (const row of rows) row.seq.slice(1).forEach((id, i) => { const r = sideRel(relations, byId, row.seq[i], id); if (r) { lines.push({ kind: "side", r, a: byId[r.from], b: byId[r.to] }); used.add(r); } });
  // 부모→자녀: 바로 윗줄 부모만, 같은 부모 묶음끼리 버스 하나
  const groups = new Map();
  for (const r of relations) {
    if (r.type !== "parent") continue;
    const p = byId[r.from], c = byId[r.to];
    if (p.row !== c.row - 1) continue;
    used.add(r);
    const ps = (parentsOf[c.id] || []).filter((q) => byId[q].row === c.row - 1).sort();
    const k = ps.join("+");
    if (!groups.has(k)) groups.set(k, { ps: ps.map((q) => byId[q]), kids: new Set(), row: p.row });
    groups.get(k).kids.add(c);
  }
  for (const r of relations) if (!used.has(r)) tableOnly.push(r);

  // 버스선 자리: 줄 사이 통로에 묶음마다 한 칸
  const perRow = {};
  for (const g of groups.values()) (perRow[g.row] ||= []).push(g);
  let shift = 0;
  rows.forEach((row, ri) => {
    row.y += shift;
    const gs = (perRow[ri] || []).sort((a, b) => Math.min(...a.ps.map((p) => p.cx)) - Math.min(...b.ps.map((p) => p.cx)));
    const need = gs.length ? LANE * (gs.length + 1) + 10 : LANE * 2;
    gs.forEach((g, gi) => { g.busOff = 18 + gi * LANE; });
    row.gap = need; shift += need - LANE * 2;
  });
  for (const row of rows) for (const id of row.seq) byId[id].y = row.y;
  for (const g of groups.values()) {
    g.busY = rows[g.row].y + BOX_H + g.busOff;
    // 부모 두 사람이 옆자리 부부면 두 상자 사이 이중선 가운데에서 내린다
    const [p1, p2] = g.ps;
    const sp = p2 && adj(p1, p2) && (spouseOf[p1.id] || []).includes(p2.id);
    g.anchors = sp ? [{ x: (Math.min(p1.x + p1.w, p2.x + p2.w) + Math.max(p1.x, p2.x)) / 2, y: p1.y + BOX_H / 2 }] : g.ps.map((p) => ({ x: p.cx, y: p.y + BOX_H }));
  }
  const H = rows.at(-1).y + BOX_H + TOP;
  return { W, H, people: Object.values(byId), lines, groups: [...groups.values()], tableOnly, rows };
}

export function familySvg(people, relations) {
  const G = familyGeometry(people, relations);
  let o = `<svg class="relsvg famtree" viewBox="0 0 ${G.W} ${G.H}" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans KR, sans-serif">`;
  // 부모→자녀 버스선(파랑, 같은 굵기, 화살표 없음)
  for (const g of G.groups) {
    const s = REL.parent; const xs = [...g.anchors.map((a) => a.x), ...[...g.kids].map((k) => k.cx)];
    let d = g.anchors.map((a) => `M${a.x},${a.y}V${g.busY}`).join("");
    d += `M${Math.min(...xs)},${g.busY}H${Math.max(...xs)}`;
    for (const k of g.kids) d += `M${k.cx},${g.busY}V${k.y}`;
    o += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${s.width + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${s.stroke}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  // 옆자리 관계선 + 낱말
  for (const l of G.lines) {
    const s = REL[l.r.type] || REL.other; const [L, R] = l.a.x < l.b.x ? [l.a, l.b] : [l.b, l.a];
    const x1 = L.x + L.w, x2 = R.x, y = L.y + BOX_H / 2;
    if (s.double) o += `<path d="M${x1},${y - 2.5}H${x2}M${x1},${y + 2.5}H${x2}" stroke="${s.stroke}" stroke-width="2"/>`;
    else {
      o += `<path d="M${x1},${y}H${x2 - (l.r.directed ? 6 : 0)}" stroke="${s.stroke}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`;
      if (l.r.directed) { const fwd = l.a === L; const ax = fwd ? x2 : x1, dir = fwd ? -1 : 1; o += `<path d="M${ax},${y}l${dir * 8},-5v10z" fill="${s.stroke}"/>`; }
    }
    if (l.r.label && !s.double) { const tw = tagW(l.r.label), cx = (x1 + x2) / 2; o += `<rect x="${cx - tw / 2}" y="${y - (TAG + 8) / 2}" width="${tw}" height="${TAG + 8}" rx="${(TAG + 8) / 2}" fill="#fff" stroke="${s.stroke}" stroke-width="1"/><text x="${cx}" y="${y + TAG * 0.36}" font-size="${TAG}" text-anchor="middle" fill="${s.stroke}" font-weight="700">${esc(l.r.label)}</text>`; }
  }
  // 상자
  for (const p of G.people) {
    const god = p.role === "god";
    o += `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${BOX_H}" rx="9" fill="${god ? "#1d2b4f" : "#fffdf7"}" stroke="${god ? "#1d2b4f" : "#c9a96b"}" stroke-width="1.6"/>`;
    o += `<rect x="${p.x + 10}" y="${p.y}" width="${p.w - 20}" height="3.4" rx="1.7" fill="#c9973b"/>`;
    o += `<text x="${p.cx}" y="${p.y + BOX_H / 2 + NAME * 0.36}" font-size="${NAME}" font-weight="700" text-anchor="middle" fill="${god ? "#fff" : "#1d2338"}">${esc(p.name)}</text>`;
  }
  return o + `</svg>`;
}

// 그림에 실제로 그은 선의 범례만
export function familyLegendHtml(people, relations) {
  const G = familyGeometry(people, relations);
  const types = new Set([...G.lines.map((l) => l.r.type), ...(G.groups.length ? ["parent"] : [])]);
  const chip = (t) => { const s = REL[t]; const line = s.double ? `<path d="M2,5H40M2,10H40" stroke="${s.stroke}" stroke-width="2"/>` : `<path d="M2,7.5H40" stroke="${s.stroke}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`; return `<span class="chip"><svg class="lg" viewBox="0 0 42 15">${line}</svg>${s.name}</span>`; };
  const note = G.tableOnly.length ? `<span class="chip fam-note">그 밖의 관계는 아래 표에</span>` : "";
  return `<div class="rel-legend">${[...types].map(chip).join("")}${note}</div>`;
}

// 겹침 검사: 상자끼리, 낱말과 상자
export function familyIssues(people, relations) {
  const G = familyGeometry(people, relations), issues = [];
  const P = G.people;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j]; if (a.y === b.y && a.x < b.x + b.w && b.x < a.x + a.w) issues.push(`상자 겹침 ${a.name}·${b.name}`); }
  return { issues, geometry: G };
}
