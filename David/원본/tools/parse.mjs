// 원고(lesson.txt) 읽기 + 검사. PDF·EPUB 빌드가 함께 쓴다.
import fs from "fs";
import path from "path";
import { parseEnglish } from "./english.mjs";

export const tsSec = (ts) => ts.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
export const ytUrl = (vid, ts) => `https://youtu.be/${vid}?t=${Math.max(0, tsSec(ts) - 3)}`;

export function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// {1:..} {2:..} {3:..} 강조 + **굵게**
export function inline(s) {
  let out = esc(s);
  for (let i = 0; i < 4; i++) out = out.replace(/\{([123]):([^{}]*)\}/g, (m, l, t) => `<span class="h${l}">${t}</span>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  if (/[{}]/.test(out)) throw new Error("강조 중괄호 짝이 맞지 않음: " + s);
  return out;
}

export function loadBook(root) {
  const book = JSON.parse(fs.readFileSync(path.join(root, "book.json"), "utf8"));
  const dirs = fs.readdirSync(root).filter((d) => /^\d+강$/.test(d)).sort((a, b) => parseInt(a) - parseInt(b));
  // ONLY=N: 그 강 하나만 한 권으로(강의별 책, 사용자 지시 2026-10-09)
  // 강 번호는 명령의 세 번째 인자(build_pdf.mjs <원본> out NN) 또는 ONLY=NN — 지침 §4-3
  const arg = process.argv[4];
  const only = /^\d+$/.test(arg || "") ? Number(arg) : process.env.ONLY ? Number(process.env.ONLY) : 0;
  book.lessons = dirs.filter((d) => !only || parseInt(d) === only).map((d) => parseLesson(path.join(root, d)));
  if (only && !book.lessons.length) throw new Error(`${only}강 폴더 없음`);
  if (only) { const L = book.lessons[0], nn = String(L.n).padStart(2, "0"); book.only = nn; { const ld = path.join(root, dirs.find((x) => parseInt(x) === only)), art = path.join(ld, "cover.svg"); if (!fs.existsSync(art)) throw new Error(`${nn}강 표지 그림 cover.svg 없음 — 표지는 그 강의 주제로 그린다`); if (!L.coverText) throw new Error(`${nn}강 @cover(표지 핵심 문장) 없음`); book.coverArt = fs.readFileSync(art, "utf8").replace(/<\?xml[^>]*>\s*/, "").replace(/<svg\b/, '<svg width="62mm" height="62mm"'); book.coverMotto = L.coverText; } book.subtitle = `${L.n}강 · ${L.title}`; book.pdfName = `다윗의_삶_${nn}강_말씀판.pdf`; book.epubName = `다윗의_삶_${nn}강_말씀판.epub`; }
  if (!only) book.lessons.forEach((L, i) => { if (L.n !== i + 1) throw new Error(`강 번호가 이어지지 않음: ${L.n}강 (기대 ${i + 1}강)`); });
  return book;
}

export function parseLesson(dir) {
  const src = fs.readFileSync(path.join(dir, "lesson.txt"), "utf8").split(/\r?\n/);
  const L = { chapters: [], summary: [], notes: [], gloss: [] };
  let ch = null, sec = null, lastTs = -1;
  const push = (blk) => { (sec ? sec.blocks : ch.blocks).push(blk); };
  for (const raw of src) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [tag, ...f] = line.split("|");
    switch (tag) {
      case "@lesson": [L.n, L.title, L.range, L.vid, L.date, L.speaker] = f; L.n = Number(L.n); L.orig = f.slice(6).join("|"); break;
      case "@ch": ch = { num: f[0], title: f[1], sub: f[2] || "", blocks: [], secs: [] }; sec = null; L.chapters.push(ch); break;
      case "@sec": sec = { title: f[0], ts: f[1] || "", blocks: [] }; ch.secs.push(sec); if (f[1]) checkTs(f[1]); break;
      // 시각이 "-"인 문단은 정리한 사람이 덧붙인 글(영상 구간 없음)
      case "@p": if (f[0] !== "-") checkTs(f[0]); inline(f.slice(1).join("|")); push({ t: "p", ts: f[0] === "-" ? "" : f[0], text: f.slice(1).join("|") }); break;
      // 다섯째 칸이 "언급"이면 강의에서 소리 내어 읽지 않고 말로 언급한 구절
      case "@verse": f[1].split("//").forEach(inline); push({ t: "verse", head: f[0], text: f[1], src: f[2], ref: f[3] === "언급" }); break;
      case "@map": push({ t: "map", key: f[0] }); break;
      // 등장인물 카드: 이어진 @person 줄을 한 묶음으로
      case "@person": {
        inline(f[2]);
        const list = sec ? sec.blocks : ch.blocks;
        if (list.at(-1)?.t !== "people") list.push({ t: "people", items: [] });
        list.at(-1).items.push({ name: f[0], role: f[1], text: f[2] });
        break;
      }
      case "@years": push({ t: "years", head: f, rows: [] }); break;
      case "@yr": (sec ? sec.blocks : ch.blocks).at(-1).rows.push(f); break;
      case "@yearnote": (sec ? sec.blocks : ch.blocks).at(-1).note = f[0]; break;
      case "@note": push({ t: "note", term: f[0], text: f[1] }); L.notes.push({ term: f[0], text: f[1], lesson: L.n }); break;
      case "@summary": L.summary.push(f.join("|")); break;
      case "@cover": L.coverText = f.filter(Boolean); break; // 표지 핵심 문장(강의 문장 그대로, 2026-10-09)
      case "@gloss": L.gloss.push({ term: f[0], text: f[1], lesson: L.n }); break;
      default: throw new Error("모르는 태그: " + line);
    }
  }
  function checkTs(ts) {
    const s = tsSec(ts);
    if (s < lastTs) throw new Error(`시각 순서가 거꾸로: ${ts}`);
    lastTs = s;
  }
  // 장 시각 = 그 장의 첫 시각(덧붙인 장은 시각 없음)
  for (const c of L.chapters) {
    const all = [...c.blocks, ...c.secs.flatMap((s) => [{ ts: s.ts }, ...s.blocks])];
    c.ts = (all.find((b) => b.ts) || {}).ts || "";
  }
  L.english = parseEnglish(dir);
  if (!L.vid || !/^[\w-]{11}$/.test(L.vid)) throw new Error("영상ID 이상: " + L.vid);
  return L;
}

