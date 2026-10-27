// 교회 자료 전체(Theme·Milk PDF 쪽 글자 + 「다윗의 삶」 강의 스크립트)에서 낱말을 찾는다.
//   node 사무엘상·하/원본/search.mjs 한나 [언약궤 …]     → 낱말마다 걸린 곳(파일·쪽/시각)과 앞뒤 글
//   --ctx 120  앞뒤 글자 수 / --max 40  낱말당 최대 결과 / --only pdf|transcript
// 결과는 후보일 뿐이다. 채택할 때는 그 쪽·그 시각 앞뒤를 직접 읽고 맥락을 확인한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const ctx = +opt('--ctx', 90), max = +opt('--max', 40), only = opt('--only', '');

export function loadCorpus() {
  const books = JSON.parse(fs.readFileSync(path.join(R, '창세기/자료검토/전체_PDF_본문색인.json'), 'utf8')).books;
  return books;
}
export function loadTranscripts() {
  const dir = path.join(R, '사무엘상·하/강의스크립트');
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)
      .map(l => l.match(/^- \[([\d:]+)\]\((https:\/\/youtu\.be\/[\w-]{11}\?t=\d+)\) (.*)$/)).filter(Boolean)
      .map(m => ({ time: m[1], url: m[2], text: m[3] }));
    const title = fs.readFileSync(path.join(dir, f), 'utf8').match(/^# (.*)$/m)[1];
    return { file: `사무엘상·하/강의스크립트/${f}`, title, lines };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const books = only === 'transcript' ? [] : loadCorpus();
  const trs = only === 'pdf' ? [] : loadTranscripts();
  for (const kw of args) {
    let n = 0; const out = [];
    for (const b of books) for (const p of b.content) {
      let i = -1;
      while ((i = p.text.indexOf(kw, i + 1)) >= 0 && n < max) {
        n++; out.push(`[PDF] ${b.file} p${p.page} :: …${p.text.slice(Math.max(0, i - ctx), i + kw.length + ctx).replace(/\s+/g, ' ')}…`);
        i += ctx;
      }
    }
    for (const t of trs) {
      const joined = t.lines.map(l => l.text).join(' ');
      const starts = []; let pos = 0; for (const l of t.lines) { starts.push(pos); pos += l.text.length + 1; }
      let i = -1;
      while ((i = joined.indexOf(kw, i + 1)) >= 0 && n < max) {
        let k = 0; while (k + 1 < starts.length && starts[k + 1] <= i) k++;
        n++; out.push(`[강의] ${t.file} [${t.lines[k].time}] :: …${joined.slice(Math.max(0, i - ctx), i + kw.length + ctx)}…`);
        i += ctx;
      }
    }
    console.log(`\n=== ${kw} (${n}${n >= max ? '+' : ''}) ===\n` + out.join('\n'));
  }
}
