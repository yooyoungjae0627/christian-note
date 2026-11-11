// 웹 채팅 서버.  node chatbot/src/server.mjs   (설정: chatbot/README.md)
//   GET  /           — 채팅 화면(web/index.html). 앱의 웹뷰나 브라우저로 연다
//   GET  /api/info   — 화면이 켜질 때 읽는 정보(인증 번호가 필요한지, 답하는 방식)
//   POST /api/chat   — { message, sessionId, code } → { text }
import fs from "fs";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";
import { loadCorpus } from "./corpus.mjs";
import { buildIndex } from "./search.mjs";
import { buildSystem } from "./prompt.mjs";
import { answer, MODEL } from "./agent.mjs";
import { answerWithClaudeCode } from "./claudecode.mjs";
import { createApp } from "./app.mjs";
import { verses } from "../../tools/kjv.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const PORT = +(process.env.PORT || 8787);
const hasKey = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
// 답하는 방식: claude-code = 개인 Claude Code 구독(본인 시험용) / api = Claude API 키 / search = AI 없이 검색 결과만
const BACKEND = process.env.CHATBOT_BACKEND || (hasKey ? "api" : "search");
if (!["claude-code", "api", "search"].includes(BACKEND)) throw new Error(`CHATBOT_BACKEND 값 이상: ${BACKEND}`);
if (BACKEND === "api" && !hasKey) throw new Error("CHATBOT_BACKEND=api 인데 ANTHROPIC_API_KEY가 없습니다.");

const log = (msg) => console.log(`${new Date().toISOString()} ${msg}`);
const chunks = loadCorpus(ROOT);
const index = buildIndex(chunks);

// 질문 글은 기록하지 않는다(성도의 사적인 질문일 수 있다). 걸린 시간과 토큰 수만 남긴다.
let answerFn = null;
if (BACKEND === "api") {
  const system = buildSystem(ROOT);
  const client = new Anthropic({ maxRetries: 1 });
  answerFn = async ({ question, session }) => {
    const t = Date.now();
    const r = await answer({ question, history: session.history, system, index, getVerse: verses, client });
    log(`답(api) ${Date.now() - t}ms · ${r.turns}턴 · 입력 ${r.usage.input} (캐시 읽기 ${r.usage.cacheRead}, 쓰기 ${r.usage.cacheWrite}) · 출력 ${r.usage.output}`);
    return r;
  };
} else if (BACKEND === "claude-code") {
  answerFn = async ({ question, session }) => {
    const t = Date.now();
    const r = await answerWithClaudeCode({ question, session, root: ROOT });
    log(`답(claude-code) ${Date.now() - t}ms · ${r.turns ?? "?"}턴`);
    return r;
  };
}

const ACCESS_CODE = process.env.CHATBOT_ACCESS_CODE || "";
const chat = createApp({
  answerFn, index, log,
  accessCode: ACCESS_CODE,
  dailyLimit: +(process.env.CHATBOT_DAILY_LIMIT || 30),
  dailyTotal: +(process.env.CHATBOT_DAILY_TOTAL || 300),
  maxConcurrent: BACKEND === "claude-code" ? 1 : 3, // Claude Code는 메모리를 많이 써서 한 번에 하나만
});

const PAGE = path.join(HERE, "../web/index.html");

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      "Content-Security-Policy": "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    return res.end(fs.readFileSync(PAGE));
  }
  if (req.method === "GET" && url.pathname === "/api/info") return send(res, 200, { needCode: !!ACCESS_CODE, backend: BACKEND, chunks: chunks.length });
  if (req.method !== "POST" || url.pathname !== "/api/chat") return send(res, 404, { text: "없는 주소입니다." });
  // 다른 사이트의 페이지가 방문자의 브라우저로 몰래 질문을 보내지 못하게 JSON 요청만 받는다(교차 출처에서는 사전 확인에 막힌다).
  if (!String(req.headers["content-type"] ?? "").startsWith("application/json")) return send(res, 415, { text: "JSON으로 보내 주세요." });

  let size = 0;
  const parts = [];
  req.on("data", (d) => {
    size += d.length;
    if (size > 20_000) { send(res, 413, { text: "요청이 너무 큽니다." }); req.destroy(); } else parts.push(d);
  });
  req.on("end", async () => {
    if (res.writableEnded) return;
    let body;
    try { body = JSON.parse(Buffer.concat(parts).toString("utf8")); } catch { return send(res, 400, { text: "요청을 읽지 못했습니다." }); }
    // 프록시(nginx 등) 뒤에 둘 때는 CHATBOT_TRUST_PROXY=1 로 X-Forwarded-For 의 주소를 쓴다.
    const ip = (process.env.CHATBOT_TRUST_PROXY === "1" && String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim()) || req.socket.remoteAddress || "";
    try {
      const r = await chat({ message: body?.message, sessionId: body?.sessionId, code: typeof body?.code === "string" ? body.code : "", ip });
      send(res, r.status, r.body);
    } catch (e) { log(`처리 실패: ${e.message}`); send(res, 500, { text: "서버 오류입니다. 잠시 뒤에 다시 보내 주세요." }); }
  });
});
server.requestTimeout = 0; // 답을 만드는 동안(최대 3분쯤) 연결을 붙잡고 있는다
server.listen(PORT, () => {
  const how = { api: `Claude API (${MODEL})`, "claude-code": "개인 Claude Code 구독 — 본인 시험용", search: "AI 꺼짐(검색 결과만)" }[BACKEND];
  log(`챗봇 서버 http://localhost:${PORT} · 자료 ${chunks.length}조각 · 답: ${how} · 인증 ${ACCESS_CODE ? "켜짐" : "꺼짐"}`);
});
