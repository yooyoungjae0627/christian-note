// 킹제임스 영어 원고 읽기
//   english.txt : 필수 단어(@w) · 직독직해 청크(@en, @c)
//   grammar.txt : 문법 강의(@g 제목, @gp 문단, @gs 뼈대, @gx 흔히 틀리는 점, @gq 확인 질문|답)
//   syntax.txt  : 절마다 뼈대(@sk)와 구문 강의(@ex)
// 청크를 이은 문장이 kjv_en.json 원문과 글자까지 같아야 하고, 모든 절에 뼈대와 구문 강의가 있어야 빌드된다.
import fs from "fs";
import path from "path";
import { inline } from "./parse.mjs";

const lines = (f) =>
  fs.readFileSync(f, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => l.split("|"));

function skel(segs, roles, where) {
  const s = segs.split(" / "), r = roles.split(" / ");
  if (s.length !== r.length) throw new Error(`뼈대 칸 수가 다름(${where}): 영어 ${s.length}칸, 역할 ${r.length}칸\n  ${segs}\n  ${roles}`);
  return s.map((en, i) => ({ en, role: r[i] }));
}

export function parseEnglish(dir) {
  const f = path.join(dir, "english.txt");
  if (!fs.existsSync(f)) return null;
  const E = { grammar: [], words: [], verses: [] };
  let v = null;
  for (const [tag, ...x] of lines(f)) {
    if (tag === "@w") E.words.push({ w: x[0], ko: x[1], ref: x[2] });
    else if (tag === "@en") { v = { ref: x[0], refKo: x[1], chunks: [], sk: [], ex: [] }; E.verses.push(v); }
    else if (tag === "@c") v.chunks.push({ en: x[0], ko: x[1] });
    else throw new Error("english.txt 모르는 태그: " + tag);
  }
  let g = null;
  for (const [tag, ...x] of lines(path.join(dir, "grammar.txt"))) {
    if (tag === "@g") { g = { title: x[0], items: [] }; E.grammar.push(g); }
    else if (tag === "@gp") { inline(x[0]); g.items.push({ t: "p", text: x[0] }); }
    else if (tag === "@gs") g.items.push({ t: "sk", sk: skel(x[0], x[1], g.title) });
    else if (tag === "@gx") g.items.push({ t: "x", text: x[0] });
    else if (tag === "@gq") g.items.push({ t: "q", q: x[0], a: x[1] });
    else throw new Error("grammar.txt 모르는 태그: " + tag);
  }
  const byRef = Object.fromEntries(E.verses.map((v) => [v.ref, v]));
  let cur = null;
  for (const [tag, ...x] of lines(path.join(dir, "syntax.txt"))) {
    if (tag === "@ref") { cur = byRef[x[0]]; if (!cur) throw new Error("syntax.txt: 직독직해에 없는 절 " + x[0]); }
    else if (tag === "@sk") cur.sk.push(skel(x[0], x[1], cur.ref));
    else if (tag === "@ex") { inline(x[0]); cur.ex.push(x[0]); }
    else throw new Error("syntax.txt 모르는 태그: " + tag);
  }
  // 고어 → 현대 영어(modern.txt). 고어가 남은 청크에 현대 영어가 없으면 빌드를 멈춘다.
  const modern = {}, wmod = {};
  const mf = path.join(dir, "modern.txt");
  if (fs.existsSync(mf)) for (const [tag, ...x] of lines(mf)) {
    if (tag === "@m") modern[x[0]] = x[1];
    else if (tag === "@w") wmod[x[0]] = x[1];
    else throw new Error("modern.txt 모르는 태그: " + tag);
  }
  const allChunks = new Set(E.verses.flatMap((v) => v.chunks.map((c) => c.en)));
  for (const k of Object.keys(modern)) if (!allChunks.has(k)) throw new Error("modern.txt: 직독직해에 없는 청크 " + k);
  for (const k of Object.keys(wmod)) if (!E.words.some((w) => w.w === k)) throw new Error("modern.txt: 필수 단어에 없는 단어 " + k);
  const ARCHAIC = /\b(thee|thou|thy|thine|ye|hath|doth|art|shalt|wilt|unto|spake|bare|whithersoever|wherefore|twain|musick|morrow|brethren|wroth|smite|scrip|girdle|tabrets|commune|behold|an h\w+|\w+eth)\b/i;
  for (const v of E.verses) for (const c of v.chunks) {
    c.modern = modern[c.en] || "";
    const m = c.en.match(ARCHAIC);
    if (m && !c.modern) throw new Error(`고어가 있는데 현대 영어가 없음(${v.ref}): "${c.en}" — ${m[0]}`);
  }
  for (const w of E.words) w.modern = wmod[w.w] || "";
  const src = path.join(dir, "kjv_en.json");
  const kjv = fs.existsSync(src) ? JSON.parse(fs.readFileSync(src, "utf8")) : {};
  for (const v of E.verses) {
    v.text = v.chunks.map((c) => c.en).join(" ");
    v.modern = v.chunks.map((c) => c.modern || c.en).join(" ");
    if (kjv[v.ref] !== v.text) throw new Error(`KJV 원문과 다름: ${v.ref}\n  원고: ${v.text}\n  KJV : ${kjv[v.ref]}`);
    if (!v.sk.length || !v.ex.length) throw new Error("뼈대 또는 구문 강의가 없는 절: " + v.ref);
    // 뼈대의 영어는 그 절 원문에서 가져온 말이어야 한다(괄호로 보충한 생략 주어는 예외)
    for (const sk of v.sk) for (const s of sk) {
      const bare = s.en.replace(/\([^)]*\)/g, "").replace(/[.,;:?]+$/, "").trim();
      if (bare && !v.text.includes(bare)) throw new Error(`뼈대 영어가 원문에 없음(${v.ref}): "${s.en}"`);
    }
  }
  return E;
}
