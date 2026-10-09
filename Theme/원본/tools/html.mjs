// 본문 HTML 조각. mode = "pdf"(QR) | "epub"(▶ 시각 링크만)
// 유튜브 링크를 받지 않은 이야기(S.vid === "")는 QR·▶ 시각을 하나도 넣지 않는다(사용자 지시 2026-10-03)
import QRCode from "qrcode";
import { esc, inline, ytUrl, ordinal, sid, chId, secId, tocId, chLabel } from "./parse.mjs";

let MODE = "pdf";
export const setMode = (m) => { MODE = m; };
// PDF는 그림을 절대 경로로, EPUB은 묶음 안 파일 이름으로
let IMG = (S, b) => "file:///" + b.path.replace(/\\/g, "/");
export const setImgResolver = (fn) => { IMG = fn; };
// 「목차로 이동」: 차례의 해당 항목(id = toc-<제목 id>)으로. EPUB은 contents.xhtml#…
let TOC = (id) => `#toc-${id}`;
export const setTocResolver = (fn) => { TOC = fn; };
const back = (id, cls = "") => `<a class="totoc${cls}" href="${TOC(id)}"><span class="arr">◀</span> 목차로 이동</a>`;

const YT = `<svg class="ytm" viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#e52d27"/><path d="M11 5.5v9l8-4.5z" fill="#fff"/></svg>`;

export async function qrSvg(url) {
  // 오류정정 M, 흰 여백 2모듈, 남색
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#18233f", light: "#ffffff" } });
}

export async function videoMark(vid, ts) {
  if (!vid) return ""; // 링크를 받지 않은 강의: 구간 이동 없음
  const url = ytUrl(vid, ts);
  if (MODE === "epub") return `<a class="yt" href="${url}">▶ ${ts}</a>`;
  const svg = (await qrSvg(url)).replace("<svg", '<svg class="qrimg"');
  return `<a class="qr" href="${url}">${svg}<span class="qt">${YT}<b>${ts}</b></span><span class="qc"><b>클릭</b>하면 해당 구간으로<br>이동합니다</span></a>`;
}

export function slideHtml(S, b) {
  // 머리글은 출처로 정한다: 정리한 사람이 그린 그림이라도 슬라이드 글자를 옮긴 것(33권)은 「강의 슬라이드에서」, 설교 인용은 「인용」
  const label = /한글KJV/.test(b.src || "") ? "성경 구절 — 한글KJV 본문" : /^설교/.test(b.src || "") ? "인용 — 강의 슬라이드에서" : "성경 구절 — 강의 슬라이드에서";
  const verse = b.verse
    ? `<div class="verse"><div class="vl">${label}</div><div class="vb">${b.verse.split("//").map((s) => `<p>${inline(s.trim())}</p>`).join("")}</div><div class="vs">${esc(b.src)}</div></div>`
    : "";
  const cap = b.made ? `<span class="made">정리한 사람이 만든 그림</span> ${esc(b.cap)}` : esc(b.cap);
  return `<figure class="slide${b.made ? " madefig" : ""}"><img src="${IMG(S, b)}" alt="${esc(b.cap)}"/><figcaption>${cap}</figcaption>${verse}</figure>`;
}

// 그림 없는 말씀 상자: 강의에서 읽은 구절(실선) / 말로 언급한 구절(점선). 본문은 한글KJV
export function verseBoxHtml(b) {
  const ref = b.kind === "언급";
  return `<div class="verse vbox${ref ? " vref" : ""}"><div class="vl">${ref ? "말씀 — 강의에서 언급한 구절" : "말씀 — 강의에서 읽은 구절"}</div>${b.head ? `<div class="vh">${esc(b.head)}</div>` : ""}<div class="vb">${b.text.split("//").map((s) => `<p>${inline(s.trim())}</p>`).join("")}</div><div class="vs">${esc(b.src)}</div></div>`;
}

export const noteHtml = (b) => `<div class="note"><div class="nt">${esc(b.term)}</div><p>${inline(b.text)}</p></div>`;

function blockHtml(S, b) {
  if (b.t === "p") return `<p class="bp">${inline(b.text)}</p>`;
  if (b.t === "img") return slideHtml(S, b);
  if (b.t === "note") return noteHtml(b);
  if (b.t === "verse") return verseBoxHtml(b);
  throw new Error(b.t);
}

