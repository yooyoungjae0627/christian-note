// 녹화 영상에서 화면이 바뀌는 곳마다 프레임을 뽑는다(슬라이드 후보). ffmpeg 필요.
// 사용: node frames.mjs <영상.mp4> <출력폴더> [장면 문턱 0.0~1.0, 기본 0.12] [--audio]
//  - 출력: <출력폴더>/f_<h-mm-ss>.jpg (원본 해상도), frames.tsv(시각·파일)
//  - --audio: <출력폴더>/audio.wav (16kHz 모노, 받아쓰기용)도 만든다
// 뽑은 뒤 사람이(또는 Claude가) 보고: 같은 슬라이드는 하나만, 화면 공유 부분만 잘라 slides/NN.jpg로.
// 강사 얼굴·참가자 화면·교회 전경이 보이는 프레임은 쓰지 않고 AI 칠판 이미지로 바꾼다(주제별 지침 §0).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
const audio = args.includes("--audio");
const [video, outDir, th = "0.12"] = args.filter((a) => a !== "--audio");
if (!video || !outDir) { console.error("사용: node frames.mjs <영상> <출력폴더> [문턱] [--audio]"); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const run = (a) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", "-y", ...a], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.error(r.stderr.slice(-2000)); process.exit(r.status || 1); } return r.stderr; };
if (audio) { run(["-i", video, "-vn", "-ac", "1", "-ar", "16000", path.join(outDir, "audio.wav")]); console.error("audio.wav 만듦"); }
// 첫 프레임 + 장면이 바뀌는 프레임
const log = run(["-i", video, "-vf", `select='eq(n\\,0)+gt(scene\\,${th})',showinfo`, "-vsync", "vfr", "-q:v", "2", path.join(outDir, "tmp_%05d.jpg")]);
const times = [...log.matchAll(/pts_time:([\d.]+)/g)].map((m) => Number(m[1]));
const tmp = fs.readdirSync(outDir).filter((f) => /^tmp_\d+\.jpg$/.test(f)).sort();
const pad = (n) => String(n).padStart(2, "0");
const rows = tmp.map((f, i) => { const s = Math.floor(times[i] ?? 0);
  const name = `f_${Math.floor(s / 3600)}-${pad(Math.floor(s / 60) % 60)}-${pad(s % 60)}.jpg`;
  fs.renameSync(path.join(outDir, f), path.join(outDir, name)); return `${s}\t${name}`; });
fs.writeFileSync(path.join(outDir, "frames.tsv"), "초\t파일\n" + rows.join("\n") + "\n");
console.error(`frames: ${rows.length}장 (문턱 ${th})`);
