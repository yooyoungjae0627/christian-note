// 단원 책 맨 뒤 「어학 학습 부록」 — 영어·일본어 독해·회화(사용자 지시 2026-11-21, 규칙 원본 docs/policy/성경_어학학습_부록_지침.md)
//   node tools/chapterbook/lang.mjs genesis check [N …]    원고 검사 — 종료 코드 0이어야 빌드에 붙는다
// 원고: 단원 원고와 같은 폴더의 <책>-langNN.json
// { "lessons": [ {                                       // 단원의 단락(sections)과 같은 수·같은 ref 순서
//     "ref": "39:1-3", "title": "단락 제목과 같게",
//     "en_read": { "ref": "39:2", "chunks": [{ "en": "WEB 글자 그대로 조각", "snd": "한글 소리", "ko": "뜻" }], "grammar": [{ "name": "문법", "text": "풀이" }] },
//     "en_talk": { "scene": "장면", "lines": [{ "who": "A", "en": "…", "snd": "…", "ko": "…" }], "keys": [{ "t": "표현", "snd": "…", "ko": "…" }] },
//     "ja_read": { "ref": "39:2", "chunks": [{ "ja": "主[しゅ]は", "snd": "슈와", "ko": "주께서는" }], "words": [{ "ja": "共[とも]に", "snd": "토모니", "ko": "함께" }], "point": [{ "name": "…", "text": "…" }] },
//     "ja_talk": { "scene": "…", "lines": [{ "who": "A", "ja": "…", "snd": "…", "ko": "…" }], "keys": [{ "t": "…", "snd": "…", "ko": "…" }] } } ] }
// 검사: 영어 조각을 띄어 이으면 WEB 절(또는 그 연속 일부)과 글자까지 같음 · 일본어 조각에서 [읽기]를 걷고 이으면 일본어 절(또는 연속 일부)과 같음 ·
//       모든 한자에 후리가나 · 모든 줄에 한글 소리(한글·문장부호만) · 단락 수·범위 일치.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { R, BOOKS, esc, webOf } from "./lib.mjs";
import { useBook, loadUnit, unitDir } from "./units.mjs";
import { qrFile } from "./html.mjs";
const pathUrl = (p) => "file:///" + p.replace(/\\/g, "/");

const JA_VERSES = { genesis: "창세기/원본/2판/verses-genesis-ja.json" };
export const langFile = (book, n) => { useBook(book); return path.join(unitDir(), `${book}-lang${String(n).padStart(2, "0")}.json`); };
export const hasLang = (book, n) => { try { return fs.existsSync(langFile(book, n)); } catch { return false; } };
const loadLang = (book, n) => JSON.parse(fs.readFileSync(langFile(book, n), "utf8"));
const jaVerses = (book) => { const f = JA_VERSES[book]; if (!f) return null; const d = JSON.parse(fs.readFileSync(path.join(R, f), "utf8")); return { source: d.source, map: Object.fromEntries(d.verses.map((v) => [v.ref, v.ja])) }; };