// 제목은 첫 내용과 떨어지지 않게(break-after: avoid). 첫 문단은 쪽을 넘어 흐를 수 있어 큰 공란이 생기지 않는다
function blocksHtml(S, blocks, head = "") {
  const out = head ? [`<div class="hk">${head}</div>`] : [];
  for (const b of blocks) out.push(blockHtml(S, b));
  return out.join("\n");
}

export async function chapterHtml(S, c, i, marker = () => "") {
  const lab = chLabel(c);
  const qr = c.ts ? await videoMark(S.vid, c.ts) : "";
  const head = `<div class="chh" id="${chId(S, i)}">${marker(chId(S, i))}<div class="chl">${lab ? `<div class="chn">${lab}</div>` : ""}<h2>${esc(c.title)}</h2>${c.sub ? `<div class="chs">${esc(c.sub)}</div>` : ""}<div class="gold"></div>${back(chId(S, i), " sm")}</div>${qr ? `<div class="chq">${qr}</div>` : ""}</div>`;
  let html = "";
  if (c.blocks.length || !c.secs.length) html += blocksHtml(S, c.blocks, head);
  for (let j = 0; j < c.secs.length; j++) {
    const s = c.secs[j];
    const showQr = S.vid && s.ts && !(j === 0 && !c.blocks.length && s.ts === c.ts);
    const sq = showQr ? `<div class="sq">${await videoMark(S.vid, s.ts)}</div>` : "";
    let sh = `<div class="sech" id="${secId(S, i, j)}">${marker(secId(S, i, j))}<h3>${esc(s.title)}</h3>${sq}</div>`;
    if (j === 0 && !c.blocks.length) sh = head + sh;
    html += blocksHtml(S, s.blocks, sh);
  }
  return `<section class="chapter">${html}</section>`;
}

// 이야기 표제 쪽: 왼쪽 아래 「목차로」 단추 → 차례에서 이 이야기 항목이 화면 맨 위에 오도록
export async function storyTitleHtml(book, S, marker = () => "") {
  const legend = S.legend.length
    ? `<div class="lgd"><div class="lgh">${S.images.length && S.chapters.some((c) => [...c.blocks, ...c.secs.flatMap((x) => x.blocks)].some((b) => b.made)) ? "그림의 색깔" : "강의 그림의 색깔"}</div>${S.legend.map((l) => `<div class="lgr"><span class="sw" style="background:${l.color}"></span><b>${esc(l.name)}</b> ${esc(l.meaning)}</div>`).join("")}</div>`
    : "";
  // 통합 이야기: 원 강의를 모두 적는다(원 강의 1, 2 …)
  const lec = S.lectures.length > 1 ? S.lectures.map((t, i) => [`원 강의 ${i + 1}`, t]) : [["원 강의", S.lectures[0] || S.orig]];
  const rows = [...lec, ["강의 날짜", S.date], ["강사", S.speaker], ["출처", book.source]].filter(([, v]) => v && v !== "-");
  const vm = await videoMark(S.vid, "0:00");
  const video = S.vid ? `<div class="sq0">${MODE === "epub" ? `<p>${vm} 강의 영상 처음부터 보기</p>` : vm}</div>` : "";
  const notes = S.storynotes.length ? `<div class="snote">${S.storynotes.map((n) => `<p>${inline(n)}</p>`).join("")}</div>` : "";
  return `<section class="story" id="${sid(S)}">${marker(sid(S))}<div class="sn">${ordinal(S.n)} 이야기</div><h1>${esc(S.title)}</h1><div class="ss">${esc(S.sub)}</div><div class="gold"></div>
  <table class="meta">${rows.map(([k, v]) => `<tr><td>${k}</td><td>${esc(v)}</td></tr>`).join("")}</table>
  ${video}${notes}${legend}
  ${back(sid(S))}</section>`;
}

export function summaryHtml(S, marker = () => "") {
  return `<section class="front" id="${sid(S, "sum")}">${marker(sid(S, "sum"))}<div class="sk">${ordinal(S.n)} 이야기</div><h1>한눈에 보는 이야기</h1><div class="gold"></div>${back(sid(S, "sum"), " sm")}<div class="added">정리한 사람이 덧붙인 글</div><ol class="sum">${S.summary.map((s) => `<li>${inline(s)}</li>`).join("")}</ol></section>`;
}

