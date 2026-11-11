// 낱말 검색(BM25). 한글은 두 글자씩 겹쳐 잘라 찾는다 — 자동 자막은 띄어쓰기·조사가 들쭉날쭉해서
// 형태소 분석보다 이 방식이 잘 맞고, 외부 서비스(임베딩 API)나 키 없이 서버 안에서 끝난다.
const K1 = 1.2, B = 0.75;

export function tokenize(s) {
  const out = [];
  for (const w of s.normalize("NFC").toLowerCase().match(/[a-z]+|[0-9]+|[가-힣]+/g) ?? []) {
    if (!/[가-힣]/.test(w) || w.length === 1) out.push(w);
    else for (let i = 0; i < w.length - 1; i++) out.push(w.slice(i, i + 2));
  }
  return out;
}

export function buildIndex(chunks) {
  const postings = new Map(); // 낱말 → [조각 번호, 횟수, 조각 번호, 횟수, …]
  const len = new Float64Array(chunks.length);
  chunks.forEach((c, i) => {
    const tf = new Map();
    const toks = tokenize(c.text);
    len[i] = toks.length;
    for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1);
    for (const [t, n] of tf) {
      let p = postings.get(t);
      if (!p) postings.set(t, (p = []));
      p.push(i, n);
    }
  });
  const avg = len.reduce((a, b) => a + b, 0) / (chunks.length || 1);
  return { chunks, postings, len, avg };
}

// tier를 주면 그 순위 자료만 찾는다. 같은 강의의 겹치는 조각은 하나만 남긴다.
export function search(index, query, { tier, k = 6 } = {}) {
  const { chunks, postings, len, avg } = index;
  const scores = new Map();
  for (const t of new Set(tokenize(query))) {
    const p = postings.get(t);
    if (!p) continue;
    const idf = Math.log(1 + (chunks.length - p.length / 2 + 0.5) / (p.length / 2 + 0.5));
    for (let j = 0; j < p.length; j += 2) {
      const i = p[j], n = p[j + 1];
      if (tier && chunks[i].tier !== tier) continue;
      scores.set(i, (scores.get(i) ?? 0) + (idf * n * (K1 + 1)) / (n + K1 * (1 - B + (B * len[i]) / avg)));
    }
  }
  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [i, score] of ranked) {
    if (out.some((o) => o.chunk.file === chunks[i].file && Math.abs(o.chunk.id - i) === 1)) continue; // 바로 옆 조각(겹침)
    out.push({ chunk: chunks[i], score });
    if (out.length >= k) break;
  }
  return out;
}

export function formatHits(hits) {
  if (!hits.length) return "찾은 대목 없음.";
  return hits.map(({ chunk: c }) => `【${c.tier}】 ${c.title}\n(파일: ${c.file})\n${c.display}`).join("\n\n---\n\n");
}
