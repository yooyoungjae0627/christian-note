// 인물 관계도 4판(사용자 지시 2026-11-02: "한 장을 할애해도 좋으니 네모 칸보다는 캐릭터로 대체하고, 그 캐릭터 인물 소개를 핵심적인 것들을 적어서")
// 인물마다 초상(portraitart.mjs, 만화와 같은 외모표) + 이름 + 핵심 소개(intro) 두 줄. 3판 규칙(크게, 겹침 없이, 선은 단순하게)은 그대로.
// 선은 가계만 긋는다 — 부부(옆자리 이중선), 부모→자녀(바로 아래 줄로 내리는 버스선), 옆자리끼리의 짧은 관계선.
// 그 밖의 관계(하나님·천사와의 관계, 떨어진 자리끼리의 관계)는 선 없이 그림 아래 표에만 싣는다.
import { REL, textW } from "./rel.mjs";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// 인물 칸: 초상 원(반지름 PR) 아래 이름, 그 아래 소개 LINES줄. MID = 초상 가운데 높이(옆자리 선·부부 선이 지나는 높이)
// 2026-11-02 전수 조사(「알아볼 수 있게 크게」): 초상을 줄이고(58→42) 소개 글자를 키움(19→22). 옆으로 넓은 관계도는 소개를 세 줄로 접어 칸을 좁힌다(familyGeometry가 둘 중 글자가 큰 쪽을 고름)
const NAME = 30, INTRO = 22, PR = 42, MID = 8 + PR, COL_GAP = 30, PAD = 16, TOP = 14, LANE = 16, TAG = 17, SHELF = 900, SHELF_GAP = 44;
let LINES = 2, BOX_H = 0, WRAP = false;
// 자녀 두 줄(WRAP): 자녀가 다섯 이상이고 모두 끝 세대(혼자, 자녀 없음)면 반씩 두 줄로 — 둘째 줄은 첫 줄 왼쪽 옆 빗살선으로 내려간다(49장 야곱의 열두 아들)
const COMB = 26;
const setLines = (n) => { LINES = n; BOX_H = 8 + PR * 2 + 36 + 8 + (INTRO + 6) * n + 14; };
setLines(2);
const boxW = (p) => Math.max(LINES > 2 ? 140 : 178, textW(p.name, NAME) + 24, ...introLines(p).map((l) => textW(l, INTRO) + 16));
// 소개 두 줄: 「 · 」에서 나누고, 없으면 가운데 가까운 띄어쓰기에서. 세 줄 모드는 낱말을 고르게 세 줄로
export function introLines(p, lines = LINES) {
  const t = (p.intro || p.part || "").trim();
  if (!t) return [];
  if (lines > 2 && [...t].length > 8) {
    const words = t.replace(/ · /g, " ").split(" "), goal = [...t].length / 3, out = [""];
    for (const w of words) { const cur = out.at(-1); if (cur && [...cur].length + [...w].length / 2 > goal && out.length < 3) out.push(w); else out[out.length - 1] = cur ? cur + " " + w : w; }
    return out;
  }
  if (t.includes(" · ")) { const i = t.indexOf(" · "); return [t.slice(0, i), t.slice(i + 3)]; }
  if ([...t].length <= 10) return [t];
  const mid = t.length / 2, sp = [...t.matchAll(/ /g)].map((m) => m.index).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
  return sp === undefined ? [t] : [t.slice(0, sp), t.slice(sp + 1)];
}
const tagW = (t) => textW(t, TAG) + 16;

// 옆자리 두 사람 사이에 그을 관계 하나(부부 먼저, 하나님·천사와 부모 관계는 빼고)
function sideRel(relations, byId, a, b) {
  const rs = relations.filter((r) => ((r.from === a && r.to === b) || (r.from === b && r.to === a)) && r.type !== "parent" && byId[r.from].role !== "god" && byId[r.to].role !== "god");
  return rs.find((r) => r.type === "spouse") || rs[0] || null;
}

// 선마다 관계 낱말(사용자 지시 2026-11-02 "관계성이 있는 부분에 설명도 적어야 한다. 예를 들어 아담 - 이브 부부"): 부부 선에도 「부부」, 자녀 선마다 「아들」·「딸」
const relLabel = (r) => (r.type === "spouse" ? "부부" : r.label || "");
// 대를 건너뛴 가계(손자·후손 등): 바로 윗줄의 조상 밑에 점선으로 잇는다(2026-11-02 — 선 없이 떠 있던 에벨)
const LINEAGE = /^(손자|손녀|후손|자손|증손|조상)$/, LINEAGE_DASH = "7 5";
const isLineage = (r, byId) => r.type === "kin" && LINEAGE.test(r.label || "") && Math.abs(byId[r.from].row - byId[r.to].row) === 1;

