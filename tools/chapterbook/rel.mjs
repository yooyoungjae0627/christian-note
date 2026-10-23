// 인물 관계도(지침 §5) — 계보도처럼 세대를 줄로 놓고, 선은 직각으로 줄 사이 통로로만 지나가게 그린다.
// 글자(이름·관계 낱말)는 다른 상자·글자·선에 가려지지 않게 놓는다. relationIssues()로 겹침을 검사한다.
//   people:[{id,name,gen,role?}], relations:[{from,to,type,label,directed?,ref}]
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const f1 = (n) => Math.round(n * 10) / 10;
export const textW = (t, s) => [...String(t)].reduce((a, c) => a + (c.charCodeAt(0) > 255 ? s * 1.0 : c === " " ? s * 0.32 : /[()·,.]/.test(c) ? s * 0.4 : s * 0.6), 0);
const hit = (a, b, pad = 2) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

export const REL = {
  spouse: { stroke: "#b8860b", width: 3, dash: "", double: true, name: "부부" },
  parent: { stroke: "#4f6390", width: 2, dash: "", name: "부모·자녀" },
  sibling: { stroke: "#4f6390", width: 2, dash: "5 3", name: "형제·자매" },
  kin: { stroke: "#4f6390", width: 2, dash: "1.5 4", name: "친척" },
  ruler: { stroke: "#2c6e49", width: 2.2, dash: "", name: "왕·신하·주인" },
  enemy: { stroke: "#c0392b", width: 2.2, dash: "7 4", name: "적대·갈등" },
  god: { stroke: "#c9973b", width: 2.4, dash: "", name: "주와의 관계" },
  other: { stroke: "#7b7466", width: 2, dash: "", name: "그 밖의 관계" },
};
// 인쇄 폭(본문 116mm)에 그림 폭 640일 때 이름 21 ≈ 11pt(지침 §5). 그보다 넓은 세대는 같은 세대 띠 안에서 두 줄로 나눈다.
const WRAP = 680, NAME = 21, TAG = 15, BOX_H = 54, MAXW = 640, LANE = 14, LABEL_ZONE = 42, GAP = 30;
const TAG_H = TAG + 10;
const tagW = (t) => textW(t, TAG) + 18;
const boxW = (p) => Math.max(84, textW(p.name, NAME) + 34);

