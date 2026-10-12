// 2순위 외부 해설 원문 보관 — 스코필드 관주 해설(Scofield Reference Notes, 1917 개정판, 저작권 만료)
// 출처: biblestudytools.com/commentaries/scofield-reference-notes/ (원문 글자 그대로, 링크만 글자로 풀어 둠)
//   node tools/chapterbook/fetch_scofield.mjs  → memory-bank/세대주의_해설/scofield/<book>-NN.md
import fs from "fs";
const OUT = "memory-bank/세대주의_해설/scofield";
const BOOKS = [["genesis", "창세기", "Genesis", 50], ["1-samuel", "사무엘상", "1 Samuel", 31], ["2-samuel", "사무엘하", "2 Samuel", 24]];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ent = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&mdash;/g, "—").replace(/&ndash;/g, "–");
fs.mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [slug, ko, en, n] of BOOKS) for (let ch = 1; ch <= n; ch++) {
  const url = `https://www.biblestudytools.com/commentaries/scofield-reference-notes/${slug}/${slug}-${ch}.html`;
  const file = `${OUT}/${slug}-${String(ch).padStart(2, "0")}.md`;
  if (fs.existsSync(file)) continue;
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0 Safari/537.36" } });
  const h = await r.text();
  let notes = [];
  const a = h.indexOf('id="pelcro-embedded-paywall"');
  if (r.ok && a > 0) {
    let seg = h.slice(h.indexOf(">", a) + 1, h.indexOf("</div>", a));
    seg = seg.replace(/<a [^>]*>([\s\S]*?)<\/a>/g, "$1").replace(/<i>|<\/i>/g, "");
    const parts = seg.split(/<b><span>/);
    // 표제어 없이 시작하는 주석(앞 장에서 이어지는 주석 등)도 버리지 않는다
    if (parts[0].replace(/<[^>]+>/g, "").trim()) parts[0] = "(표제 없음)</span></b>" + parts[0]; else parts.shift();
    for (const part of parts) {
      const [head, body] = part.split(/<\/span><\/b>/);
      const text = ent(body.replace(/<p>/g, "\n").replace(/<[^>]+>/g, "")).split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n\n");
      notes.push({ head: ent(head.replace(/<[^>]+>/g, "").trim()), text });
    }
  }
  let md = `# 스코필드 관주 해설 — ${ko} ${ch}장 (${en} ${ch})\n\n| 항목 | 내용 |\n|---|---|\n| 원문 | Scofield Reference Notes (1917 Edition), C. I. Scofield — 저작권 만료 |\n| 주소 | ${url} |\n| 보관 | 2026-10-12, HTTP ${r.status}, 주석 ${notes.length}개 |\n\n> 성경 해석 지침의 2순위(외부 해설) 원문 보관본. 글자를 고치지 않는다(링크는 글자로만 남김). 교재에는 교회 교리에 가까운 대목만, 출처와 함께 쓴다.\n`;
  md += notes.length ? notes.map((x, i) => `\n## ${i + 1}. ${x.head}\n\n${x.text}\n`).join("") : "\n(이 장에는 주석이 없습니다.)\n";
  fs.writeFileSync(file, md);
  total += notes.length;
  console.log(slug, ch, r.status, notes.length);
  await sleep(700);
}
console.log("notes", total);
