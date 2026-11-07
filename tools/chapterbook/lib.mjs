// 장별 해설서 2판 공통: 설정, 원고·본문 읽기, 칠판 표시, 근거 읽기, 외부 모듈.
// 규칙 원본: docs/policy/장별해설서_제작지침.md
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const HERE = path.join(R, "tools/chapterbook");
export const TMP = path.join(os.tmpdir(), "chapterbook2");
fs.mkdirSync(TMP, { recursive: true });

export const BOOKS = {
  genesis: { ko: "창세기", en: "GENESIS", chapters: 50, dir: "창세기", src: "창세기/원본/2판", verses: "창세기/원본/2판/verses-genesis.json", json: (n) => `chapter${String(n).padStart(2, "0")}.json`, out: (n) => `창세기_${String(n).padStart(2, "0")}장_교재`, all: "창세기_합본_교재", scofield: "genesis" },
  "1sam": { ko: "사무엘상", en: "1 SAMUEL", chapters: 31, dir: "사무엘상·하", src: "사무엘상·하/원본/2판", verses: "사무엘상·하/원본/2판/verses-1sam.json", json: (n) => `1sam-${String(n).padStart(2, "0")}.json`, out: (n) => `사무엘상_${String(n).padStart(2, "0")}장_교재`, all: "사무엘상_합본_교재", scofield: "1-samuel" },
  "2sam": { ko: "사무엘하", en: "2 SAMUEL", chapters: 24, dir: "사무엘상·하", src: "사무엘상·하/원본/2판", verses: "사무엘상·하/원본/2판/verses-2sam.json", json: (n) => `2sam-${String(n).padStart(2, "0")}.json`, out: (n) => `사무엘하_${String(n).padStart(2, "0")}장_교재`, all: "사무엘하_합본_교재", scofield: "2-samuel" },
  "1ki": { ko: "열왕기상", en: "1 KINGS", chapters: 22, dir: "열왕기상·하", src: "열왕기상·하/원본/2판", verses: "열왕기상·하/원본/2판/verses-1ki.json", json: (n) => `1ki-${String(n).padStart(2, "0")}.json`, out: (n) => `열왕기상_${String(n).padStart(2, "0")}장_교재`, all: "열왕기상_합본_교재", scofield: "1-kings" },
  "2ki": { ko: "열왕기하", en: "2 KINGS", chapters: 25, dir: "열왕기상·하", src: "열왕기상·하/원본/2판", verses: "열왕기상·하/원본/2판/verses-2ki.json", json: (n) => `2ki-${String(n).padStart(2, "0")}.json`, out: (n) => `열왕기하_${String(n).padStart(2, "0")}장_교재`, all: "열왕기하_합본_교재", scofield: "2-kings" },
  exod: { ko: "출애굽기", en: "EXODUS", chapters: 40, dir: "출애굽기", src: "출애굽기/원본/2판", verses: "출애굽기/원본/2판/verses-exod.json", json: (n) => `exod-${String(n).padStart(2, "0")}.json`, out: (n) => `출애굽기_${String(n).padStart(2, "0")}장_교재`, all: "출애굽기_합본_교재", scofield: "exodus" },
  judg: { ko: "사사기", en: "JUDGES", chapters: 21, dir: "사사기", src: "사사기/원본/2판", verses: "사사기/원본/2판/verses-judg.json", json: (n) => `judg-${String(n).padStart(2, "0")}.json`, out: (n) => `사사기_${String(n).padStart(2, "0")}장_교재`, all: "사사기_합본_교재", scofield: "judges" },
  job: { ko: "욥기", en: "JOB", chapters: 42, dir: "욥기", src: "욥기/원본/2판", verses: "욥기/원본/2판/verses-job.json", json: (n) => `job-${String(n).padStart(2, "0")}.json`, out: (n) => `욥기_${String(n).padStart(2, "0")}장_교재`, all: "욥기_합본_교재", scofield: "job" },
  ezek: { ko: "에스겔", en: "EZEKIEL", chapters: 48, dir: "에스겔", src: "에스겔/원본/2판", verses: "에스겔/원본/2판/verses-ezek.json", json: (n) => `ezek-${String(n).padStart(2, "0")}.json`, out: (n) => `에스겔_${String(n).padStart(2, "0")}장_교재`, all: "에스겔_합본_교재", scofield: "ezekiel" },
  esth: { ko: "에스더", en: "ESTHER", chapters: 10, dir: "에스더", src: "에스더/원본/2판", verses: "에스더/원본/2판/verses-esth.json", json: (n) => `esth-${String(n).padStart(2, "0")}.json`, out: (n) => `에스더_${String(n).padStart(2, "0")}장_교재`, all: "에스더_합본_교재", scofield: "esther" },
};

