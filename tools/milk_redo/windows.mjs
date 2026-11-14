// PDF의 ▶ 시각 링크로 그림마다 찾아볼 영상 구간(초)을 정한다. 영상이 여럿이면 영상ID별.
// node windows.mjs <pdf> <접두어 m1_> <옛그림폴더> <out.json>
import fs from "fs"; import * as mupdf from "mupdf";
const [pdf, prefix, oldDir, outJson] = process.argv.slice(2);
const doc = mupdf.Document.openDocument(fs.readFileSync(pdf), "application/pdf");
const N = doc.countPages(); const T = [];
for (let i = 0; i < N; i++) { const p = doc.loadPage(i); const ts = [];
  for (const l of p.getLinks()) { const u = l.getURI() || ""; const m = u.match(/youtu\.be\/([\w-]+)\?t=(\d+)/); if (m) ts.push({ id: m[1], t: +m[2], y: l.getBounds()[1] }); }
  T.push(ts.sort((a, b) => a.y - b.y)); }
const res = {};
for (const f of fs.readdirSync(oldDir).filter((f) => f.startsWith(prefix) && f.endsWith(".png"))) {
  const pg = +f.match(/_p(\d+)_/)[1] - 1;
  let before = null, after = null;
  for (let i = pg - 1; i >= 0 && !before; i--) if (T[i].length) before = T[i].at(-1);
  if (T[pg].length) { before = before && T[pg][0].t < before.t ? before : before; }
  for (let i = pg + 1; i < N && !after; i++) if (T[i].length) after = T[i][0];
  const here = T[pg];
  const lo = Math.min(...[before, ...here].filter(Boolean).map((x) => x.t));
  const hi = Math.max(...[after, ...here].filter(Boolean).map((x) => x.t));
  const id = (here[0] || before || after).id;
  res[f] = { id, lo: Math.max(0, lo - 30), hi: hi + 90 };
}
fs.writeFileSync(outJson, JSON.stringify(res, null, 1));
console.log(Object.entries(res).map(([k, v]) => `${k.slice(0, 8)} ${v.id} ${v.lo}-${v.hi}`).join("\n"));