// 배치: 계보도(tidy tree) — 부부는 한 묶음, 묶음마다 자손 전체가 차지하는 폭을 먼저 재고, 부모를 자녀들 가운데 위에 둔다.
// 자손 묶음끼리 세로 띠가 겹치지 않으므로 부모→자녀 선이 서로 엇갈리지 않는다(2026-11-02 — 함의 선이 솀의 선을 지나가던 문제).
// 부부 묶음마다 좌우를 뒤집어 보고(최대 2^6) 선 엇갈림·상자 겹침이 가장 적은 배치를 고른다 — 다른 집에서 온 배우자(사위 등)를 바깥쪽으로
export function familyGeometry(people, relations) {
  // 소개 두 줄/세 줄 × 자녀 한 줄/두 줄 중 글자가 가장 큰 배치(세 줄·두 줄 접기는 3% 넘게 커질 때만)
  let best = null;
  for (const [lines, wrap] of [[2, false], [3, false], [2, true], [3, true]]) {
    setLines(lines); WRAP = wrap;
    const G = geometryFor(people, relations), s = fitScale(G) * (lines > 2 ? 0.97 : 1) * (wrap ? 0.97 : 1);
    if (!best || s > best.s) best = { s, lines, wrap, G };
  }
  setLines(best.lines); WRAP = best.wrap;
  return best.G;
}
const fitScale = (G) => Math.min(BOX_MM[0] / G.W, BOX_MM[1] / G.H);
function geometryFor(people, relations) {
  let best = null;
  const tries = 2 ** Math.min(6, layoutOnce(people, relations, 0).couples);
  for (let flip = 0; flip < tries && best?.n !== 0; flip++) {
    const G = layoutOnce(people, relations, flip), n = geometryIssues(G).length;
    if (!best || n < best.n) best = { G, n };
  }
  return fold(best.G);
}