// 외부 모듈은 저장소 밖 %TEMP%/topicbook/node_modules에서 읽는다(README 빌드 환경 메모)
export const TOPIC = path.join(os.tmpdir(), "topicbook");
export async function mod(name) {
  const dir = path.join(TOPIC, "node_modules", name);
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  let entry = pkg.main || "index.js";
  const ex = pkg.exports?.["."] ?? pkg.exports;
  if (typeof ex === "string") entry = ex;
  else if (ex) entry = ex.import?.default || ex.import || ex.default || ex.node || entry;
  if (typeof entry === "object") entry = entry.default;
  try { return await import(pathToFileURL(path.join(dir, entry)).href); }
  catch { return createRequire(path.join(TOPIC, "x.js"))(name); }
}

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
export const strip = (h) => h.replace(/<[^>]*>/g, "").replace(/&(#?\w+);/g, (m, e) => ENT[e] ?? (e[0] === "#" ? String.fromCharCode(+e.slice(1)) : m));

const versesCache = {};
export function versesOf(book) {
  return (versesCache[book] ||= JSON.parse(fs.readFileSync(path.join(R, BOOKS[book].verses), "utf8")));
}
export function chapterVerses(book, ch) { return versesOf(book).filter((v) => +v.ref.split(":")[0] === ch); }
export function rangeVerses(book, ch, ref) {
  const [c, r] = ref.split(":"); if (+c !== ch) throw new Error(`단락 장 번호가 다름: ${ref}`);
  const [a, z = a] = r.split("-").map(Number);
  return chapterVerses(book, ch).filter((v) => { const n = +v.ref.split(":")[1]; return n >= a && n <= z; });
}
export function loadChapter(book, ch) {
  const f = path.join(R, BOOKS[book].src, BOOKS[book].json(ch));
  return JSON.parse(fs.readFileSync(f, "utf8"));
}
export const chapterFile = (book, ch) => path.join(R, BOOKS[book].src, BOOKS[book].json(ch));

// ── 칠판 표시: 글자를 바꾸지 않고 span만 덧씌운다 ──
export const MARK = { u: ["mk-u", "밑줄 — 중요한 포인트"], y: ["mk-y", "노랑 — 하나님의 말씀·약속·언약·명령"], g: ["mk-g", "초록 — 믿음·순종·은혜·구원"], p: ["mk-p", "분홍 — 죄·불순종·심판·경고"], b: ["mk-b", "하늘 — 예표·모형"] };
export function markRanges(plain, marks, lang) {
  const out = [];
  for (const m of marks) {
    const t = m[lang]; if (!t) continue;
    const i = plain.indexOf(t);
    if (i < 0) throw new Error(`표시 글자가 본문에 없음(${lang}): "${t}"`);
    if (plain.indexOf(t, i + 1) >= 0) throw new Error(`표시 글자가 본문에 두 번 이상(${lang}): "${t}"`);
    out.push({ s: i, e: i + t.length, cls: MARK[m.t][0] });
  }
  out.sort((a, b) => a.s - b.s);
  for (let i = 1; i < out.length; i++) if (out[i].s < out[i - 1].e) throw new Error(`표시가 겹침(${lang})`);
  return out;
}
export function applyMarks(html, plain, ranges) {
  if (strip(html) !== plain) throw new Error("본문 HTML과 글자가 다름: " + plain.slice(0, 30));
  // 표시 하나가 태그로 여러 조각이 되어도 형광펜 위 색 안내(lead)는 첫 조각에만(지침 §3, 2026-10-13)
  const at = (p) => ranges.find((r) => p >= r.s && p < r.e) || null;
  const seen = new Set();
  const clsAt = (p) => { const r = at(p); if (!r) return null; if (seen.has(r)) return r.cls; seen.add(r); return r.cls + " lead"; };
  let out = "", p = 0, open = null, i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const j = html.indexOf(">", i);
      if (open) { out += "</span>"; open = null; }
      out += html.slice(i, j + 1); i = j + 1; continue;
    }
    let ch = html[i], len = 1;
    if (ch === "&") { const j = html.indexOf(";", i); if (j > i && j - i < 8) { len = j - i + 1; } }
    const r = at(p);
    if (r !== open) { if (open) out += "</span>"; if (r) out += `<span class="${clsAt(p)}">`; open = r; }
    out += html.slice(i, i + len); i += len; p += 1;
  }
  if (open) out += "</span>";
  return out;
}

