// 줌 클라우드 녹화 자막(.vtt)·Whisper 결과(.vtt/.srt)를 주제별 교재 transcript_raw.txt 형식으로 바꾼다.
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
