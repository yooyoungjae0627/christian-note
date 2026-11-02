// 「만화로 보는 이야기」 컷 그림을 이미지 생성 AI(Codex CLI의 image_generation = ChatGPT 이미지)로 그린다.
// 사용: node tools/chapterbook/comicart.mjs genesis 2 [--pages 1,3] [--only 5,12] [--note "고칠 점"] [--force] [--jobs 3]
// 결과: <원고 폴더>/만화그림/NN/PP.jpg (1200×750). 이미 있는 컷은 건너뛴다(--force/--only로 다시 그림).
// 그림 안에 글자·말풍선은 넣지 않는다 — 말풍선·내레이션·밑줄은 comic.mjs가 그 위에 얹는다.
// 하나님은 사람 모양으로 그리지 않고 빛으로만, 천사는 얼굴이 빛에 가려진 모습, 십자가는 그리지 않는다(지침 §2-0).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { R, BOOKS, mod, chapterVerses } from "./lib.mjs";
import { castOf } from "./cast.mjs";
import { W, PANELS, PER_PAGE, says, artDir, artFile } from "./comic.mjs";

const STYLE = "Studio Ghibli-inspired hand-painted watercolor anime illustration, warm soft natural light, lush detailed painted background, expressive faces with big gentle eyes, natural proportions, ancient Near East setting (Bronze Age, tents, linen robes, sandals). Wide landscape frame, aspect ratio 16:10.";
const RULES = "No text, letters, numbers, captions, speech bubbles, signatures or watermarks anywhere. Everyone is modestly clothed; family-friendly. Never draw God as a person or a face: God is shown only as warm golden light shining from above. Angels are tall figures whose faces are hidden in soft white radiance. No crosses or cross shapes.";
const SET = { sky: "open land under a blue sky with cumulus clouds", dawn: "sunrise, peach and gold sky", night: "night, deep blue sky full of stars", dark: "deep darkness before creation, faint shapes", desert: "dry desert hills and sand under a pale sky", garden: "the lush garden of Eden with fruit trees, flowers and a river", water: "wide water", field: "green pasture fields and rolling hills", tent: "inside a large goat-hair tent, warm lamplight", palace: "inside a grand Egyptian house or palace hall with stone columns, painted walls and linen curtains (not a tent)", city: "an ancient walled city of mud-brick", storm: "heavy storm, dark rain clouds", fire: "fire and burning sky" };
const POSE = { stand: "standing", raise: "raising both arms", point: "pointing", give: "holding something out to give", walk: "walking", run: "running", cry: "weeping", kneel: "kneeling", pray: "kneeling in prayer", bow: "bowing low to the ground", sit: "sitting", staff: "standing with a staff", angry: "angry, fists clenched", lie: "lying down" };
const FACE = { happy: "joyful", sad: "sad", surprise: "surprised", angry: "angry", sleep: "asleep", cry: "in tears", fear: "afraid", pray: "reverent", proud: "proud" };
const THING = { sun: "the sun", moon: "the moon", star: "a bright star", stars: "countless stars", light: "rays of light", cloud: "clouds", darkcloud: "dark clouds", rain: "pouring rain", wave: "waves", sea: "the sea", river: "a river", mountain: "a mountain", hill: "a hill", tree: "a tree", fruittree: "a fruit tree", fruit: "a fruit", plant: "plants", grass: "grass", sheaf: "a sheaf of grain", tent: "a tent", altar: "a stone altar", fire: "fire", smoke: "rising smoke", wood: "a bundle of firewood", knife: "a knife", sword: "a sword", flamesword: "a flaming sword turning every way", pot: "a cooking pot of red stew", bread: "bread", jar: "a clay jar", well: "a stone well", stone: "a stone", pillar: "a standing stone pillar", ladder: "a stairway reaching to heaven", ark: "the great wooden ark", rainbow: "a rainbow", tower: "a tall brick tower", brick: "bricks", city: "a city", ruin: "ruins", brimstone: "fire and brimstone falling from the sky", pyramid: "Egyptian buildings", silver: "silver pieces", gold: "gold", ring: "gold rings and bracelets", coat: "a garment", cave: "a cave", grave: "a burial cave", bed: "a bed", door: "a doorway", house: "a house", rod: "peeled rods", mandrake: "mandrake plants", snake: "a serpent", sheep: "sheep", ram: "a ram", goat: "goats", camel: "camels", donkey: "a donkey", cattle: "cattle", dove: "a dove", raven: "a raven", bird: "birds", fish: "fish", whale: "great sea creatures", beast: "wild animals", earth: "the earth", water: "water", mist: "mist rising from the ground", dust: "dust of the ground", tablet: "a tablet", scroll: "a scroll", bow: "a bow and arrows", quiver: "a quiver of arrows", rope: "a rope", gate: "a city gate", window: "a window", scales: "a balance scale", veil: "a veil", thicket: "a thicket", dew: "dew drops", oil: "oil poured from a flask", feast: "a feast table", spotted: "speckled and spotted sheep and goats", baby: "a baby" };

