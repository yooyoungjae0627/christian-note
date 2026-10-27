// 장별 해설서 2판 근거 찾기 — 성경 해석 지침의 순위대로 자료 전체에서 낱말을 찾는다.
//   node tools/chapterbook/search.mjs 아브람 하란 [--ctx 120] [--max 40] [--only ff|pdf|ext|sbc]
//   [1순위·영상] 첫열매들 강의 스크립트 memory-bank/첫열매들_강의스크립트/
//   [1순위·교재] Theme·Milk PDF 쪽 글자 (창세기/자료검토/전체_PDF_본문색인.json)
//   [2순위·외부] 스코필드 관주 해설 memory-bank/세대주의_해설/ (장별 md + 1917판 OCR 전체)
//   [3순위·이이레] 「다윗의 삶」 스크립트 사무엘상·하/강의스크립트/
// 결과는 후보일 뿐이다. 채택할 때는 그 쪽·그 시각 앞뒤를 직접 읽고 맥락을 확인한다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const rel = (f) => path.relative(R, f).split(path.sep).join("/");
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

export function loadTranscriptDir(dir) {
  return walk(path.join(R, dir)).filter((f) => f.endsWith(".md") && !f.endsWith("README.md")).sort().map((f) => {
    const s = fs.readFileSync(f, "utf8");
    const lines = s.split(/\r?\n/).map((l) => l.match(/^- \[([\d:]+)\]\((https:\/\/youtu\.be\/[\w-]{11}\?t=\d+)\) (.*)$/)).filter(Boolean).map((m) => ({ time: m[1], url: m[2], text: m[3] }));
    return { file: rel(f), title: s.match(/^# (.*)$/m)[1], lines };
  });
}
export const loadFirstfruits = () => loadTranscriptDir("memory-bank/첫열매들_강의스크립트");
export const loadSbc = () => loadTranscriptDir("사무엘상·하/강의스크립트");
export const loadPdf = () => JSON.parse(fs.readFileSync(path.join(R, "창세기/자료검토/전체_PDF_본문색인.json"), "utf8")).books;
export function loadExternal() {
  const d = path.join(R, "memory-bank/세대주의_해설");
  return walk(d).filter((f) => /\.(md|txt)$/.test(f) && !f.endsWith("README.md")).map((f) => ({ file: rel(f), text: fs.readFileSync(f, "utf8") }));
}
// 공백을 하나로 모은 글자(OCR 대조용)
export const squash = (s) => s.replace(/\s+/g, " ").trim();

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const ctx = +opt("--ctx", 90), max = +opt("--max", 40), only = opt("--only", "");
  const use = (k) => !only || only === k;
  const ff = use("ff") ? loadFirstfruits() : [], pdf = use("pdf") ? loadPdf() : [], ext = use("ext") ? loadExternal() : [], sbc = use("sbc") ? loadSbc() : [];
  const inTr = (label, trs, kw, out) => {
    for (const t of trs) {
      const joined = t.lines.map((l) => l.text).join(" ");
      const starts = []; let pos = 0; for (const l of t.lines) { starts.push(pos); pos += l.text.length + 1; }
      let i = -1;
      while ((i = joined.indexOf(kw, i + 1)) >= 0 && out.length < max) {
        let k = 0; while (k + 1 < starts.length && starts[k + 1] <= i) k++;
        out.push(`[${label}] ${t.file} [${t.lines[k].time}] ${t.lines[k].url} :: …${joined.slice(Math.max(0, i - ctx), i + kw.length + ctx)}…`);
        i += ctx;
      }
    }
  };
  for (const kw of args) {
    const out = [];
    inTr("1순위·영상", ff, kw, out);
    for (const b of pdf) for (const p of b.content) {
      let i = -1;
      while ((i = p.text.indexOf(kw, i + 1)) >= 0 && out.length < max) { out.push(`[1순위·교재] ${b.file} p${p.page} :: …${p.text.slice(Math.max(0, i - ctx), i + kw.length + ctx).replace(/\s+/g, " ")}…`); i += ctx; }
    }
    for (const e of ext) {
      const t = e.file.endsWith(".txt") ? squash(e.text) : e.text;
      let i = -1;
      while ((i = t.toLowerCase().indexOf(kw.toLowerCase(), i + 1)) >= 0 && out.length < max) { out.push(`[2순위·외부] ${e.file} @${i} :: …${t.slice(Math.max(0, i - ctx), i + kw.length + ctx).replace(/\s+/g, " ")}…`); i += ctx; }
    }
    inTr("3순위·이이레", sbc, kw, out);
    console.log(`\n=== ${kw} (${out.length}${out.length >= max ? "+" : ""}) ===\n` + out.join("\n"));
  }
}