export function quizHtml(S, marker = () => "") {
  return `<section class="front" id="${sid(S, "quiz")}">${marker(sid(S, "quiz"))}<div class="sk">${ordinal(S.n)} 이야기</div><h1>개념 문제</h1><div class="gold"></div>${back(sid(S, "quiz"), " sm")}<div class="added">강의 내용으로만 냈습니다. 답은 다음 쪽부터 있습니다.</div>
  ${S.quiz.map((q, i) => `<div class="qz"><span class="num">${i + 1}</span><p>${esc(q.q)}</p></div>`).join("")}</section>`;
}

const qaNote = (S) => !S.vid ? "" : `<div class="added">${MODE === "epub" ? "▶ 시각을 누르면 근거가 나오는 강의 구간이 열립니다." : "오른쪽 QR이나 ▶ 시각을 누르면 근거가 나오는 강의 구간이 열립니다."}</div>`;
const qaRight = async (S, ts) => (S.vid ? `<div class="anr">${await videoMark(S.vid, ts)}</div>` : "");

export async function answersHtml(S, marker = () => "") {
  let h = `<section class="front" id="${sid(S, "ans")}">${marker(sid(S, "ans"))}<div class="sk">${ordinal(S.n)} 이야기</div><h1>개념 문제 답안</h1><div class="gold"></div>${back(sid(S, "ans"), " sm")}${qaNote(S)}`;
  for (const [i, q] of S.quiz.entries()) {
    h += `<div class="an${S.vid ? "" : " novid"}"><div class="anb"><div class="anq"><span class="num gold">${i + 1}</span>${esc(q.q)}</div><div class="ana">${esc(q.a)}</div><div class="anw"><b>근거:</b> ${esc(q.why)}</div></div>${await qaRight(S, q.ts)}</div>`;
  }
  return h + `</section>`;
}

export async function faqHtml(book, S, marker = () => "") {
  let h = `<section class="front" id="${sid(S, "faq")}">${marker(sid(S, "faq"))}<div class="sk">${ordinal(S.n)} 이야기</div><h1>예상 질문과 답변</h1><div class="gold"></div>${back(sid(S, "faq"), " sm")}
  <div class="banner"><div class="bt">처음 듣는 분들이 물을 법한 질문에 강의 내용으로 답합니다</div><p>${inline(book.faqBanner)}</p><div class="bs">${esc(book.faqBannerSrc)}</div></div>`;
  for (const [i, q] of S.faq.entries()) {
    h += `<div class="fq${S.vid ? "" : " novid"}"><div class="fqb"><div class="fqq"><span class="qn">Q${i + 1}</span>${esc(q.q)}</div><div class="fqa">${esc(q.a)}</div><div class="anw"><b>근거:</b> ${esc(q.why)}</div></div>${await qaRight(S, q.ts)}</div>`;
  }
  return h + `</section>`;
}

export function glossHtml(S, marker = () => "") {
  const items = [...S.notes, ...S.gloss].filter((g, i, a) => a.findIndex((x) => x.term === g.term) === i).sort((a, b) => a.term.localeCompare(b.term, "ko"));
  return `<section class="front" id="${sid(S, "gl")}">${marker(sid(S, "gl"))}<div class="sk">${ordinal(S.n)} 이야기</div><h1>용어·인물 풀이</h1><div class="gold"></div>${back(sid(S, "gl"), " sm")}${items.map((g) => `<div class="gl"><div class="gt">${esc(g.term)}</div><p>${inline(g.text)}</p></div>`).join("")}</section>`;
}

// 이야기 하나의 차례 항목: [제목, id, 깊이(0=이야기 1=장 2=소제목), 부제]
export function tocItems(S) {
  const it = [[`${ordinal(S.n)} 이야기 · ${S.title}`, sid(S), 0, S.sub]];
  S.chapters.forEach((c, i) => {
    it.push([`${chLabel(c) ? chLabel(c) + " " : ""}${c.title}`, chId(S, i), 1, c.sub]);
    c.secs.forEach((s, j) => it.push([s.title, secId(S, i, j), 2]));
  });
  it.push(["한눈에 보는 이야기", sid(S, "sum"), 1], ["개념 문제", sid(S, "quiz"), 1], ["개념 문제 답안", sid(S, "ans"), 1], ["예상 질문과 답변", sid(S, "faq"), 1], ["용어·인물 풀이", sid(S, "gl"), 1]);
  return it;
}