// 선이 시작하는 자리: 부부는 두 사람 사이, 아니면 부모 칸 아래. 자녀 둘째 줄은 첫 줄 버스에서 첫 줄 왼쪽 옆으로
const combX = (g) => Math.min(...[...g.main.kids].map((k) => k.x)) - COMB / 2;
function setAnchors(gs) {
  for (const g of gs) {
    if (g.main) continue;
    const [p1, p2] = g.ps;
    g.anchors = g.sp ? [{ x: (Math.min(p1.x + p1.w, p2.x + p2.w) + Math.max(p1.x, p2.x)) / 2, y: p1.y + MID }] : g.ps.map((p) => ({ x: p.cx, y: p.y + BOX_H }));
  }
  for (const g of gs) if (g.main) g.anchors = [{ x: combX(g), y: g.main.busY }];
}
// 접기(사용자 지시 2026-11-02 「알아볼 수 있게 크게」 「한 페이지에 모두」): 세대가 길어 그림이 세로로만 길면(5장 아담→노아 11대 등)
// 세대 줄을 2–4칸으로 나눠 옆으로 나란히 놓는다. 칸을 넘어가는 부모→자녀 선은 앞 칸 맨 아래 → 칸 사이 통로 → 다음 칸 맨 위로 잇는다.
// 그림 칸(쪽 안) 116×146mm에서 글자가 가장 커지는 나눔을 고르고, 5% 넘게 커질 때만 접는다.
const BOX_MM = [116, 156], PANEL_GAP = 64, CROSS_LANE = 14, CROSS_TOP = 18 + LANE + TAG + 34;
function fold(G) {
  const n = G.rows.length;
  if (n < 3) return G;
  const scale = (W, H) => Math.min(BOX_MM[0] / W, BOX_MM[1] / H);
  const base = fitScale(G);
  const inRow = G.rows.map((_, i) => G.people.filter((p) => p.ri === i));
  const ext = (a, b) => { const ps = inRow.slice(a, b + 1).flat(); return [Math.min(...ps.map((p) => p.x)), Math.max(...ps.map((p) => p.x + p.w))]; };
  const crossAt = (c) => G.groups.filter((g) => g.row === c - 1); // c = 다음 칸 첫 줄 — 그 바로 윗줄에서 내려오는 선은 모두 칸을 넘는다
  const measure = (cuts) => {
    const segs = [0, ...cuts, n].slice(0, -1).map((a, i) => [a, [...cuts, n][i] - 1]);
    let W = PAD * 2, H = 0, nc = 0;
    segs.forEach(([a, b], j) => {
      const [x0, x1] = ext(a, b), cin = j ? crossAt(a).length : 0, cout = j < segs.length - 1 ? crossAt(b + 1).length : 0;
      nc += cout;
      W += x1 - x0 + (j ? PANEL_GAP + cin * CROSS_LANE : 0);
      H = Math.max(H, G.rows[b].y - G.rows[a].y + BOX_H + (cout ? G.rows[b].gap : 0) + (cin ? CROSS_TOP : 0) + TOP * 2);
    });
    return { segs, W: Math.max(W, G.W), H, s: scale(Math.max(W, G.W), H) * (1 - 0.02 * nc) };
  };
  let best = null;
  const pick = (cuts) => { const m = measure(cuts); if (!best || m.s > best.s) best = m; };
  for (let a = 1; a < n; a++) { pick([a]); for (let b = a + 1; b < n; b++) { pick([a, b]); for (let c = b + 1; c < n; c++) pick([a, b, c]); } }
  if (!best || best.s < base * 1.05) return G;
  // 옮기기: 칸마다 x는 앞 칸 오른쪽 + 통로, y는 칸 맨 위에서 다시
  const used = best.segs.reduce((a, [s, e], j) => a + ext(s, e)[1] - ext(s, e)[0] + (j ? PANEL_GAP + crossAt(s).length * CROSS_LANE : 0), 0);
  let X = (best.W - used) / 2;
  const panels = [];
  best.segs.forEach(([a, b], j) => {
    const cin = j ? crossAt(a) : [];
    if (j) X += PANEL_GAP + cin.length * CROSS_LANE;
    const [x0, x1] = ext(a, b), dx = X - x0, dy = TOP + (cin.length ? CROSS_TOP : 0) - G.rows[a].y;
    for (let i = a; i <= b; i++) { G.rows[i].y += dy; for (const p of inRow[i]) { p.x += dx; p.cx += dx; p.y += dy; } }
    panels.push({ a, b, left: X, right: X + (x1 - x0) });
    X += x1 - x0;
  });
  for (const g of G.groups) g.busY = G.rows[g.row].y + BOX_H + g.busOff;
  setAnchors(G.groups);
  panels.forEach((pn, j) => {
    if (!j) return;
    crossAt(pn.a).forEach((g, k) => { g.cross = { gx: panels[j - 1].right + PANEL_GAP / 2 + k * CROSS_LANE, ty: TOP + 18 + k * LANE }; });
  });
  G.W = best.W; G.H = best.H; G.folded = panels.length;
  return G;
}
function layoutOnce(people, relations, flip) {
  const byId = Object.fromEntries(people.map((p) => [p.id, { ...p }]));
  for (const r of relations) if (!byId[r.from] || !byId[r.to]) throw new Error(`관계도 인물 없음: ${r.from}→${r.to}`);
  for (const r of relations) if (r.type === "spouse") { const a = byId[r.from], b = byId[r.to]; a.gen = b.gen = Math.min(a.gen ?? 0, b.gen ?? 0); }
  const gens = [...new Set(Object.values(byId).map((p) => p.gen ?? 0))].sort((a, b) => a - b);
  for (const p of Object.values(byId)) { p.row = gens.indexOf(p.gen ?? 0); p.w = boxW(p); }
  const spouseOf = {}, parentsOf = {};
  for (const r of relations) if (r.type === "spouse") { (spouseOf[r.from] ||= []).push(r.to); (spouseOf[r.to] ||= []).push(r.from); }
  for (const r of relations) if (r.type === "parent") (parentsOf[r.to] ||= []).push(r.from);
  // 윗줄과 잇는 줄: 바로 윗줄의 부모, 없으면 바로 윗줄의 조상(점선)
  const up = {};
  for (const p of Object.values(byId)) {
    const ps = (parentsOf[p.id] || []).filter((q) => byId[q].row === p.row - 1);
    if (ps.length) { up[p.id] = { ids: ps, rel: null }; continue; }
    const r = relations.find((r) => isLineage(r, byId) && (r.from === p.id || r.to === p.id) && byId[r.from === p.id ? r.to : r.from].row === p.row - 1);
    if (r) up[p.id] = { ids: [r.from === p.id ? r.to : r.from], rel: r };
  }
  // 줄마다 묶음(부부는 옆자리 한 묶음)
  const units = [], unitOf = {};
  for (let ri = 0; ri < gens.length; ri++) {
    for (const p of people) {
      const id = p.id; if (byId[id].row !== ri || unitOf[id]) continue;
      const u = { row: ri, ids: [id], kids: [] }; unitOf[id] = u;
      // 배우자의 배우자까지(레아 → 야곱 → 라헬: 아내가 둘이면 세 사람이 한 묶음 — 2026-11-02 30장 라헬이 떨어져 나가던 문제)
      for (let j = 0; j < u.ids.length; j++) for (const s of spouseOf[u.ids[j]] || []) if (byId[s].row === ri && !unitOf[s]) { u.ids.push(s); unitOf[s] = u; }
      // 아내가 둘 이상이면 남편을 가운데, 아내들을 양옆에(각 아내의 자녀가 그 아내 쪽 아래로)
      const hub = u.ids.find((x) => u.ids.filter((y) => (spouseOf[x] || []).includes(y)).length >= 2);
      if (hub) {
        const ws = u.ids.filter((x) => x !== hub), wp = ws.map((w) => up[w]?.ids.join() || "");
        // 아내들이 한 아버지의 딸들(레아·라헬)이고 남편의 부모가 다르면 남편을 끝에 — 가운데 두면 두 집 선이 엇갈린다(31장)
        if (wp[0] && wp.every((x) => x === wp[0]) && (up[hub]?.ids.join() || "") !== wp[0]) u.ids = [hub, ...ws];
        else u.ids = [...ws.filter((_, i) => i % 2 === 1).reverse(), hub, ...ws.filter((_, i) => i % 2 === 0)];
      }
      if (flip & (1 << units.filter((v) => v.ids.length > 1).length) && u.ids.length > 1) u.ids.reverse();
      units.push(u);
    }
  }
  for (const u of units) { const c = u.ids.find((id) => up[id]); u.parent = c ? unitOf[up[c].ids[0]] : null; if (u.parent) u.parent.kids.push(u); }
  // 자녀 묶음 순서: 부모 묶음 안에서 그 자녀의 부모가 선 자리 순서(엄마 쪽 아래로)
  for (const u of units) {
    const pos = (k) => { const ps = k.ids.flatMap((id) => up[id] ? up[id].ids : []).filter((q) => u.ids.includes(q)); return ps.length ? ps.reduce((a, q) => a + u.ids.indexOf(q), 0) / ps.length : 0; };
    u.kids = u.kids.map((k, i) => ({ k, i, p: pos(k) })).sort((a, b) => a.p - b.p || a.i - b.i).map((t) => t.k);
  }
  const gap = (a, b) => { const r = sideRel(relations, byId, a, b); return r && relLabel(r) ? Math.max(COL_GAP, tagW(relLabel(r)) + 22) : COL_GAP; };
  const selfW = (u) => u.ids.reduce((a, id) => a + byId[id].w, 0) + u.ids.slice(1).reduce((a, id, i) => a + gap(u.ids[i], id), 0);
  const kidLines = (u) => { const n = u.kids.length; if (!WRAP || n < 5 || !u.kids.every((k) => k.ids.length === 1 && !k.kids.length)) return [u.kids]; const h = Math.ceil(n / 2); return [u.kids.slice(0, h), u.kids.slice(h)]; };
  const lineW = (ks) => ks.reduce((a, k) => a + k.sw, 0) + ks.slice(1).reduce((a, k, i) => a + gap(ks[i].ids.at(-1), k.ids[0]), 0);
  const kidsW = (u) => { const ls = kidLines(u); return ls.length > 1 ? Math.max(...ls.map(lineW)) + COMB : lineW(u.kids); };
  const measure = (u) => { u.kids.forEach(measure); u.sw = Math.max(selfW(u), kidsW(u)); };
  const roots = units.filter((u) => !u.parent);
  roots.forEach(measure);
  const putSelf = (u, x) => { for (const [i, id] of u.ids.entries()) { const p = byId[id]; p.x = x; p.cx = x + p.w / 2; x += p.w + (i < u.ids.length - 1 ? gap(id, u.ids[i + 1]) : 0); } };
  const center = (u) => (byId[u.ids[0]].x + byId[u.ids.at(-1)].x + byId[u.ids.at(-1)].w) / 2;
  const place = (u, x0) => {
    const sw = selfW(u);
    if (!u.kids.length) return putSelf(u, x0 + (u.sw - sw) / 2);
    const ls = kidLines(u), lx = x0 + (u.sw - kidsW(u)) / 2 + (ls.length > 1 ? COMB : 0);
    ls.forEach((ks, li) => {
      let x = lx;
      ks.forEach((k, i) => { place(k, x); x += k.sw + (i < ks.length - 1 ? gap(k.ids.at(-1), ks[i + 1].ids[0]) : 0); if (li) { k.row = u.row + 2; byId[k.ids[0]].row = u.row + 2; } });
    });
    const mid = (center(ls[0][0]) + center(ls[0].at(-1))) / 2;
    putSelf(u, Math.min(Math.max(mid - sw / 2, x0), x0 + u.sw - sw));
  };
  // 집안 블록: 다른 뿌리와 부모 선으로 이어진 뿌리(사위·며느리의 친정 등)는 한 블록으로 붙여 둔다
  const rootOf = (u) => { while (u.parent) u = u.parent; return u; };
  const comp = new Map(roots.map((r) => [r, r]));
  const find = (r) => (comp.get(r) === r ? r : find(comp.get(r)));
  for (const p of Object.values(byId)) for (const q of up[p.id]?.ids || []) { const a = find(rootOf(unitOf[p.id])), b = find(rootOf(unitOf[q])); if (a !== b) comp.set(b, a); }
  const blocks = [];
  for (const r of roots) { const k = find(r); let b = blocks.find((x) => x.k === k); if (!b) blocks.push((b = { k, roots: [] })); b.roots.push(r); }
  for (const b of blocks) b.w = b.roots.reduce((a, r) => a + r.sw, 0) + (b.roots.length - 1) * COL_GAP * 1.5;
  // 선반(한 쪽 세로로 쌓기): 폭 SHELF까지 블록을 옆으로, 넘치면 다음 선반 — 그림이 옆으로만 길어져 글자가 작아지지 않게(한 쪽을 다 써도 됨)
  const limit = Math.max(SHELF, ...blocks.map((b) => b.w)), shelves = [];
  // 선이 하나도 없는 혼자인 사람(하나님·천사·이름만 나오는 사람)은 선반을 따로 차지하지 않고 다른 집안 줄 옆 빈자리에(2026-11-02 전수 조사 — 29장 「주」가 한 줄을 통째로 쓰던 문제)
  const isLone = (b) => b.roots.length === 1 && b.roots[0].ids.length === 1 && !b.roots[0].kids.length;
  const lone = blocks.some((b) => !isLone(b)) ? blocks.filter(isLone) : [];
  for (const b of blocks) { if (lone.includes(b)) continue; const sh = shelves.at(-1); if (sh && sh.w + COL_GAP * 2 + b.w <= limit) { sh.blocks.push(b); sh.w += COL_GAP * 2 + b.w; } else shelves.push({ blocks: [b], w: b.w }); }
  const unitsOfRoot = (r) => [r, ...r.kids.flatMap(unitsOfRoot)];
  const W = limit + PAD * 2;
  for (const [si, sh] of shelves.entries()) {
    let X = PAD + (limit - sh.w) / 2;
    for (const b of sh.blocks) {
      const bmin = Math.min(...b.roots.flatMap((r) => unitsOfRoot(r).map((u) => u.row)));
      // 집안마다 맨 윗세대를 선반 맨 위 줄에 맞춘다(서로 이어지지 않은 집안끼리 세대 번호로 계단이 지지 않게)
      for (const r of b.roots) { place(r, X); X += r.sw + COL_GAP * 1.5; for (const u of unitsOfRoot(r)) for (const id of u.ids) { byId[id].shelf = si; byId[id].lr = byId[id].row - bmin; } }
      X += COL_GAP * 0.5;
    }
  }
  for (const b of lone) {
    const p = byId[b.roots[0].ids[0]];
    let spot = null;
    for (let si = 0; si < shelves.length && !spot; si++) {
      const on = Object.values(byId).filter((q) => q.shelf === si && q !== p && q.lr !== undefined);
      const hi = Math.max(...on.map((q) => q.lr));
      for (let lr = 0; lr <= hi && !spot; lr++) {
        const rowP = on.filter((q) => q.lr === lr);
        if (!rowP.length) { spot = { si, lr, x: PAD + (limit - p.w) / 2 }; break; }
        const x0 = Math.min(...rowP.map((q) => q.x)), x1 = Math.max(...rowP.map((q) => q.x + q.w));
        if (x0 - PAD - COL_GAP * 2 >= p.w) spot = { si, lr, x: x0 - COL_GAP * 2 - p.w };
        else if (PAD + limit - x1 - COL_GAP * 2 >= p.w) spot = { si, lr, x: x1 + COL_GAP * 2 };
      }
    }
    if (!spot) { shelves.push({ blocks: [b], w: b.w }); spot = { si: shelves.length - 1, lr: 0, x: PAD + (limit - p.w) / 2 }; }
    p.x = spot.x; p.cx = p.x + p.w / 2; p.shelf = spot.si; p.lr = spot.lr;
  }
  const all = Object.values(byId);
  // 줄: 선반마다 그 선반 사람들의 세대 줄(가운데 빈 세대도 간격을 맞추려 남긴다)
  const rows = [];
  for (let si = 0; si < shelves.length; si++) {
    const rs = all.filter((p) => p.shelf === si).map((p) => p.lr), lo = Math.min(...rs), hi = Math.max(...rs);
    for (let r = lo; r <= hi; r++) { const seq = all.filter((p) => p.shelf === si && p.lr === r).sort((a, b) => a.x - b.x).map((p) => p.id); rows.push({ shelf: si, row: r, seq }); for (const id of seq) byId[id].ri = rows.length - 1; }
  }

  // 선 고르기
  const lines = [], tableOnly = [], used = new Set();
  const adj = (a, b) => a.ri === b.ri && Math.abs(rows[a.ri].seq.indexOf(a.id) - rows[b.ri].seq.indexOf(b.id)) === 1;
  for (const row of rows) row.seq.slice(1).forEach((id, i) => { const r = sideRel(relations, byId, row.seq[i], id); if (r) { lines.push({ kind: "side", r, a: byId[r.from], b: byId[r.to] }); used.add(r); } });
  const groups = new Map();
  for (const c of all) {
    const u = up[c.id]; if (!u) continue;
    if (u.rel) used.add(u.rel); else for (const r of relations) if (r.type === "parent" && r.to === c.id && u.ids.includes(r.from)) used.add(r);
    const second = c.row - byId[u.ids[0]].row === 2; // 자녀 둘째 줄
    const k0 = [...u.ids].sort().join("+") + (u.rel ? "~" + u.rel.label : ""), k = k0 + (second ? "~2" : "");
    if (!groups.has(k)) groups.set(k, { ps: [...u.ids].sort().map((q) => byId[q]), kids: new Set(), row: second ? c.ri - 1 : byId[u.ids[0]].ri, dashed: !!u.rel, label: u.rel?.label, mainKey: second ? k0 : null });
    groups.get(k).kids.add(c);
    if (!u.rel) { const pr = relations.find((r) => r.type === "parent" && r.to === c.id && u.ids.includes(r.from)); (groups.get(k).kl ||= new Map()).set(c.id, pr?.label || ""); }
  }
  for (const r of relations) if (!used.has(r)) tableOnly.push(r);

  for (const g of groups.values()) if (g.mainKey) { g.main = groups.get(g.mainKey); (g.main.combs ||= []).push(g); }
  // 버스선 자리: 가로로 겹치는 묶음만 다른 칸에
  const perRow = {};
  for (const g of [...groups.values()].sort((a, b) => !!a.main - !!b.main)) {
    if (g.main) { const cx = combX(g); g.ax = [cx]; g.l = cx; g.r = Math.max(...[...g.kids].map((k) => k.cx)); g.main.l = Math.min(g.main.l, cx); (perRow[g.row] ||= []).push(g); continue; }
    const [p1, p2] = g.ps;
    const sp = p2 && adj(p1, p2) && (spouseOf[p1.id] || []).includes(p2.id);
    g.sp = sp;
    const ax = sp ? [(Math.min(p1.x + p1.w, p2.x + p2.w) + Math.max(p1.x, p2.x)) / 2] : g.ps.map((p) => p.cx);
    g.ax = ax; const xs = [...ax, ...[...g.kids].map((k) => k.cx)]; g.l = Math.min(...xs); g.r = Math.max(...xs);
    (perRow[g.row] ||= []).push(g);
  }
  let y = TOP;
  rows.forEach((row, ri) => {
    if (ri && row.shelf !== rows[ri - 1].shelf) y += SHELF_GAP;
    row.y = y;
    const gs = (perRow[ri] || []).sort((a, b) => a.l - b.l), ends = [];
    for (const g of gs) { let k = ends.findIndex((e) => e < g.l - 6); if (k < 0) { k = ends.length; ends.push(0); } ends[k] = g.r; g.busOff = 18 + k * LANE; }
    row.gap = Math.max(LANE * 2, gs.length ? LANE * (ends.length + 1) + 10 : 0, gs.length ? Math.max(...gs.map((g) => g.busOff)) + TAG + 34 : 0); // 자녀 선 위 낱말 자리
    y += BOX_H + row.gap;
  });
  for (const row of rows) for (const id of row.seq) byId[id].y = row.y;
  for (const g of groups.values()) g.busY = rows[g.row].y + BOX_H + g.busOff;
  setAnchors([...groups.values()]);
  const H = rows.at(-1).y + BOX_H + TOP;
  // 버스가 다른 선반으로 건너가지 않는지(블록을 묶었으므로 없어야 함)
  for (const g of groups.values()) for (const k of g.kids) if (k.shelf !== g.ps[0].shelf) throw new Error("관계도 선반 사이 선: " + k.name);
  return { W, H, people: all, lines, groups: [...groups.values()], tableOnly, rows, couples: units.filter((u) => u.ids.length > 1).length };
}

