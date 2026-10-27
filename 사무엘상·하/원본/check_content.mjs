// 사무엘상 장별 원고(chapterNN.json)를 빌드 전에 검사한다 — docs/policy/사무엘상_교재_제작지침.md
//   node 사무엘상·하/원본/check_content.mjs [장 …]   (없으면 있는 원고 전부)
// 검사: 절 범위(누락·중복), 해설마다 근거, PDF 근거 원문이 그 쪽 글자에 있는지·주소가 그 쪽에 있는지,
// 스크립트 근거 원문이 그 시각 줄부터 이어지는 자막에 있는지·주소가 그 줄의 시각 링크와 같은지,
// 강조 범위, 학습 자료 개수·연결, 본문 확인 문제의 답이 그 절 본문에 있는지.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCorpus, loadTranscripts } from './search.mjs';

const B = path.dirname(fileURLToPath(import.meta.url));
const verses = JSON.parse(fs.readFileSync(path.join(B, 'verses_01-15.json'), 'utf8'));
const corpus = Object.fromEntries(loadCorpus().map(b => [b.file, b]));
const trs = Object.fromEntries(loadTranscripts().map(t => [t.file, t]));
const norm = t => String(t).replace(/\s+/g, '');
const verseText = ref => { const v = verses.find(v => v.ref === ref); return v ? v.ko : null; };
const chapters = process.argv.slice(2).map(Number);
const list = chapters.length ? chapters : fs.readdirSync(B).filter(f => /^chapter\d\d\.json$/.test(f)).map(f => +f.slice(7, 9));
let failed = 0; const report = [];
for (const ch of list) {
  const errors = []; const warn = [];
  const file = path.join(B, `chapter${String(ch).padStart(2, '0')}.json`);
  let d; try { d = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { errors.push('JSON 읽기 실패 ' + e.message); report.push({ ch, errors }); failed++; continue; }
  const count = verses.filter(v => v.ref.startsWith(ch + ':')).length;
  if (d.chapter !== ch) errors.push('chapter 값이 다름');
  for (const k of ['title', 'subtitle', 'motto', 'motto_comment', 'sections', 'learning']) if (!(k in d)) errors.push('빠진 항목 ' + k);
  const refs = [];
  for (const s of d.sections || []) {
    const m = String(s.ref).match(/^(\d+):(\d+)(?:-(\d+))?$/);
    if (!m || +m[1] !== ch) { errors.push('잘못된 단락 ref ' + s.ref); continue; }
    for (let i = +m[2]; i <= +(m[3] || m[2]); i++) refs.push(i);
    if (!s.title) errors.push('단락 제목 없음 ' + s.ref);
    if (!(s.comments || []).length && !(s.notes || []).length) errors.push('해설도 미수록 안내도 없음 ' + s.ref);
  }
  if (JSON.stringify(refs) !== JSON.stringify([...Array(count)].map((_, i) => i + 1))) errors.push(`단락이 1–${count}절을 빠짐없이 한 번씩 덮지 않음`);
  const comments = {}; const basisCount = { direct: 0, linked: 0, doctrine: 0 };
  for (const s of d.sections || []) for (const c of s.comments || []) {
    if (comments[c.id]) errors.push('중복 id ' + c.id);
    comments[c.id] = { ...c, ref: s.ref };
    if (!/^s\d+-\d+$/.test(c.id || '')) errors.push('id 형식(s장-번호) ' + c.id);
    if (!['direct', 'linked', 'doctrine'].includes(c.basis)) errors.push('basis ' + c.id); else basisCount[c.basis]++;
    if (!c.text || c.text.length < 40) errors.push('해설이 너무 짧음 ' + c.id);
    for (const sp of c.spans || []) if (c.text.split(sp.text).length - 1 !== 1 || ![1, 2, 3].includes(sp.level)) errors.push('강조 범위 ' + c.id + ' ' + sp.text);
    if (!(c.evidence || []).length) errors.push('근거 없음 ' + c.id);
    for (const e of c.evidence || []) {
      if (!e.excerpt || norm(e.excerpt).length < 20) { errors.push('근거 원문 없음/짧음 ' + c.id); continue; }
      if (!e.source) errors.push('source 없음 ' + c.id);
      if (e.type === 'pdf') {
        const b = corpus[e.file];
        if (!b) { errors.push('없는 PDF ' + c.id + ' ' + e.file); continue; }
        if (!Array.isArray(e.pages) || !e.pages.length || e.pages.some(p => p < 1 || p > b.pages)) { errors.push('쪽 번호 ' + c.id); continue; }
        const pt = norm(b.content.filter(p => e.pages.includes(p.page)).map(p => p.text).join(''));
        for (const piece of e.excerpt.split(/\n…\n/)) if (norm(piece) && !pt.includes(norm(piece))) errors.push('PDF 원문이 그 쪽에 없음 ' + c.id + ' :: ' + piece.slice(0, 40));
        if (e.url) { const urls = new Set(b.content.filter(p => e.pages.includes(p.page)).flatMap(p => p.links.map(l => l.url))); if (!urls.has(e.url)) errors.push('그 쪽에 없는 주소 ' + c.id + ' ' + e.url); }
      } else if (e.type === 'transcript') {
        const t = trs[e.file];
        if (!t) { errors.push('없는 스크립트 ' + c.id + ' ' + e.file); continue; }
        const k = t.lines.findIndex(l => l.time === e.time);
        if (k < 0) { errors.push('스크립트에 없는 시각 ' + c.id + ' ' + e.time); continue; }
        if (e.url !== t.lines[k].url) errors.push('시각 링크가 그 줄과 다름 ' + c.id + ' ' + e.url + ' ≠ ' + t.lines[k].url);
        // 근거는 그 시각 줄(또는 바로 앞 줄)에서 시작해 이어지는 자막 안에 있어야 한다
        const after = norm(t.lines.slice(Math.max(0, k - 1), k + 40).map(l => l.text).join(' '));
        for (const piece of e.excerpt.split(/\n…\n/)) if (norm(piece) && !after.includes(norm(piece))) errors.push('스크립트 원문이 그 시각 뒤에 없음 ' + c.id + ' :: ' + piece.slice(0, 40));
      } else errors.push('근거 type(pdf|transcript) ' + c.id);
    }
  }
  if (d.motto && d.motto_comment && !(comments[d.motto_comment] && norm(comments[d.motto_comment].text).includes(norm(d.motto)))) errors.push('표어가 지정한 해설 문장에 없음');
  const L = d.learning || {};
  const checkRef = (x, what) => {
    if (x.key) { if (!comments[x.key]) errors.push(what + ' 없는 해설 key ' + x.key); }
    else if (x.verse) { const vt = verseText(x.verse); if (!vt || !x.verse.startsWith(ch + ':')) errors.push(what + ' 잘못된 verse ' + x.verse); else return vt; }
    else errors.push(what + ' key나 verse 없음');
    return null;
  };
  for (const q of L.questions || []) {
    const vt = checkRef(q, '문제');
    if (!q.q || !q.a) errors.push('문제/답 비어 있음');
    if (vt) for (const w of String(q.a).split(/[,·/]| 그리고 /).map(s => s.replace(/[.?!"'“”‘’]|입니다|이다|습니다|합니다/g, '').trim()).filter(Boolean)) if (!norm(vt).includes(norm(w))) errors.push(`본문 확인 문제의 답이 ${q.verse} 본문에 없음: ${w}`);
  }
  for (const f of L.faq || []) { if (!f.key || !comments[f.key]) errors.push('예상 질문은 해설 key 필요 ' + f.q); }
  for (const g of L.glossary || []) checkRef(g, '용어');
  for (const s of L.summary || []) checkRef(s, '요약');
  const nq = (L.questions || []).length, nf = (L.faq || []).length, ns = (L.summary || []).length;
  if (nq < 25 || nq > 41) errors.push('문제 개수 ' + nq + ' (25–41)');
  if (nf < 12 || nf > 14) errors.push('예상 질문 개수 ' + nf + ' (12–14)');
  if (ns < 12 || ns > 22) errors.push('요약 개수 ' + ns + ' (12–22)');
  if ((L.glossary || []).length < 4) warn.push('용어 풀이가 4개 미만');
  const r = { chapter: ch, verses: count, sections: (d.sections || []).length, comments: Object.keys(comments).length, basis: basisCount,
    evidence: Object.values(comments).reduce((a, c) => a + (c.evidence || []).length, 0), questions: nq, faq: nf, summary: ns, glossary: (L.glossary || []).length,
    notes: (d.sections || []).reduce((a, s) => a + (s.notes || []).length, 0), errors, warn };
  report.push(r); if (errors.length) failed++;
  console.log(JSON.stringify(r, null, errors.length ? 1 : 0));
}
fs.writeFileSync(path.join(B, 'content-check.json'), JSON.stringify(report, null, 1));
process.exitCode = failed ? 1 : 0;
