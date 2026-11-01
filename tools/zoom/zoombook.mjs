// 「최근 줌 녹화 교재 집필해줘」의 준비 단계 — 가장 최근 강의 자료를 찾아 받아쓰기·슬라이드 후보까지 만든다.
// 그다음 원고(story.txt)·그림 고르기·빌드는 Claude가 docs/policy/줌녹화_교재_지침.md 대로 한다.
//
// 기본 조합(2026-11-01): 줌 녹화 영상(슬라이드) + 삼성 음성 녹음 「텍스트 변환」 .txt(말씀). 둘 다 같은 폴더에.
//   - 삼성 변환이 끊겨 .txt가 여러 개면 파일 이름 순서(음성 001, 002 …)로 시간을 이어 붙인다.
//     같은 이름의 음성 파일(.m4a)이 있으면 그 길이로, 없으면 앞 파일의 마지막 시각 + 5초로 다음 파일 시작을 정한다.
//   - 영상이 없으면 같은 폴더의 슬라이드 캡처(.jpg/.png)를 슬라이드 후보로 쓴다.
//
// 사용: node tools/zoom/zoombook.mjs [폴더|파일] [--model 이름] [--find]
//   인자가 없으면 가장 최근 자료가 있는 폴더를 찾는다:
//     ZOOM_DIR → PC 줌 녹화(~/Documents/Zoom, ~/OneDrive/문서/Zoom, ~/OneDrive/Documents/Zoom)
//     → 채팅 첨부(/mnt/user-data/uploads) → /tmp/zoom_in, <임시폴더>/zoom_in
//   --find : 찾기만 하고 무엇을 찾았는지 출력
// 결과(저장소 밖): <임시폴더>/zoombook/<이름>/ — info.json, transcript_raw.txt(주제별 교재 형식), frames/(슬라이드 후보, frames.tsv)
// 받아쓰기 순서: 줌 자막(.vtt/.srt) → 받아쓴 글(.txt, 시각 포함) → faster-whisper(transcribe.py) → transformers.js(transcribe.mjs)
// exit: 0 준비 완료, 2 자료 없음, 3 받아쓰기 불가, 4 줌 변환 전(.zoom), 5·6 ffmpeg 문제. 지어서 채우지 않는다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
const model = opt("--model");
const findOnly = argv.includes("--find"); if (findOnly) argv.splice(argv.indexOf("--find"), 1);
const given = argv[0];

const VIDEO = /\.(mp4|mkv|mov|webm)$/i, AUDIO = /\.(m4a|mp3|wav|aac|3gp|amr)$/i, SUB = /\.(vtt|srt)$/i, IMG = /\.(jpe?g|png|webp)$/i;
const home = os.homedir();
const roots = [process.env.ZOOM_DIR,
  path.join(home, "Documents", "Zoom"), path.join(home, "OneDrive", "문서", "Zoom"), path.join(home, "OneDrive", "Documents", "Zoom"),
  "/mnt/user-data/uploads", "/tmp/zoom_in", path.join(os.tmpdir(), "zoom_in")].filter((p, i, a) => p && a.indexOf(p) === i && fs.existsSync(p));

const mtime = (p) => fs.statSync(p).mtimeMs;
const byName = (a, b) => path.basename(a).localeCompare(path.basename(b), "ko", { numeric: true });
const stem = (p) => path.basename(p).replace(/\.[^.]+$/, "");
function filesIn(dir, depth = 1) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth > 0) out.push(...filesIn(p, depth - 1));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
// 시각이 들어 있는 받아쓴 글(.txt)인가 — 줌 채팅 파일은 뺀다
const isTranscriptTxt = (f) => /\.txt$/i.test(f) && !/chat|채팅/i.test(path.basename(f)) && /\d{1,2}:\d{2}/.test(fs.readFileSync(f, "utf8").slice(0, 4000));
function fail(msg, code) { console.error("zoombook: " + msg); process.exit(code); }

function pickFolder() {
  if (given) {
    const g = path.resolve(given);
    if (!fs.existsSync(g)) fail(`없는 경로: ${g}`, 2);
    return fs.statSync(g).isDirectory() ? g : path.dirname(g);
  }
  const all = roots.flatMap((r) => filesIn(r, 2));
  const items = all.filter((f) => VIDEO.test(f) || AUDIO.test(f) || SUB.test(f) || isTranscriptTxt(f)).sort((a, b) => mtime(b) - mtime(a));
  const unconverted = all.filter((f) => /\.zoom$/i.test(f)).sort((a, b) => mtime(b) - mtime(a))[0];
  if (unconverted && (!items[0] || mtime(unconverted) > mtime(items[0])))
    fail(`가장 최근 녹화가 아직 변환되지 않았음: ${unconverted}\n줌이 회의 끝난 뒤 변환을 마칠 때까지 기다리거나, 그 파일을 두 번 눌러 변환하세요.`, 4);
  if (!items[0]) fail(`강의 자료를 찾지 못함. 찾아본 곳: ${roots.join(", ") || "(있는 폴더 없음)"}\n줌 녹화 영상과 삼성 음성 녹음 텍스트(.txt)를 채팅에 첨부하거나 /tmp/zoom_in에 두고 다시 실행.`, 2);
  return path.dirname(items[0]);
}

