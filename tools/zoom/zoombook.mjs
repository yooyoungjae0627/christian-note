// 「최근 줌 녹화 교재 집필해줘」의 준비 단계 — 가장 최근 줌 녹화를 찾아 받아쓰기·슬라이드 후보까지 만든다.
// 그다음 원고(story.txt)·그림 고르기·빌드는 Claude가 docs/policy/줌녹화_교재_지침.md 대로 한다.
//
// 사용: node tools/zoom/zoombook.mjs [녹화 폴더|녹화 파일] [--model 이름] [--find]
//   인자가 없으면 가장 최근 녹화를 찾는다(아래 순서):
//     1) 환경 변수 ZOOM_DIR
//     2) ~/Documents/Zoom, ~/OneDrive/문서/Zoom, ~/OneDrive/Documents/Zoom  (PC 줌 로컬 녹화 기본 위치)
//     3) /tmp/zoom_in, <운영체제 임시폴더>/zoom_in  (클라우드 세션: Claude가 Google Drive 「줌 녹화」에서 받아 두는 곳)
//   --find : 찾기만 하고 무엇을 찾았는지 출력
// 결과(저장소 밖): <임시폴더>/zoombook/<녹화 이름>/
//   info.json(찾은 파일·받아쓰기 방법·줄 수·프레임 수), transcript_raw.txt(주제별 교재 형식), transcript.srt, audio.wav, frames/(슬라이드 후보, frames.tsv)
// 받아쓰기 순서: 줌 자막(.vtt) → 같은 폴더의 받아쓴 글(.txt, 삼성 음성 녹음 텍스트 변환 등, 시각 포함) → 파이썬 faster-whisper(tools/zoom/transcribe.py) → Node transformers.js(transcribe.mjs)
// 하나도 안 되면 지어내지 않고 exit 3으로 멈춘다.
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

const VIDEO = /\.(mp4|mkv|mov|webm)$/i, AUDIO = /\.(m4a|mp3|wav|aac)$/i, VTT = /\.(vtt|srt)$/i;
const home = os.homedir();
const roots = [process.env.ZOOM_DIR,
  path.join(home, "Documents", "Zoom"), path.join(home, "OneDrive", "문서", "Zoom"), path.join(home, "OneDrive", "Documents", "Zoom"),
  "/tmp/zoom_in", path.join(os.tmpdir(), "zoom_in")].filter((p, i, a) => p && a.indexOf(p) === i && fs.existsSync(p));

// 폴더 안(한 단계 아래 폴더까지)의 녹화 파일들
function filesIn(dir, depth = 1) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && depth > 0) out.push(...filesIn(p, depth - 1));
    else if (e.isFile()) out.push(p);
  }
  return out;
}
const mtime = (p) => fs.statSync(p).mtimeMs;

// 녹화 하나 = 같은 폴더의 영상·음성·자막 묶음. 가장 최근 영상(없으면 음성)을 기준으로 고른다.
function pickRecording() {
  if (given) {
    const g = path.resolve(given);
    if (!fs.existsSync(g)) fail(`없는 경로: ${g}`, 2);
    const dir = fs.statSync(g).isDirectory() ? g : path.dirname(g);
    const fs1 = filesIn(dir, 0);
    return bundle(dir, fs1, fs.statSync(g).isFile() ? g : null);
  }
  const all = roots.flatMap((r) => filesIn(r, 2));
  const unconverted = all.filter((f) => /\.zoom$/i.test(f)).sort((a, b) => mtime(b) - mtime(a))[0];
  const media = all.filter((f) => VIDEO.test(f) || AUDIO.test(f)).sort((a, b) => mtime(b) - mtime(a));
  if (unconverted && (!media[0] || mtime(unconverted) > mtime(media[0])))
    fail(`가장 최근 녹화가 아직 변환되지 않았음: ${unconverted}\n줌이 회의 끝난 뒤 변환을 마칠 때까지 기다리거나, 그 파일을 두 번 눌러 변환하세요.`, 4);
  if (!media[0]) fail(`녹화를 찾지 못함. 찾아본 곳: ${roots.join(", ") || "(있는 폴더 없음)"}\n클라우드 세션이면 Google Drive 「줌 녹화」 폴더의 최근 파일을 /tmp/zoom_in에 받아 두고 다시 실행.`, 2);
  const dir = path.dirname(media[0]);
  return bundle(dir, filesIn(dir, 0), media[0]);
}
function bundle(dir, files, main) {
  const newest = (re) => files.filter((f) => re.test(f)).sort((a, b) => mtime(b) - mtime(a))[0] || null;
  const video = main && VIDEO.test(main) ? main : newest(VIDEO);
  const audio = main && AUDIO.test(main) ? main : newest(AUDIO);
  // 줌 클라우드 녹화 자막은 보통 *.transcript.vtt
  let vtt = files.filter((f) => VTT.test(f)).sort((a, b) => /transcript/i.test(b) - /transcript/i.test(a) || mtime(b) - mtime(a))[0] || null;
  // 자막이 없으면 삼성 음성 녹음 텍스트 변환(.txt, 시각 포함)을 쓴다. 줌 채팅 파일(chat)은 뺀다.
  if (!vtt) vtt = files.filter((f) => /\.txt$/i.test(f) && !/chat|채팅/i.test(path.basename(f)) && /\d{1,2}:\d{2}/.test(fs.readFileSync(f, "utf8").slice(0, 4000))).sort((a, b) => mtime(b) - mtime(a))[0] || null;
  if (!video && !audio) fail(`그 폴더에 영상·음성 파일이 없음: ${dir}`, 2);
  return { dir, video, audio, vtt, name: path.basename(dir) };
}
function fail(msg, code) { console.error("zoombook: " + msg); process.exit(code); }

