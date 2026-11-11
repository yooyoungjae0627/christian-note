// 저장소의 근거 자료를 읽어 검색 단위(조각)로 나눈다. 순위는 docs/policy/성경해석_지침.md 그대로.
//   교리  = docs/doctrine/*.md                     (밀크 교리 정리 — 옳고 그름의 기준)
//   1순위 = memory-bank/첫열매들_강의스크립트/**    (첫열매들 영상 강의, 줄마다 시각 링크)
//   2순위 = memory-bank/세대주의_해설/scofield/*    (스코필드 관주 해설 원문, 영어)
//   3순위 = 사무엘상·하/강의스크립트/* + 이이레 목사 성경 해석/원본/*/transcript_raw.txt
// 조각: { id, tier, title, file, text(검색용 글자), display(모델에게 보여 줄 글자 — 시각 링크 포함) }
import fs from "fs";
import path from "path";

export const TIERS = ["교리", "1순위", "2순위", "3순위"];

const LINES_PER_CHUNK = 10; // 스크립트 한 조각의 줄 수
const LINE_STRIDE = 8; // 두 줄씩 겹친다(문장이 조각 경계에서 끊기지 않게)
const MAX_SECTION = 1800; // 교리·해설 한 조각의 글자 수 상한

function mdFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(p));
    else if (e.name.endsWith(".md") && e.name !== "README.md") out.push(p);
  }
  return out.sort();
}

const titleOf = (md, fallback) => (md.match(/^# (.+)$/m)?.[1] ?? fallback).trim();

// 긴 글을 문단 경계에서 max 글자 이하로 나눈다.
function splitLong(text, max = MAX_SECTION) {
  if (text.length <= max) return [text];
  const out = [];
  let cur = "";
  for (const para of text.split(/\n{2,}/)) {
    if (cur && cur.length + para.length + 2 > max) { out.push(cur); cur = ""; }
    if (para.length > max) {
      for (let i = 0; i < para.length; i += max) out.push(para.slice(i, i + max));
    } else cur = cur ? cur + "\n\n" + para : para;
  }
  if (cur) out.push(cur);
  return out;
}

// 스크립트 줄 묶음 → 조각들. lines: [{ time, link|null, text }]
function windows(lines, base) {
  const out = [];
  for (let i = 0; i < lines.length; i += LINE_STRIDE) {
    const win = lines.slice(i, i + LINES_PER_CHUNK);
    if (!win.length) break;
    out.push({
      ...base,
      text: `${base.title}\n` + win.map((l) => l.text).join(" "),
      display: win.map((l) => (l.link ? `[${l.time}](${l.link}) ${l.text}` : `[${l.time}] ${l.text}`)).join("\n"),
    });
    if (i + LINES_PER_CHUNK >= lines.length) break;
  }
  return out;
}

// "- [0:13](https://youtu.be/ID?t=13) 글" 줄로 된 스크립트 파일
function scriptChunks(file, rel, tier) {
  const md = fs.readFileSync(file, "utf8");
  const title = titleOf(md, path.basename(file, ".md"));
  const lines = [...md.matchAll(/^- \[(\d+(?::\d+)+)\]\((https:\/\/youtu\.be\/[^)\s]+)\) (.+)$/gm)].map((m) => ({
    time: m[1], link: m[2], text: m[3].trim(),
  }));
  return windows(lines, { tier, title, file: rel });
}

// 제목(##, ###) 단위로 나누는 문서(교리 정리, 스코필드 해설)
function sectionChunks(file, rel, tier, extra = "") {
  const md = fs.readFileSync(file, "utf8");
  const title = titleOf(md, path.basename(file, ".md"));
  const out = [];
  let h2 = "", head = "", buf = [];
  const flush = () => {
    const body = buf.filter((l) => !/^\s*-{3,}\s*$/.test(l)).join("\n").trim(); // 구분선만 있는 줄은 버린다
    buf = [];
    if (!/[가-힣a-zA-Z]/.test(body)) return;
    const where = [title, head].filter(Boolean).join(" › ");
    for (const part of splitLong(body)) {
      out.push({ tier, title: where, file: rel, text: `${where}\n${part}`, display: extra ? `${extra}\n${part}` : part });
    }
  };
  for (const line of md.split("\n")) {
    const m = line.match(/^(#{2,3}) (.+)$/);
    if (m) {
      flush();
      if (m[1] === "##") { h2 = m[2].trim(); head = h2; } else head = [h2, m[2].trim()].filter(Boolean).join(" › ");
    } else if (!/^# /.test(line)) buf.push(line);
  }
  flush();
  return out;
}

// "0:09 9초 글" 줄로 된 받아쓰기 원문(이이레 목사 성경 해석/원본/*/transcript_raw.txt)
function rawTranscriptChunks(dir, relDir) {
  const file = path.join(dir, "transcript_raw.txt");
  if (!fs.existsSync(file)) return [];
  const title = `${path.basename(dir)} (이이레 목사 강의)`;
  let videoId = null; // 같은 폴더 원고에 유튜브 주소가 적혀 있을 때만 시각 링크를 만든다
  for (const f of ["story.txt", "layout.json"]) {
    const p = path.join(dir, f);
    const m = fs.existsSync(p) && fs.readFileSync(p, "utf8").match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/);
    if (m) { videoId = m[1]; break; }
  }
  const lines = [...fs.readFileSync(file, "utf8").matchAll(/^(\d+(?::\d+)+) (?:\d+시간 ?)?(?:\d+분 ?)?(?:\d+초)? ?(.+)$/gm)].map((m) => {
    const sec = m[1].split(":").reduce((a, n) => a * 60 + +n, 0);
    return { time: m[1], link: videoId ? `https://youtu.be/${videoId}?t=${sec}` : null, text: m[2].trim() };
  });
  return windows(lines, { tier: "3순위", title, file: `${relDir}/transcript_raw.txt` });
}

export function loadCorpus(root) {
  const rel = (p) => path.relative(root, p).split(path.sep).join("/");
  const chunks = [];

  for (const f of mdFiles(path.join(root, "docs/doctrine"))) chunks.push(...sectionChunks(f, rel(f), "교리"));
  for (const f of mdFiles(path.join(root, "memory-bank/첫열매들_강의스크립트"))) chunks.push(...scriptChunks(f, rel(f), "1순위"));
  for (const f of mdFiles(path.join(root, "memory-bank/세대주의_해설/scofield"))) {
    const url = fs.readFileSync(f, "utf8").match(/^\| 주소 \| (\S+) \|/m)?.[1];
    chunks.push(...sectionChunks(f, rel(f), "2순위", `출처: C. I. Scofield, Scofield Reference Notes (1917)${url ? " · " + url : ""}`));
  }
  for (const f of mdFiles(path.join(root, "사무엘상·하/강의스크립트"))) chunks.push(...scriptChunks(f, rel(f), "3순위"));
  const ire = path.join(root, "이이레 목사 성경 해석/원본");
  if (fs.existsSync(ire)) {
    for (const e of fs.readdirSync(ire, { withFileTypes: true })) {
      if (e.isDirectory()) chunks.push(...rawTranscriptChunks(path.join(ire, e.name), rel(path.join(ire, e.name))));
    }
  }
  chunks.forEach((c, i) => { c.id = i; });
  return chunks;
}