// 한 폴더 = 강의 하나. 첨부 폴더처럼 여러 강의가 섞일 수 있는 곳은 가장 최근 파일 기준 24시간 안의 것만 쓴다.
function bundle(dir) {
  let files = filesIn(dir, 0);
  const latest = Math.max(...files.map(mtime));
  files = files.filter((f) => latest - mtime(f) < 24 * 3600e3);
  const newest = (re) => files.filter((f) => re.test(f)).sort((a, b) => mtime(b) - mtime(a))[0] || null;
  const sub = files.filter((f) => SUB.test(f)).sort((a, b) => /transcript/i.test(b) - /transcript/i.test(a) || mtime(b) - mtime(a))[0] || null;
  const txts = files.filter(isTranscriptTxt).sort(byName);
  const audios = files.filter((f) => AUDIO.test(f)).sort(byName);
  const images = files.filter((f) => IMG.test(f)).sort(byName);
  const video = newest(VIDEO);
  if (!video && !audios.length && !sub && !txts.length) fail(`그 폴더에 영상·음성·받아쓴 글이 없음: ${dir}`, 2);
  return { dir, name: path.basename(dir), video, audios, sub, txts, images };
}

const TOOLS = path.join(os.tmpdir(), "zoombook", "_node");
function npmEnsure(pkgs) {
  fs.mkdirSync(TOOLS, { recursive: true });
  if (!fs.existsSync(path.join(TOOLS, "package.json"))) fs.writeFileSync(path.join(TOOLS, "package.json"), '{"private":true,"type":"module"}');
  const need = pkgs.filter((p) => !fs.existsSync(path.join(TOOLS, "node_modules", p)));
  if (!need.length) return true;
  console.error(`설치: ${need.join(" ")} → ${TOOLS}`);
  return spawnSync("npm", ["i", "--no-audit", "--no-fund", ...need], { cwd: TOOLS, stdio: "inherit", shell: process.platform === "win32" }).status === 0;
}
let FF = null;
function ffmpeg() {
  if (FF) return FF;
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return (FF = "ffmpeg");
  if (npmEnsure(["ffmpeg-static"])) { const p = path.join(TOOLS, "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"); if (fs.existsSync(p)) return (FF = p); }
  fail("ffmpeg를 찾지도 설치하지도 못함", 5);
}
const duration = (f) => { const m = spawnSync(ffmpeg(), ["-hide_banner", "-i", f], { encoding: "utf8" }).stderr.match(/Duration: (\d+):(\d+):([\d.]+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null; };
const node = (script, args, env = {}) => spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, ...(FF ? { FFMPEG: FF } : {}), ...env }, encoding: "utf8", maxBuffer: 1 << 28 });
const tsec = (t) => t.split(":").map(Number).reduce((a, b) => a * 60 + b, 0);
const fmt = (s) => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, "0"); return h ? `${h}:${String(m).padStart(2, "0")}:${x}` : `${m}:${x}`; };

const rec = bundle(pickFolder());
console.error(`자료 폴더: ${rec.dir}\n  영상 ${rec.video ? path.basename(rec.video) : "-"}\n  자막 ${rec.sub ? path.basename(rec.sub) : "-"}\n  받아쓴 글 ${rec.txts.map((f) => path.basename(f)).join(", ") || "-"}\n  음성 ${rec.audios.map((f) => path.basename(f)).join(", ") || "-"}\n  슬라이드 캡처 ${rec.images.length}장`);
if (findOnly) { console.log(JSON.stringify(rec, null, 1)); process.exit(0); }