// ffmpeg: 시스템 것 → 없으면 ffmpeg-static(임시폴더에 설치)
const TOOLS = path.join(os.tmpdir(), "zoombook", "_node");
function npmEnsure(pkgs) {
  fs.mkdirSync(TOOLS, { recursive: true });
  if (!fs.existsSync(path.join(TOOLS, "package.json"))) fs.writeFileSync(path.join(TOOLS, "package.json"), '{"private":true,"type":"module"}');
  const need = pkgs.filter((p) => !fs.existsSync(path.join(TOOLS, "node_modules", p)));
  if (!need.length) return true;
  console.error(`설치: ${need.join(" ")} → ${TOOLS}`);
  const r = spawnSync("npm", ["i", "--no-audit", "--no-fund", ...need], { cwd: TOOLS, stdio: "inherit", shell: process.platform === "win32" });
  return r.status === 0;
}
function ffmpegPath() {
  if (spawnSync("ffmpeg", ["-version"]).status === 0) return "ffmpeg";
  if (npmEnsure(["ffmpeg-static"])) { const p = path.join(TOOLS, "node_modules", "ffmpeg-static", process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg"); if (fs.existsSync(p)) return p; }
  fail("ffmpeg를 찾지도 설치하지도 못함", 5);
}

const rec = pickRecording();
console.error(`녹화: ${rec.dir}\n  영상 ${rec.video || "-"}\n  음성 ${rec.audio || "-"}\n  자막 ${rec.vtt || "-"}`);
if (findOnly) { console.log(JSON.stringify(rec, null, 1)); process.exit(0); }

const work = path.join(os.tmpdir(), "zoombook", rec.name.replace(/[\\/:*?"<>|]/g, "_"));
fs.mkdirSync(work, { recursive: true });
const FF = ffmpegPath();
const node = (script, args, env = {}) => spawnSync(process.execPath, [path.join(HERE, script), ...args], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, FFMPEG: FF, ...env }, encoding: "utf8", maxBuffer: 1 << 28 });

// 1) 슬라이드 후보 + 음성
const src = rec.video || rec.audio;
if (rec.video) { const r = node("frames.mjs", [rec.video, path.join(work, "frames"), "0.12"]); if (r.status) fail("프레임 추출 실패", 6); }
const wav = path.join(work, "audio.wav");
if (!fs.existsSync(wav)) {
  const r = spawnSync(FF, ["-hide_banner", "-nostdin", "-y", "-i", rec.audio || src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], { encoding: "utf8" });
  if (r.status) fail("음성 추출 실패:\n" + r.stderr.slice(-800), 6);
}

// 2) 받아쓰기
const srt = path.join(work, "transcript.srt");
let method = null;
if (rec.vtt) { fs.copyFileSync(rec.vtt, srt); method = (/\.txt$/i.test(rec.vtt) ? "받아쓴 글(삼성 음성 녹음 등) " : "줌 자막 ") + path.basename(rec.vtt); }
if (!method) {
  for (const py of ["python3", "python", "py"]) {
    if (spawnSync(py, ["-c", "import faster_whisper"], { shell: process.platform === "win32" }).status !== 0) continue;
    console.error(`받아쓰기: ${py} faster-whisper`);
    const r = spawnSync(py, [path.join(HERE, "transcribe.py"), wav, srt, ...(model ? [model] : [])], { stdio: "inherit", shell: process.platform === "win32" });
    if (r.status === 0) method = "faster-whisper " + (model || "medium");
    break;
  }
}
if (!method) {
  console.error("받아쓰기: Node transformers.js");
  if (npmEnsure(["@huggingface/transformers"])) {
    const r = node("transcribe.mjs", [wav, srt, ...(model ? [model] : [])], { NODE_PATH: path.join(TOOLS, "node_modules") });
    if (r.status === 0) method = "transformers.js " + (model || "기본");
  }
}
if (!method) fail("받아쓰기를 하지 못함 — 줌 자막(.vtt)을 녹화 폴더에 넣거나, 받아쓰기 모델 주소(huggingface.co)를 쓸 수 있는 곳에서 다시 실행. 지어서 채우지 않는다.", 3);

const r = node("vtt2raw.mjs", [srt]);
if (r.status) fail("transcript_raw 변환 실패", 6);
fs.writeFileSync(path.join(work, "transcript_raw.txt"), r.stdout);
const lines = r.stdout.split("\n").filter(Boolean).length;
const frames = fs.existsSync(path.join(work, "frames")) ? fs.readdirSync(path.join(work, "frames")).filter((f) => f.endsWith(".jpg")).length : 0;
const info = { recording: rec, work, method, transcriptLines: lines, frames, made: new Date().toISOString() };
fs.writeFileSync(path.join(work, "info.json"), JSON.stringify(info, null, 1));
console.log(JSON.stringify(info, null, 1));
console.error(`준비 완료: ${work} — 받아쓰기 ${lines}줄(${method}), 슬라이드 후보 ${frames}장`);
