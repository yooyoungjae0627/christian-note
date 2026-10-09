// 본문 HTML 조각. mode = "pdf"(QR) | "epub"(▶ 링크만)
import QRCode from "qrcode";
import { esc, inline, ytUrl } from "./parse.mjs";
import { mapSvg } from "./maps.mjs";

// EPUB은 앱마다 SVG 지원이 달라 지도·아이콘을 PNG로 쓴다
let MODE = "pdf";
export const setMode = (m) => { MODE = m; };

export const chLabel = (c) => (/^\d+$/.test(c.num) && c.num !== "0" ? `${c.num}장` : "");
export const lessonId = (L) => `L${L.n}`;
export const chId = (L, i) => `L${L.n}c${i}`;
export const secId = (L, i, j) => `L${L.n}c${i}s${j}`;

const YT = `<svg class="ytm" viewBox="0 0 28 20" aria-hidden="true"><rect width="28" height="20" rx="5" fill="#e52d27"/><path d="M11 5.5v9l8-4.5z" fill="#fff"/></svg>`;

export async function qrSvg(url) {
  // 오류정정 M, 흰 여백 2모듈, 남색
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#18233f", light: "#ffffff" } });
}

export async function videoMark(vid, ts, mode) {
  const url = ytUrl(vid, ts);
  if (mode === "epub") return `<a class="yt" href="${url}">▶ ${ts}</a>`;
  const svg = (await qrSvg(url)).replace("<svg", '<svg class="qrimg"');
  return `<a class="qr" href="${url}">${svg}<span class="qt">${YT}<b>${ts}</b></span><span class="qc"><b>클릭</b>하면 해당 구간으로<br>이동합니다</span></a>`;
}

export function verseHtml(b) {
  const head = b.head ? `<div class="vh">${esc(b.head)}</div>` : "";
  const body = b.text.split("//").map((s) => `<p>${inline(s.trim())}</p>`).join("");
  return `<div class="verse${b.ref ? " vref" : ""}"><div class="vl">${b.ref ? "말씀 — 강의에서 언급한 구절" : "말씀 — 강의에서 읽은 구절"}</div>${head}<div class="vb">${body}</div><div class="vs">${esc(b.src)}</div></div>`;
}

export const noteHtml = (b) => `<div class="note"><div class="nt">${esc(b.term)}</div><p>${inline(b.text)}</p></div>`;