// img(p) → 초상 data URI(없으면 이름 첫 글자 원)
let svgSeq = 0; // 한 책에 관계도가 여럿이면 clipPath id가 겹쳐 둘째 관계도부터 초상이 비던 문제(2026-11-02) — 그림마다 다른 id
export function familySvg(people, relations, { img = () => null } = {}) {
  const G = familyGeometry(people, relations), sid = "f" + ++svgSeq + "c";
  let o = `<svg class="relsvg famtree" viewBox="0 0 ${G.W} ${G.H}" xmlns="http://www.w3.org/2000/svg" font-family="Noto Sans KR, sans-serif">`;
  // 부모→자녀 버스선(파랑, 같은 굵기, 화살표 없음)
  for (const g of G.groups) {
    const s = REL.parent; const xs = [...g.anchors.map((a) => a.x), ...[...g.kids].map((k) => k.cx), ...(g.combs || []).map((c) => c.anchors[0].x)];
    let d = g.anchors.map((a) => `M${a.x},${a.y}V${g.busY}`).join("");
    const kids = [...g.kids], top = g.cross ? g.cross.ty : g.busY;
    if (g.cross) { // 칸 넘김: 앞 칸 아래 → 통로 → 다음 칸 위
      const kx = kids.map((k) => k.cx);
      d += `M${Math.min(...g.anchors.map((a) => a.x))},${g.busY}H${g.cross.gx}V${top}H${Math.max(...kx)}`;
    } else d += `M${Math.min(...xs)},${g.busY}H${Math.max(...xs)}`;
    for (const k of kids) d += `M${k.cx},${top}V${k.y}`;
    o += `<path d="${d}" fill="none" stroke="#fff" stroke-width="${s.width + 4}" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${s.stroke}" stroke-width="${s.width}" ${g.dashed ? `stroke-dasharray="${LINEAGE_DASH}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
    // 대를 건너뛴 가계는 자손 쪽 세로선 가운데에 낱말(손자 등)
    for (const k of g.kids) { const lab = g.label || g.kl?.get(k.id); if (!lab) continue; const tw = tagW(lab), cy = (top + k.y) / 2; o += `<rect x="${k.cx - tw / 2}" y="${cy - (TAG + 8) / 2}" width="${tw}" height="${TAG + 8}" rx="${(TAG + 8) / 2}" fill="#fff" stroke="${s.stroke}" stroke-width="1"/><text x="${k.cx}" y="${cy + TAG * 0.36}" font-size="${TAG}" text-anchor="middle" fill="${s.stroke}" font-weight="700">${esc(lab)}</text>`; }
  }
  // 옆자리 관계선 + 낱말
  for (const l of G.lines) {
    const s = REL[l.r.type] || REL.other; const [L, R] = l.a.x < l.b.x ? [l.a, l.b] : [l.b, l.a];
    const x1 = L.x + L.w, x2 = R.x, y = L.y + MID;
    if (s.double) o += `<path d="M${x1},${y - 2.5}H${x2}M${x1},${y + 2.5}H${x2}" stroke="${s.stroke}" stroke-width="2"/>`;
    else {
      o += `<path d="M${x1},${y}H${x2 - (l.r.directed ? 6 : 0)}" stroke="${s.stroke}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`;
      if (l.r.directed) { const fwd = l.a === L; const ax = fwd ? x2 : x1, dir = fwd ? -1 : 1; o += `<path d="M${ax},${y}l${dir * 8},-5v10z" fill="${s.stroke}"/>`; }
    }
    const lab = relLabel(l.r);
    if (lab) { const tw = tagW(lab), cx = (x1 + x2) / 2; o += `<rect x="${cx - tw / 2}" y="${y - (TAG + 8) / 2}" width="${tw}" height="${TAG + 8}" rx="${(TAG + 8) / 2}" fill="#fff" stroke="${s.stroke}" stroke-width="1"/><text x="${cx}" y="${y + TAG * 0.36}" font-size="${TAG}" text-anchor="middle" fill="${s.stroke}" font-weight="700">${esc(lab)}</text>`; }
  }
  // 인물: 초상 원 + 이름 + 소개 두 줄. 하나님은 사람 모양 없이 금빛 빛 원(지침 §2-0)
  o += `<defs><radialGradient id="famglow"><stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#ffe7a3"/><stop offset="1" stop-color="#d9a441"/></radialGradient></defs>`;
  for (const [i, p] of G.people.entries()) {
    const god = p.role === "god", cy = p.y + MID, src = god ? null : img(p);
    o += `<circle cx="${p.cx}" cy="${cy}" r="${PR + 3}" fill="#fffdf7" stroke="${god ? "#c9973b" : "#c9a96b"}" stroke-width="3"/>`;
    if (god) o += `<circle cx="${p.cx}" cy="${cy}" r="${PR}" fill="url(#famglow)"/>` + [0, 45, 90, 135].map((d) => `<path d="M${p.cx},${cy - PR * 0.78}V${cy + PR * 0.78}" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".75" transform="rotate(${d + 22.5} ${p.cx} ${cy})"/>`).join("");
    else if (src) o += `<clipPath id="${sid}${i}"><circle cx="${p.cx}" cy="${cy}" r="${PR}"/></clipPath><image href="${src}" x="${p.cx - PR}" y="${cy - PR}" width="${PR * 2}" height="${PR * 2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${sid}${i})"/>`;
    else o += `<circle cx="${p.cx}" cy="${cy}" r="${PR}" fill="#efe4c8"/><text x="${p.cx}" y="${cy + 16}" font-size="44" font-weight="700" text-anchor="middle" fill="#8a7442">${esc([...p.name][0])}</text>`;
    const ny = p.y + 8 + PR * 2 + 36;
    o += `<text x="${p.cx}" y="${ny}" font-size="${NAME}" font-weight="800" text-anchor="middle" fill="${god ? "#8a5a10" : "#1d2338"}">${esc(p.name)}</text>`;
    introLines(p).forEach((l, k) => { o += `<text x="${p.cx}" y="${ny + 8 + (k + 1) * (INTRO + 6)}" font-size="${INTRO}" font-weight="500" text-anchor="middle" fill="#4a4a4a">${esc(l)}</text>`; });
  }
  return o + `</svg>`;
}