// ── 근거 자료 ──
const trCache = {};
export function transcript(file) {
  if (trCache[file]) return trCache[file];
  const s = fs.readFileSync(path.join(R, diskPath(file)), "utf8");
  const lines = s.split(/\r?\n/).map((l) => l.match(/^- \[([\d:]+)\]\((https:\/\/youtu\.be\/[\w-]{11}\?t=\d+)\) (.*)$/)).filter(Boolean).map((m) => ({ time: m[1], url: m[2], text: m[3] }));
  return (trCache[file] = { title: s.match(/^# (.*)$/m)[1], lines, video: s.match(/https:\/\/youtu\.be\/([\w-]{11})/)[1] });
}
export const secOf = (t) => t.split(":").reduce((a, b) => a * 60 + +b, 0);
let pdfIndex;
export function pdfPage(file, page) {
  pdfIndex ||= Object.fromEntries(JSON.parse(fs.readFileSync(path.join(R, "창세기/자료검토/전체_PDF_본문색인.json"), "utf8")).books.map((b) => [b.file, b]));
  return pdfIndex[file]?.content.find((p) => p.page === page)?.text ?? null;
}
// 원고·PDF 색인에는 폴더 이름을 바꾸기 전 경로(Theme/, Milk/, Samuel/)가 남아 있다 — 디스크에서는 새 폴더로 찾는다(2026-11-02)
// 주제별 교재 완성본은 2026-11-04부터 파일 이름에 번호(NN_)가 없다 — 옛 이름(Theme/08_사탄_정확히_알기.pdf)이면 번호를 떼어 찾는다
export const diskPath = (f) => { for (const [a, b] of [["Theme/", "첫열매들 성경해석/"], ["Milk/", "밀크(첫열매들)/"], ["Samuel/", "사무엘상·하/"]]) if (f.startsWith(a)) { const p = b + f.slice(a.length); if (a === "Theme/" && !fs.existsSync(path.join(R, p))) { const q = p.replace(/\/\d{2}_([^/]+)$/, "/$1"); if (fs.existsSync(path.join(R, q))) return q; } return p; } return f; };
export const squash = (s) => String(s).replace(/\s+/g, " ").trim();
export const ffFile = (f) => f.startsWith("memory-bank/첫열매들_강의스크립트/");
// 원고에는 폴더 이름을 바꾸기 전 경로(Samuel/강의스크립트/)가 남아 있다 — 둘 다 3순위로 본다(2026-10-31)
export const sbcFile = (f) => f.startsWith("사무엘상·하/강의스크립트/") || f.startsWith("Samuel/강의스크립트/");

export const BASIS = {
  direct: { tag: "", cls: "" },
  linked: { tag: "", cls: "" },
  doctrine: { tag: " · 교회 교리 적용", cls: "" },
  external: { tag: " · 외부 해설(2순위)", cls: "external", badge: "외부 해설 · 2순위" },
  sbc: { tag: " · 이이레 목사 강의(3순위)", cls: "sbc", badge: "이이레 목사 강의 · 3순위" },
};
export const timeKo = (url) => { const n = +url.match(/[?&]t=(\d+)/)[1]; return n >= 3600 ? `${Math.floor(n / 3600)}시간 ${Math.floor(n % 3600 / 60)}분 ${String(n % 60).padStart(2, "0")}초` : `${Math.floor(n / 60)}분 ${String(n % 60).padStart(2, "0")}초`; };

// 현대 영어(WEBBE, 퍼블릭 도메인) — tools/chapterbook/fetch_web.mjs로 받은 글자 그대로
const webCache = {};
export function webOf(book, ref) {
  if (!webCache[book]) { const f = path.join(R, BOOKS[book].verses.replace(/\.json$/, "-web.json")); webCache[book] = fs.existsSync(f) ? Object.fromEntries(JSON.parse(fs.readFileSync(f, "utf8")).map((v) => [v.ref, v.web])) : {}; }
  return webCache[book][ref] ?? null;
}