const work = path.join(os.tmpdir(), "zoombook", rec.name.replace(/[\\/:*?"<>|]/g, "_"));
fs.mkdirSync(work, { recursive: true });

// 1) 슬라이드 후보: 영상 → 장면 전환 프레임, 영상이 없으면 슬라이드 캡처 그대로
const fdir = path.join(work, "frames");
if (rec.video) { ffmpeg(); if (node("frames.mjs", [rec.video, fdir, "0.12"]).status) fail("프레임 추출 실패", 6); }
else if (rec.images.length) {
  fs.mkdirSync(fdir, { recursive: true });
  const rows = rec.images.map((f, i) => { const n = `img_${String(i + 1).padStart(3, "0")}${path.extname(f).toLowerCase()}`; fs.copyFileSync(f, path.join(fdir, n)); return `-\t${n}\t${path.basename(f)}`; });
  fs.writeFileSync(path.join(fdir, "frames.tsv"), "초\t파일\t원래 이름\n" + rows.join("\n") + "\n");
}

// 2) 받아쓰기 → transcript_raw.txt 줄들
let method = null, lines = [];
const raw = (f) => { const r = node("vtt2raw.mjs", [f]); return r.status ? null : r.stdout.split("\n").filter(Boolean); };
if (rec.sub) { lines = raw(rec.sub); if (lines) method = "줌 자막 " + path.basename(rec.sub); }
if (!method && rec.txts.length) {
  let offset = 0; const parts = [];
  for (const [i, f] of rec.txts.entries()) {
    const ls = raw(f); if (!ls) fail(`받아쓴 글을 읽지 못함: ${path.basename(f)}`, 3);
    const shifted = ls.map((l) => { const m = l.match(/^(\d+:\d\d(?::\d\d)?) (.*)$/); return { t: tsec(m[1]) + offset, text: m[2] }; });
    lines.push(...shifted.map((x) => `${fmt(x.t)} ${x.text}`));
    const audio = rec.audios.find((a) => stem(a) === stem(f));
    const len = audio ? duration(audio) : null;
    parts.push({ file: path.basename(f), start: fmt(offset), lines: ls.length, length: len ? fmt(len) : "모름(마지막 시각 + 5초로 이음)" });
    offset = len ?? ((shifted.at(-1)?.t ?? offset) + 5);
    if (i < rec.txts.length - 1) console.error(`  이어 붙임: ${path.basename(f)} → 다음 파일은 ${fmt(offset)}부터`);
  }
  method = { kind: "받아쓴 글(삼성 음성 녹음 등)", parts };
}
if (!method) {
  const src = rec.audios.at(-1) || rec.video;
  if (src) {
    const wav = path.join(work, "audio.wav");
    if (!fs.existsSync(wav)) { const r = spawnSync(ffmpeg(), ["-hide_banner", "-nostdin", "-y", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], { encoding: "utf8" }); if (r.status) fail("음성 추출 실패:\n" + r.stderr.slice(-800), 6); }
    const srt = path.join(work, "transcript.srt");
    for (const py of ["python3", "python", "py"]) {
      if (spawnSync(py, ["-c", "import faster_whisper"], { shell: process.platform === "win32" }).status !== 0) continue;
      console.error(`받아쓰기: ${py} faster-whisper`);
      if (spawnSync(py, [path.join(HERE, "transcribe.py"), wav, srt, ...(model ? [model] : [])], { stdio: "inherit", shell: process.platform === "win32" }).status === 0) method = "faster-whisper " + (model || "medium");
      break;
    }
    if (!method) {
      console.error("받아쓰기: Node transformers.js");
      if (npmEnsure(["@huggingface/transformers"]) && node("transcribe.mjs", [wav, srt, ...(model ? [model] : [])], { NODE_PATH: path.join(TOOLS, "node_modules") }).status === 0) method = "transformers.js " + (model || "기본");
    }
    if (method) lines = raw(srt);
  }
}
if (!method || !lines?.length) fail("받아쓰기를 하지 못함 — 삼성 음성 녹음 「텍스트 변환」 글(.txt, 시각 포함)이나 줌 자막(.vtt)을 같은 곳에 넣거나, 받아쓰기 모델 주소(huggingface.co)를 쓸 수 있는 곳에서 다시 실행. 지어서 채우지 않는다.", 3);

fs.writeFileSync(path.join(work, "transcript_raw.txt"), lines.join("\n") + "\n");
const frames = fs.existsSync(fdir) ? fs.readdirSync(fdir).filter((f) => IMG.test(f)).length : 0;
const info = { recording: rec, work, method, transcriptLines: lines.length, frames, made: new Date().toISOString() };
fs.writeFileSync(path.join(work, "info.json"), JSON.stringify(info, null, 1));
console.log(JSON.stringify(info, null, 1));
console.error(`준비 완료: ${work} — 받아쓰기 ${lines.length}줄, 슬라이드 후보 ${frames}장${frames ? "" : " (영상·캡처 없음 — 슬라이드는 사용자에게 요청)"}`);
