// 파이썬이 없는 기기(예: Windows)용 받아쓰기 — transformers.js(Whisper ONNX, CPU). zoombook.mjs가 필요할 때 부른다.
// 사용: node transcribe.mjs <16kHz 모노 wav> <출력.srt> [모델=onnx-community/whisper-large-v3-turbo]
// 모델은 처음 쓸 때 huggingface.co에서 받는다. 글은 고치지 않는다(오인식 그대로).
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const [, , wavFile, out, model = "onnx-community/whisper-large-v3-turbo"] = process.argv;
if (!wavFile || !out) { console.error("사용: node transcribe.mjs <wav> <출력.srt> [모델]"); process.exit(2); }

// NODE_PATH(zoombook의 임시 설치 폴더)에서 찾는다
let tf;
try { tf = await import(require.resolve("@huggingface/transformers", { paths: (process.env.NODE_PATH || "").split(/[;:]/).filter(Boolean) })); }
catch (e) { console.error("transformers.js 없음: " + e.message); process.exit(3); }

// 16bit PCM wav → Float32
const buf = fs.readFileSync(wavFile);
let off = 12, data = null;
while (off < buf.length - 8) { const id = buf.toString("ascii", off, off + 4), sz = buf.readUInt32LE(off + 4); if (id === "data") { data = buf.subarray(off + 8, off + 8 + sz); break; } off += 8 + sz + (sz & 1); }
if (!data) { console.error("wav data 없음"); process.exit(2); }
const pcm = new Float32Array(data.length >> 1);
for (let i = 0; i < pcm.length; i++) pcm[i] = data.readInt16LE(i * 2) / 32768;

const ts = (s) => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, x = Math.floor(ms / 1000) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`; };
const t0 = Date.now();
let asr;
try { asr = await tf.pipeline("automatic-speech-recognition", model, { dtype: "q8" }); }
catch (e) { console.error(`모델을 불러오지 못함(${model}): ${e.message}`); process.exit(3); }
const res = await asr(pcm, { language: "korean", task: "transcribe", chunk_length_s: 30, stride_length_s: 5, return_timestamps: true });
const chunks = (res.chunks || []).filter((c) => c.text.trim());
fs.writeFileSync(out, chunks.map((c, i) => `${i + 1}\n${ts(c.timestamp[0])} --> ${ts(c.timestamp[1] ?? c.timestamp[0])}\n${c.text.trim()}\n`).join("\n"));
console.error(`transcribe.mjs: ${chunks.length}구간, ${Math.round((Date.now() - t0) / 1000)}초 → ${out}`);
