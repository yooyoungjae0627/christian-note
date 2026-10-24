// 근거 원문 채우기 — 강의 스크립트 근거는 time(시작)·to(끝) 시각만 적으면 그 사이 줄의 자막 원문과 시각 링크를 그대로 넣는다.
// 손으로 옮겨 적다 생기는 글자 오류를 막기 위한 도구다(지침 §1 출처 기록).
//   node tools/chapterbook/fill.mjs genesis 12 [13 …]
import fs from "node:fs";
import { BOOKS, chapterFile, transcript } from "./lib.mjs";

const [book, ...chs] = process.argv.slice(2);
if (!BOOKS[book]) { console.error("사용법: fill.mjs genesis|1sam|2sam|1ki|2ki <장…>"); process.exit(2); }
let bad = 0;
for (const ch of chs.map(Number)) {
  const f = chapterFile(book, ch);
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  let n = 0;
  for (const s of d.sections) for (const c of s.comments) for (const e of c.evidence) {
    if (e.type !== "transcript") continue;
    const t = transcript(e.file);
    const a = t.lines.findIndex((l) => l.time === e.time);
    const z = t.lines.findIndex((l) => l.time === (e.to || e.time));
    if (a < 0 || z < a) { console.error(`!! ${book} ${ch} ${c.id}: 시각 줄 없음 ${e.file} ${e.time}~${e.to}`); bad++; continue; }
    e.excerpt = t.lines.slice(a, z + 1).map((l) => l.text).join(" ");
    e.url = t.lines[a].url;
    n++;
  }
  fs.writeFileSync(f, JSON.stringify(d, null, 1) + "\n");
  console.log(`${book} ${ch}: 강의 근거 ${n}개 채움`);
}
process.exit(bad ? 1 : 0);