// 그림에 실제로 그은 선의 범례만
export function familyLegendHtml(people, relations) {
  const G = familyGeometry(people, relations);
  const types = new Set([...G.lines.map((l) => l.r.type), ...(G.groups.length ? ["parent"] : [])]);
  const chip = (t) => { const s = REL[t]; const line = s.double ? `<path d="M2,5H40M2,10H40" stroke="${s.stroke}" stroke-width="2"/>` : `<path d="M2,7.5H40" stroke="${s.stroke}" stroke-width="${s.width}" ${s.dash ? `stroke-dasharray="${s.dash}"` : ""}/>`; return `<span class="chip"><svg class="lg" viewBox="0 0 42 15">${line}</svg>${s.name}</span>`; };
  const lin = G.groups.some((g) => g.dashed) ? `<span class="chip"><svg class="lg" viewBox="0 0 42 15"><path d="M2,7.5H40" stroke="${REL.parent.stroke}" stroke-width="${REL.parent.width}" stroke-dasharray="${LINEAGE_DASH}"/></svg>대를 건너뛴 자손</span>` : "";
  const note = G.tableOnly.length ? `<span class="chip fam-note">그 밖의 관계는 아래 표에</span>` : "";
  return `<div class="rel-legend">${[...types].map(chip).join("")}${lin}${note}</div>`;
}

