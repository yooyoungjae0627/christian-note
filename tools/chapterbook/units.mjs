// 이야기 단원별 책(지침 §0-1 창세기, §0-2 사무엘상·하, §0-3 열왕기상·하, 2026-10-23) — 단원 목록과 장별 원고로 단원 원고를 만들고 검사한다.
//   node tools/chapterbook/units.mjs [genesis|1sam|2sam|1ki|2ki] make [N …] [--force]   단원 원고 만들기(있으면 건너뜀). 책을 빼면 genesis
//   node tools/chapterbook/units.mjs [genesis|1sam|2sam|1ki|2ki] check [N …]            단원 원고 검사 — 종료 코드 0이어야 빌드
//   단원 목록: Genesis/원본/단원/units.json(unitNN.json) · Samuel/원본/단원/units-1sam.json(1sam-unitNN.json) · units-2sam.json · Kings/원본/단원/units-1ki.json(1ki-unitNN.json) · units-2ki.json
// 해설·칠판·인물·지도는 장별 원고를 그대로 쓰고, 단원 원고에는 제목·표지·표어·학습 자료만 둔다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R, BOOKS, loadChapter, chapterVerses } from "./lib.mjs";
import { MOTIFS } from "./art.mjs";

// 책마다 단원 목록 위치와 원고 이름
const SPEC = {
  genesis: { dir: "Genesis/원본/단원", list: "units.json", file: (n) => `unit${n}.json` },
  "1sam": { dir: "Samuel/원본/단원", list: "units-1sam.json", file: (n) => `1sam-unit${n}.json` },
  "2sam": { dir: "Samuel/원본/단원", list: "units-2sam.json", file: (n) => `2sam-unit${n}.json` },
  "1ki": { dir: "Kings/원본/단원", list: "units-1ki.json", file: (n) => `1ki-unit${n}.json` },
  "2ki": { dir: "Kings/원본/단원", list: "units-2ki.json", file: (n) => `2ki-unit${n}.json` },
};
let BOOK = "genesis";
export let UNITS;
export function useBook(b) { if (!SPEC[b]) throw new Error("단원 책이 아님 " + b); BOOK = b; UNITS = JSON.parse(fs.readFileSync(path.join(R, SPEC[b].dir, SPEC[b].list), "utf8")); }
useBook("genesis");
export const unitFile = (n) => path.join(R, SPEC[BOOK].dir, SPEC[BOOK].file(String(n).padStart(2, "0")));
export const unitOut = (u) => `${BOOKS[BOOK].ko}_${String(u.unit).padStart(2, "0")}_${u.title.replace(/\s+/g, "_")}`;
export const unitDir = () => path.join(R, SPEC[BOOK].dir);
export const isUnitBook = (b) => !!SPEC[b];
const LIMIT = { summary: [12, 22], questions: [25, 41], faq: [12, 14], glossary: [4, 12] };

const pv = (r) => { const [c, v] = r.split(":").map(Number); return [c, v]; };
// "12:4" · "12:4-10" · "12:4, 12:6" → 첫 절 [장, 절]
const firstRef = (r) => pv(String(r).split(/[,\s]+/)[0].split("-")[0]);
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];