function layout(people0, relations) {
  // 부부는 같은 줄에(원고의 세대 번호가 달라도 그림에서는 나란히)
  const people = people0.map((p) => ({ ...p }));
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));
  for (let k = 0; k < 3; k++) for (const r of relations) if (r.type === "spouse" && byId[r.from] && byId[r.to]) { const a = byId[r.from], b = byId[r.to]; const g = Math.min(a.gen ?? 0, b.gen ?? 0); a.gen = g; b.gen = g; }
  for (const r of relations) if (!byId[r.from] || !byId[r.to]) throw new Error(`관계도 인물 없음: ${r.from}→${r.to}`);
  const gens = [...new Set(people.map((p) => p.gen ?? 0))].sort((a, b) => a - b);
  const sameRowRel = (a, b) => relations.find((r) => (r.from === a.id && r.to === b.id) || (r.from === b.id && r.to === a.id));
  // 이웃 사이 관계 낱말은 보통 두 사람 사이에 넣고, 줄이 너무 넓어지면(글자가 작아지므로) 사이를 좁히고 낱말을 선 위·아래에 둔다
  const compact = new Set();
  const gapOf = (a, b) => { const r = sameRowRel(a, b); if (!r?.label) return GAP; return compact.has(a.id) ? 52 : Math.max(GAP, tagW(r.label) + 22); };
  const width = (row) => row.reduce((s, p, i) => s + boxW(p) + (i ? gapOf(row[i - 1], p) : 0), 0);
  const tighten = (rows) => { for (const row of rows) if (width(row) > MAXW - 40) row.forEach((p) => compact.add(p.id)); };
  // ① 세대 줄 안의 순서: 원고 순서와 무게중심 정렬 가운데 선이 덜 엇갈리는 쪽
  const centers = (rows) => { const c = {}; for (const row of rows) { let x = -width(row) / 2; row.forEach((p, i) => { if (i) x += gapOf(row[i - 1], p); c[p.id] = x + boxW(p) / 2; x += boxW(p); }); } return c; };
  const rowOf = {}; const base = gens.map((g, gi) => people.filter((p) => (p.gen ?? 0) === g).map((p) => (rowOf[p.id] = gi, p)));
  const cost = (rows) => {
    const c = centers(rows), idx = {}; rows.forEach((row) => row.forEach((p, i) => (idx[p.id] = i)));
    const inter = relations.filter((r) => rowOf[r.from] !== rowOf[r.to]).map((r) => { const [u, l] = rowOf[r.from] < rowOf[r.to] ? [r.from, r.to] : [r.to, r.from]; return [rowOf[u], c[u], rowOf[l], c[l]]; });
    let x = 0;
    for (let i = 0; i < inter.length; i++) for (let j = i + 1; j < inter.length; j++) { const [a0, ax, a1, bx] = inter[i], [b0, cx, b1, dx] = inter[j]; if (a0 === b0 && a1 === b1 && (ax - cx) * (bx - dx) < 0) x++; }
    const far = relations.filter((r) => rowOf[r.from] === rowOf[r.to] && Math.abs(idx[r.from] - idx[r.to]) > 1).length;
    const span = inter.reduce((s, [, a, , b]) => s + Math.abs(a - b), 0);
    return x * 4 + far * 6 + span / 120;
  };
  let best = base, bestCost = cost(base), rows = base.map((r) => r.slice());
  for (let sweep = 0; sweep < 8; sweep++) {
    const order = sweep % 2 ? [...rows.keys()].reverse() : [...rows.keys()];
    for (const gi of order) {
      const c = centers(rows);
      const bary = (p) => { const ns = relations.filter((r) => r.from === p.id || r.to === p.id).map((r) => (r.from === p.id ? r.to : r.from)); return ns.length ? ns.reduce((s, n) => s + c[n], 0) / ns.length : c[p.id]; };
      rows[gi] = rows[gi].map((p, i) => [p, bary(p), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map((x) => x[0]);
    }
    const k = cost(rows); if (k < bestCost - 1e-9) { best = rows.map((r) => r.slice()); bestCost = k; }
  }
  // ② 너무 넓은 세대는 여러 줄로 나눈다(글자를 작게 줄이지 않으려고)
  // 나눌 때는 관계로 이어진 이웃(부부 등)을 가르지 않는 자리, 두 줄 폭이 비슷한 자리를 고른다
  const lines = [];
  const split = (row) => {
    // 한 세대를 두 줄로 나누면 세대가 다른 것처럼 보이므로 아주 넓을 때(WRAP)만 나눈다
    if (row.length < 2 || width(row) <= WRAP) { lines.push(row); return; }
    let best = null;
    for (let k = 1; k < row.length; k++) {
      const a = row.slice(0, k), b = row.slice(k);
      const cut = sameRowRel(row[k - 1], row[k]) ? 1 : 0;
      const score = cut * 1e4 + Math.max(width(a), width(b));
      if (!best || score < best.score) best = { k, score };
    }
    split(row.slice(0, best.k)); split(row.slice(best.k));
  };
  tighten(best);
  for (const row of best) split(row);
  // ③ 줄이 7개를 넘으면 두 단으로
  // 한 단으로 세우면 너무 길 때만(세로가 가로의 1.5배를 넘을 때) 두 단으로 — 두 단은 글자가 작아지므로 되도록 피한다
  const estH = (n) => n * (BOX_H + 16 + LANE + LABEL_ZONE);
  const cols = lines.length > 7 && estH(lines.length) > 1.5 * Math.max(MAXW, ...lines.map((l) => width(l) + 48)) ? 2 : 1, perCol = Math.ceil(lines.length / cols);
  const colW = Math.max(cols > 1 ? 300 : MAXW, ...lines.map((l) => width(l) + 48));
  const W = colW * cols;
  const node = {};
  const lineGen = lines.map((l) => l[0].gen ?? 0);
  lines.forEach((line, li) => {
    const col = Math.floor(li / perCol), ri = li % perCol;
    let x = col * colW + (colW - width(line)) / 2;
    line.forEach((p, i) => { if (i) x += gapOf(line[i - 1], p); const w = boxW(p); node[p.id] = { p, x: x + w / 2, w, li, col, ri, idx: i }; x += w; });
  });
  return { node, lines, lineGen, cols, perCol, colW, W };
}

// 모서리를 둥글린 직각 경로
function roundPath(pts, r = 7) {
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py), l2 = Math.hypot(nx - x, ny - y);
    const k = Math.min(r, l1 / 2, l2 / 2);
    if (k < 0.5) { d += ` L${f1(x)},${f1(y)}`; continue; }
    d += ` L${f1(x - (x - px) / l1 * k)},${f1(y - (y - py) / l1 * k)} Q${f1(x)},${f1(y)} ${f1(x + (nx - x) / l2 * k)},${f1(y + (ny - y) / l2 * k)}`;
  }
  const [lx, ly] = pts.at(-1); return d + ` L${f1(lx)},${f1(ly)}`;
}