// 겹침 검사: 상자끼리, 낱말과 상자
export function familyIssues(people, relations) {
  const G = familyGeometry(people, relations);
  return { issues: geometryIssues(G), geometry: G };
}
function geometryIssues(G) {
  const issues = [], P = G.people;
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { const a = P[i], b = P[j]; if (a.y === b.y && a.x < b.x + b.w && b.x < a.x + a.w) issues.push(`상자 겹침 ${a.name}·${b.name}`); }
  // 선 엇갈림: 한 묶음의 세로선이 다른 묶음의 가로 버스를 지나감, 세로선이 다른 인물 상자를 지나감(2026-11-02)
  const verts = G.groups.flatMap((g) => [...g.anchors.map((a) => ({ g, x: a.x, y1: a.y, y2: g.busY })), ...[...g.kids].map((k) => ({ g, x: k.cx, y1: g.cross ? g.cross.ty : g.busY, y2: k.y }))]);
  for (const v of verts) {
    for (const h of G.groups) if (h !== v.g && v.x > Math.min(...h.anchors.map((a) => a.x), ...[...h.kids].map((k) => k.cx)) + 1 && v.x < Math.max(...h.anchors.map((a) => a.x), ...[...h.kids].map((k) => k.cx)) - 1 && h.busY > v.y1 + 1 && h.busY < v.y2 - 1) issues.push(`선 엇갈림 ${[...v.g.kids].map((k) => k.name).join("·")}↔${[...h.kids].map((k) => k.name).join("·")}`);
    for (const p of P) if (v.x > p.x && v.x < p.x + p.w && p.y + BOX_H > v.y1 + 1 && p.y < v.y2 - 1) issues.push(`선이 상자를 지나감 ${p.name}`);
  }
  return issues;
}
