// 한글KJV 본문 찾기(hangl.net/bible_kor_kjv). 슬라이드가 없는 이야기의 구절 상자는 이 본문을 글자 그대로 쓴다.
// node kjv.mjs "디모데전서 4:7-8" ["시편 5:3" …]   → 절마다 한 줄씩 출력
// 받은 장 페이지는 작업 폴더의 kjvcache/에 저장해 다시 받지 않는다.
import fs from "fs";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";
const get = async (u) => (await fetch(u, { headers: { "User-Agent": UA } })).text();

async function findDoc(book, ch) {
  const pads = book === "시편" ? [`${String(ch).padStart(3, "0")}편`, `${String(ch).padStart(2, "0")}편`, `${String(ch).padStart(3, "0")}장`, `${String(ch).padStart(2, "0")}장`, `${ch}편`] : [`${String(ch).padStart(2, "0")}장`, `${ch}장`];
  for (const p of pads) {
    const q = `${book} ${p}`;
    const h = await get(`https://hangl.net/index.php?mid=bible_kor_kjv&search_target=title&search_keyword=${encodeURIComponent(q)}`);
    for (const m of h.matchAll(/href="[^"]*?(?:bible_kor_kjv\/|document_srl=)(\d+)[^"]*"[^>]*>([\s\S]{0,200}?)<\/a>/g)) {
      const title = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      if (title === `한글KJV ${q}`) return m[1];
    }
  }
  throw new Error(`장을 찾지 못함: ${book} ${ch}`);
}

async function chapterText(id) {
  const f = `kjvcache/${id}.html`;
  let h;
  if (fs.existsSync(f)) h = fs.readFileSync(f, "utf8");
  else { h = await get(`https://hangl.net/bible_kor_kjv/${id}`); fs.mkdirSync("kjvcache", { recursive: true }); fs.writeFileSync(f, h); }
  const body = h.split("xe_content")[1] || h;
  return body.replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n").replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    // 사이트 표시 "p주p" = KJV의 Sir를 '주'로 옮긴 곳 표시(본문 글자가 아님) → "주"
    .replace(/p주p/g, "주");
}

// "디모데전서 4:7-8" → [{ref:"4:7", text}, …]
export async function verses(ref) {
  const m = ref.trim().match(/^(.+?)\s*(\d+):(\d+)(?:-(\d+))?$/);
  if (!m) throw new Error("구절 표기 이상: " + ref);
  const [, book, ch, a, z = a] = m;
  const txt = await chapterText(await findDoc(book, +ch));
  const lines = txt.split("\n").map((s) => s.replace(/^.*?">/, "").trim());
  const out = [];
  for (let n = +a; n <= +z; n++) {
    const line = lines.find((l) => l.startsWith(`${ch}:${n} `));
    if (!line) throw new Error(`절을 찾지 못함: ${book} ${ch}:${n}`);
    out.push({ ref: `${ch}:${n}`, text: line.slice(`${ch}:${n} `.length).trim() });
  }
  return out;
}

if (process.argv.length > 2) {
  for (const r of process.argv.slice(2)) {
    try { for (const v of await verses(r)) console.log(`${r.replace(/\s*\d+:.*$/, "")} ${v.ref} | ${v.text}`); }
    catch (e) { console.log(`!! ${r}: ${e.message}`); }
  }
}
