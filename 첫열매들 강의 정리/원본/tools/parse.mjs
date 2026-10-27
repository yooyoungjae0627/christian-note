// 원고 읽기 + 검사. PDF·EPUB 빌드와 검사 프로그램이 함께 쓴다.
// 책 = book.json + 이야기 폴더들(NN_이름/story.txt, transcript_raw.txt, slides/*.jpg)
import fs from "fs";
import path from "path";

// 시각 "m:ss" 또는 통합 이야기의 둘째 강의부터 "k/m:ss"(k번째 강의). 정렬값 = (k-1)×10⁶ + 초
export const lecOf = (ts) => (/^\d+\//.test(ts) ? Number(ts.split("/")[0]) : 1);
export const tsSec = (ts) => (lecOf(ts) - 1) * 1e6 + ts.replace(/^\d+\//, "").split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
export const ytUrl = (vid, ts) => `https://youtu.be/${vid}?t=${Math.max(0, tsSec(ts) - 3)}`;

const ORD = ["첫", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열", "열한", "열두", "열세", "열네", "열다섯", "열여섯", "열일곱", "열여덟", "열아홉", "스무"];
export const ordinal = (n) => (ORD[n - 1] ? `${ORD[n - 1]} 번째` : `${n}번째`);

export function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
// {1:..} {2:..} {3:..} 강조, {b:..} 굵게, **굵게**
export function inline(s) {
  let out = esc(s);
  for (let i = 0; i < 4; i++) {
    out = out.replace(/\{([123]):([^{}]*)\}/g, (m, l, t) => `<span class="h${l}">${t}</span>`);
    out = out.replace(/\{b:([^{}]*)\}/g, "<b>$1</b>");
  }
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  if (/[{}]/.test(out)) throw new Error("강조 중괄호 짝이 맞지 않음: " + s);
  return out;
}

export function loadBook(root) {
  const book = JSON.parse(fs.readFileSync(path.join(root, "book.json"), "utf8"));
  const dirs = fs.readdirSync(root).filter((d) => /^\d\d_/.test(d) && fs.statSync(path.join(root, d)).isDirectory()).sort();
  // 강의 1개 = 책 1권(사용자 지시 2026-10-09). 책 번호는 명령의 세 번째 인자(build_pdf.mjs <원본> out NN) 또는 ONLY=NN
  const arg = process.argv[4];
  const only = /^\d+$/.test(arg || "") ? Number(arg) : process.env.ONLY ? Number(process.env.ONLY) : 0;
  const nums = dirs.map((d) => parseInt(d, 10));
  nums.forEach((n, i) => { if (n !== i + 1) throw new Error(`이야기 폴더 번호가 이어지지 않음: ${dirs[i]} (기대 ${i + 1})`); });
  if (!only) throw new Error("책 번호(NN)가 필요합니다: 강의 하나가 책 한 권입니다 — node build_pdf.mjs <원본> out NN");
  const d = dirs[nums.indexOf(only)];
  if (!d) throw new Error(`${only}번 이야기 폴더 없음`);
  const S = parseStory(path.join(root, d));
  if (S.n !== only) throw new Error(`[${d}] @story 번호 ${S.n} ≠ 폴더 번호 ${only}`);
  book.stories = [S];
  const nn = String(only).padStart(2, "0");
  book.series = book.title;
  book.only = nn;
  book.title = S.title;
  book.subtitle = S.sub;
  // 표지 그림·문구는 그 강의 주제로(사용자 지시 2026-10-09): 이야기 폴더의 cover.svg와 @cover. 없으면 빌드를 멈춘다
  const art = path.join(S.dir, "cover.svg");
  if (!fs.existsSync(art)) throw new Error(`[${d}] 표지 그림 cover.svg 없음 — 표지는 그 강의 주제로 그린다`);
  if (!S.coverText || !S.coverText.length) throw new Error(`[${d}] @cover(표지 핵심 문장) 없음`);
  book.coverArt = fs.readFileSync(art, "utf8").replace(/<\?xml[^>]*>\s*/, "").replace(/<svg\b/, '<svg width="78mm" height="78mm"');
  book.coverMotto = S.coverText;
  book.pdfName = `${d}.pdf`;
  book.epubName = `${d}.epub`;
  book.uid = book.uid.replace(/.{3}$/, "b" + nn); // 책마다 다른 uid(같은 책은 다시 빌드해도 같은 uid)
  return book;
}

// 녹취록 한 줄: "1:18" + "1분 18초" + 문장 → 시각만 뽑는다
// 통합 이야기(사용자 지시 2026-10-03: 주제가 같거나 비슷한 강의는 한 이야기로 합친다):
// 첫 강의 = transcript_raw.txt, k번째 강의 = transcript_raw_k.txt → 시각 앞에 "k/"를 붙인다
export function transcriptTimes(dir) {
  const files = fs.readdirSync(dir).map((x) => [x, x === "transcript_raw.txt" ? 1 : Number((x.match(/^transcript_raw_(\d+)\.txt$/) || [])[1])]).filter(([, k]) => k).sort((a, b) => a[1] - b[1]);
  return files.flatMap(([x, k]) => fs.readFileSync(path.join(dir, x), "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => {
    const m = l.match(/^(\d+:\d\d(?::\d\d)?)/);
    if (!m) throw new Error("녹취록 시각을 읽을 수 없음: " + l);
    return k === 1 ? m[1] : `${k}/${m[1]}`;
  }));
}

export function parseStory(dir) {
  const src = fs.readFileSync(path.join(dir, "story.txt"), "utf8").split(/\r?\n/);
  const S = { dir, chapters: [], legend: [], storynotes: [], summary: [], quiz: [], faq: [], notes: [], gloss: [], images: [], lectures: [] };
  let ch = null, sec = null;
  const lastTs = {};
  const push = (blk) => { if (!ch) throw new Error("@ch 앞에 내용이 있음"); (sec ? sec.blocks : ch.blocks).push(blk); };
  // 순서 검사는 강의마다 따로(통합 이야기는 두 강의 문단을 주제에 따라 엮을 수 있다)
  const checkTs = (ts) => { const k = lecOf(ts), s = tsSec(ts); if (s < (lastTs[k] ?? -1)) throw new Error(`[${path.basename(dir)}] 시각 순서가 거꾸로: ${ts}`); lastTs[k] = s; };
  const ranges = [];
  for (const raw of src) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [tag, ...f] = line.split("|");
    switch (tag) {
      // 영상ID가 "-"이거나 비면 유튜브 링크를 받지 않은 강의 → 영상 구간 이동(QR·▶)을 넣지 않는다(사용자 지시 2026-10-03)
      case "@story": [S.n, S.title, S.sub, S.vid, S.date, S.speaker, S.orig] = f; S.n = Number(S.n); if (!S.vid || S.vid === "-") S.vid = ""; break;
      // @lecture|원 강의 제목 — 통합 이야기의 강의들(순서 = transcript_raw.txt, _2, _3 …)
      case "@lecture": S.lectures.push(f[0]); break;
      case "@storynote": inline(f[0]); S.storynotes.push(f[0]); break;
      // @cover|줄1|줄2 — 표지에 넣는 그 강의의 핵심 문장(강의 문장 그대로, 2026-10-09 표지는 강의 주제로)
      case "@cover": S.coverText = f.filter(Boolean); break;
      case "@legend": S.legend.push({ name: f[0], color: f[1], meaning: f[2] }); break;
      case "@ch": ch = { num: f[0], title: f[1], sub: f[2] || "", blocks: [], secs: [] }; sec = null; S.chapters.push(ch); break;
      case "@sec": sec = { title: f[0], ts: f[1] || "", blocks: [] }; ch.secs.push(sec); if (f[1]) checkTs(f[1]); break;
      case "@p": {
        const [a, b] = f[0].split("-");
        checkTs(a); if (tsSec(b) < tsSec(a) || lecOf(a) !== lecOf(b)) throw new Error("문단 범위가 거꾸로이거나 두 강의에 걸침: " + f[0]);
        const text = f.slice(1).join("|"); inline(text);
        ranges.push([a, b]); push({ t: "p", ts: a, end: b, text });
        break;
      }
      // @img|파일|캡션|구절(// 로 단락 나눔, 비우면 구절 상자 없음)|출처
      case "@img": {
        const file = path.join(dir, "slides", f[0]);
        // FIGS_OK=1: 아직 찍지 않은 만든 그림(figs/NN.html)도 있는 것으로 본다(원고 검사 전용)
        const figSrc = path.join(dir, "figs", f[0].replace(/\.jpe?g$/i, ".html"));
        if (!fs.existsSync(file) && !(process.env.FIGS_OK && fs.existsSync(figSrc))) throw new Error("슬라이드 파일 없음: " + file);
        (f[2] || "").split("//").forEach(inline);
        // 다섯째 칸 "made" = 정리한 사람이 만든 그림(슬라이드 스크린샷이 없는 강의)
        S.images.push(f[0]); push({ t: "img", file: f[0], path: file, cap: f[1], verse: f[2] || "", src: f[3] || "", made: f[4] === "made" });
        break;
      }
      // @verse|머리|구절(//)|출처|읽음 또는 언급 — 그림 없는 말씀 상자(표준킹제임스성경 본문, 옛 책은 한글KJV)
      case "@verse": f[1].split("//").forEach(inline); push({ t: "verse", head: f[0], text: f[1], src: f[2], kind: f[3] || "읽음" }); break;
      case "@note": inline(f[1]); push({ t: "note", term: f[0], text: f[1] }); S.notes.push({ term: f[0], text: f[1] }); break;
      case "@summary": inline(f.join("|")); S.summary.push(f.join("|")); break;
      case "@quiz": S.quiz.push({ q: f[0], a: f[1], why: f[2], ts: f[3] }); tsSec(f[3]); break;
      case "@faq": S.faq.push({ q: f[0], a: f[1], why: f[2], ts: f[3] }); tsSec(f[3]); break;
      case "@gloss": S.gloss.push({ term: f[0], text: f[1] }); break;
      default: throw new Error("모르는 태그: " + line);
    }
  }
  if (S.vid && !/^[\w-]{11}$/.test(S.vid)) throw new Error("영상ID 이상: " + S.vid);
  if (S.lectures.length > 1 && S.vid) throw new Error("통합 이야기에 영상ID 하나를 둘 수 없음(강의마다 영상이 다름)");
  // 쪽 공란 맞춤(fit.mjs가 씀): 그림을 같은 소제목 안에서 앞뒤 문단 단위로 옮긴다. {"06.jpg": 1} = 다음 문단 뒤로
  S.layout = fs.existsSync(path.join(dir, "layout.json")) ? JSON.parse(fs.readFileSync(path.join(dir, "layout.json"), "utf8")) : {};
  for (const [file, shift] of Object.entries(S.layout)) applyShift(S, file, shift);
  // 장 시각 = 그 장의 첫 시각
  for (const c of S.chapters) {
    const all = [...c.blocks, ...c.secs.flatMap((s) => [{ ts: s.ts }, ...s.blocks])];
    c.ts = (all.find((b) => b.ts) || {}).ts || "";
  }
  // ── 검사 ──
  const problems = [];
  // 1) 녹취록의 모든 줄이 문단 범위 하나에만 들어가는가(빠짐·겹침 없음)
  const times = transcriptTimes(dir);
  for (const t of times) {
    const hit = ranges.filter(([a, b]) => tsSec(t) >= tsSec(a) && tsSec(t) <= tsSec(b));
    if (hit.length !== 1) problems.push(`녹취록 ${t}이(가) 문단 ${hit.length}개에 들어감`);
  }
  for (const [a, b] of ranges) {
    if (!times.includes(a)) problems.push(`문단 시작 ${a}이(가) 녹취록에 없음`);
    if (!times.includes(b)) problems.push(`문단 끝 ${b}이(가) 녹취록에 없음`);
  }
  // 2) slides 폴더의 그림이 모두 정확히 한 번씩
  const lsd = (d) => (fs.existsSync(path.join(dir, d)) ? fs.readdirSync(path.join(dir, d)) : []);
  const files = [...new Set([...lsd("slides").filter((x) => /\.(jpe?g|png)$/i.test(x)), ...(process.env.FIGS_OK ? lsd("figs").filter((x) => x.endsWith(".html")).map((x) => x.replace(/\.html$/, ".jpg")) : [])])].sort();
  for (const x of files) { const k = S.images.filter((y) => y === x).length; if (k !== 1) problems.push(`슬라이드 ${x} 사용 ${k}번`); }
  // 3) 뒷부분 분량(지침 ① §5)
  if (S.summary.length < 12 || S.summary.length > 22) problems.push(`한눈에 보는 이야기 ${S.summary.length}줄(12~22)`);
  if (S.quiz.length < 25 || S.quiz.length > 41) problems.push(`개념 문제 ${S.quiz.length}개(25~41)`);
  if (S.faq.length < 12 || S.faq.length > 14) problems.push(`예상 질문 ${S.faq.length}개(12~14)`);
  if (problems.length) throw new Error(`[${path.basename(dir)}] 원고 검사 실패\n  ` + problems.join("\n  "));
  S.transcriptLines = times.length;
  return S;
}

// 문단 단위 = 문단 + 그 바로 아래 용어 상자들(용어 상자는 자기 문단과 떨어지지 않는다)
function applyShift(S, file, shift) {
  const lists = S.chapters.flatMap((c) => [c.blocks, ...c.secs.map((s) => s.blocks)]);
  const list = lists.find((l) => l.some((b) => b.t === "img" && b.file === file));
  if (!list || !shift) return;
  let i = list.findIndex((b) => b.t === "img" && b.file === file);
  const [img] = list.splice(i, 1);
  for (let k = 0; k < Math.abs(shift); k++) {
    if (shift > 0) {
      if (list[i]?.t !== "p") break;
      i++; while (list[i]?.t === "note") i++;
    } else {
      let j = i - 1; while (list[j]?.t === "note") j--;
      if (list[j]?.t !== "p") break;
      i = j;
    }
  }
  list.splice(i, 0, img);
}

// 이야기마다 쓰는 고정 id
export const sid = (S, k = "") => `S${S.n}${k}`;
export const chId = (S, i) => `S${S.n}c${i}`;
export const secId = (S, i, j) => `S${S.n}c${i}s${j}`;
export const tocId = (S) => `toc-S${S.n}`;
export const chLabel = (c) => (/^\d+$/.test(c.num) && c.num !== "0" ? `${c.num}장` : "");