export function relationGeometry(people, relations) {
  const L = layout(people, relations);
  const { node, cols, perCol, colW } = L;
  const nLines = L.lines.length;
  // 경로의 뼈대(가로 구간은 통로 번호와 함께) — y는 줄 높이가 정해진 뒤에 채운다
  const E = relations.map((r, k) => ({ r, k, a: node[r.from], b: node[r.to], st: REL[r.type] || REL.other }));
  const ports = {}; // node:side → [{edge, group, other}]
  const addPort = (n, side, e, group, other) => ((ports[n.p.id + ":" + side] ||= []).push({ e, group, other }));
  const bus = (t) => t === "parent" || t === "kin";
  for (const e of E) {
    const { a, b } = e;
    if (a.li === b.li) { e.kind = Math.abs(a.idx - b.idx) === 1 ? "h" : "over"; if (e.kind === "over") { addPort(a, "top", e, "o" + e.k, b.x); addPort(b, "top", e, "o" + e.k, a.x); } continue; }
    e.kind = "down";
    const [U, Lo] = a.li < b.li ? [a, b] : [b, a]; e.U = U; e.Lo = Lo; e.up = a.li > b.li;
    addPort(U, "bottom", e, bus(e.r.type) ? e.r.type : "d" + e.k, Lo.x);
    addPort(Lo, "top", e, bus(e.r.type) ? e.r.type : "u" + e.k, U.x);
  }
  const portX = {}; // edge.k + node + side → x
  for (const [key, list] of Object.entries(ports)) {
    const [id, side] = key.split(":"); const n = node[id];
    const groups = [...new Set(list.map((x) => x.group))].map((g) => ({ g, m: list.filter((x) => x.group === g).reduce((s, x, _, a) => s + x.other / a.length, 0) })).sort((p, q) => p.m - q.m);
    const span = Math.min(n.w - 24, 22 * (groups.length - 1));
    groups.forEach((g, i) => { const x = groups.length === 1 ? n.x : n.x - span / 2 + span * i / (groups.length - 1); for (const it of list.filter((y) => y.group === g.g)) portX[it.e.k + ":" + id + ":" + side] = x; });
  }
  const P = (e, n, side) => portX[e.k + ":" + n.p.id + ":" + side];
  // 통로: col:ri = ri번째 줄 위쪽(ri = perCol이면 맨 아래)
  const segs = []; // {ch, x1, x2, key, e}
  const lineOfCol = (col, ri) => col * perCol + ri;
  const linesIn = (col) => Math.min(perCol, nLines - col * perCol);
  const gutterUse = {};
  const freeX = (col, fromRi, toRi, want) => {
    // 사이 줄의 인물 상자와, 나란히 이어진 두 사람 사이(부부 줄·관계 낱말 자리)는 지나가지 않는다
    const mid = Object.values(node).filter((n) => n.col === col && n.ri > fromRi && n.ri < toRi);
    const blocks = mid.map((n) => [n.x - n.w / 2 - 14, n.x + n.w / 2 + 14]);
    for (const e of E) if (e.kind === "h" && mid.includes(e.a)) blocks.push([Math.min(e.a.x, e.b.x), Math.max(e.a.x, e.b.x)]);
    const lo = col * colW + 10, hi = (col + 1) * colW - 10;
    const cand = [want, ...blocks.flatMap(([a, b]) => [a, b])].filter((x) => x > lo && x < hi);
    return cand.filter((x) => !blocks.some(([a, b]) => x > a && x < b)).sort((p, q) => Math.abs(p - want) - Math.abs(q - want))[0] ?? lo;
  };
  for (const e of E) {
    if (e.kind === "h") continue;
    if (e.kind === "over") {
      const ch = `${e.a.col}:${e.a.ri}`, xa = P(e, e.a, "top"), xb = P(e, e.b, "top");
      e.plan = [["top", e.a, xa], ["lane", ch, 0], ["lane", ch, 1], ["top", e.b, xb]];
      e.xs = [xa, xb]; segs.push({ ch, x1: Math.min(xa, xb), x2: Math.max(xa, xb), key: "o" + e.k, e, idx: 0 });
      continue;
    }
    const { U, Lo } = e; const xu = P(e, U, "bottom"), xl = P(e, Lo, "top");
    const keyU = bus(e.r.type) ? `${U.p.id}:${e.r.type}` : "u" + e.k, keyL = bus(e.r.type) ? `${Lo.p.id}:in:${e.r.type}` : "l" + e.k;
    if (U.col === Lo.col && Lo.ri === U.ri + 1) {
      const ch = `${U.col}:${Lo.ri}`;
      e.pts = [[xu, "B", U], [xu, ch, 0], [xl, ch, 0], [xl, "T", Lo]];
      segs.push({ ch, x1: Math.min(xu, xl), x2: Math.max(xu, xl), key: keyU, key2: keyL, e, idx: 0 });
    } else {
      const ch1 = `${U.col}:${U.ri + 1}`, ch2 = `${Lo.col}:${Lo.ri}`;
      let xm;
      if (U.col === Lo.col) xm = freeX(U.col, U.ri, Lo.ri, (xu + xl) / 2);
      else { const g = (gutterUse[U.col] = (gutterUse[U.col] || 0) + 1); xm = (U.col + 1) * colW + (g % 2 ? 1 : -1) * Math.ceil(g / 2) * 9 - (g % 2 ? 4 : -4); }
      e.pts = [[xu, "B", U], [xu, ch1, 0], [xm, ch1, 0], [xm, ch2, 1], [xl, ch2, 1], [xl, "T", Lo]];
      segs.push({ ch: ch1, x1: Math.min(xu, xm), x2: Math.max(xu, xm), key: keyU, e, idx: 0 });
      segs.push({ ch: ch2, x1: Math.min(xm, xl), x2: Math.max(xm, xl), key: keyL, e, idx: 1 });
    }
  }
  // 통로마다 가로 구간에 차선 배정(같은 부모의 자녀 선은 한 차선을 함께 써서 계보도 모양)
  const lanesIn = {};
  const byCh = {};
  for (const s of segs) (byCh[s.ch] ||= []).push(s);
  for (const [ch, list] of Object.entries(byCh)) {
    const groups = [];
    for (const s of list) {
      const g = groups.find((g) => g.keys.has(s.key) || (s.key2 && g.keys.has(s.key2)));
      if (g) { g.items.push(s); g.keys.add(s.key); if (s.key2) g.keys.add(s.key2); g.x1 = Math.min(g.x1, s.x1); g.x2 = Math.max(g.x2, s.x2); }
      else groups.push({ items: [s], keys: new Set([s.key, s.key2].filter(Boolean)), x1: s.x1, x2: s.x2 });
    }
    groups.sort((a, b) => a.x1 - b.x1 || b.x2 - a.x2);
    const used = [];
    for (const g of groups) {
      let lane = 0; while ((used[lane] || []).some(([a, b]) => g.x1 < b + 14 && g.x2 > a - 14)) lane++;
      (used[lane] ||= []).push([g.x1, g.x2]); for (const s of g.items) s.lane = lane;
    }
    lanesIn[ch] = used.length;
  }
  // 줄 높이: 통로 높이 = 위 여백 + 차선 + 관계 낱말 자리
  const chH = (col, ri) => { const n = lanesIn[`${col}:${ri}`] || 0; const last = ri === linesIn(col); if (ri === 0) return n ? 16 + n * LANE + LABEL_ZONE : 22; if (last) return n ? 16 + n * LANE + 12 : 20; return 16 + Math.max(1, n) * LANE + LABEL_ZONE; };
  const top = {}; let H = 0;
  for (let col = 0; col < cols; col++) {
    let y = chH(col, 0);
    for (let ri = 0; ri < linesIn(col); ri++) { top[lineOfCol(col, ri)] = y; y += BOX_H + chH(col, ri + 1); }
    H = Math.max(H, y);
  }
  const chTop = (ch) => { const [col, ri] = ch.split(":").map(Number); return ri === 0 ? 0 : top[lineOfCol(col, ri - 1)] + BOX_H; };
  const laneY = (ch, lane) => chTop(ch) + 16 + lane * LANE;
  for (const n of Object.values(node)) { n.y = top[n.li]; n.box = { x: n.x - n.w / 2, y: n.y, w: n.w, h: BOX_H }; }
  // 경로 좌표
  for (const e of E) {
    const st = e.st;
    if (e.kind === "h") { const [l, r] = e.a.x < e.b.x ? [e.a, e.b] : [e.b, e.a]; const y = l.y + BOX_H / 2; e.path = [[l.x + l.w / 2, y], [r.x - r.w / 2, y]]; if (e.a.x > e.b.x) e.path.reverse(); continue; }
    if (e.kind === "over") { const s = segs.find((s) => s.e === e); const y = laneY(s.ch, s.lane); e.path = [[e.xs[0], e.a.y], [e.xs[0], y], [e.xs[1], y], [e.xs[1], e.b.y]]; continue; }
    const my = segs.filter((s) => s.e === e);
    const pts = e.pts.map(([x, c, i]) => [x, c === "B" ? i.y + BOX_H : c === "T" ? i.y : laneY(c, my[i].lane)]);
    e.path = e.up ? pts.reverse() : pts;
    void st;
  }
  return { ...L, E, H, node };
}

