// 장별 해설서 2판 HTML 조판 — 장별 책과 합본이 같은 조각을 쓴다(합본은 장별 원고를 그대로 묶는다).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BOOKS, HERE, TMP, esc, chapterVerses, rangeVerses, markRanges, applyMarks, MARK, BASIS, timeKo, ffFile, sbcFile, webOf } from "./lib.mjs";
import { mapSvg, mapViews, relationSvg, relLegendHtml, coverSvg } from "./art.mjs";

// 굵기별 정적 Noto 폰트(%TEMP%/chapterbook2/fonts, fetch_fonts.mjs로 받음). 가변 폰트는 Edge가 굵기 변형을 Type3(글자 그림)로 넣어
// PDF가 커지므로 쓰지 않는다. 정적 폰트가 없으면 빌드를 멈춘다.
const FD = path.join(TMP, "fonts");
const FACES = [["Noto Sans KR", 300, "NotoSansKR-300"], ["Noto Sans KR", 400, "NotoSansKR-400"], ["Noto Sans KR", 500, "NotoSansKR-500"], ["Noto Sans KR", 600, "NotoSansKR-700"], ["Noto Sans KR", 700, "NotoSansKR-700"], ["Noto Sans KR", 900, "NotoSansKR-900"], ["Noto Serif KR", 400, "NotoSerifKR-400"], ["Noto Serif KR", 700, "NotoSerifKR-700"]];
for (const [, , n] of FACES) if (!fs.existsSync(path.join(FD, n + ".ttf"))) throw new Error("정적 폰트 없음: node tools/chapterbook/fetch_fonts.mjs 를 먼저 실행 (" + n + ")");
const FONT = FACES.map(([fam, w, n]) => `@font-face{font-family:"${fam}";font-weight:${w};font-style:normal;src:url("${pathUrl(path.join(FD, n + ".ttf"))}") format("truetype");}`).join("");
function pathUrl(p) { return "file:///" + p.replace(/\\/g, "/"); }
export const CSS = FONT + fs.readFileSync(path.join(HERE, "style.css"), "utf8");

export const qrFile = (url) => path.join(TMP, "qr", crypto.createHash("sha1").update(url).digest("hex").slice(0, 16) + ".png");

function inline(c) {
  let out = "", pos = 0;
  const spans = (c.spans || []).map((s) => ({ s: c.text.indexOf(s.text), e: c.text.indexOf(s.text) + s.text.length, level: s.level })).sort((a, b) => a.s - b.s);
  for (const s of spans) { if (s.s < pos) continue; out += esc(c.text.slice(pos, s.s)) + `<span class="hl${s.level}">${esc(c.text.slice(s.s, s.e))}</span>`; pos = s.e; }
  return out + esc(c.text.slice(pos));
}
function where(e) {
  if (e.type === "pdf") { const p = e.pages; return ` · PDF ${p.length > 1 ? `${p[0]}–${p.at(-1)}` : p[0]}쪽`; }
  if (e.type === "external") return ` · ${e.where || "원문"}`;
  return "";
}
// 유튜브 재생 버튼 모양(빨간 둥근 사각형 + 흰 삼각형)
export const YT = `<svg class="yt" viewBox="0 0 28 20"><rect width="28" height="20" rx="5" fill="#ff0000"/><path d="M11 5.5L19.5 10L11 14.5Z" fill="#fff"/></svg>`;
// 교재 PDF 출처 한 줄: "밀크 7강 제사장 교회 VS 신부 교회" (파일 이름에서 제목을 뽑아 교재 이름 뒤에 한 번만)
function pdfTitle(e) {
  const nf = (x) => String(x || "").normalize("NFC");
  let t = nf(path.basename(nf(e.file), ".pdf"));
  t = t.replace(/^[0-9]+[_ ]/, "").replace(new RegExp("[_ ]?" + nf("밀크") + "[0-9]+(-[0-9]+)?" + nf("강") + "$"), "").split("_").join(" ").replace(/\bvs\b/gi, "VS").trim();
  const src = nf(e.source).trim();
  const flat = (x) => x.replace(/[\s「」]/g, "");
  if (!t || flat(src).includes(flat(t))) return src;
  return src + " " + t;
}
// 출처 상자: 출처마다 한 줄, 왼쪽 칸 이름 · 오른쪽 칸 ▶ 분·초(QR 없음, 지침 §2-2, 2026-10-13)
function sourceRows(c) {
  return `<div class="srcbox">` + c.evidence.map((e) => {
    const basis = BASIS[c.basis].tag;
    const label = e.type === "external" ? `${e.author} · ${e.source}` : e.type === "pdf" ? pdfTitle(e) : e.source;
    const jump = !e.url ? "" : e.type === "external" ? `<a class="jump" href="${esc(e.url)}">원문 보기 ↗</a>` : `<a class="jump" href="${esc(e.url)}">${YT}<span>${timeKo(e.url)}</span></a>`;
    return `<div class="srow"><div class="sl">${esc(label)}${esc(where(e))}<span class="basis">${esc(basis)}</span></div><div class="sj">${jump}</div></div>`;
  }).join("") + `</div>`;
}
export const TOTOC = `<div class="totoc-row"><a class="totoc" href="#toc">▲ 차례로</a></div>`;
const header = (label, en, key, mk) => `<section class="front" id="${key}">${mk(key)}<p class="eyebrow">${en}</p><h1>${esc(label)}</h1><div class="gold"></div>`;

