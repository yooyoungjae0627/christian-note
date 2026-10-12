// 장별 해설서 2판 본문 받기 — 표준킹제임스성경 한영대역(tools/kjv.mjs) 글자 그대로.
//   node tools/chapterbook/fetch_verses.mjs   → Genesis/원본/2판/verses-genesis.json, Samuel/원본/2판/verses-1sam.json·verses-2sam.json
import fs from "fs";
import { chapter } from "../kjv.mjs";
const BOOKS = [["창세기", 50, "Genesis/원본/2판/verses-genesis.json"], ["사무엘상", 31, "Samuel/원본/2판/verses-1sam.json"], ["사무엘하", 24, "Samuel/원본/2판/verses-2sam.json"]];
for (const [book, n, out] of BOOKS) {
  const all = [];
  for (let ch = 1; ch <= n; ch++) {
    const vs = await chapter(book, ch);
    const nums = [...vs.keys()].sort((a, b) => a - b);
    if (nums[0] !== 1 || nums.at(-1) !== nums.length) throw new Error(`${book} ${ch}장 절 번호가 이어지지 않음`);
    for (const k of nums) all.push(vs.get(k));
  }
  fs.writeFileSync(out, JSON.stringify(all, null, 1));
  console.log(book, n + "장", all.length + "절", "→", out);
}