const side = (x) => (x < W * 0.36 ? "left" : x > W * 0.64 ? "right" : "center");
function panelPrompt(book, ch, p, ko) {
  const who = [], things = [];
  let god = false;
  for (const a of p.art || []) {
    if (a.f === "angel") who.push(`an angel (face hidden in light) on the ${side(a.x)}`);
    else if (a.f) {
      const kind = a.f === "child" ? "a child" : a.f === "woman" ? "a woman" : "a man";
      const look = a.name ? castOf(a.name, ch, `${a.name}: ${kind}${a.old ? ", elderly with white hair" : ""}${a.crown ? ", wearing a crown" : ""}, robe color ${a.c || "earth tone"}`) : `${kind}, robe color ${a.c || "earth tone"}`;
      who.push(`${look} — on the ${side(a.x)}, ${POSE[a.pose] || "standing"}${a.face && FACE[a.face] ? ", " + FACE[a.face] : ""}`);
    } else if (a.m === "glow") god = true;
    else if (THING[a.m]) things.push(THING[a.m]);
  }
  const L = [`Scene (${BOOKS[book].en} ${p.v}): ${p.cap}`, `Bible text for context: ${ko[p.v] || ""}`, `Setting: ${SET[p.bg || "sky"]}.`];
  if (who.length) L.push("Characters (keep exactly these looks):\n" + who.map((w) => "- " + w).join("\n"));
  else L.push("No people in this image.");
  if (things.length) L.push("Also show: " + [...new Set(things)].join(", ") + ".");
  if (god) L.push("God's presence: a warm golden light shining down from above (not a person).");
  const sp = says(p).filter((s) => s.who && s.who !== "하나님" && s.who !== "주").map((s) => `${s.who} on the ${side(s.at?.[0] ?? W / 2)}`);
  if (says(p).length) L.push(`Composition: figures in the lower two-thirds, heads at about mid height; keep the upper third calm and open (sky or plain wall) because speech bubbles will be added later${sp.length ? "; speaking: " + sp.join(", ") : ""}.`);
  return L.join("\n");
}

export function codexExe() {
  if (process.env.CODEX_EXE) return process.env.CODEX_EXE;
  // WindowsApps 폴더는 목록을 읽을 수 없어 설치 위치를 Appx 정보로 묻는다
  const dir = execSync(`powershell -NoProfile -Command "(Get-AppxPackage OpenAI.Codex).InstallLocation"`, { encoding: "utf8" }).trim();
  if (!dir) throw new Error("Codex 앱을 찾지 못함 — CODEX_EXE로 codex.exe 경로를 지정");
  return path.join(dir, "app/resources/codex.exe");
}
// 싼 모델(luna)은 그림을 만들고도 파일을 못 찾아 복사하지 못할 때가 있다 — Codex가 저장한 ~/.codex/generated_images/<세션>/의 그림을
// 만든 순서(= 지시 순서)대로 빠진 파일 이름에 옮겨 놓는다. 그 세션 그림 수가 지시한 수와 같을 때만(순서가 어긋날 수 있으면 하지 않음)
export function harvestImages(log, names, cwd) {
  const sid = fs.existsSync(log) && fs.readFileSync(log, "utf8").match(/session id:\s*(\S+)/)?.[1];
  const dir = sid && path.join(os.homedir(), ".codex", "generated_images", sid);
  if (!dir || !fs.existsSync(dir) || names.every((n) => fs.existsSync(path.join(cwd, n)))) return 0;
  const pngs = fs.readdirSync(dir).filter((f) => f.endsWith(".png")).map((f) => path.join(dir, f)).sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);
  if (pngs.length !== names.length) return 0;
  let n = 0;
  names.forEach((nm, i) => { const to = path.join(cwd, nm); if (!fs.existsSync(to)) { fs.copyFileSync(pngs[i], to); n++; } });
  return n;
}
export function runCodex(exe, prompt, cwd, log) {
  return new Promise((ok, bad) => {
    // 그림 그리기 지시만 하므로 일상용 모델·낮은 추론으로(사용자 지적 2026-11-02 "아스트라로 그리고 있네? 토큰 낭비") — CODEX_MODEL로 바꿀 수 있다
    const model = process.env.CODEX_MODEL || "gpt-6-luna";
    const c = spawn(exe, ["exec", "--skip-git-repo-check", "-s", "workspace-write", "-m", model, "-c", 'model_reasoning_effort="low"', "-"], { cwd, windowsHide: true });
    const out = fs.createWriteStream(log);
    c.stdout.pipe(out); c.stderr.pipe(out);
    c.on("error", bad); c.on("close", (code) => (code ? bad(new Error(`codex 종료 ${code} — ${log}`)) : ok()));
    c.stdin.end(prompt);
  });
}