// 관계 낱말 자리: 들어가는 마지막 세로 구간 → 가로 구간 → 나머지
function placeTags(G) {
  const { E, node, W, H } = G;
  const boxes = Object.values(node).map((n) => n.box);
  const segBox = (p, q) => ({ x: Math.min(p[0], q[0]) - 1.5, y: Math.min(p[1], q[1]) - 1.5, w: Math.abs(p[0] - q[0]) + 3, h: Math.abs(p[1] - q[1]) + 3 });
  const lines = E.flatMap((e) => e.path.slice(1).map((q, i) => ({ e, b: segBox(e.path[i], q) })));
  const tags = [], seen = new Map();
  for (const e of E) {
    if (!e.r.label) continue;
    const w = tagW(e.r.label), h = TAG_H;
    const end = e.path.at(-1), pre = e.path.at(-2);
    const dk = e.kind === "down" ? `${Math.round(end[0])}:${Math.round(end[1])}:${e.r.label}:${e.r.type}` : null;
    if (dk && seen.has(dk)) { e.tag = seen.get(dk); continue; }
    const cands = [];
    const along = (p, q, n) => { for (let i = 0; i <= n; i++) { const t = n ? 0.5 + (i % 2 ? 1 : -1) * Math.ceil(i / 2) / (n + 1) : 0.5; cands.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); } };
    if (e.kind === "h") { along(e.path[0], e.path[1], 0); const [p, q] = e.path, mx = (p[0] + q[0]) / 2, y = p[1]; for (const dy of [-(BOX_H / 2 + h / 2 + 5), BOX_H / 2 + h / 2 + 5, -(BOX_H / 2 + h + 12), BOX_H / 2 + h + 12]) for (const dx of [0, -24, 24, -48, 48]) cands.push([mx + dx, y + dy]); }
    else { along(pre, end, 4); for (let i = e.path.length - 2; i > 0; i--) along(e.path[i - 1], e.path[i], 8); }
    const fits = (c, strict) => { const b = { x: c[0] - w / 2, y: c[1] - h / 2, w, h }; if (b.x < 3 || b.y < 3 || b.x + w > W - 3 || b.y + h > H - 3) return null; if (boxes.some((o) => hit(b, o, 3)) || tags.some((o) => hit(b, o, 3))) return null; if (strict && lines.some((l) => l.e !== e && hit(b, l.b, 1))) return null; return b; };
    let b = null;
    for (const c of cands) if ((b = fits(c, true))) break;
    if (!b) for (const c of cands) if ((b = fits(c, false))) break;
    let lead = null;
    if (!b) { // 가까운 빈자리 + 지시선
      const [cx, cy] = cands[0]; let best = null;
      for (let y = 4; y + h < H - 3; y += 5) for (let x = 4; x + w < W - 3; x += 6) { const bb = { x, y, w, h }; if (boxes.some((o) => hit(bb, o, 3)) || tags.some((o) => hit(bb, o, 3)) || lines.some((l) => hit(bb, l.b, 1))) continue; const d = Math.hypot(x + w / 2 - cx, y + h / 2 - cy); if (!best || d < best.d) best = { ...bb, d }; }
      if (!best) throw new Error("관계 낱말 자리를 찾지 못함: " + e.r.label);
      b = { x: best.x, y: best.y, w, h }; lead = [cx, cy];
    }
    const t = { ...b, t: e.r.label, c: e.st.stroke, lead }; tags.push(t); e.tag = t; if (dk) seen.set(dk, t);
  }
  return tags;
}

