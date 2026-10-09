// 칠판: 선생님이 칠판(PPT)에 한 절을 청크로 끊어 쓰고, 단어 밑에 색 분필로 성분을 표시하고,
// 그 아래 노란 분필로 직독직해를 적은 화면. HTML로 그려서 PDF에는 그대로, EPUB에는 그림(PNG)으로 넣는다.
import { esc } from "./parse.mjs";

export const ROLE = {
  S: { ko: "주어", c: "#8fd3ff" },
  V: { ko: "동사", c: "#ff9fc4" },
  O: { ko: "목적어", c: "#b9f28a" },
  C: { ko: "보어", c: "#ffc56b" },
  Q: { ko: "말한 내용", c: "#d9c2ff" },
};

const marked = (s) => esc(s).replace(/\[([SVOCQ]):([^\]]*)\]/g, (m, r, t) => `<span class="smk smk-${r}" data-r="${r}">${t}</span>`);

/** b = { ref, refKo, chunks:[{en, ko}], key } */
export function boardHtml(b) {
  const rows = b.chunks
    .map((c, i) => `<div class="bdr"><div class="bde">${marked(c.en)}${i < b.chunks.length - 1 ? '<span class="bds"> /</span>' : ""}</div><div class="bdk">→ ${esc(c.ko)}</div></div>`)
    .join("");
  return `<div class="bd"><div class="bdh"><span class="bdref">${esc(b.ref)}</span><span class="bdko">${esc(b.refKo)}</span></div>${rows}${b.key ? `<div class="bdkey">★ ${esc(b.key)}</div>` : ""}<div class="bdtray"><i></i></div></div>`;
}

// 칠판 CSS. 글꼴은 fonts/ 폴더(OFL): Patrick Hand(영어 분필), Nanum Pen Script(우리말 분필)
export function boardCss(fontBase) {
  const roles = Object.entries(ROLE).map(([k, v]) => `.smk-${k}{border-bottom-color:${v.c}}.smk-${k}::before{color:${v.c}}`).join("");
  return `@font-face{font-family:"Patrick Hand";src:url("${fontBase}PatrickHand-Regular.ttf")}
@font-face{font-family:"Nanum Pen Script";src:url("${fontBase}NanumPenScript-Regular.ttf")}
.bd{position:relative;background:radial-gradient(ellipse at 35% 30%,#2e5643 0%,#1c3a2c 70%,#173125 100%);border:2.6mm solid #7a5230;border-radius:2mm;box-shadow:inset 0 0 0 .4mm rgba(0,0,0,.35);padding:3.2mm 5mm 6mm;color:#f4f1e6;break-inside:avoid;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bdh{display:flex;justify-content:space-between;align-items:baseline;border-bottom:.3mm solid rgba(244,241,230,.35);padding-bottom:1mm;margin-bottom:2.6mm}
.bdref{font:15pt/1.1 "Patrick Hand",sans-serif;letter-spacing:.02em}
.bdko{font:15pt/1.1 "Nanum Pen Script",sans-serif;color:#fff09a}
.bdr{margin:0 0 2.2mm}
.bde{font:13.6pt/1.55 "Patrick Hand",sans-serif;color:#f4f1e6;padding-top:2.4mm}
.bds{color:#ff8f8f;font-weight:700}
.bdk{font:14pt/1.25 "Nanum Pen Script",sans-serif;color:#fff09a;padding-left:4mm}
.smk{position:relative;border-bottom:.55mm solid;padding-bottom:.2mm}
.smk::before{content:attr(data-r);position:absolute;left:0;top:-1.05em;font:8pt/1 "Patrick Hand",sans-serif;font-weight:700}
${roles}
.bdkey{margin-top:3mm;border:.3mm dashed rgba(244,241,230,.8);border-radius:1.2mm;padding:1.4mm 2.6mm;font:14pt/1.3 "Nanum Pen Script",sans-serif;color:#f4f1e6}
.bdtray{position:absolute;left:50%;bottom:1mm;transform:translateX(-50%);width:34mm;height:1.1mm;background:#5a3b22;border-radius:.6mm}
.bdtray i{position:absolute;right:5mm;top:-1.3mm;width:6mm;height:1.5mm;background:#e9e4d8;border-radius:.4mm}`;
}

export function roleLegendHtml() {
  return Object.entries(ROLE).map(([k, v]) => `<span class="rlg"><b style="border-bottom:.6mm solid ${v.c}">${k}</b> ${v.ko}</span>`).join(" ");
}
