// 영어로 읽는 사무엘기: 원본/영어/사무엘상_NN.txt 읽기 + 검사
// 청크의 성분 표시 [S:..] [V:..] [O:..] [C:..] [Q:..]를 지우고 이어 붙인 문장이
// bsb_1sa_NN.json(Berean Standard Bible) 본문과 글자까지 같아야 한다. 모든 절에 칠판·핵심·쉬운 설명·문법 설명이 있어야 한다.
import fs from "fs";
import path from "path";
import { inline } from "./parse.mjs";

const MARK = /\[([SVOCQ]):([^\]]*)\]/g;
export const plain = (s) => s.replace(MARK, "$2");

function bsbVerses(file) {
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const out = {};
  for (const v of j.chapter.content.filter((c) => c.type === "verse"))
    out[v.number] = v.content.map((x) => (typeof x === "string" ? x : x.text || "")).join(" ").replace(/\s+/g, " ").trim();
  return out;
}

export function loadSamuel(root) {
  const dir = path.join(root, "영어");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => /^사무엘(상|하)_\d+\.txt$/.test(f)).sort();
  return files.map((f) => {
    const [, book, nn] = f.match(/^사무엘(상|하)_(\d+)\.txt$/);
    const C = { book: "사무엘" + book, n: Number(nn), intro: [], learn: [], verses: [], words: [], sum: [] };
    let v = null;
    for (const raw of fs.readFileSync(path.join(dir, f), "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const [tag, ...x] = line.split("|");
      switch (tag) {
        case "@chapter": C.titleEn = x[2]; C.title = x[3]; break;
        case "@intro": inline(x[0]); C.intro.push(x[0]); break;
        case "@learn": C.learn.push(x[0]); break;
        case "@v": v = { n: Number(x[0]), chunks: [], key: "", easy: [], gram: [] }; C.verses.push(v); break;
        case "@c": v.chunks.push({ en: x[0], ko: x[1] }); break;
        case "@key": v.key = x[0]; break;
        case "@easy": inline(x[0]); v.easy.push(x[0]); break;
        case "@gram": inline(x[0]); v.gram.push(x[0]); break;
        case "@w": C.words.push({ w: x[0], ko: x[1], ref: x[2] }); break;
        case "@sum": C.sum.push(x[0]); break;
        default: throw new Error(`${f}: 모르는 태그 ${line}`);
      }
    }
    const bsb = bsbVerses(path.join(dir, `bsb_1sa_${nn}.json`.replace("1sa", book === "상" ? "1sa" : "2sa")));
    const want = Object.keys(bsb).map(Number);
    const have = C.verses.map((v) => v.n);
    if (JSON.stringify(want) !== JSON.stringify(have)) throw new Error(`${f}: 절 목록이 본문과 다름\n  본문 ${want.join(",")}\n  원고 ${have.join(",")}`);
    for (const v of C.verses) {
      v.text = v.chunks.map((c) => plain(c.en)).join(" ");
      if (v.text !== bsb[v.n]) throw new Error(`${f} ${v.n}절: BSB 본문과 다름\n  원고: ${v.text}\n  BSB : ${bsb[v.n]}`);
      if (!v.key || !v.easy.length || !v.gram.length) throw new Error(`${f} ${v.n}절: 핵심·쉬운 설명·문법 설명 중 빠진 것이 있음`);
      for (const c of v.chunks) if (!c.ko) throw new Error(`${f} ${v.n}절: 직독직해가 없는 청크 "${c.en}"`);
    }
    return C;
  });
}