// 한 세대가 두 줄 이상으로 나뉜 곳: 그 줄들을 옅은 띠로 묶는다
function genBands(G) {
  const out = [];
  for (let li = 0; li < G.lines.length; li++) {
    let lj = li; while (lj + 1 < G.lines.length && G.lineGen[lj + 1] === G.lineGen[li] && Math.floor((lj + 1) / G.perCol) === Math.floor(li / G.perCol)) lj++;
    if (lj > li) { const ns = Object.values(G.node).filter((n) => n.li >= li && n.li <= lj); const col = ns[0].col; const y0 = Math.min(...ns.map((n) => n.y)) - 8, y1 = Math.max(...ns.map((n) => n.y)) + BOX_H + 8; out.push({ x: col * G.colW + 8, y: y0, w: G.colW - 16, h: y1 - y0 }); }
    li = lj;
  }
  return out;
}
export const hasGenBand = (people, relations) => genBands(relationGeometry(people, relations)).length > 0;
export function relationSvg(people, relations) {
  const G = relationGeometry(people, relations);
  const tags = placeTags(G);
  const { E, node, W, H } = G;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f1(W)} ${f1(H)}" class="relsvg">`,
    `<defs>` + Object.entries(REL).map(([k, s]) => `<marker id="rar-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="${s.stroke}"/></marker>`).join("") + `</defs>`,
    `<rect width="${f1(W)}" height="${f1(H)}" rx="12" fill="#fbf7ec"/>`, ...genBands(G).map((b) => `<rect x="${f1(b.x)}" y="${f1(b.y)}" width="${f1(b.w)}" height="${f1(b.h)}" rx="10" fill="#efe3c4" fill-opacity=".55"/>`)];
  // 같은 길을 겹쳐 지나가는 선(계보 줄기)은 한 번만
  const drawn = new Set();
  for (const e of E) {
    const st = e.st, dash = st.dash ? ` stroke-dasharray="${st.dash}"` : "";
    const mk = e.r.directed ? ` marker-end="url(#rar-${REL[e.r.type] ? e.r.type : "other"})"` : "";
    if (e.kind === "h" && st.double) {
      const [p, q] = e.path; out.push(`<line x1="${f1(p[0])}" y1="${f1(p[1] - 2.6)}" x2="${f1(q[0])}" y2="${f1(q[1] - 2.6)}" stroke="${st.stroke}" stroke-width="1.8"/><line x1="${f1(p[0])}" y1="${f1(p[1] + 2.6)}" x2="${f1(q[0])}" y2="${f1(q[1] + 2.6)}" stroke="${st.stroke}" stroke-width="1.8"/>`);
      continue;
    }
    const d = roundPath(e.path);
    const k = d + st.stroke + dash + mk; if (drawn.has(k)) continue; drawn.add(k);
    out.push(`<path d="${d}" fill="none" stroke="${st.stroke}" stroke-width="${st.width}" stroke-linejoin="round"${dash}${mk}/>`);
  }
  for (const n of Object.values(node)) {
    const { x, y, w, p } = n;
    const [fill, stroke, color, band] = p.role === "god" ? ["#1c284e", "#c9973b", "#f6e7c1", "#c9973b"] : p.role === "enemy" ? ["#fff4f2", "#c0392b", "#7a1f16", "#c0392b"] : ["#fffdf7", "#b39a5f", "#18233f", "#c9973b"];
    out.push(`<rect x="${f1(x - w / 2 + 1.5)}" y="${f1(y + 2.5)}" width="${f1(w)}" height="${BOX_H}" rx="12" fill="#5a4a2a" fill-opacity=".14"/><rect x="${f1(x - w / 2)}" y="${f1(y)}" width="${f1(w)}" height="${BOX_H}" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/><rect x="${f1(x - w / 2 + 12)}" y="${f1(y)}" width="${f1(w - 24)}" height="4" rx="2" fill="${band}"/>`);
    out.push(`<text x="${f1(x)}" y="${f1(y + BOX_H / 2 + NAME * 0.36)}" text-anchor="middle" font-size="${NAME}" font-weight="700" font-family="Noto Sans KR" fill="${color}">${esc(p.name)}</text>`);
  }
  for (const t of tags) if (t.lead) out.push(`<line x1="${f1(t.lead[0])}" y1="${f1(t.lead[1])}" x2="${f1(t.x + t.w / 2)}" y2="${f1(t.y + t.h / 2)}" stroke="${t.c}" stroke-width="1" stroke-dasharray="2 2"/>`);
  for (const t of tags) out.push(`<rect x="${f1(t.x)}" y="${f1(t.y)}" width="${f1(t.w)}" height="${f1(t.h)}" rx="${f1(t.h / 2)}" fill="#fff" stroke="${t.c}" stroke-width="1.2"/><text x="${f1(t.x + t.w / 2)}" y="${f1(t.y + t.h / 2 + TAG * 0.36)}" text-anchor="middle" font-size="${TAG}" font-weight="500" font-family="Noto Sans KR" fill="${t.c}">${esc(t.t)}</text>`);
  out.push(`</svg>`);
  return out.join("");
}

