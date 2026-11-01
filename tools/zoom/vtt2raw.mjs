// 줌 클라우드 녹화 자막(.vtt)·Whisper 결과(.vtt/.srt)·삼성 음성 녹음 텍스트 변환(.txt)을
// 주제별 교재 transcript_raw.txt 형식으로 바꾼다.
// 삼성 .txt: 「화자 1  00:05」처럼 시각만 있는 줄(앞에 화자 이름 가능, 괄호 가능) 뒤에 글이 오거나, 「00:05 글」처럼 줄 앞에 시각.
//   시각이 하나도 없으면 멈춘다(exit 4) — 시각 없이는 원고 검사가 안 된다.
// 한 줄 = "m:ss 글" (1시간 넘으면 "h:mm:ss 글"). 글은 고치지 않는다(오인식 그대로). 화자 이름 "이름: "은 뺀다.
// 사용: node vtt2raw.mjs <입력.vtt|.srt> > transcript_raw.txt   (--keep-speaker 로 화자 이름 유지)
import fs from "node:fs";
const [, , file, ...opt] = process.argv;
if (!file) { console.error("사용: node vtt2raw.mjs <입력.vtt|.srt> [--keep-speaker]"); process.exit(2); }
const keep = opt.includes("--keep-speaker");
const src = fs.readFileSync(file, "utf8").replace(/^﻿/, "").replace(/\r/g, "");
const fmt = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };
const sec = (t) => t.replace(",", ".").split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
const out = []; let last = "";
if (!/-->/.test(src)) { // 삼성 음성 녹음 등 일반 텍스트
  const TS = "(\\d{1,2}:\\d{2}(?::\\d{2})?)";
  const head = new RegExp(`^(?:[^\\d\\s][^:：]{0,20}?\\s*)?[\\(\\[]?${TS}[\\)\\]]?\\s*$`); // 「화자 1 (00:05)」 시각만 있는 줄
  const lead = new RegExp(`^[\\(\\[]?${TS}[\\)\\]]?\\s+(.+)$`);                         // 「00:05 글」
  let cur = null; const segs = [];
  for (const raw of src.split("\n")) {
    const l = raw.trim(); if (!l) continue;
    let m;
    if ((m = l.match(head))) { cur = { t: sec(m[1]), text: [] }; segs.push(cur); }
    else if ((m = l.match(lead))) { cur = { t: sec(m[1]), text: [m[2]] }; segs.push(cur); }
    else if (cur) cur.text.push(l);
  }
  if (!segs.length) { console.error("vtt2raw: 시각이 있는 줄을 찾지 못함 — 삼성 음성 녹음에서 시각이 함께 나오게 내보내 주세요"); process.exit(4); }
  for (const g of segs) { const text = g.text.join(" ").replace(/\s+/g, " ").trim(); if (text && text !== last) { last = text; out.push(`${fmt(g.t)} ${text}`); } }
  process.stdout.write(out.join("\n") + "\n"); console.error(`vtt2raw: ${out.length}줄 (일반 텍스트)`); process.exit(0);
}
for (const block of src.split(/\n\s*\n/)) {
  const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
  const i = lines.findIndex((l) => /-->/.test(l));
  if (i < 0) continue;
  const start = sec(lines[i].split("-->")[0].trim());
  let text = lines.slice(i + 1).join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  if (!keep) text = text.replace(/^[^:：]{1,30}[:：]\s+/, "");
  if (!text || text === last) continue; // 같은 글이 이어서 반복되면 한 번만
  last = text; out.push(`${fmt(start)} ${text}`);
}
process.stdout.write(out.join("\n") + "\n");
console.error(`vtt2raw: ${out.length}줄`);