const KANJI = /[㐀-鿿豈-﫿々〆]/;
const RUBY = /([㐀-鿿豈-﫿々〆]+)\[([ぁ-ゖー]+)\]/g;
const plainJa = (s) => s.replace(RUBY, "$1");
const SND = /^[가-힣ㄱ-ㅎ\s\-,.?!~·…“”"'()「」『』:;]+$/;
const inRange = (ref, range) => {
  const [c, v] = ref.split(":").map(Number); const m = range.match(/^(\d+):(\d+)-(\d+)$/) || range.match(/^(\d+):(\d+)$/);
  return m && c === +m[1] && v >= +m[2] && v <= +(m[3] ?? m[2]);
};

export function checkLang(book, n) {
  const E = [];
  if (!hasLang(book, n)) return ["원고 없음 " + langFile(book, n)];
  let d; try { d = loadLang(book, n); } catch (e) { return ["JSON 오류 " + e.message]; }
  const u = loadUnit(n);
  const secs = u.parts.flatMap((x) => x.d.sections);
  const ja = jaVerses(book); if (!ja) return [`${book} 일본어 본문 파일이 정해지지 않음(JA_VERSES)`];
  if (!Array.isArray(d.lessons) || d.lessons.length !== secs.length) E.push(`레슨 수 ${d.lessons?.length} ≠ 단락 수 ${secs.length}`);
  const sndOk = (s, at) => { if (!s || !SND.test(s)) E.push(`${at} 한글 소리가 없거나 한글 아닌 글자: ${JSON.stringify(s)}`); };
  const rubyOk = (s, at) => { if (!s) { E.push(at + " 일본어 없음"); return; } const rest = s.replace(RUBY, ""); if (KANJI.test(rest)) E.push(`${at} 후리가나 없는 한자: ${s}`); if (/[\[\]]/.test(rest)) E.push(`${at} 괄호 형식 오류: ${s}`); };
  (d.lessons || []).forEach((L, i) => {
    const s = secs[i] || {}; const at = `레슨 ${i + 1}(${L.ref})`;
    if (L.ref !== s.ref) E.push(`${at} ref가 단락 ${s.ref}과 다름`);
    if (L.title !== s.title) E.push(`${at} 제목이 단락 제목 「${s.title}」과 다름`);
    // 영어 독해
    const er = L.en_read || {};
    if (!er.ref || !inRange(er.ref, L.ref)) E.push(`${at} 영어 독해 절 ${er.ref}이 단락 범위 밖`);
    else {
      const web = webOf(book, er.ref); const joined = (er.chunks || []).map((c) => c.en).join(" ");
      if (!web) E.push(`${at} WEB ${er.ref} 없음`);
      else if (!joined || !web.includes(joined)) E.push(`${at} 영어 조각을 이은 글이 WEB ${er.ref}과 다름: ${joined}`);
      (er.chunks || []).forEach((c, k) => { sndOk(c.snd, `${at} 영어 독해 ${k + 1}`); if (!c.ko) E.push(`${at} 영어 독해 ${k + 1} 뜻 없음`); });
    }
    if (!er.grammar?.length) E.push(`${at} 영어 문법 없음`);
    // 일본어 독해
    const jr = L.ja_read || {};
    if (!jr.ref || !inRange(jr.ref, L.ref)) E.push(`${at} 일본어 독해 절 ${jr.ref}이 단락 범위 밖`);
    else {
      const v = ja.map[jr.ref]; const joined = (jr.chunks || []).map((c) => plainJa(c.ja || "")).join("");
      if (!v) E.push(`${at} 일본어 ${jr.ref} 없음`);
      else if (!joined || !v.includes(joined)) E.push(`${at} 일본어 조각을 이은 글이 본문 ${jr.ref}과 다름: ${joined}`);
      (jr.chunks || []).forEach((c, k) => { rubyOk(c.ja, `${at} 일본어 독해 ${k + 1}`); sndOk(c.snd, `${at} 일본어 독해 ${k + 1}`); if (!c.ko) E.push(`${at} 일본어 독해 ${k + 1} 뜻 없음`); });
    }
    if (jr.words) E.push(`${at} ja_read.words는 review.ja_words로 옮김(2026-11-21)`);
    // ⑤ 정리 — 구문(새 예문)·단어(그 레슨 글에 실제로 나온 말)
    const rv = L.review || {};
    const enText = [er.chunks, L.en_talk?.lines, L.en_talk?.keys].flat().filter(Boolean).map((x) => x.en || x.t || "").join(" ").toLowerCase();
    const jaText = [jr.chunks, L.ja_talk?.lines, L.ja_talk?.keys].flat().filter(Boolean).map((x) => plainJa(x.ja || x.t || "")).join("");
    for (const [k, lang] of [["en_pat", "en"], ["ja_pat", "ja"]]) {
      const ps = rv[k] || []; const nm = lang === "en" ? "영어 구문" : "일본어 구문";
      if (ps.length < 1 || ps.length > 3) E.push(`${at} ${nm} 1–3개`);
      ps.forEach((p, j) => { const a = `${at} ${nm} ${j + 1}`; if (!p.pat) E.push(a + " 구문 없음"); if (lang === "ja") { rubyOk(p.pat, a); rubyOk(p.ex, a + " 예문"); } else if (!p.ex || /[가-힣]/.test(p.ex)) E.push(a + " 영어 예문 없음"); sndOk(p.snd, a); if (!p.ko) E.push(a + " 뜻 없음"); });
    }
    const POS = new Set(["명", "동", "형", "부", "전", "접", "대"]);
    const ews = rv.en_words || []; if (ews.length < 4 || ews.length > 8) E.push(`${at} 영어 단어 4–8개`);
    ews.forEach((w, j) => { const a = `${at} 영어 단어 ${j + 1}(${w.w})`; const f = (w.from || w.w || "").toLowerCase(); if (!f || !new RegExp(`(^|[^a-z])${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(enText)) E.push(`${a} 이 레슨 영어 글에 없음(from)`); if (!POS.has(w.pos)) E.push(`${a} 품사(${[...POS].join("·")})`); sndOk(w.snd, a); if (!w.ko) E.push(a + " 뜻 없음"); });
    const jws = rv.ja_words || []; if (jws.length < 4 || jws.length > 8) E.push(`${at} 일본어 단어 4–8개`);
    jws.forEach((w, j) => { const a = `${at} 일본어 단어 ${j + 1}(${w.ja})`; rubyOk(w.ja, a); const f = w.from || plainJa(w.ja || ""); if (!f || !jaText.includes(f)) E.push(`${a} 이 레슨 일본어 글에 없음(from)`); sndOk(w.snd, a); if (!w.ko) E.push(a + " 뜻 없음"); });
    // 회화
    for (const [key, lang] of [["en_talk", "en"], ["ja_talk", "ja"]]) {
      const t = L[key] || {}; const nm = lang === "en" ? "영어 회화" : "일본어 회화";
      if (!t.scene) E.push(`${at} ${nm} 장면 없음`);
      if (!t.lines || t.lines.length < 3 || t.lines.length > 6) E.push(`${at} ${nm} 줄 수 3–6`);
      (t.lines || []).forEach((l, k) => { if (lang === "ja") rubyOk(l.ja, `${at} ${nm} ${k + 1}`); else if (!l.en || /[가-힣]/.test(l.en)) E.push(`${at} ${nm} ${k + 1} 영어 없음`); sndOk(l.snd, `${at} ${nm} ${k + 1}`); if (!l.ko) E.push(`${at} ${nm} ${k + 1} 뜻 없음`); });
      (t.keys || []).forEach((x, k) => { if (lang === "ja") rubyOk(x.t, `${at} ${nm} 표현 ${k + 1}`); sndOk(x.snd, `${at} ${nm} 표현 ${k + 1}`); });
      if (!t.keys?.length) E.push(`${at} ${nm} 핵심 표현 없음`);
    }
  });
  return E;
}

// ---------- 듣기(원어민 음성 버튼, 사용자 지시 2026-11-21 「원어민 읽어주는 버튼」 → 방법 1: 듣기 웹페이지) ----------
// 버튼·QR은 GitHub Pages의 listen/ 페이지를 연다. 그 페이지가 기기에 내장된 영어·일본어 음성(Web Speech API)으로 읽는다.
// 데이터: listen/data/<책>-<단원>.json — 빌드가 원고에서 만든다(exportLang). 일본어는 후리가나 읽기(가나)로 읽혀 한자 오독을 막는다.
export const LISTEN_BASE = "https://yooyoungjae0627.github.io/christian-note/listen/";
export const listenUrl = (book, n, k) => `${LISTEN_BASE}?b=${book}&u=${n}&k=${k}`;
// 음성은 한자 섞인 원래 글을 읽혀야 조사(は=와)를 바르게 읽는다. 읽기가 갈리는 한자만 후리가나로 바꿔 읽힌다(主=しゅ, 長=ちょう).
const SAY_KANA = new Set(["主", "長"]);
const kanaJa = (s) => s.replace(RUBY, (m, k, r) => SAY_KANA.has(k) ? r : k);
export function langItems(book, n) {
  const d = loadLang(book, n), ja = jaVerses(book), B = BOOKS[book];
  const it = (id, lang, show, say, snd, ko, kind) => ({ id, lang, show, say, snd, ko, kind });
  return {
    book, unit: n, title: `${B.ko} ${loadUnit(n).title}`, range: d.range,
    lessons: d.lessons.map((L, j) => {
      const i = j + 1, er = L.en_read, jr = L.ja_read, et = L.en_talk, jt = L.ja_talk;
      const enV = er.chunks.map((c) => c.en).join(" "), jaV = jr.chunks.map((c) => c.ja).join("");
      return {
        no: i, ref: L.ref, title: L.title, enRef: er.ref, jaRef: jr.ref, enScene: et.scene, jaScene: jt.scene,
        items: [
          it(`${i}-er`, "en", enV, enV, er.chunks.map((c) => c.snd).join(" "), er.chunks.map((c) => c.ko).join(" / "), "영어 독해 · 본문"),
          ...er.chunks.map((c, k) => it(`${i}-er-${k + 1}`, "en", c.en, c.en, c.snd, c.ko, "영어 독해 · 끊어 읽기")),
          ...et.lines.map((l, k) => it(`${i}-et-${k + 1}`, "en", l.en, l.en, l.snd, l.ko, `영어 회화 · ${l.who}`)),
          ...et.keys.map((x, k) => it(`${i}-ek-${k + 1}`, "en", x.t, x.t.replace(/~/g, ""), x.snd, x.ko, "영어 회화 · 핵심 표현")),
          it(`${i}-jr`, "ja", jaV, kanaJa(jaV), jr.chunks.map((c) => c.snd).join(" "), jr.chunks.map((c) => c.ko).join(" / "), "일본어 독해 · 본문"),
          ...jr.chunks.map((c, k) => it(`${i}-jr-${k + 1}`, "ja", c.ja, kanaJa(c.ja), c.snd, c.ko, "일본어 독해 · 끊어 읽기")),
          ...jt.lines.map((l, k) => it(`${i}-jt-${k + 1}`, "ja", l.ja, kanaJa(l.ja), l.snd, l.ko, `일본어 회화 · ${l.who}`)),
          ...jt.keys.map((x, k) => it(`${i}-jk-${k + 1}`, "ja", x.t, kanaJa(x.t).replace(/～/g, ""), x.snd, x.ko, "일본어 회화 · 핵심 표현")),
          ...L.review.en_pat.map((p, k) => it(`${i}-ep-${k + 1}`, "en", p.ex, p.ex, p.snd, p.ko, `영어 구문 · ${p.pat}`)),
          ...L.review.en_words.map((w, k) => it(`${i}-ev-${k + 1}`, "en", w.w, w.w, w.snd, `(${w.pos}) ${w.ko}`, "영어 단어")),
          ...L.review.ja_pat.map((p, k) => it(`${i}-jp-${k + 1}`, "ja", p.ex, kanaJa(p.ex), p.snd, p.ko, `일본어 구문 · ${plainJa(p.pat)}`)),
          ...L.review.ja_words.map((w, k) => it(`${i}-jv-${k + 1}`, "ja", w.ja, kanaJa(w.ja), w.snd, w.ko, "일본어 단어")),
        ],
      };
    }),
    sources: { en: "World English Bible (British Edition), Public Domain", ja: ja.source.split(" — ")[0] },
  };
}
// 원고 → listen/data/<책>-<단원>.json (바뀌었을 때만 씀). 빌드가 부른다.
export function exportLang(book, n) {
  const f = path.join(R, "listen/data", `${book}-${n}.json`);
  const s = JSON.stringify(langItems(book, n), null, 1) + "\n";
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== s) { fs.writeFileSync(f, s); return { file: f, changed: true }; }
  return { file: f, changed: false };
}
// 레슨 QR 주소(빌드가 QR 그림을 미리 만든다)
export const langQrUrls = (book, n) => loadLang(book, n).lessons.map((_, j) => listenUrl(book, n, `${j + 1}`));

// ---------- 조판 ----------
const ruby = (s) => esc(s).replace(RUBY, "<ruby>$1<rt>$2</rt></ruby>");
let SAY = () => "";   // langHtml 안에서 (id) → ▶ 버튼 HTML
const head = (label, en, key, mk) => `<section class="front lang" id="${key}">${mk(key)}<p class="eyebrow">${en}</p><h1>${esc(label)}</h1><div class="gold"></div>`;
const TOTOC = `<div class="totoc-row"><a class="totoc" href="#toc">▲ 차례로</a></div>`;
const KANA = [
  ["あア", "아"], ["いイ", "이"], ["うウ", "우"], ["えエ", "에"], ["おオ", "오"],
  ["かカ", "카"], ["きキ", "키"], ["くク", "쿠"], ["けケ", "케"], ["こコ", "코"],
  ["さサ", "사"], ["しシ", "시"], ["すス", "스"], ["せセ", "세"], ["そソ", "소"],
  ["たタ", "타"], ["ちチ", "치"], ["つツ", "츠"], ["てテ", "테"], ["とト", "토"],
  ["なナ", "나"], ["にニ", "니"], ["ぬヌ", "누"], ["ねネ", "네"], ["のノ", "노"],
  ["はハ", "하"], ["ひヒ", "히"], ["ふフ", "후"], ["へヘ", "헤"], ["ほホ", "호"],
  ["まマ", "마"], ["みミ", "미"], ["むム", "무"], ["めメ", "메"], ["もモ", "모"],
  ["やヤ", "야"], null, ["ゆユ", "유"], null, ["よヨ", "요"],
  ["らラ", "라"], ["りリ", "리"], ["るル", "루"], ["れレ", "레"], ["ろロ", "로"],
  ["わワ", "와"], null, null, null, ["をヲ", "오"],
  ["んン", "ㄴ(받침)"], null, null, null, null,
];
const DAKU = [
  ["がガ", "가"], ["ぎギ", "기"], ["ぐグ", "구"], ["げゲ", "게"], ["ごゴ", "고"],
  ["ざザ", "자"], ["じジ", "지"], ["ずズ", "즈"], ["ぜゼ", "제"], ["ぞゾ", "조"],
  ["だダ", "다"], ["ぢヂ", "지"], ["づヅ", "즈"], ["でデ", "데"], ["どド", "도"],
  ["ばバ", "바"], ["びビ", "비"], ["ぶブ", "부"], ["べベ", "베"], ["ぼボ", "보"],
  ["ぱパ", "파"], ["ぴピ", "피"], ["ぷプ", "푸"], ["ぺペ", "페"], ["ぽポ", "포"],
];
const kanaGrid = (rows) => `<table class="kana">` + [...Array(rows.length / 5)].map((_, r) => `<tr>` + rows.slice(r * 5, r * 5 + 5).map((c) => c ? `<td><span class="kh">${c[0][0]}</span><span class="kk">${c[0][1]}</span><span class="ks">${esc(c[1])}</span></td>` : `<td></td>`).join("") + `</tr>`).join("") + `</table>`;
const chunkTable = (chunks, lang, p) => `<table class="chunks"><thead><tr><th>${lang === "ja" ? "일본어" : "영어"}</th><th>한글 소리</th><th>뜻</th></tr></thead><tbody>` + chunks.map((c, k) => `<tr><td class="${lang}">${SAY(`${p}-${k + 1}`)}${lang === "ja" ? ruby(c.ja) : esc(c.en)}</td><td class="snd">${esc(c.snd)}</td><td>${esc(c.ko)}</td></tr>`).join("") + `</tbody></table>`;
const talk = (t, lang, p, q) => `<div class="scene">장면 · ${esc(t.scene)}<span class="made">연습용 대화 — 성경 본문이 아님</span></div><div class="talk">` + t.lines.map((l, k) => `<div class="line"><span class="who">${esc(l.who)}</span><div><div class="${lang}">${SAY(`${p}-${k + 1}`)}${lang === "ja" ? ruby(l.ja) : esc(l.en)}</div><div class="snd">${esc(l.snd)}</div><div class="ko">${esc(l.ko)}</div></div></div>`).join("") + `</div>` +
  `<div class="keys"><div class="kl">핵심 표현</div>` + t.keys.map((x, k) => `<div class="key">${SAY(`${q}-${k + 1}`)}<span class="${lang}">${lang === "ja" ? ruby(x.t) : esc(x.t)}</span> <span class="snd">${esc(x.snd)}</span> — ${esc(x.ko)}</div>`).join("") + `</div>`;
const notes = (list) => (list || []).map((g) => `<div class="gnote"><span class="gn">${esc(g.name)}</span>${esc(g.text)}</div>`).join("");

export function langHtml(book, n, mk = () => "") {
  const B = BOOKS[book], d = loadLang(book, n), ja = jaVerses(book);
  SAY = (id, cls = "") => `<a class="say ${cls}" href="${esc(listenUrl(book, n, id))}">▶</a>`;
  const nav =[["lang-chapter", "어학 학습 부록 — 영어·일본어 독해·회화", 0], ["lang-kana", "일본어 첫걸음 · 소리표", 1]];
  let o = head("어학 학습 부록", "ENGLISH · 日本語", "lang-chapter", mk) +
    `<p class="lead">이 책의 본문(${esc(B.ko)} ${esc(d.range)})을 영어와 일본어로 다시 읽고, 같은 장면을 오늘의 말로 바꾸어 말해 봅니다. 레슨은 앞의 단락과 하나씩 짝을 이룹니다.</p>` +
    `<div class="lab">한 레슨의 순서</div><ol class="steps"><li><b>영어 독해</b> — 현대 영어 성경 한 절을 끊어 읽고 문법 하나를 익힙니다.</li><li><b>영어 회화</b> — 그 장면을 오늘의 상황으로 옮긴 대화를 소리 내어 읽습니다.</li><li><b>일본어 독해</b> — 일본어 성경 한 절을 한글 소리로 따라 읽고 뜻을 맞춰 봅니다.</li><li><b>일본어 회화</b> — 짧은 대화와 표현을 외워 봅니다.</li></ol>` +
    `<div class="lab">공부하는 법</div><p>① 한글 소리를 보며 세 번 소리 내어 읽습니다. ② 한글 소리를 가리고 원문만 보고 읽습니다. ③ 뜻을 가리고 원문만 보고 뜻을 말해 봅니다. ④ 대화는 A·B 역할을 바꾸어 두 번 말합니다.</p>` +
    `<div class="lab">한글 소리에 대하여</div><p>한글 소리는 처음 배우는 사람을 위한 <b>대략의 소리</b>입니다. 「-」는 소리를 길게 끄는 자리입니다(예: 슈- = しゅう). 일본어 조사 は는 「와」, へ는 「에」, を는 「오」로 읽습니다. 정확한 발음은 원어민 소리로 꼭 확인하세요.</p>` +
    `<div class="lab">소리 듣기 <span class="say">▶</span></div><p>문장 앞의 빨간 <b>▶</b>를 누르면 듣기 페이지가 열리고, 휴대폰·컴퓨터에 들어 있는 영어·일본어 음성이 그 문장을 읽어 줍니다. 종이 책은 레슨 첫머리의 QR을 휴대폰 카메라로 찍으세요. 사람이 녹음한 소리가 아니라 기기의 음성이며, 처음에는 페이지의 「듣기」를 한 번 더 눌러야 할 수 있습니다. 듣기 페이지는 인터넷에 연결되어 있어야 열립니다.</p>` +
    `<div class="lab">본문과 대화</div><p>영어 본문은 World English Bible(British Edition, 퍼블릭 도메인), 일본어 본문은 フリーダム・バイブル(Japanese Freedom Bible, 퍼블릭 도메인)을 글자 그대로 옮겼습니다. 한자 위의 작은 글자(후리가나)는 읽는 소리입니다. 회화의 대화는 연습을 위해 지은 것이며 성경 본문이 아닙니다.</p>${TOTOC}</section>`;
  // 일본어 첫걸음
  o += head("일본어 첫걸음 · 소리표", "KANA", "lang-kana", mk) +
    `<p>일본어 글자는 세 가지입니다. <b>히라가나</b>(あいう — 일본어 낱말과 조사), <b>가타카나</b>(アイウ — 외래어·외국 이름: ヨセフ 요세후, エジプト 에지푸토), <b>한자</b>(主 — 위에 작게 읽는 소리를 달았습니다). 표의 칸마다 히라가나 · 가타카나 · 한글 소리 순서입니다.</p>` +
    `<div class="lab">기본 소리</div>` + kanaGrid(KANA) +
    `<div class="lab">탁음 · 반탁음(점 두 개 ゛· 동그라미 ゜)</div>` + kanaGrid(DAKU) +
    `<div class="lab">작은 글자</div><p>작은 ゃ·ゅ·ょ는 앞 글자와 붙어 한 소리가 됩니다: しゃ 샤, しゅ 슈, しょ 쇼, ちょ 초, きょ 쿄. 작은 っ는 다음 소리를 한 박자 멈추는 받침(ㅅ)입니다: ${ruby("三[みっ]つ")} 밋츠. 가타카나의 「ー」는 소리를 길게 끕니다.</p>` +
    `<div class="lab">꼭 알아 둘 조사(토씨)</div><table class="chunks"><tbody>` +
    [["は", "와", "~은/는"], ["が", "가", "~이/가"], ["を", "오", "~을/를"], ["の", "노", "~의"], ["に", "니", "~에, ~에게"], ["へ", "에", "~(쪽)으로"], ["と", "토", "~와/과"], ["で", "데", "~에서, ~로"], ["も", "모", "~도"], ["か", "카", "~까?(물음)"]].map(([a, b, c]) => `<tr><td class="ja">${a}</td><td class="snd">${b}</td><td>${c}</td></tr>`).join("") +
    `</tbody></table><p class="small">문장 끝의 です(데스)·ます(마스)는 「~입니다·~합니다」 같은 높임말입니다.</p>${TOTOC}</section>`;
  d.lessons.forEach((L, i) => {
    const key = `lang-${i + 1}`; nav.push([key, `레슨 ${i + 1} · ${L.ref} ${L.title}`, 1]);
    const er = L.en_read, jr = L.ja_read;
    const enFull = webOf(book, er.ref), jaFull = ja.map[jr.ref];
    const enPart = er.chunks.map((c) => c.en).join(" "), jaPart = jr.chunks.map((c) => plainJa(c.ja)).join("");
    const p = i + 1, qu = listenUrl(book, n, `${p}`);
    o += head(`레슨 ${i + 1} · ${L.title}`, `LESSON ${i + 1} · ${B.en} ${L.ref}`, key, mk) +
      `<div class="lqr"><a href="${esc(qu)}"><img src="${pathUrl(qrFile(qu))}"/></a><span><b>이 레슨 소리로 듣기</b><br/>휴대폰 카메라로 QR을 찍거나, 문장 앞의 <span class="say">▶</span>를 누르세요.</span></div>` +
      `<h2 class="track en-t">① 영어 독해 <small>${esc(B.ko)} ${esc(er.ref)}${enPart !== enFull ? " (절의 일부)" : ""} · WEB</small></h2>` +
      `<div class="verse en">${SAY(`${p}-er`, "big")}${esc(enPart)}</div>` + chunkTable(er.chunks, "en", `${p}-er`) + notes(er.grammar) +
      `<h2 class="track en-t">② 영어 회화</h2>` + talk(L.en_talk, "en", `${p}-et`, `${p}-ek`) +
      `<h2 class="track ja-t">③ 일본어 독해 <small>${esc(B.ko)} ${esc(jr.ref)}${jaPart !== jaFull ? " (절의 일부)" : ""} · フリーダム・バイブル</small></h2>` +
      `<div class="verse ja">${SAY(`${p}-jr`, "big")}${jr.chunks.map((c) => ruby(c.ja)).join("")}</div>` + chunkTable(jr.chunks, "ja", `${p}-jr`) + notes(jr.point) +
      `<h2 class="track ja-t">④ 일본어 회화</h2>` + talk(L.ja_talk, "ja", `${p}-jt`, `${p}-jk`) +
      reviewHtml(L, p) + TOTOC + `</section>`;
  });
  // 총정리 — 레슨의 정리를 모아 자동으로 만든다(새 내용 없음)
  nav.push(["lang-index", "총정리 · 단어장 · 문법 · 구문", 1]);
  const ew = [], jw = [], gram = [], pats = { en: [], ja: [] };
  d.lessons.forEach((L, i) => {
    L.review.en_words.forEach((w, k) => ew.push({ ...w, no: i + 1, id: `${i + 1}-ev-${k + 1}` }));
    L.review.ja_words.forEach((w, k) => jw.push({ ...w, no: i + 1, id: `${i + 1}-jv-${k + 1}`, kana: w.ja.replace(RUBY, "$2") }));
    gram.push({ no: i + 1, en: L.en_read.grammar.map((g) => g.name), ja: (L.ja_read.point || []).map((g) => g.name) });
    L.review.en_pat.forEach((x) => pats.en.push({ ...x, no: i + 1 })); L.review.ja_pat.forEach((x) => pats.ja.push({ ...x, no: i + 1 }));
  });
  // 같은 단어(영어는 단어+품사, 일본어는 표기)가 여러 레슨에 나오면 한 줄로 합치고 레슨 번호를 모은다
  const merge = (list, keyOf) => { const m = new Map(); for (const w of list) { const k = keyOf(w); if (m.has(k)) m.get(k).nos.push(w.no); else m.set(k, { ...w, nos: [w.no] }); } return [...m.values()]; };
  const ewM = merge(ew, (w) => w.w.toLowerCase() + "|" + w.pos).sort((a, b) => a.w.toLowerCase().localeCompare(b.w.toLowerCase()));
  const jwM = merge(jw, (w) => w.ja).sort((a, b) => a.kana.localeCompare(b.kana, "ja"));
  ew.length = 0; ew.push(...ewM); jw.length = 0; jw.push(...jwM);
  o += head("총정리 · 단어장 · 문법 · 구문", "INDEX", "lang-index", mk) +
    `<p class="small">레슨마다의 ⑤ 정리를 한데 모았습니다. 오른쪽 숫자는 레슨 번호입니다.</p>` +
    `<h2 class="track en-t">영어 단어장 <small>알파벳순 · ${ew.length}개</small></h2><table class="chunks vocab-t"><thead><tr><th>단어</th><th>품사</th><th>한글 소리</th><th>뜻</th><th>레슨</th></tr></thead><tbody>` +
    ew.map((w) => `<tr><td class="en">${SAY(w.id)}${esc(w.w)}</td><td>${esc(w.pos)}</td><td class="snd">${esc(w.snd)}</td><td>${esc(w.ko)}</td><td class="no">${w.nos.join(", ")}</td></tr>`).join("") + `</tbody></table>` +
    `<h2 class="track ja-t">일본어 단어장 <small>あいうえお순 · ${jw.length}개</small></h2><table class="chunks vocab-t"><thead><tr><th>단어</th><th>한글 소리</th><th>뜻</th><th>레슨</th></tr></thead><tbody>` +
    jw.map((w) => `<tr><td class="ja">${SAY(w.id)}${ruby(w.ja)}</td><td class="snd">${esc(w.snd)}</td><td>${esc(w.ko)}</td><td class="no">${w.nos.join(", ")}</td></tr>`).join("") + `</tbody></table>` +
    `<h2 class="track rv-t">문법 색인</h2><table class="chunks"><thead><tr><th>레슨</th><th>영어 문법</th><th>일본어 문법</th></tr></thead><tbody>` +
    gram.map((g) => `<tr><td class="no">${g.no}</td><td>${g.en.map(esc).join("<br/>")}</td><td class="ja">${g.ja.map((x) => ruby(x)).join("<br/>")}</td></tr>`).join("") + `</tbody></table>` +
    `<h2 class="track rv-t">구문 모음</h2><table class="chunks"><thead><tr><th>영어 구문</th><th>레슨</th></tr></thead><tbody>` +
    pats.en.map((x) => `<tr><td>${esc(x.pat)}</td><td class="no">${x.no}</td></tr>`).join("") + `</tbody></table><table class="chunks"><thead><tr><th>일본어 구문</th><th>레슨</th></tr></thead><tbody>` +
    pats.ja.map((x) => `<tr><td class="ja">${ruby(x.pat)}</td><td class="no">${x.no}</td></tr>`).join("") + `</tbody></table>${TOTOC}</section>`;
  return { html: `<style>${LANG_CSS}</style>` + o, nav };
}
// ⑤ 정리 — 구문(새 예문)·문법(①③의 문법)·단어
function reviewHtml(L, p) {
  const rv = L.review;
  const patBox = (ps, lang, tag) => ps.map((x, k) => `<div class="pat"><div class="pp ${lang}">${lang === "ja" ? ruby(x.pat) : esc(x.pat)}</div><div class="${lang}">${SAY(`${p}-${tag}-${k + 1}`)}${lang === "ja" ? ruby(x.ex) : esc(x.ex)}</div><div class="snd">${esc(x.snd)}</div><div class="ko">${esc(x.ko)}</div></div>`).join("");
  const gramList = (gs) => `<ul class="gl2">` + (gs || []).map((g) => `<li><span class="gn">${esc(g.name)}</span>${esc(g.text)}</li>`).join("") + `</ul>`;
  const enW = `<table class="chunks vocab-t"><thead><tr><th>단어</th><th>품사</th><th>한글 소리</th><th>뜻</th></tr></thead><tbody>` + rv.en_words.map((w, k) => `<tr><td class="en">${SAY(`${p}-ev-${k + 1}`)}${esc(w.w)}${w.from ? `<span class="from">← ${esc(w.from)}</span>` : ""}</td><td>${esc(w.pos)}</td><td class="snd">${esc(w.snd)}</td><td>${esc(w.ko)}</td></tr>`).join("") + `</tbody></table>`;
  const jaW = `<table class="chunks vocab-t"><thead><tr><th>단어</th><th>한글 소리</th><th>뜻</th></tr></thead><tbody>` + rv.ja_words.map((w, k) => `<tr><td class="ja">${SAY(`${p}-jv-${k + 1}`)}${ruby(w.ja)}${w.from && w.from !== plainJa(w.ja) ? `<span class="from">← ${esc(w.from)}</span>` : ""}</td><td class="snd">${esc(w.snd)}</td><td>${esc(w.ko)}</td></tr>`).join("") + `</tbody></table>`;
  return `<h2 class="track rv-t">⑤ 정리 — 구문 · 문법 · 단어</h2>` +
    `<div class="rvh en-c">영어 구문 <small>새 예문으로 연습</small></div>` + patBox(rv.en_pat, "en", "ep") +
    `<div class="rvh en-c">영어 문법</div>` + gramList(L.en_read.grammar) +
    `<div class="rvh en-c">영어 단어</div>` + enW +
    `<div class="rvh ja-c">일본어 구문 <small>새 예문으로 연습</small></div>` + patBox(rv.ja_pat, "ja", "jp") +
    `<div class="rvh ja-c">일본어 문법</div>` + gramList(L.ja_read.point) +
    `<div class="rvh ja-c">일본어 단어</div>` + jaW;
}

const LANG_CSS = `
.lang .lead{font-size:9.8pt;}
.lang .steps{margin:0 0 3mm;padding-left:5mm;font-size:9.2pt;line-height:1.75;}
.lang .small{font-size:8.4pt;color:#555;}
.lang .ja{font-family:"Meiryo","Yu Gothic","Noto Sans KR",sans-serif;}
.lang .en{font-family:"Times New Roman",serif;}
.lang ruby rt{font-size:52%;color:#9a5b12;font-family:"Meiryo","Yu Gothic",sans-serif;}
.lang h2.track{font:700 10.4pt/1.4 "Noto Sans KR";color:#fff;border-radius:1.4mm;padding:1.2mm 3mm;margin:5mm 0 2.4mm;break-after:avoid;}
.lang h2.track small{font-weight:400;font-size:7.4pt;margin-left:2mm;opacity:.9;}
.lang h2.en-t{background:#24447a;}
.lang h2.ja-t{background:#a8322d;}
.lang .verse{background:#f6f1e4;border-left:.9mm solid #c9973b;border-radius:1.2mm;padding:2.2mm 3.2mm;margin:0 0 2.4mm;font-size:10.6pt;line-height:1.9;break-inside:avoid;}
.lang .verse.ja{font-size:10.2pt;line-height:2.25;}
.lang table.chunks{width:100%;border-collapse:collapse;margin:0 0 2.6mm;font-size:8.8pt;line-height:1.55;}
.lang table.chunks th{font:700 7.4pt "Noto Sans KR";color:#7a6a45;text-align:left;border-bottom:.3mm solid #c9973b;padding:.6mm 1.4mm;}
.lang table.chunks td{border-bottom:.2mm solid #e7e0cf;padding:1mm 1.4mm;vertical-align:top;}
.lang table.chunks tr{break-inside:avoid;}
.lang table.chunks td.en{font-size:10pt;width:40%;}
.lang table.chunks td.ja{font-size:10pt;width:34%;line-height:2.1;}
.lang .snd{font-family:"Noto Sans KR",sans-serif;color:#2f6b3a;}
.lang td.snd{width:30%;}
.lang .gnote{background:#eef3f8;border-left:.8mm solid #6b8bb5;border-radius:1.2mm;padding:1.6mm 3mm;margin:0 0 2mm;font-size:8.8pt;line-height:1.65;break-inside:avoid;}
.lang .gn{font:700 7.4pt "Noto Sans KR";color:#fff;background:#6b8bb5;border-radius:.8mm;padding:.2mm 1.4mm;margin-right:1.6mm;white-space:nowrap;}
.lang .scene{font:500 8.6pt/1.5 "Noto Sans KR";color:#555;margin:0 0 1.6mm;}
.lang .made{display:inline-block;margin-left:2mm;font-size:6.8pt;color:#b0562b;border:.2mm solid #d9a68a;border-radius:.8mm;padding:0 1.2mm;}
.lang .talk{margin:0 0 2mm;}
.lang .line{display:flex;gap:2.4mm;margin:0 0 1.8mm;break-inside:avoid;}
.lang .who{flex:none;width:5.4mm;height:5.4mm;border-radius:50%;background:#18233f;color:#fff;font:700 7.6pt/5.4mm "Noto Sans KR";text-align:center;margin-top:.6mm;}
.lang .line .en{font-size:10.6pt;line-height:1.45;}
.lang .line .ja{font-size:10.2pt;line-height:1.75;padding-top:.8mm;}
.lang .line .snd{font-size:8.8pt;line-height:1.45;}
.lang .line .ko{font-size:8.6pt;line-height:1.45;color:#555;}
.lang .keys,.lang .words{background:#faf7ef;border:.2mm solid #e3dccb;border-radius:1.4mm;padding:1.6mm 3mm;margin:0 0 2.4mm;font-size:8.8pt;line-height:1.75;break-inside:avoid;}
.lang .kl{font:700 7.4pt "Noto Sans KR";color:#c9973b;margin-right:2mm;}
.lang .key .en,.lang .key .ja{font-weight:700;}
.lang .words .w{display:inline-block;margin-right:4mm;}
.lang h2.rv-t{background:#5b4a1e;}
.lang .rvh{font:700 8.6pt/1.4 "Noto Sans KR";margin:3mm 0 1.4mm;padding-bottom:.6mm;border-bottom:.3mm solid currentColor;break-after:avoid;}
.lang .rvh small{font-weight:400;font-size:7pt;color:#777;margin-left:1.6mm;}
.lang .en-c{color:#24447a;}.lang .ja-c{color:#a8322d;}
.lang .pat{background:#faf7ef;border:.2mm solid #e3dccb;border-radius:1.4mm;padding:1.6mm 3mm;margin:0 0 1.8mm;break-inside:avoid;font-size:8.8pt;line-height:1.5;}
.lang .pat .pp{font:700 8.4pt/1.6 "Noto Sans KR",sans-serif;color:#5b4a1e;}
.lang .pat .pp.ja{font-family:"Meiryo","Yu Gothic",sans-serif;}
.lang .pat .en{font-size:10.4pt;}
.lang .pat .ja{font-size:10pt;line-height:1.9;}
.lang .pat .ko{color:#555;}
.lang ul.gl2{margin:0 0 2mm;padding:0;list-style:none;font-size:8.6pt;line-height:1.6;}
.lang ul.gl2 li{margin:0 0 1mm;break-inside:avoid;}
.lang table.vocab-t td{padding:.7mm 1.4mm;}
.lang table.vocab-t td.en{font-size:10pt;width:30%;}
.lang table.vocab-t td.ja{width:30%;line-height:1.9;}
.lang table.vocab-t td.snd{width:24%;}
.lang .from{display:block;font:7pt "Noto Sans KR";color:#888;margin-left:5.6mm;}
.lang td.no{width:11mm;white-space:nowrap;text-align:center;color:#888;font-family:"Noto Sans KR";}
.lang .say{display:inline-block;width:4.2mm;height:4.2mm;border-radius:50%;background:#d0362b;color:#fff;font:700 6pt/4.2mm "Noto Sans KR",sans-serif;text-align:center;margin-right:1.4mm;vertical-align:1px;text-indent:.3mm;}
.lang .say.big{width:5.4mm;height:5.4mm;font-size:7.6pt;line-height:5.4mm;margin-right:2mm;}
.lang .verse .say{float:left;margin-top:1.2mm;}
.lang .verse.ja .say{margin-top:2.6mm;}
.lang .lqr{display:flex;align-items:center;gap:3mm;margin:0 0 2mm;font:400 8pt/1.5 "Noto Sans KR";color:#555;break-inside:avoid;}
.lang .lqr b{color:#18233f;}
.lang .lqr a{display:block;width:14mm;height:14mm;flex:none;}
.lang .lqr img{display:block;width:14mm;height:14mm;}
.lang table.kana{width:100%;border-collapse:collapse;margin:0 0 3mm;break-inside:avoid;}
.lang .lab{break-after:avoid;}
.lang table.kana td{border:.2mm solid #e3dccb;text-align:center;padding:.6mm 0;width:20%;line-height:1.25;}
.lang .kh{font:12pt "Meiryo","Yu Gothic",sans-serif;margin-right:1.2mm;}
.lang .kk{font:9pt "Meiryo","Yu Gothic",sans-serif;color:#666;margin-right:1.2mm;}
.lang .ks{font:700 8.6pt "Noto Sans KR";color:#2f6b3a;}
`;

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [book, cmd, ...ns] = process.argv.slice(2);
  if (cmd !== "check" || !ns.length) { console.error("사용법: lang.mjs genesis check N …"); process.exit(2); }
  let bad = 0;
  for (const n of ns.map(Number)) { const e = checkLang(book, n); if (e.length) { bad++; console.error(`단원 ${n}: 오류 ${e.length}개`); e.forEach((x) => console.error("  - " + x)); } else console.log(`단원 ${n}: 통과`); }
  process.exit(bad ? 1 : 0);
}