export const LEGEND_BOARD = `<div class="legend-board"><span class="k"><span class="mk-u">밑줄</span> 중요한 포인트</span>` + ["y", "g", "p", "b"].map((k) => `<span class="k"><span class="${MARK[k][0]}">${MARK[k][1].split(" — ")[0]}</span> ${MARK[k][1].split(" — ")[1]}</span>`).join("") + `</div>`;

export function introBlocks(book) {
  const B = BOOKS[book];
  return [
    ["이 책은", `${B.ko}의 절 순서로 읽으며 첫열매들 교회의 강의와 교재, 교회 교리로 본문을 이해하는 교재입니다. 해설을 붙일 근거를 찾지 못한 부분은 본문을 그대로 읽도록 남겼습니다.`],
    ["해설의 근거와 순위", "해설은 성경 해석 지침의 순위를 따릅니다. 1순위는 첫열매들 교회의 영상 강의와 교재입니다. 출처 줄에 표시가 없으면 강의·교재가 그 절을 풀이하거나 언급한 것이고, ‘교회 교리 적용’은 교회 교리(밀크 교재 등)의 원리를 이 절에 비추어 본 것입니다. 1순위 근거가 없는 단락에만 2순위 ‘외부 해설’(세대주의 해설가 — 스코필드 등 — 의 해설 가운데 교회 교리에 가까운 것)을, 그다음 3순위 ‘이이레 목사 강의’(서울침례교회 「다윗의 삶」)를 썼습니다. 2·3순위는 회색·갈색 줄로 구분했으며 교회의 가르침으로 소개하지 않습니다."],
    ["성경 본문 — 칠판", "한글과 영어 본문은 표준킹제임스성경 한영대역의 글자 그대로입니다. 칠판의 밑줄과 형광펜은 글자를 바꾸지 않고 덧씌운 표시이며, KJV 영어에도 같은 뜻의 자리에 같은 표시를 했습니다. 색의 뜻은 칠판마다 맨 위에, 형광펜 바로 위에도 작게 적었습니다. KJV 아래 색 상자는 현대 영어 번역 World English Bible(British Edition, 퍼블릭 도메인)입니다. 칠판 끝에는 그 단락의 영어 강의(주요 구문·필수 문법)와 단어장이 있습니다."],
    ["그림", "이 장의 인물과 관계도, 지명이 나오는 장의 지도를 본문 앞에 두었습니다. 지도의 위치는 대략적인 것이며, 위치가 알려지지 않은 곳은 따로 적었습니다."],
    ["영상 구간과 차례", "빨간 유튜브 버튼을 누르면 그 구간부터 영상이 재생됩니다. 강의 시각은 YouTube 자막 패널에 표시된 그 줄의 시작 시각이고, 교재 PDF 출처의 시각은 원 교재에 실린 구간 주소이거나, 그 쪽이 속한 구간의 시작 시각입니다. 이번 제작에서 영상을 재생하여 발언 시점을 다시 확인하지는 않았습니다. 차례의 제목을 누르면 해당 단락으로 이동합니다."],
  ];
}
export function howto(book, mk) {
  let o = header("이 책을 읽는 법", "HOW TO READ", "howto", mk);
  for (const [l, t] of introBlocks(book)) o += `<div class="lab">${l}</div><p>${esc(t)}</p>`;
  o += `<div class="lab">해설 강조 표시</div><table class="legend"><tr><td><span class="hl1">노란 바탕</span></td><td>중요</td></tr><tr><td><span class="hl2">노란 바탕 + 굵게</span></td><td>더 중요</td></tr><tr><td><span class="hl3">노란 바탕 + 굵게 + 빨간 밑줄</span></td><td>핵심 명제</td></tr><tr><td>파란 인용 상자</td><td>교재 문장을 그대로 옮긴 곳</td></tr></table></section>`;
  return o;
}
export function cover(book, title, sub, art, motto) {
  return `<section class="cover"><i class="diamond top"></i><i class="diamond bottom"></i><div class="ed">FIRSTFRUITS · 첫열매들 교리로 읽는 성경</div><h1>${title}</h1><div class="sub">${esc(sub)}</div><div class="art">${art}</div><div class="motto">${esc(motto)}</div><div class="bar"></div><div class="bot">첫열매들(FIRSTFRUITS) 강의와 교재로 엮은</div></section>`;
}