async function main() {
  const [book, chS, ...rest] = process.argv.slice(2);
  const opt = (k) => { const i = rest.indexOf(k); return i < 0 ? null : rest[i + 1]; };
  const list = (s) => (s ? s.split(",").map(Number) : null);
  const ch = +chS, force = rest.includes("--force"), note = opt("--note"), jobs = +(opt("--jobs") || 3);
  const d = JSON.parse(fs.readFileSync(path.join(R, BOOKS[book].src, BOOKS[book].json(ch)), "utf8"));
  if (d.comic?.length !== PANELS) throw new Error("comic 18컷이 없음");
  const ko = Object.fromEntries(chapterVerses(book, ch).map((v) => [v.ref, v.ko]));
  const only = list(opt("--only")), pages = list(opt("--pages"));
  const want = [...Array(PANELS).keys()].filter((i) => (only ? only.includes(i + 1) : (!pages || pages.includes(Math.floor(i / PER_PAGE) + 1)) && (force || !fs.existsSync(artFile(book, ch, i)))));
  if (!want.length) return console.log("그릴 컷 없음");
  const work = path.join(os.tmpdir(), "chapterbook2", "comicart", `${book}-${ch}`);
  fs.mkdirSync(work, { recursive: true }); fs.mkdirSync(artDir(book, ch), { recursive: true });
  const exe = codexExe(), sharp = (await mod("sharp")).default || (await mod("sharp"));
  // 한 번의 codex 실행에 최대 3컷 — 같은 대화 안에서 그려 인물 모습이 덜 흔들린다
  const groups = [];
  for (let k = 0; k < want.length; k += 3) groups.push(want.slice(k, k + 3));
  const one = async (g) => {
    const names = g.map((i) => `panel-${String(i + 1).padStart(2, "0")}.png`);
    names.forEach((n) => fs.rmSync(path.join(work, n), { force: true }));
    const prompt = [`Create ${g.length} separate illustrations for a Bible study comic, one call of your built-in image generation tool (image_gen) per illustration — do not use browser, JavaScript, computer-use or Python tools to make images. After each one, copy the generated PNG into the current directory with the given file name. Do nothing else and do not write any other files.`,
      `Style for every image: ${STYLE}`, `Rules for every image: ${RULES}`, note ? `Extra direction from the reviewer: ${note}` : "",
      ...g.map((i, k) => `=== Image ${k + 1} → file ${names[k]} ===\n${panelPrompt(book, ch, d.comic[i], ko)}`)].filter(Boolean).join("\n\n");
    fs.writeFileSync(path.join(work, `prompt-${g[0] + 1}.txt`), prompt);
    await runCodex(exe, prompt, work, path.join(work, `log-${g[0] + 1}.txt`));
    harvestImages(path.join(work, `log-${g[0] + 1}.txt`), names, work);
    for (const [k, i] of g.entries()) {
      const src = path.join(work, names[k]);
      if (!fs.existsSync(src)) { console.log(`  ${i + 1}컷: 그림 없음(로그 확인)`); continue; }
      await sharp(src).resize(1200, 750, { fit: "cover", position: "attention" }).jpeg({ quality: 82, mozjpeg: true }).toFile(artFile(book, ch, i));
      console.log(`  ${i + 1}컷 저장`);
    }
  };
  const queue = [...groups];
  await Promise.all([...Array(Math.min(jobs, queue.length))].map(async () => { while (queue.length) await one(queue.shift()).catch((e) => console.log("  실패: " + e.message)); }));
  const done = [...Array(PANELS).keys()].filter((i) => fs.existsSync(artFile(book, ch, i))).length;
  console.log(`${BOOKS[book].ko} ${ch}장 만화 그림 ${done} / ${PANELS}`);
  process.exitCode = done === PANELS ? 0 : 1;
}
if (process.argv[1]?.endsWith("comicart.mjs")) await main();
