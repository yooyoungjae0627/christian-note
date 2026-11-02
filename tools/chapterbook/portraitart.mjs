// 인물 관계도 초상 — 관계도의 네모 칸 대신 인물 얼굴(사용자 지시 2026-11-02 "네모 칸보다는 캐릭터로 대체")을 이미지 생성 AI(Codex CLI)로 그린다.
// 사용: node tools/chapterbook/portraitart.mjs genesis [장 …|all] [--only key,key] [--note "고칠 점"] [--force] [--jobs 3] [--list]
// 결과: <원고 폴더>/인물그림/<key>.jpg (400×400) + index.json(key → 이름·모습 설명·나온 장). 이미 있는 초상은 건너뛴다.
// 같은 사람은 만화와 같은 외모표(cast.mjs)로 — 나이가 바뀌는 인물은 장마다 다른 초상. 외모표에 없는 사람은 원고의 look·설명으로.
// 하나님은 초상을 그리지 않는다(관계도에서 빛으로만). 천사는 얼굴이 빛에 가려진 모습, 십자가는 그리지 않는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { R, BOOKS, mod } from "./lib.mjs";
import { portraitDesc } from "./cast.mjs";
import { codexExe, runCodex, harvestImages } from "./comicart.mjs";

const STYLE = "Studio Ghibli-inspired hand-painted watercolor anime portrait, head and shoulders (bust), the face clearly visible and gently lit, expressive big gentle eyes, natural proportions, ancient Near East (Bronze Age linen robes, head-wraps). Simple softly painted plain background in pale warm cream tones, no scenery. Square image, aspect ratio 1:1, the face centered.";
const RULES = "No text, letters, numbers, captions, signatures or watermarks anywhere. Modestly clothed; family-friendly. Never draw God as a person. Angels: faces hidden in soft white radiance. No crosses or cross shapes.";
const LOOK = { man: "an adult man", old: "an elderly person with white hair", woman: "a woman", child: "a child", boy: "a boy", girl: "a girl", king: "a king wearing a simple crown and royal robe", group: "a small group portrait of 3–4 people standing together, shoulders up", angel: "an angel whose face is hidden in soft white radiance" };

export const portraitDir = (book) => path.join(R, BOOKS[book].src, "인물그림");
// 한 사람의 초상 열쇠·모습 설명(같은 외모 설명이면 같은 초상)
export function portraitOf(p, ch) {
  if (p.role === "god") return null;
  const cast = portraitDesc(p, ch);
  const name = p.name.replace(/\(.*?\)/g, "").trim();
  const desc = cast || `${p.en || name} (${name}): ${LOOK[p.look] || "an adult man"}. Who this is (Korean, for context only — do not write it): ${p.desc || p.part || ""}`;
  const key = crypto.createHash("sha1").update(cast || `${name}|${p.look || ""}`).digest("hex").slice(0, 10);
  return { key, desc, name };
}
export const portraitFile = (book, key) => path.join(portraitDir(book), key + ".jpg");