// 단원의 장별 조각: [{ch, from, to, full, d}] — d는 범위 안의 단락·인물·관계·지명만 남긴 원고
export function unitParts(u) {
  const [c0, v0] = pv(u.from), [c1, v1] = pv(u.to);
  const parts = [];
  for (let ch = c0; ch <= c1; ch++) {
    const last = +chapterVerses(BOOK, ch).at(-1).ref.split(":")[1];
    const from = ch === c0 ? v0 : 1, to = ch === c1 ? v1 : last;
    const full = from === 1 && to === last;
    const src = loadChapter(BOOK, ch);
    const inR = (r) => { const [c, v] = firstRef(r); return c === ch && v >= from && v <= to; };
    const secIn = (s) => { const [a, z = a] = s.ref.split(":")[1].split("-").map(Number); if ((a < from && z >= from) || (a <= to && z > to)) throw new Error(`단원 ${u.unit} 경계 ${u.from}–${u.to}가 단락 ${s.ref}를 가름`); return a >= from && z <= to; };
    const d = full ? src : { ...src, sections: src.sections.filter(secIn) };
    if (!full) {
      d.people = (src.people || []).filter((x) => x.refs.some(inR));
      const ids = new Set(d.people.map((x) => x.id));
      d.relations = (src.relations || []).filter((r) => inR(r.ref) && ids.has(r.from) && ids.has(r.to));
      if (src.map) {
        const places = (src.map.places || []).filter((x) => inR(x.ref)); const keys = new Set(places.map((x) => x.key));
        d.map = { ...src.map, places, routes: (src.map.routes || []).filter((r) => inR(r.ref)).map((r) => ({ ...r, path: r.path.filter((k) => keys.has(k)) })).filter((r) => r.path.length > 1), unknown: (src.map.unknown || []).filter((x) => inR(x.ref)) };
        if (src.map.views) d.map.views = src.map.views.map((v) => ({ ...v, keys: v.keys.filter((k) => keys.has(k)) })).filter((v) => v.keys.length);
        if (d.map.views && d.map.views.length < 2) delete d.map.views;
      }
    }
    parts.push({ ch, from, to, full, d });
  }
  return parts;
}
export const label = (p) => p.full ? `${BOOKS[BOOK].ko} ${p.ch}장` : `${BOOKS[BOOK].ko} ${p.ch}:${p.from}–${p.to}`;
export function loadUnit(n) {
  const u = UNITS.find((x) => x.unit === n); if (!u) throw new Error("없는 단원 " + n);
  const f = unitFile(n);
  return { ...u, ...(fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}), parts: unitParts(u) };
}

// 고르게 뽑기: 단원 전체에 퍼지도록 같은 간격으로
const spread = (a, n) => a.length <= n ? a : [...Array(n)].map((_, i) => a[Math.round(i * (a.length - 1) / (n - 1))]);
const uniq = (a, k) => { const s = new Set(); return a.filter((x) => { const v = k(x); if (s.has(v)) return false; s.add(v); return true; }); };

function make(u) {
  const parts = unitParts(u);
  const ids = new Set(parts.flatMap((p) => p.d.sections.flatMap((s) => s.comments.map((c) => c.id))));
  const vIn = (r) => { const x = firstRef(r); return cmp(x, pv(u.from)) >= 0 && cmp(x, pv(u.to)) <= 0; };
  const ok = (x) => x.key ? ids.has(x.key) : x.verse ? vIn(x.verse) : false;
  const pool = (k) => parts.flatMap((p) => (loadChapter(BOOK, p.ch).learning[k] || []).filter(ok));
  const learning = {
    summary: spread(uniq(pool("summary"), (x) => x.text), LIMIT.summary[1]),
    questions: spread(uniq(pool("questions"), (x) => x.q), LIMIT.questions[1]),
    faq: spread(uniq(pool("faq"), (x) => x.q), LIMIT.faq[1]),
    glossary: spread(uniq(pool("glossary"), (x) => x.term), LIMIT.glossary[1]),
  };
  // 표어·표지: 단원에 해설 문단이 다 들어간 장의 것을, 앞 장부터
  const src = parts.map((p) => loadChapter(BOOK, p.ch)).find((d) => ids.has(d.motto_comment));
  if (!src) throw new Error(`단원 ${u.unit}: 표어로 쓸 해설이 없음`);
  return { unit: u.unit, title: u.title, subtitle: u.subtitle, motto: src.motto, motto_comment: src.motto_comment, cover: src.cover, learning };
}