// 한 장의 본문부: 장 머리 → 인물 → 지도 → 절·해설 → 영어 구문 (+ 학습 자료는 learning()으로)
// p = id 앞붙임(합본에서 장마다 다르게), qr = PDF에 QR 넣기
// head = 단원 책에서 장 일부만 실을 때 장 머리 글자 {h1, nav}(지침 §0-1)
export function chapterParts(book, ch, d, { p = "", qr = true, mk = () => "", head = null } = {}) {
  const B = BOOKS[book];
  const nav = [];
  const comments = Object.fromEntries(d.sections.flatMap((s) => s.comments.map((c) => [c.id, c])));
  let o = `<section class="front" id="${p}chapter">${mk(p + "chapter")}<div class="chapter-header"><p class="eyebrow">${B.en} ${ch}</p><h1>${head ? esc(head.h1) : `${B.ko} ${ch}장`}</h1>${head ? "" : `<div class="subtitle">${esc(d.subtitle)}</div>`}<div class="gold"></div></div>`;
  nav.push([p + "chapter", head ? head.nav : `${B.ko} ${ch}장 — ${d.subtitle}`, 0]);
  // 인물
  if (d.people?.length) {
    o += `<div class="lab" id="${p}people">${mk(p + "people")}이 장의 인물</div><div class="people">`;
    for (const x of d.people) o += `<div class="person"><span class="pn">${esc(x.name)}</span>${x.en ? `<span class="pe">${esc(x.en)}</span>` : ""}<div>${esc(x.desc)}</div><div class="pr">근거: ${B.ko} ${esc(x.refs.join(", "))}</div></div>`;
    o += `</div>`;
    nav.push([p + "people", "이 장의 인물", 1]);
    if (d.relations?.length) { const nm = Object.fromEntries(d.people.map((x) => [x.id, x.name])); o += `<div class="figure relfig"><div class="lab">인물 관계도</div>${relationSvg(d.people, d.relations)}${relLegendHtml(d.relations, d.people)}</div><table class="rel-refs"><thead><tr><th>관계</th><th>근거</th></tr></thead><tbody>` + d.relations.map((r) => `<tr><td>${esc(nm[r.from])} — ${esc(nm[r.to])}${r.label ? ` · ${esc(r.label)}` : ""}</td><td>${B.ko} ${esc(r.ref)}</td></tr>`).join("") + `</tbody></table>`; }
  }
  // 지도 — views가 있으면 전체 지도와 확대 지도 등 여러 장
  if (d.map?.places?.length) {
    const views = mapViews(d.map);
    o += `<div class="lab" id="${p}map">${mk(p + "map")}이 장의 지도</div>`;
    views.forEach((v, vi) => {
      const places = d.map.places.filter((x) => v.keys.includes(x.key));
      const routes = (d.map.routes || []).map((r) => ({ ...r, path: r.path.filter((k) => v.keys.includes(k)) })).filter((r) => r.path.length > 1);
      const last = vi === views.length - 1;
      o += `<div class="figure">${v.title ? `<div class="map-title">${esc(v.title)}</div>` : ""}${mapSvg({ places, routes, minSpan: v.minSpan, focus: v.focus, hide: v.hide, frames: v.frames })}${last ? `<div class="cap">붉은 점·굵은 이름 = 이 장에 나오는 지명. 옅은 이름 = 주변 지역. 위치는 대략적인 것입니다.${d.map.routes?.length ? " 붉은 점선 화살표 = 본문의 이동 경로(" + esc(d.map.routes.map((r) => r.ref).join(", ")) + ")." : ""}</div>${d.map.unknown?.length ? `<div class="unknown">위치 미상: ${esc(d.map.unknown.map((u) => `${u.name}(${u.ref}) ${u.note || ""}`.trim()).join(" · "))}</div>` : ""}` : ""}</div>`;
    });
    nav.push([p + "map", "이 장의 지도", 1]);
  }
  // 절과 해설 — 단락마다 칠판 하나: 범례 → 절(한글·KJV·현대 영어) → 영어 강의 → 단어장
  d.sections.forEach((s, i) => {
    const key = `${p}s${i + 1}`;
    const vs = rangeVerses(book, ch, s.ref);
    nav.push([key, `${s.ref} ${s.title}`, 1]);
    o += `<div class="sech" id="${key}">${mk(key)}<span class="badge">${s.ref}</span><h2>${esc(s.title)}</h2></div><div class="verse"><div class="bhead">${LEGEND_BOARD}<div class="vl">본문 · ${B.ko} ${s.ref}</div>`;
    for (const [vi, v] of vs.entries()) {
      const ms = (s.marks || []).filter((m) => m.v === v.ref);
      const ko = applyMarks(v.koHtml, v.ko, markRanges(v.ko, ms, "ko"));
      const en = applyMarks(v.enHtml, v.en, markRanges(v.en, ms, "en"));
      const web = webOf(book, v.ref);
      o += `<div class="vrow"><span class="num">${v.ref.split(":")[1]}</span><p class="ko">${ko}</p><p class="en">${en}</p>${web ? `<div class="web"><span class="wt">현대 영어</span>${esc(web)}</div>` : ""}</div>` + (vi === 0 ? `</div>` : "");
    }
    o += `<div class="vs">한글·KJV: 표준킹제임스성경 한영대역 · kingjamesbiblekorea.com &nbsp;|&nbsp; 현대 영어: World English Bible (British Edition), public domain</div>`;
    if (s.english?.length) {
      o += `<div class="lesson"><div class="lt">영어 강의 — 주요 구문 · 필수 문법</div>`;
      for (const e of s.english) o += `<div class="li"><div><span class="lr">${e.ref}</span><span class="lp">${esc(e.phrase)}</span>${e.grammar ? `<span class="lg2">${esc(e.grammar)}</span>` : ""}</div><p>${esc(e.text)}</p></div>`;
      o += `</div>`;
    }
    if (s.vocab?.length) o += `<div class="vocab"><div class="lt">단어장</div><div class="vw">` + s.vocab.map((w) => `<span class="w"><b>${esc(w.w)}</b> ${esc(w.ko)} <i>${w.ref.split(":")[1]}절</i></span>`).join("") + `</div></div>`;
    o += `</div>`;
    // 「이야기로 읽기」는 싣지 않는다(지침 §2-1, 2026-10-13)
    if (s.comments.length) o += `<div class="category">해설</div>`;
    for (const c of s.comments) {
      const b = BASIS[c.basis];
      o += `<div class="comment ${b.cls}"><p class="${c.quote ? "quote" : ""}">${b.badge ? `<span class="badge-src">${b.badge}</span>` : ""}${inline(c)}</p>${sourceRows(c)}</div>`;
    }
    for (const t of s.notes || []) o += `<div class="note"><b>해설 미수록</b><br/>${esc(t)}</div>`;
    o += TOTOC;
  });
  o += `</section>`;
  return { html: o, nav, comments };
}
export function refOf(d, key) { for (const s of d.sections) if (s.comments.some((c) => c.id === key)) return s.ref; throw new Error("없는 해설 key: " + key); }
const basisOf = (B, d, x) => x.key ? `근거: ${B.ko} ${refOf(d, x.key)} 해설` : `근거: ${B.ko} ${x.verse} 본문`;

