// 장별 해설서 2판 원고 검사 — 종료 코드 0이어야 빌드한다(지침 §7).
//   node tools/chapterbook/check.mjs genesis 12 [13 …]   또는  genesis all
import fs from "node:fs";
import path from "node:path";
import { R, BOOKS, chapterFile, chapterVerses, rangeVerses, markRanges, transcript, pdfPage, squash, ffFile, sbcFile, MARK, diskPath } from "./lib.mjs";
import { PLACES, MOTIFS, mapViews, mapSvg, mapIssues } from "./art.mjs";
import { familyIssues } from "./famtree.mjs";
import { THINGS, BG, PANELS, bubble, says } from "./comic.mjs";
const BASIC = new Set(Object.values(JSON.parse(fs.readFileSync(new URL("./basic_words.json", import.meta.url), "utf8"))).filter(Array.isArray).flat());

const [book, ...rest] = process.argv.slice(2);
const B = BOOKS[book];
if (!B) { console.error("사용법: check.mjs genesis|1sam|2sam|1ki|2ki <장…|all>"); process.exit(2); }
const chs = rest[0] === "all" ? [...Array(B.chapters)].map((_, i) => i + 1) : rest.map(Number);
const AUTHORS = ["C. I. 스코필드", "D. L. 무디", "클라렌스 라킨", "피터 럭크만"];
const RANK = { direct: 1, linked: 1, doctrine: 1, external: 2, sbc: 3 };
const extCache = {};
let total = 0;
const summary = [];
for (const ch of chs) {
  const errs = [];
  const E = (m) => errs.push(m);
  const f = chapterFile(book, ch);
  if (!fs.existsSync(f)) { console.log(`${book} ${ch}: 원고 없음`); total++; continue; }
  let d; try { d = JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { console.log(`${book} ${ch}: JSON 오류 ${e.message}`); total++; continue; }
  if (d.chapter !== ch) E("chapter 번호 다름");
  for (const k of ["subtitle", "motto", "motto_comment", "cover", "sections", "learning"]) if (!d[k]) E(`${k} 없음`);
  try { for (const c of d.cover || []) if (!MOTIFS[c.m]) E(`없는 표지 그림 ${c.m}`); } catch { }
  // 절 덮기
  const all = chapterVerses(book, ch).map((v) => +v.ref.split(":")[1]);
  const covered = [];
  const ids = new Set();
  const stat = { direct: 0, linked: 0, doctrine: 0, external: 0, sbc: 0, marks: 0, unmarked: 0 };
  for (const s of d.sections || []) {
    let vs; try { vs = rangeVerses(book, ch, s.ref); } catch (e) { E(e.message); continue; }
    covered.push(...vs.map((v) => +v.ref.split(":")[1]));
    // 칠판 표시
    const perVerse = {};
    for (const m of s.marks || []) {
      if (!MARK[m.t]) E(`${s.ref} 표시 종류 이상 ${m.t}`);
      if (!m.ko || !m.en) E(`${m.v} 표시는 한글·영어 한 쌍이어야 함`);
      if (!vs.some((v) => v.ref === m.v)) E(`${m.v} 표시가 단락 ${s.ref} 밖`);
      perVerse[m.v] = (perVerse[m.v] || 0) + 1; stat.marks++;
    }
    for (const [v, n] of Object.entries(perVerse)) if (n > 3) E(`${v} 표시 ${n}곳(최대 3)`);
    for (const v of vs) {
      const ms = (s.marks || []).filter((m) => m.v === v.ref);
      try { markRanges(v.ko, ms, "ko"); markRanges(v.en, ms, "en"); } catch (e) { E(`${v.ref} ${e.message}`); }
    }
    if (!(s.marks || []).length) stat.unmarked++;
    // 이야기로 읽기·영어 강의·단어장(지침 §2-1·§4)
    const enText = vs.map((v) => v.en).join(" ");
    if (!(s.english || []).length || s.english.length > 3) E(`${s.ref} 영어 강의 ${(s.english || []).length}개(1–3)`);
    for (const e of s.english || []) { const v = vs.find((x) => x.ref === e.ref); if (!v || !v.en.includes(e.phrase)) E(`${s.ref} 영어 강의 구문이 ${e.ref} KJV에 없음: ${e.phrase}`); if (!e.grammar || !e.text) E(`${s.ref} 영어 강의 문법 이름·풀이 없음`); stat.english = (stat.english || 0) + 1; }
    if ((s.vocab || []).length > 8) E(`${s.ref} 단어장 ${(s.vocab || []).length}개(최대 8)`);
    for (const w of s.vocab || []) if (BASIC.has(w.w.toLowerCase())) E(`${s.ref} 단어장에 기초 영단어: ${w.w}(basic_words.json)`);
    for (const w of s.vocab || []) { const v = vs.find((x) => x.ref === w.ref); if (!v || !new RegExp("\\b" + w.w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(v.en)) E(`${s.ref} 단어장 낱말이 ${w.ref} KJV에 없음: ${w.w}`); if (!w.ko) E(`${s.ref} 단어 뜻 없음 ${w.w}`); }
    // 해설
    const ranks = new Set();
    for (const c of s.comments || []) {
      if (ids.has(c.id)) E(`해설 id 중복 ${c.id}`); ids.add(c.id);
      if (!RANK[c.basis]) { E(`${c.id} basis 이상 ${c.basis}`); continue; }
      // also = 높은 순위 해설 곁에 함께 싣는 이이레 강의(지침 §2-2, 사용자 지시 2026-11-02) — 순위 막기에서 뺀다
      if (c.also && c.basis !== "sbc") E(`${c.id} also는 이이레 강의(basis sbc)에만`);
      if (!c.also) ranks.add(RANK[c.basis]); stat[c.basis]++;
      for (const sp of c.spans || []) { const i = c.text.indexOf(sp.text); if (i < 0 || c.text.indexOf(sp.text, i + 1) >= 0) E(`${c.id} 강조 글자가 정확히 한 번 있어야 함: ${sp.text}`); if (![1, 2, 3].includes(sp.level)) E(`${c.id} 강조 단계 이상`); }
      if ((c.spans || []).length > 3) E(`${c.id} 강조 3개 초과`);
      if (!c.evidence?.length) E(`${c.id} 근거 없음`);
      for (const e of c.evidence || []) {
        if (!fs.existsSync(path.join(R, diskPath(e.file)))) { E(`${c.id} 파일 없음 ${e.file}`); continue; }
        if (e.type === "transcript") {
          if (ffFile(e.file) && RANK[c.basis] !== 1) E(`${c.id} 첫열매들 강의 근거는 basis direct/linked/doctrine`);
          if (sbcFile(e.file) && c.basis !== "sbc") E(`${c.id} 이이레 강의 근거는 basis sbc`);
          if (!ffFile(e.file) && !sbcFile(e.file)) E(`${c.id} 강의 파일 위치 이상 ${e.file}`);
          const t = transcript(e.file);
          const a = t.lines.findIndex((l) => l.time === e.time), z = t.lines.findIndex((l) => l.time === (e.to || e.time));
          if (a < 0 || z < a) { E(`${c.id} 시각 줄 없음 ${e.time}`); continue; }
          if (e.excerpt !== t.lines.slice(a, z + 1).map((l) => l.text).join(" ")) E(`${c.id} 강의 원문이 스크립트와 다름(fill.mjs로 채울 것)`);
          if (e.url !== t.lines[a].url) E(`${c.id} 시각 링크가 그 줄의 링크와 다름`);
          if (!e.source) E(`${c.id} source 없음`);
        } else if (e.type === "pdf") {
          if (RANK[c.basis] !== 1) E(`${c.id} 교회 교재 근거는 basis direct/linked/doctrine`);
          const text = e.pages.map((p) => pdfPage(e.file, p) ?? "").join(" ");
          if (!text) E(`${c.id} PDF 쪽 글자 없음 ${e.file} ${e.pages}`);
          for (const piece of String(e.excerpt).split(/\n…\n/)) if (!squash(text).includes(squash(piece))) E(`${c.id} PDF 원문이 쪽 글자에 없음: ${piece.slice(0, 40)}`);
        } else if (e.type === "external") {
          if (c.basis !== "external") E(`${c.id} 외부 해설 근거는 basis external`);
          if (!e.file.startsWith("memory-bank/세대주의_해설/")) E(`${c.id} 외부 해설 보관 위치 이상`);
          if (!AUTHORS.includes(e.author)) E(`${c.id} 해설가 이름 이상 ${e.author}`);
          if (!/^https?:\/\//.test(e.url || "")) E(`${c.id} 외부 해설 주소 없음`);
          const src = (extCache[e.file] ||= squash(fs.readFileSync(path.join(R, e.file), "utf8")));
          for (const piece of String(e.excerpt).split(/\n…\n/)) if (!src.includes(squash(piece))) E(`${c.id} 외부 해설 원문이 보관본에 없음: ${piece.slice(0, 40)}`);
        } else E(`${c.id} 근거 종류 이상 ${e.type}`);
      }
    }
    // 순위: 낮은 순위는 그 단락에 높은 순위 근거가 없을 때만
    if (ranks.has(2) && ranks.has(1)) E(`${s.ref} 1순위 근거가 있는 단락에 2순위 해설`);
    if (ranks.has(3) && (ranks.has(1) || ranks.has(2))) E(`${s.ref} 높은 순위 근거가 있는 단락에 3순위 해설`);
    if (!(s.comments || []).length && !(s.notes || []).length && !s.plain) E(`${s.ref} 해설도 본문만 표시(plain)도 없음`);
    // 「찾지 못했다」는 책에 쓰지 않는다(지침 §1, 2026-11-03) — 창세기부터. 사무엘·열왕기는 옛 원고라 아직 뺌
    if (book === "genesis") {
      if ((s.notes || []).length) E(`${s.ref} 해설 미수록 안내 대신 "plain": true`);
      for (const c of s.comments || []) if (/찾지 ?못/.test(c.text) && /(강의|교재|해설|근거)/.test(c.text)) E(`${c.id} 해설에 「찾지 못했다」 안내`);
    }
  }
  if (JSON.stringify(covered) !== JSON.stringify(all)) E(`절 덮기 이상: 원고 ${covered.length}절 / 본문 ${all.length}절`);
  const allC = (d.sections || []).flatMap((s) => s.comments || []);
  const has = (k) => allC.some((c) => c.id === k);
  if (d.motto_comment && (!has(d.motto_comment) || !allC.find((c) => c.id === d.motto_comment).text.includes(d.motto))) E("표어가 지정한 해설 문장 안에 없음");
  // 인물·관계도
  const pids = new Set((d.people || []).map((p) => p.id));
  const inCh = (r) => { const m = String(r).match(/^(\d+):(\d+)(?:-(\d+))?$/); return m && +m[1] === ch && all.includes(+m[2]) && (!m[3] || all.includes(+m[3])); };
  for (const p of d.people || []) { if (!p.name || !p.desc) E(`인물 ${p.id} 이름·설명 없음`); if (!p.refs?.length || !p.refs.every(inCh)) E(`인물 ${p.id} 근거 절 이상`); }
  for (const r of d.relations || []) { if (!pids.has(r.from) || !pids.has(r.to)) E(`관계 ${r.from}→${r.to} 인물 없음`); if (!inCh(r.ref)) E(`관계 ${r.from}→${r.to} 근거 절 이상 ${r.ref}`); }
  // 지도
  for (const p of d.map?.places || []) { if (!PLACES.places[p.key] && !(Array.isArray(p.at) && p.name)) E(`지도 지명 없음 ${p.key}(places.json에 없으면 name과 at:[경도,위도]를 원고에)`); if (!p.ref || !inCh(p.ref)) E(`지도 지명 ${p.key} 근거 절 이상`); }
  for (const r of d.map?.routes || []) for (const k of r.path) if (!PLACES.places[k] && !(d.map.places || []).some((x) => x.key === k && x.at)) E(`경로 지명 없음 ${k}`);
  for (const v of d.map?.views || []) for (const k of v.keys) if (!(d.map.places || []).some((x) => x.key === k)) E(`지도 보기의 지명이 places에 없음 ${k}`);
  // 그림 겹침(지침 §5·§6): 관계도·지도 글자가 상자·선·다른 글자에 가려지지 않는지 실제 배치로 검사
  if (d.people?.length && d.relations?.length) { try { for (const m of familyIssues(d.people, d.relations).issues) E("관계도 " + m); } catch (e) { E("관계도 배치 실패 " + e.message); } }
  if (d.map?.places?.length) { try { for (const v of mapViews(d.map)) { const places = d.map.places.filter((x) => v.keys.includes(x.key)); const routes = (d.map.routes || []).map((r) => ({ ...r, path: r.path.filter((k) => v.keys.includes(k)) })).filter((r) => r.path.length > 1); mapSvg({ places, routes, minSpan: v.minSpan, focus: v.focus, hide: v.hide, frames: v.frames }); for (const m of mapIssues) E("지도 " + m); } } catch (e) { E("지도 배치 실패 " + e.message); } }
  // 만화로 보는 이야기·쉬운 역할·요약 밑줄(사용자 지시 2026-11-02) — comic이 있는 원고에서 검사
  if (d.comic) {
    const verseKo = Object.fromEntries(chapterVerses(book, ch).map((v) => [v.ref, v.ko]));
    const vn = (r) => +String(r).split(":")[1];
    if (d.comic.length !== PANELS) E(`만화 ${d.comic.length}컷(${PANELS}컷이어야 함)`);
    let prev = 0;
    d.comic.forEach((p, i) => {
      const n = `만화 ${i + 1}컷`;
      if (!verseKo[p.v]) { E(`${n} 절 이상 ${p.v}`); return; }
      if (vn(p.v) < prev) E(`${n} 절 순서가 거꾸로 ${p.v}`); prev = vn(p.v);
      if (!BG[p.bg || "sky"]) E(`${n} 없는 배경 ${p.bg}`);
      if (!(p.art || []).length) E(`${n} 그림 없음`);
      for (const a of p.art || []) {
        if (a.f) { if (!["man", "woman", "child", "angel"].includes(a.f)) E(`${n} 없는 인물 그림 ${a.f}`); }
        else if (!THINGS[a.m]) E(`${n} 없는 그림 ${a.m}`);
        if ((a.x ?? 120) < 0 || (a.x ?? 120) > 240 || (a.y ?? 132) < 0 || (a.y ?? 132) > 150) E(`${n} 그림 좌표가 판(240×150) 밖`);
        if (a.name && [...a.name].length > 10) E(`${n} 이름표가 김(10자 이하): ${a.name}`);
      }
      if (!p.cap || [...p.cap].length > 80) E(`${n} 내레이션 ${[...(p.cap || "")].length}자(1–80)`);
      if (!(p.u || []).length || p.u.length > 2) E(`${n} 밑줄 ${(p.u || []).length}곳(1–2)`);
      for (const t of p.u || []) { const k = (p.cap || "").indexOf(t); if (k < 0 || p.cap.indexOf(t, k + 1) >= 0) E(`${n} 밑줄 글자가 내레이션에 정확히 한 번 있어야 함: ${t}`); }
      if (says(p).length > 2) E(`${n} 말풍선은 2개까지`);
      for (const sy of says(p)) {
        const ko = verseKo[sy.v];
        if (!ko || !ko.includes(sy.text)) E(`${n} 말풍선이 ${sy.v} 본문 글자 그대로가 아님: ${sy.text}`);
        if ([...sy.text].length > 46) E(`${n} 말풍선이 김(46자 이하)`);
        try { if (bubble(sy).lines.length > 4) E(`${n} 말풍선 4줄 초과`); } catch (e) { E(`${n} 말풍선 ${e.message}`); }
      }
    });
    const secs = d.sections || [];
    if (secs.length && d.comic.length) {
      const first = rangeVerses(book, ch, secs[0].ref).map((v) => v.ref), last = rangeVerses(book, ch, secs.at(-1).ref).map((v) => v.ref);
      if (!first.includes(d.comic[0].v)) E("만화 1컷은 첫 단락에서 시작해야 함");
      if (!last.includes(d.comic.at(-1).v)) E("만화 마지막 컷은 마지막 단락이어야 함");
    }
    for (const p of d.people || []) {
      if (!p.part || [...p.part].length > 14) E(`인물 ${p.id} 쉬운 역할(part) 1–14자 필요`);
      if (!p.intro || [...p.intro].length < 8 || [...p.intro].length > 24) E(`인물 ${p.id} 관계도 핵심 소개(intro) 8–24자 필요`);
      if (p.look && !["man", "woman", "child", "old", "king", "group", "angel"].includes(p.look)) E(`인물 ${p.id} look 이상 ${p.look}`);
    }
    for (const x of d.learning?.summary || []) {
      if (!(x.u || []).length || x.u.length > 2) E(`요약 밑줄 ${(x.u || []).length}곳(1–2): ${x.text.slice(0, 20)}`);
      for (const t of x.u || []) { const k = x.text.indexOf(t); if (k < 0 || x.text.indexOf(t, k + 1) >= 0) E(`요약 밑줄 글자가 정확히 한 번 있어야 함: ${t}`); }
    }
  }
  // 영어 구문
  if (d.english) E("장 전체 english는 2판 보강에서 단락별 english로 옮긴다");
  // 학습 자료
  const L = d.learning || {};
  const cnt = (a, lo, hi, n) => { if (!a || a.length < lo || a.length > hi) E(`${n} ${a?.length ?? 0}개(${lo}–${hi})`); };
  cnt(L.summary, 12, 22, "요약"); cnt(L.questions, 25, 41, "문제"); cnt(L.faq, 12, 14, "예상 질문");
  const verseOk = (x, ans) => {
    const v = chapterVerses(book, ch).find((y) => y.ref === x.verse);
    if (!v) return E(`본문 근거 절 없음 ${x.verse}`);
    if (ans) for (const w of ans.split(/[,·]\s*/).map((s) => s.trim()).filter(Boolean)) if (!v.ko.includes(w)) E(`본문 확인 답 "${w}"이 ${x.verse} 본문에 없음`);
  };
  for (const x of [...(L.summary || []), ...(L.glossary || [])]) { if (x.key) { if (!has(x.key)) E(`없는 해설 key ${x.key}`); } else if (x.verse) verseOk(x); else E("요약·용어에 근거(key/verse) 없음"); }
  for (const x of L.questions || []) { if (x.key) { if (!has(x.key)) E(`문제 key 없음 ${x.key}`); } else if (x.verse) verseOk(x, x.a); else E(`문제 근거 없음: ${x.q}`); }
  for (const x of L.faq || []) if (!has(x.key)) E(`예상 질문 key 없음 ${x.key}`);
  for (const x of L.glossary || []) if (!x.term || !x.text) E("용어 풀이 빈칸");
  total += errs.length;
  summary.push({ ch, errors: errs.length, ...stat, people: (d.people || []).length, places: (d.map?.places || []).length, english: stat.english || 0 });
  console.log(`${B.ko} ${ch}장: ${errs.length ? "실패 " + errs.length : "통과"} · 1순위 ${stat.direct + stat.linked + stat.doctrine} / 2순위 ${stat.external} / 3순위 ${stat.sbc} · 표시 ${stat.marks} · 인물 ${(d.people || []).length} · 지명 ${(d.map?.places || []).length}`);
  for (const e of errs) console.log("   - " + e);
}
process.exit(total ? 1 : 0);