export function blockHtml(b) {
  if (b.t === "p") return `<p class="bp">${inline(b.text)}</p>`;
  if (b.t === "verse") return verseHtml(b);
  if (b.t === "note") return noteHtml(b);
  if (b.t === "map") { const m = mapSvg(b.key); const pic = MODE === "epub" ? `<img class="map ${b.key}" src="map_${b.key}.png" alt="${esc(m.caption)}"/>` : m.svg; return `<figure class="mapfig">${pic}<figcaption>${esc(m.caption)}</figcaption></figure>`; }
  if (b.t === "people") return `<div class="people">${b.items.map((p) => `<div class="pc"><div class="pn">${esc(p.name)}<span class="pr">${esc(p.role)}</span></div><p>${inline(p.text)}</p></div>`).join("")}</div>`;
  if (b.t === "years") return `<table class="years"><thead><tr>${b.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map((r) => `<tr${r[1].startsWith("★") ? ' class="now"' : ""}>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>${b.note ? `<p class="ynote">${esc(b.note)}</p>` : ""}`;
  throw new Error(b.t);
}

// 말씀 상자를 소개하는 문단과 상자를 한 덩어리로 묶는다(쪽 나눔 정책 §5)
export function blocksHtml(blocks, head = "") {
  // 제목은 다음 내용과 떨어지지 않게(break-after: avoid), 문단은 쪽을 넘어 흐를 수 있다
  const out = head ? [`<div class="hk">${head}</div>`] : [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.t === "p" && blocks[i + 1] && blocks[i + 1].t === "verse") {
      out.push(`<div class="keep">${blockHtml(b)}${blockHtml(blocks[i + 1])}</div>`);
      i++;
    } else out.push(blockHtml(b));
  }
  return out.join("\n");
}

export async function chapterHtml(L, c, i, mode, marker = () => "") {
  const lab = chLabel(c);
  const qr = c.ts ? await videoMark(L.vid, c.ts, mode) : "";
  const head = `<div class="chh" id="${chId(L, i)}">${marker(chId(L, i))}<div class="chl">${lab ? `<div class="chn">${lab}</div>` : ""}<h2>${esc(c.title)}</h2>${c.sub ? `<div class="chs">${esc(c.sub)}</div>` : ""}<div class="gold"></div></div>${qr ? `<div class="chq">${qr}</div>` : ""}</div>`;
  let html = "";
  if (c.blocks.length) {
    html += blocksHtml(c.blocks, head);
  }
  for (let j = 0; j < c.secs.length; j++) {
    const s = c.secs[j];
    const showQr = s.ts && !(j === 0 && !c.blocks.length && s.ts === c.ts);
    const sq = showQr ? `<div class="sq">${await videoMark(L.vid, s.ts, mode)}</div>` : "";
    let sh = `<div class="sech" id="${secId(L, i, j)}">${marker(secId(L, i, j))}<h3>${esc(s.title)}</h3>${sq}</div>`;
    if (j === 0 && !c.blocks.length) sh = head + sh;
    html += blocksHtml(s.blocks, sh);
  }
  return `<section class="chapter">${html}</section>`;
}

// ── 킹제임스 영어로 읽기(책 맨 끝) ──
export const ttsUrl = (text) => "https://translate.google.com/?sl=en&tl=ko&text=" + encodeURIComponent(text) + "&op=translate";
const SPK = `<svg class="spk" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;
export const ttsButton = (text, label = "듣기", cls = "") => `<a class="tts${cls ? " " + cls : ""}" href="${esc(ttsUrl(text))}">${MODE === "epub" ? '<img class="spk" src="speaker.png" alt=""/>' : SPK}<span>${label}</span></a>`;
export const kjvId = (L, k = "") => `L${L.n}kjv${k}`;

// 문장의 뼈대: 역할(주어·동사…)을 왼쪽 칸에, 영어 덩어리를 오른쪽 칸에. 좁은 화면에서도 깨지지 않게 세로로 쌓는다.
function skelHtml(sk) {
  const role = (r) => {
    const k = /^주어|사건의 주어/.test(r) ? "s" : /^동사|조동사|사건의 동사|동사가 먼저|조동사가 먼저/.test(r) ? "v" : /목적어|보어|대상|~을/.test(r) ? "o" : "m";
    return `<span class="rl r-${k}">${esc(r)}</span>`;
  };
  if (MODE === "epub") return `<div class="skel">${sk.map((s) => `<div class="skr">${role(s.role)} <span class="se">${esc(s.en)}</span></div>`).join("")}</div>`;
  return `<table class="skel">${sk.map((s) => `<tr><td class="sr">${role(s.role)}</td><td class="se">${esc(s.en)}</td></tr>`).join("")}</table>`;
}

export function englishLessonHtml(L, marker = () => "") {
  const E = L.english;
  let h = `<div class="enl" id="${kjvId(L)}">${marker(kjvId(L))}<div class="chn">제${L.n}강</div><h2>${esc(L.title)}</h2><div class="chs">사무엘기상 범위의 킹제임스 영어 강의 · ${E.verses.length}절 · 「다윗의 삶 말씀판」 제${L.n}강과 함께 읽으세요</div><div class="gold"></div></div>`;
  h += `<div class="hk"><div class="sech" id="${kjvId(L, "g")}">${marker(kjvId(L, "g"))}<h3>문법 강의 — 킹제임스 영어 구문 해석의 기초</h3></div></div>`;
  E.grammar.forEach((g, gi) => {
    h += `<div class="glec"><div class="hk"><div class="gt2" id="${kjvId(L, "g" + gi)}">${marker(kjvId(L, "g" + gi))}${esc(g.title)}</div></div>`;
    for (const it of g.items) {
      if (it.t === "p") h += `<p class="bp">${inline(it.text)}</p>`;
      else if (it.t === "sk") h += skelHtml(it.sk);
      else if (it.t === "x") h += `<div class="gx"><div class="gxh">이렇게 틀리기 쉽습니다</div><p>${inline(it.text)}</p></div>`;
      else if (it.t === "q") h += `<div class="gq"><div class="gqh">확인해 볼까요?</div><p class="q">${esc(it.q)}</p><p class="a"><b>답</b> ${esc(it.a)}</p></div>`;
    }
    h += `</div>`;
  });
  h += `<div class="hk"><div class="sech" id="${kjvId(L, "w")}">${marker(kjvId(L, "w"))}<h3>필수 단어</h3></div></div>`;
  h += `<table class="words"><thead><tr><th>단어</th><th>뜻</th><th>현대 영어</th><th>나온 절</th></tr></thead><tbody>${E.words.map((w) => `<tr><td class="w">${esc(w.w)}</td><td>${esc(w.ko)}</td><td class="m">${esc(w.modern || "—")}</td><td class="r">${esc(w.ref)}</td></tr>`).join("")}</tbody></table>`;
  h += `<div class="hk"><div class="sech" id="${kjvId(L, "r")}">${marker(kjvId(L, "r"))}<h3>직독직해와 구문 강의 — 한 절씩</h3></div><p class="bp small">한 절마다 ① 원문과 현대 영어를 소리 내어 읽고(확성기 모양의 <b>원문 듣기 · 현대 영어 듣기</b> 버튼: Google 번역 화면이 열리면 그곳의 스피커 단추를 눌러 미국식 영어로 듣습니다, 인터넷 필요) ② / 표시마다 끊어 직독직해하고 ③ 문장의 뼈대를 확인한 뒤 ④ 구문 강의를 읽습니다. <span class="modtag">현대</span> 표시는 고어를 오늘날 영어로 바꾼 말입니다.</p></div>`;
  for (const v of E.verses) {
    const hasMod = v.modern !== v.text;
    h += `<div class="env"><div class="enh"><span class="er">${esc(v.refKo)} <small>${esc(v.ref)}</small></span><span class="btns">${ttsButton(v.text, "원문 듣기")}${hasMod ? ttsButton(v.modern, "현대 영어 듣기", "mod") : ""}</span></div>`;
    h += `<p class="enfull">${v.chunks.map((c) => esc(c.en)).join(' <span class="sl">/</span> ')}</p>`;
    if (hasMod) h += `<p class="enmod"><span class="modtag">현대</span>${esc(v.modern)}</p>`;
    h += `<div class="lab2">직독직해</div>`;
    h += MODE === "epub"
      ? `<div class="chunks">${v.chunks.map((c) => `<div class="chunk"><div class="ce">${esc(c.en)}</div>${c.modern ? `<div class="cm"><span class="modtag">현대</span>${esc(c.modern)}</div>` : ""}<div class="ck">${esc(c.ko)}</div></div>`).join("")}</div>`
      : `<table class="chunks">${v.chunks.map((c) => `<tr><td class="ce">${esc(c.en)}${c.modern ? `<span class="cm"><span class="modtag">현대</span>${esc(c.modern)}</span>` : ""}</td><td class="ck">${esc(c.ko)}</td></tr>`).join("")}</table>`;
    h += `<div class="lab2">문장의 뼈대</div>${v.sk.map(skelHtml).join("")}`;
    h += `<div class="lab2">구문 강의</div>${v.ex.map((p) => `<p class="bp exp">${inline(p)}</p>`).join("")}`;
    h += `</div>`;
  }
  return h;
}
