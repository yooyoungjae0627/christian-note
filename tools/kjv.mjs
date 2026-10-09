// 표준킹제임스성경 본문 찾기 — kingjamesbiblekorea.com/parallel (표준킹제임스성경 한영대역, 표준역 3판).
// 세 시리즈·카드 공통 기본 역본(README.md §3, 사용자 지시 2026-10-10). 출처 표기는 끝에 `· 표준킹제임스성경`.
//   node tools/kjv.mjs "창세기 1:1-5" ["시편 23:1" …]   → 절마다 "책 장:절 | 한글 본문" 한 줄
//   node tools/kjv.mjs --en "창세기 1:1"                 → 영어(KJV) 줄도 함께
//   node tools/kjv.mjs --json "창세기 1:1-31"            → [{book, ref, ko, en, koHtml, enHtml}]
// 본문은 사이트 글자 그대로 돌려준다(¶ 문단 표시 포함). koHtml/enHtml은 사이트의 글꼴 표시만 남긴 것:
//   <span class="g1"> 대문자 낱말(God·Day 등) / g2 = LORD God의 하나님·Spirit / g3 = LORD(주), <i> = KJV 이탤릭(번역자 첨가)
// 받은 페이지는 임시 폴더(%TEMP%/stdkjv-cache)에 저장해 다시 받지 않는다(저장소에 캐시를 두지 않는다).
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const SITE = "https://kingjamesbiblekorea.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const CACHE = path.join(os.tmpdir(), "stdkjv-cache");

// 사이트 책 이름과 다르게 흔히 쓰는 이름
const ALIAS = {
  "여호수아": "여호수아기", "사무엘상": "사무엘기상", "사무엘하": "사무엘기하", "역대상": "역대기상", "역대하": "역대기하",
  "느헤미야": "느헤미야기", "에스더": "에스더기", "아가": "솔로몬의 아가", "이사야": "이사야서", "예레미야": "예레미야서",
  "애가": "예레미야애가", "에스겔": "에스겔서", "다니엘": "다니엘서", "요한복음서": "요한복음",
};

async function cached(name, url) {
  const f = path.join(CACHE, name);
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const h = await r.text();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(f, h);
  return h;
}

let books;
async function slugOf(book) {
  if (!books) {
    const h = await cached("parallel.html", `${SITE}/parallel`);
    books = new Map([...h.matchAll(/href="\/p\/([^/"]+)\/1">([^<]+)</g)].map((m) => [m[2].trim(), m[1]]));
    if (books.size !== 66) throw new Error(`책 목록이 66권이 아님: ${books.size}`);
  }
  const name = ALIAS[book] || book;
  if (!books.has(name)) throw new Error(`책 이름을 찾지 못함: ${book} (사이트 이름: ${[...books.keys()].join(", ")})`);
  return { name, slug: books.get(name) };
}

const decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const plain = (s) => decode(s.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
const marks = (s) => s
  .replace(/<span class="font-g font-light">([^<]*)<\/span>/g, '<span class="g1">$1</span>')
  .replace(/<span class="font-g font-semibold">([^<]*)<\/span>/g, '<span class="g2">$1</span>')
  .replace(/<span class="font-g font-black">([^<]*)<\/span>/g, '<span class="g3">$1</span>')
  .replace(/<span class="italic">([^<]*)<\/span>/g, "<i>$1</i>")
  .replace(/<(?!\/?(?:i|span)\b)[^>]*>/g, "").replace(/\s+/g, " ").trim();

async function chapter(book, ch) {
  const { name, slug } = await slugOf(book);
  const h = await cached(`${slug}-${ch}.html`, `${SITE}/p/${encodeURIComponent(slug)}/${ch}`);
  const out = new Map();
  for (const m of h.matchAll(/<div class="verse[^"]*">\s*<p[^>]*><span class="mr-2">(\d+)<\/span>([\s\S]*?)<\/p>\s*<p[^>]*><span class="hidden[^"]*">\d+<\/span>([\s\S]*?)<\/p>/g)) {
    out.set(+m[1], { book: name, ref: `${ch}:${m[1]}`, ko: plain(m[2]), en: plain(m[3]), koHtml: marks(m[2]), enHtml: marks(m[3]) });
  }
  if (!out.size) throw new Error(`장을 읽지 못함: ${name} ${ch}`);
  return out;
}

// "창세기 1:1-31" → [{book, ref, ko, en, koHtml, enHtml}, …]
export async function verses(ref) {
  const m = ref.trim().match(/^(.+?)\s*(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error("구절 표기 이상: " + ref);
  const [, book, ch, a, z = a] = m;
  const vs = await chapter(book.trim(), +ch);
  const out = [];
  for (let n = +a; n <= +z; n++) {
    if (!vs.has(n)) throw new Error(`절을 찾지 못함: ${book} ${ch}:${n}`);
    out.push(vs.get(n));
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))) {
  const args = process.argv.slice(2);
  const en = args.includes("--en"), json = args.includes("--json");
  const refs = args.filter((a) => !a.startsWith("--"));
  const all = [];
  let bad = 0;
  for (const r of refs) {
    try {
      for (const v of await verses(r)) {
        all.push(v);
        if (!json) { console.log(`${v.book} ${v.ref} | ${v.ko}`); if (en) console.log(`${" ".repeat(v.book.length)} ${v.ref} | ${v.en}`); }
      }
    } catch (e) { bad++; console.error(`!! ${r}: ${e.message}`); }
  }
  if (json) console.log(JSON.stringify(all, null, 1));
  process.exit(bad ? 1 : 0);
}