export function learning(book, ch, d, comments, { p = "", mk = () => "", inBook = false, scope = "이 장" } = {}) {
  const B = BOOKS[book], L = d.learning, nav = [];
  const sec = (label, en, key) => { nav.push([p + key, (inBook ? `${ch}장 ` : "") + label, inBook ? 1 : 0]); return header(label, en, p + key, mk); };
  let o = sec("한눈에 보는 이야기", "SUMMARY", "summary") + `<ol class="summary">` + L.summary.map((x) => `<li>${esc(x.text)}</li>`).join("") + `</ol>${TOTOC}</section>`;
  o += sec("개념 문제", "QUESTIONS", "questions") + `<ol class="questions">` + L.questions.map((x) => `<li>${esc(x.q)}</li>`).join("") + `</ol>${TOTOC}</section>`;
  o += sec("답안과 근거", "ANSWERS", "answers") + L.questions.map((x, i) => `<div class="qa"><p class="q">${String(i + 1).padStart(2, "0")}. ${esc(x.q)}</p><p class="answer">${esc(x.a)}</p><div class="source-text">${basisOf(B, d, x)}</div>${x.key ? sourceRows(comments[x.key]) : ""}</div>`).join("") + TOTOC + `</section>`;
  o += sec("예상 질문과 답변", "QUESTIONS & ANSWERS", "faq") + `<div class="note">${scope}의 해설에서 확인한 설명으로 답합니다.</div>` + L.faq.map((x, i) => { const c = comments[x.key]; return `<p class="q">Q${i + 1}. ${esc(x.q)}</p><p>${esc(c.text)}</p>${sourceRows(c, false)}`; }).join("") + TOTOC + `</section>`;
  o += sec("용어 풀이", "GLOSSARY", "glossary") + L.glossary.map((x) => `<div class="gl"><div class="gt">${esc(x.term)}</div><p>${esc(x.text)}</p><div class="source-text">${basisOf(B, d, x)}</div></div>`).join("") + TOTOC + `</section>`;
  return { html: o, nav };
}
export function sourcesTable(list, mk, key = "sources") {
  const files = new Map();
  for (const c of list) for (const e of c.evidence) {
    let label = e.type === "external" ? `${e.author} · ${e.source}` : e.source;
    if (e.type === "transcript") label += ` · youtu.be/${e.url.match(/youtu\.be\/([\w-]{11})/)[1]}`;
    const kind = e.type === "external" ? "2순위" : sbcFile(e.file) ? "3순위" : "1순위";
    if (!files.has(e.file)) files.set(e.file, [kind, label]);
  }
  const rows = [...files].sort((a, b) => a[1][0].localeCompare(b[1][0])).map(([f, [k, l]]) => `<tr><td>${k}</td><td>${esc(l)}</td><td>${esc(f)}</td></tr>`).join("");
  return header("참고한 자료", "SOURCES", key, mk) + `<table class="source-table"><thead><tr><th>순위</th><th>강의·교재·해설</th><th>파일</th></tr></thead><tbody>${rows}</tbody></table><p class="note" style="margin-top:4mm">성경 본문: 표준킹제임스성경 한영대역(kingjamesbiblekorea.com). 교리의 근간: 「MILK · 하나님 말씀의 기초원리」 1–10강. 근거 순위: 성경 해석 지침(docs/policy/성경해석_지침.md).</p></section>`;
}
export function toc(nav, pages, mk) {
  let o = header("차례", "CONTENTS", "toc", mk) + `<div class="toc">`;
  for (const [key, label, lvl] of nav) {
    const cls = lvl === 0 ? (key.endsWith("chapter") ? "group" : "row extra") : "row";
    o += `<a class="${cls}" href="#${key}"><span>${esc(label)}</span><span class="dots"></span><span class="pg">${pages[key] ?? "·"}</span></a>`;
  }
  return o + `</div></section>`;
}
export function page(title, body) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"/><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}