async function main() {
  const [book, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(k); return i < 0 ? null : rest[i + 1]; };
  const B = BOOKS[book], force = rest.includes("--force"), note = opt("--note"), jobs = +(opt("--jobs") || 3);
  const chs = rest.filter((a, i) => /^\d+$/.test(a) && !/^--/.test(rest[i - 1] || "")).map(Number);
  const list = rest.includes("all") || !chs.length ? [...Array(B.chapters)].map((_, i) => i + 1) : chs;
  const only = opt("--only")?.split(",");
  const all = new Map();
  for (const ch of list) {
    const f = path.join(R, B.src, B.json(ch));
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const p of d.people || []) { const o = portraitOf(p, ch); if (!o) continue; if (!all.has(o.key)) all.set(o.key, { ...o, chs: [] }); all.get(o.key).chs.push(ch); }
  }
  fs.mkdirSync(portraitDir(book), { recursive: true });
  const idxF = path.join(portraitDir(book), "index.json");
  const idx = fs.existsSync(idxF) ? JSON.parse(fs.readFileSync(idxF, "utf8")) : {};
  for (const [k, o] of all) idx[k] = { name: o.name, desc: o.desc, chapters: [...new Set([...(idx[k]?.chapters || []), ...o.chs])].sort((a, b) => a - b) };
  fs.writeFileSync(idxF, JSON.stringify(idx, null, 1) + "\n");
  const want = [...all.values()].filter((o) => (only ? only.includes(o.key) : force || !fs.existsSync(portraitFile(book, o.key))));
  if (rest.includes("--list")) { for (const o of all.values()) console.log(o.key, fs.existsSync(portraitFile(book, o.key)) ? "있음" : "없음", o.name, o.chs.join(",")); return; }
  console.log(`초상 ${all.size}명 · 그릴 것 ${want.length}`);
  if (!want.length) return;
  const work = path.join(os.tmpdir(), "chapterbook2", "portraitart", book);
  fs.mkdirSync(work, { recursive: true });
  const exe = codexExe(), sharp = (await mod("sharp")).default || (await mod("sharp"));
  const groups = [];
  for (let k = 0; k < want.length; k += 4) groups.push(want.slice(k, k + 4)); // 한 번 실행에 4명 — 실행마다 드는 고정 토큰을 나눠 씀
  let n = 0;
  const one = async (g) => {
    const names = g.map((o) => `portrait-${o.key}.png`);
    names.forEach((x) => fs.rmSync(path.join(work, x), { force: true }));
    const prompt = [`Create ${g.length} separate portrait illustrations for a Bible study family-tree chart, calling your built-in image generation tool (image_gen) exactly once per portrait, in the order given (exactly ${g.length} calls in total, never retry or redo one). Do not use browser, JavaScript, computer-use, Python or shell tools, and do not save, copy or write any files — the generated images are collected automatically. After the last image, just reply "done".`,
      `Style for every image: ${STYLE}`, `Rules for every image: ${RULES}`, note ? `Extra direction from the reviewer: ${note}` : "",
      ...g.map((o, k) => `=== Portrait ${k + 1} → file ${names[k]} ===\n${o.desc}`)].filter(Boolean).join("\n\n");
    fs.writeFileSync(path.join(work, `prompt-${g[0].key}.txt`), prompt);
    await runCodex(exe, prompt, work, path.join(work, `log-${g[0].key}.txt`)).catch((e) => console.log("  codex: " + e.message));
    const got = harvestImages(path.join(work, `log-${g[0].key}.txt`), names, work);
    if (got) console.log(`  Codex 저장 폴더에서 ${got}장 가져옴`);
    // 파일 저장은 Codex에 시키지 않는다 — 싼 모델이 base64를 셸로 쓰다 실패(명령 너무 김)·다시 그려 순서가 어긋났다(2026-11-02). 그림은 harvestImages가 순서대로 가져온다
    // 같은 그림이 여러 이름으로 복사되는 일이 있었다(2026-11-02 아홀리바마·아스낫·마킬) — 이 묶음에서 처음 나온 그림만 쓰고 겹치면 다시 그리게 둔다
    const seen = new Set();
    for (const [k, o] of g.entries()) {
      const src = path.join(work, names[k]);
      if (!fs.existsSync(src)) { console.log(`  ${o.name}(${o.key}): 그림 없음(로그 확인)`); continue; }
      const h = crypto.createHash("sha1").update(fs.readFileSync(src)).digest("hex");
      if (seen.has(h)) { console.log(`  ${o.name}(${o.key}): 앞 사람과 같은 그림이라 버림`); continue; }
      seen.add(h);
      await sharp(src).resize(400, 400, { fit: "cover", position: "attention" }).jpeg({ quality: 82, mozjpeg: true }).toFile(portraitFile(book, o.key));
      console.log(`  ${++n}/${want.length} ${o.name} 저장`);
    }
  };
  const queue = [...groups];
  await Promise.all([...Array(Math.min(jobs, queue.length))].map(async () => { while (queue.length) await one(queue.shift()).catch((e) => console.log("  실패: " + e.message)); }));
  const done = [...all.keys()].filter((k) => fs.existsSync(portraitFile(book, k))).length;
  console.log(`${B.ko} 인물 초상 ${done} / ${all.size}`);
  process.exitCode = done === all.size ? 0 : 1;
}
if (process.argv[1]?.endsWith("portraitart.mjs")) await main();
