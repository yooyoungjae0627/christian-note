// 현대 영어 본문 받기 — World English Bible, British Edition(WEBBE, 퍼블릭 도메인). KJV처럼 "the LORD"를 쓴다.
// 출처 bible-api.com(translation=webbe). 글자는 줄바꿈만 공백으로 바꾸고 그대로 둔다(지침 §3).
//   node tools/chapterbook/fetch_web.mjs   → Genesis/원본/2판/verses-genesis-web.json, Samuel/원본/2판/verses-1sam-web.json·verses-2sam-web.json
import fs from "node:fs";
import path from "node:path";
import { R } from "./lib.mjs";
const BOOKS = [["genesis", 50, "Genesis/원본/2판/verses-genesis-web.json"], ["1 samuel", 31, "Samuel/원본/2판/verses-1sam-web.json"], ["2 samuel", 24, "Samuel/원본/2판/verses-2sam-web.json"]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (const [book, n, out] of BOOKS) {
  const file = path.join(R, out);
  const all = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : [];
  const have = new Set(all.map((v) => +v.ref.split(":")[0]));
  for (let ch = 1; ch <= n; ch++) {
    if (have.has(ch)) continue;
    let j;
    for (let tries = 0; tries < 6; tries++) {
      const r = await fetch(`https://bible-api.com/${encodeURIComponent(book + " " + ch)}?translation=webbe`);
      if (r.ok) { j = await r.json(); break; }
      await sleep(8000);
    }
    if (!j) throw new Error(`${book} ${ch} 받기 실패`);
    for (const v of j.verses) all.push({ ref: `${v.chapter}:${v.verse}`, web: v.text.replace(/\s+/g, " ").trim() });
    all.sort((a, b) => { const [c1, v1] = a.ref.split(":").map(Number), [c2, v2] = b.ref.split(":").map(Number); return c1 - c2 || v1 - v2; });
    fs.writeFileSync(file, JSON.stringify({ source: "World English Bible, British Edition (WEBBE) — public domain · bible-api.com", verses: all }.verses ? all : all, null, 1));
    console.log(book, ch, j.verses.length);
    await sleep(2200);
  }
  console.log(book, "done", all.length);
}