// 겹침 검사: 글자 상자끼리, 글자와 인물 상자, 선이 다른 인물 상자를 지나가는지, 그림 밖으로 나가는지
export function relationIssues(people, relations) {
  const G = relationGeometry(people, relations); const tags = placeTags(G);
  const { E, node, W, H } = G; const issues = [];
  const boxes = Object.values(node);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (hit(boxes[i].box, boxes[j].box, 4)) issues.push(`인물 상자 겹침 ${boxes[i].p.name}/${boxes[j].p.name}`);
  for (const n of boxes) if (textW(n.p.name, NAME) > n.w - 12) issues.push(`이름이 상자보다 김 ${n.p.name}`);
  for (let i = 0; i < tags.length; i++) {
    for (let j = i + 1; j < tags.length; j++) if (hit(tags[i], tags[j], 1)) issues.push(`관계 낱말 겹침 ${tags[i].t}/${tags[j].t}`);
    for (const n of boxes) if (hit(tags[i], n.box, 1)) issues.push(`관계 낱말이 인물 상자에 걸침 ${tags[i].t}/${n.p.name}`);
    const t = tags[i]; if (t.x < 0 || t.y < 0 || t.x + t.w > W || t.y + t.h > H) issues.push(`관계 낱말이 그림 밖 ${t.t}`);
  }
  for (const e of E) for (let i = 1; i < e.path.length; i++) {
    const [p, q] = [e.path[i - 1], e.path[i]];
    for (const n of boxes) {
      if (n === e.a || n === e.b) continue;
      const b = n.box, x1 = Math.min(p[0], q[0]), x2 = Math.max(p[0], q[0]), y1 = Math.min(p[1], q[1]), y2 = Math.max(p[1], q[1]);
      if (x2 > b.x + 1 && x1 < b.x + b.w - 1 && y2 > b.y + 1 && y1 < b.y + b.h - 1) issues.push(`선이 다른 인물 상자를 지나감 ${e.r.from}→${e.r.to} / ${n.p.name}`);
    }
  }
  return { issues, W, H };
}
