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
    (jr.words || []).forEach((w, k) => { rubyOk(w.ja, `${at} 일본어 단어 ${k + 1}`); sndOk(w.snd, `${at} 일본어 단어 ${k + 1}`); });
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

// ---------- 조판 ----------
const ruby = (s) => esc(s).replace(RUBY, "<ruby>$1<rt>$2</rt></ruby>");
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
const chunkTable = (chunks, lang) => `<table class="chunks"><thead><tr><th>${lang === "ja" ? "일본어" : "영어"}</th><th>한글 소리</th><th>뜻</th></tr></thead><tbody>` + chunks.map((c) => `<tr><td class="${lang}">${lang === "ja" ? ruby(c.ja) : esc(c.en)}</td><td class="snd">${esc(c.snd)}</td><td>${esc(c.ko)}</td></tr>`).join("") + `</tbody></table>`;
const talk = (t, lang) => `<div class="scene">장면 · ${esc(t.scene)}<span class="made">연습용 대화 — 성경 본문이 아님</span></div><div class="talk">` + t.lines.map((l) => `<div class="line"><span class="who">${esc(l.who)}</span><div><div class="${lang}">${lang === "ja" ? ruby(l.ja) : esc(l.en)}</div><div class="snd">${esc(l.snd)}</div><div class="ko">${esc(l.ko)}</div></div></div>`).join("") + `</div>` +
  `<div class="keys"><div class="kl">핵심 표현</div>` + t.keys.map((k) => `<div class="key"><span class="${lang}">${lang === "ja" ? ruby(k.t) : esc(k.t)}</span> <span class="snd">${esc(k.snd)}</span> — ${esc(k.ko)}</div>`).join("") + `</div>`;
const notes = (list) => (list || []).map((g) => `<div class="gnote"><span class="gn">${esc(g.name)}</span>${esc(g.text)}</div>`).join("");

export function langHtml(book, n, mk = () => "") {
  const B = BOOKS[book], d = loadLang(book, n), ja = jaVerses(book);
  const nav = [["lang-chapter", "어학 학습 부록 — 영어·일본어 독해·회화", 0], ["lang-kana", "일본어 첫걸음 · 소리표", 1]];
  let o = head("어학 학습 부록", "ENGLISH · 日本語", "lang-chapter", mk) +
    `<p class="lead">이 책의 본문(${esc(B.ko)} ${esc(d.range)})을 영어와 일본어로 다시 읽고, 같은 장면을 오늘의 말로 바꾸어 말해 봅니다. 레슨은 앞의 단락과 하나씩 짝을 이룹니다.</p>` +
    `<div class="lab">한 레슨의 순서</div><ol class="steps"><li><b>영어 독해</b> — 현대 영어 성경 한 절을 끊어 읽고 문법 하나를 익힙니다.</li><li><b>영어 회화</b> — 그 장면을 오늘의 상황으로 옮긴 대화를 소리 내어 읽습니다.</li><li><b>일본어 독해</b> — 일본어 성경 한 절을 한글 소리로 따라 읽고 뜻을 맞춰 봅니다.</li><li><b>일본어 회화</b> — 짧은 대화와 표현을 외워 봅니다.</li></ol>` +
    `<div class="lab">공부하는 법</div><p>① 한글 소리를 보며 세 번 소리 내어 읽습니다. ② 한글 소리를 가리고 원문만 보고 읽습니다. ③ 뜻을 가리고 원문만 보고 뜻을 말해 봅니다. ④ 대화는 A·B 역할을 바꾸어 두 번 말합니다.</p>` +
    `<div class="lab">한글 소리에 대하여</div><p>한글 소리는 처음 배우는 사람을 위한 <b>대략의 소리</b>입니다. 「-」는 소리를 길게 끄는 자리입니다(예: 슈- = しゅう). 일본어 조사 は는 「와」, へ는 「에」, を는 「오」로 읽습니다. 정확한 발음은 원어민 소리로 꼭 확인하세요.</p>` +
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
    o += head(`레슨 ${i + 1} · ${L.title}`, `LESSON ${i + 1} · ${B.en} ${L.ref}`, key, mk) +
      `<h2 class="track en-t">① 영어 독해 <small>${esc(B.ko)} ${esc(er.ref)}${enPart !== enFull ? " (절의 일부)" : ""} · WEB</small></h2>` +
      `<div class="verse en">${esc(enPart)}</div>` + chunkTable(er.chunks, "en") + notes(er.grammar) +
      `<h2 class="track en-t">② 영어 회화</h2>` + talk(L.en_talk, "en") +
      `<h2 class="track ja-t">③ 일본어 독해 <small>${esc(B.ko)} ${esc(jr.ref)}${jaPart !== jaFull ? " (절의 일부)" : ""} · フリーダム・バイブル</small></h2>` +
      `<div class="verse ja">${jr.chunks.map((c) => ruby(c.ja)).join("")}</div>` + chunkTable(jr.chunks, "ja") +
      (jr.words?.length ? `<div class="words"><span class="kl">단어</span>` + jr.words.map((w) => `<span class="w"><span class="ja">${ruby(w.ja)}</span> <span class="snd">${esc(w.snd)}</span> ${esc(w.ko)}</span>`).join("") + `</div>` : "") + notes(jr.point) +
      `<h2 class="track ja-t">④ 일본어 회화</h2>` + talk(L.ja_talk, "ja") + TOTOC + `</section>`;
  });
  return { html: `<style>${LANG_CSS}</style>` + o, nav };
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