export function check(n) {
  const E = [];
  let u; try { u = loadUnit(n); } catch (e) { return [e.message]; }
  if (!fs.existsSync(unitFile(n))) return ["단원 원고 없음 " + unitFile(n)];
  // 이어짐: 단원 목록이 1:1부터 50:26까지 빈틈·겹침 없이
  const comments = Object.fromEntries(u.parts.flatMap((p) => p.d.sections.flatMap((s) => s.comments.map((c) => [c.id, c]))));
  for (const p of u.parts) {
    const vs = p.d.sections.flatMap((s) => { const [a, z = a] = s.ref.split(":")[1].split("-").map(Number); return [...Array(z - a + 1)].map((_, i) => a + i); });
    const want = [...Array(p.to - p.from + 1)].map((_, i) => p.from + i);
    if (JSON.stringify(vs) !== JSON.stringify(want)) E.push(`${label(p)} 단락이 범위를 빠짐없이 덮지 않음`);
  }
  if (!comments[u.motto_comment] || !comments[u.motto_comment].text.includes(u.motto)) E.push("표어가 단원 해설 문단 글자에 없음");
  for (const c of u.cover || []) if (!MOTIFS[c.m]) E.push("없는 표지 그림 " + c.m);
  if (!u.cover?.length) E.push("표지 그림 없음");
  const vIn = (r) => { const x = firstRef(r); return cmp(x, pv(u.from)) >= 0 && cmp(x, pv(u.to)) <= 0; };
  for (const [k, [lo, hi]] of Object.entries(LIMIT)) {
    const a = u.learning?.[k] || [];
    if (a.length < lo || a.length > hi) E.push(`${k} ${a.length}개(지침 ${lo}–${hi})`);
    for (const x of a) if (x.key ? !comments[x.key] : !(x.verse && vIn(x.verse))) E.push(`${k} 근거가 단원 밖: ${x.key || x.verse}`);
  }
  return E;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (SPEC[argv[0]]) useBook(argv.shift());
  const [cmd, ...rest] = argv;
  const force = rest.includes("--force");
  const ns = rest.filter((x) => x !== "--force").map(Number);
  const list = ns.length ? ns : UNITS.map((u) => u.unit);
  // 목록 전체가 책 첫 절부터 끝 절까지 빈틈없이 잇는지
  const order = UNITS.map((u) => [pv(u.from), pv(u.to)]);
  const errs = [];
  const nCh = BOOKS[BOOK].chapters, end = [nCh, +chapterVerses(BOOK, nCh).at(-1).ref.split(":")[1]];
  if (cmp(order[0][0], [1, 1]) || cmp(order.at(-1)[1], end)) errs.push(`단원 목록이 1:1–${end.join(":")}이 아님`);
  for (let i = 1; i < order.length; i++) {
    const [c, v] = order[i - 1][1]; const last = +chapterVerses(BOOK, c).at(-1).ref.split(":")[1];
    const next = v === last ? [c + 1, 1] : [c, v + 1];
    if (cmp(order[i][0], next)) errs.push(`단원 ${i}와 ${i + 1} 사이 빈틈·겹침`);
  }
  if (errs.length) { console.log(errs.join("\n")); process.exit(1); }
  let bad = 0;
  for (const n of list) {
    const u = UNITS.find((x) => x.unit === n);
    if (cmd === "make") {
      if (fs.existsSync(unitFile(n)) && !force) { console.log(`단원 ${n}: 있음(건너뜀)`); continue; }
      fs.writeFileSync(unitFile(n), JSON.stringify(make(u), null, 1) + "\n");
      console.log(`단원 ${n} ${u.title}: 만듦`);
    } else {
      const e = check(n); if (e.length) bad++;
      const x = loadUnit(n), L = x.learning || {};
      console.log(`단원 ${n} ${u.title} (${u.from}–${u.to}): ${e.length ? "실패" : "통과"} · 장 ${x.parts.map(label).join(", ")} · 해설 ${x.parts.reduce((a, p) => a + p.d.sections.reduce((b, s) => b + s.comments.length, 0), 0)} · 요약 ${L.summary?.length} 문제 ${L.questions?.length} 예상 질문 ${L.faq?.length} 용어 ${L.glossary?.length}`);
      for (const m of e) console.log("   - " + m);
    }
  }
  process.exit(bad ? 1 : 0);
}
