// 카카오톡 스킬 서버.  node chatbot/src/server.mjs   (설정: chatbot/README.md)
//   POST /kakao/skill  — 카카오 i 오픈빌더 스킬 URL
//   GET  /health       — 살아 있는지 확인(자료 조각 수, AI 사용 여부)
import http from "http";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { timingSafeEqual } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { loadCorpus } from "./corpus.mjs";
import { buildIndex } from "./search.mjs";
import { buildSystem } from "./prompt.mjs";
import { answer, MODEL } from "./agent.mjs";
import { parseRequest } from "./kakao.mjs";
import { createApp } from "./app.mjs";
import { verses } from "../../tools/kjv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PORT = +(process.env.PORT || 8787);
const SECRET = process.env.CHATBOT_SKILL_SECRET || ""; // 오픈빌더 스킬 헤더 x-skill-secret 에 같은 값을 넣는다
const DATA_DIR = process.env.CHATBOT_DATA_DIR || path.join(os.tmpdir(), "christian-note-chatbot"); // 저장소 밖
const hasLLM = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);

const chunks = loadCorpus(ROOT);
const index = buildIndex(chunks);
const system = buildSystem(ROOT);
const client = hasLLM ? new Anthropic({ maxRetries: 1 }) : null;

const handle = createApp({
  index,
  accessCode: process.env.CHATBOT_ACCESS_CODE || "",
  dailyLimit: +(process.env.CHATBOT_DAILY_LIMIT || 30),
  dataDir: DATA_DIR,
  log,
  answerFn: client && (async ({ question, history }) => {
    const t = Date.now();
    const r = await answer({ question, history, system, index, getVerse: verses, client });
    // 질문 글은 기록하지 않는다(성도의 사적인 질문일 수 있다). 비용을 볼 수 있게 토큰 수만 남긴다.
    log(`답 ${Date.now() - t}ms · ${r.turns}턴 · 입력 ${r.usage.input} (캐시 읽기 ${r.usage.cacheRead}, 쓰기 ${r.usage.cacheWrite}) · 출력 ${r.usage.output}`);
    return r;
  }),
});

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(obj));
}

http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/health") return send(res, 200, { ok: true, chunks: chunks.length, llm: hasLLM, model: hasLLM ? MODEL : null });
  if (req.method !== "POST" || url.pathname !== "/kakao/skill") return send(res, 404, { error: "not found" });
  if (SECRET && !same(String(req.headers["x-skill-secret"] ?? ""), SECRET)) return send(res, 401, { error: "unauthorized" });

  let size = 0;
  const parts = [];
  req.on("data", (d) => {
    size += d.length;
    if (size > 100_000) { send(res, 413, { error: "too large" }); req.destroy(); } else parts.push(d);
  });
  req.on("end", async () => {
    if (res.writableEnded) return;
    let body;
    try { body = JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { return send(res, 400, { error: "bad json" }); }
    try { send(res, 200, await handle(parseRequest(body))); } catch (e) { log(`처리 실패: ${e.message}`); send(res, 500, { error: "internal" }); }
  });
}).listen(PORT, () => {
  log(`챗봇 서버 :${PORT} · 자료 ${chunks.length}조각 · AI ${hasLLM ? MODEL : "꺼짐(검색 결과만)"} · 인증 ${process.env.CHATBOT_ACCESS_CODE ? "켜짐" : "꺼짐"} · 스킬 비밀값 ${SECRET ? "켜짐" : "꺼짐"}`);
});
