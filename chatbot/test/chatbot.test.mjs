// node --test chatbot/test/*.test.mjs     (API 키·네트워크 없이 돈다 — Claude API와 claude 명령은 가짜로 대신한다)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { loadCorpus, TIERS } from "../src/corpus.mjs";
import { buildIndex, search, tokenize } from "../src/search.mjs";
import { buildSystem, buildClaudeCodePrompt } from "../src/prompt.mjs";
import { answer, TOOLS, REFUSAL_TEXT } from "../src/agent.mjs";
import { answerWithClaudeCode } from "../src/claudecode.mjs";
import { plain } from "../src/format.mjs";
import { createApp } from "../src/app.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const chunks = loadCorpus(ROOT);
const index = buildIndex(chunks);

test("자료: 네 순위 모두 읽히고 강의 조각에는 시각 링크가 있다", () => {
  for (const tier of TIERS) assert.ok(chunks.some((c) => c.tier === tier), `${tier} 조각 없음`);
  const scripts = chunks.filter((c) => c.tier === "1순위");
  assert.ok(scripts.length > 1000);
  for (const c of scripts) assert.match(c.display, /^\[\d+(:\d+)+\]\(https:\/\/youtu\.be\/[\w-]{11}\?t=\d+\) /, c.file);
  for (const c of chunks) assert.ok(/[가-힣a-zA-Z]/.test(c.display), `빈 조각: ${c.file}`);
  // 스크립트 파일마다 조각이 하나 이상 있어야 한다(형식이 달라 통째로 빠진 파일이 없는지)
  const dir = path.join(ROOT, "memory-bank/첫열매들_강의스크립트");
  const withLines = fs.readdirSync(dir, { recursive: true }).filter((f) => f.endsWith(".md") && !f.endsWith("README.md"))
    .filter((f) => /^- \[\d+:\d+/m.test(fs.readFileSync(path.join(dir, f), "utf8")));
  const indexed = new Set(scripts.map((c) => c.file));
  for (const f of withLines) assert.ok(indexed.has(`memory-bank/첫열매들_강의스크립트/${f.split(path.sep).join("/")}`), `빠진 강의: ${f}`);
});

test("검색: 순위별로 맞는 자료가 나온다", () => {
  assert.deepEqual(tokenize("징계를 받다 Genesis 3"), ["징계", "계를", "받다", "genesis", "3"]);
  const top = (tier, q) => search(index, q, { tier, k: 5 });
  assert.ok(top("1순위", "징계 가시 차이").some((h) => /징계/.test(h.chunk.title + h.chunk.display)));
  assert.ok(top("1순위", "징계 가시 차이").every((h) => h.chunk.tier === "1순위"));
  assert.ok(top("교리", "성령 아버지의 영").some((h) => /milk04|00_교리/.test(h.chunk.file)));
  assert.match(top("2순위", "Genesis 1 dispensation innocency")[0].chunk.display, /biblestudytools\.com/);
  assert.ok(top("3순위", "다윗 골리앗 물매").some((h) => /골리앗/.test(h.chunk.display)));
  assert.equal(top("1순위", "ㅋㅋㅋ zzzqqq").length, 0);
});

test("프롬프트: 지침·교리 문서를 그대로 싣고, 요청마다 글자가 같다(캐시)", () => {
  const a = buildSystem(ROOT), b = buildSystem(ROOT);
  assert.deepEqual(a, b);
  const all = a.map((x) => x.text).join("\n");
  assert.ok(all.includes(fs.readFileSync(path.join(ROOT, "docs/policy/성경해석_지침.md"), "utf8").trim()));
  assert.ok(all.includes(fs.readFileSync(path.join(ROOT, "docs/doctrine/00_교리_총정리.md"), "utf8").trim()));
  assert.equal(a.at(-1).cache_control.type, "ephemeral");
});

test("답 글 다듬기: 마크다운 표시를 걷고 주소는 그대로 둔다", () => {
  assert.equal(plain("## 제목\n**굵게** [12:34](https://youtu.be/abc?t=754)\n\n\n\n* 항목"), "제목\n굵게 12:34 https://youtu.be/abc?t=754\n\n- 항목");
});

// 가짜 Claude: 미리 정한 응답을 차례로 돌려주고 받은 요청을 기록한다.
function fakeClient(responses) {
  const calls = [];
  return {
    calls,
    beta: { messages: { create: async (params) => { calls.push(structuredClone(params)); return { usage: { input_tokens: 10, output_tokens: 5 }, ...responses[calls.length - 1] }; } } },
  };
}

test("도구 루프: 검색·구절 도구를 실행해 결과를 한 메시지로 돌려주고 마지막 글을 답으로 낸다", async () => {
  const client = fakeClient([
    { stop_reason: "tool_use", content: [
      { type: "tool_use", id: "t1", name: "search", input: { tier: "1순위", query: "징계 가시" } },
      { type: "tool_use", id: "t2", name: "get_verse", input: { ref: "요한복음 3:16" } },
      { type: "tool_use", id: "t3", name: "get_verse", input: { ref: "없는책 1:1" } },
    ] },
    { stop_reason: "end_turn", content: [{ type: "text", text: "답입니다." }] },
  ]);
  const getVerse = async (ref) => { if (ref.startsWith("없는")) throw new Error("책을 찾지 못함"); return [{ book: "요한복음", ref: "3:16", ko: "본문" }]; };
  const r = await answer({ question: "징계란?", history: [{ role: "user", content: "앞 질문" }, { role: "assistant", content: "앞 답" }], system: buildSystem(ROOT), index, getVerse, client });
  assert.equal(r.text, "답입니다.");
  assert.equal(r.turns, 2);
  assert.equal(client.calls[0].model, "claude-opus-5-5");
  assert.equal(client.calls[0].messages.length, 3);
  assert.deepEqual(client.calls[0].tools, TOOLS);
  const results = client.calls[1].messages.at(-1).content;
  assert.deepEqual(results.map((x) => x.tool_use_id), ["t1", "t2", "t3"]);
  assert.match(results[0].content, /【1순위】[\s\S]*https:\/\/youtu\.be\//);
  assert.equal(results[1].content, "요한복음 3:16 | 본문\n(표준킹제임스성경)");
  assert.equal(results[2].is_error, true);

  const refused = await answer({ question: "x", system: [], index, getVerse, client: fakeClient([{ stop_reason: "refusal", content: [] }]) });
  assert.equal(refused.text, REFUSAL_TEXT);
  await assert.rejects(answer({ question: "x", system: [], index, getVerse, client: fakeClient([]), deadline: Date.now() }), /시간 초과/);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SID = "session-0001";

test("웹 흐름: 인증 번호 → 질문 → 이어지는 대화, 겹친 질문·하루 횟수 제한, 실패 안내", async () => {
  const seen = [];
  let delay = 0;
  const app = createApp({
    index, accessCode: "1234", dailyLimit: 3,
    answerFn: async ({ question, session }) => { seen.push({ question, history: session.history }); await sleep(delay); return { text: `**답**: ${question}` }; },
  });
  const ask = (message, extra = {}) => app({ message, sessionId: SID, code: "1234", ip: "1.1.1.1", ...extra });

  assert.deepEqual(await ask("징계란?", { code: "" }), { status: 401, body: { text: "인증 번호가 필요합니다.", needCode: true } });
  assert.equal((await ask("징계란?", { code: "9999" })).status, 401);
  assert.equal((await ask("  ")).status, 400);
  assert.equal((await ask("가".repeat(1001))).status, 400);
  assert.equal((await ask("징계란?", { sessionId: "x" })).status, 400);
  assert.equal(seen.length, 0);

  assert.deepEqual(await ask("징계란?"), { status: 200, body: { text: "답: 징계란?" } }); // 마크다운 표시는 걷힌다

  delay = 80;
  const slow = ask("가시란?");
  await sleep(10);
  assert.equal((await ask("또 질문")).status, 429); // 앞 답을 만드는 중
  assert.equal((await slow).body.text, "답: 가시란?");
  assert.deepEqual(seen[1].history, [{ role: "user", content: "징계란?" }, { role: "assistant", content: "답: 징계란?" }]);

  delay = 0;
  assert.equal((await ask("셋째")).status, 200);
  const over = await ask("넷째");
  assert.equal(over.status, 429);
  assert.match(over.body.text, /오늘은 질문을 모두/);
  assert.equal(seen.length, 3);

  const failing = createApp({ index, answerFn: async () => { throw new Error("API 오류"); } });
  const f = await failing({ message: "징계란?", sessionId: SID });
  assert.equal(f.status, 502);
  assert.match(f.body.text, /답을 만들지 못했습니다/);
  assert.equal((await failing({ message: "다시", sessionId: SID })).status, 502); // 실패 뒤에도 다음 질문을 받는다(busy가 풀림)
});

test("웹 흐름: AI가 꺼져 있으면 강의 대목과 시각 링크만 · 서버 전체 하루 횟수", async () => {
  const noAI = createApp({ index, answerFn: null, dailyTotal: 1 });
  const r = await noAI({ message: "징계와 가시의 차이", sessionId: SID, ip: "1.1.1.1" });
  assert.equal(r.status, 200);
  assert.match(r.body.text, /AI 답변이 꺼져/);
  assert.match(r.body.text, /https:\/\/youtu\.be\/[\w-]{11}\?t=\d+/);
  const r2 = await noAI({ message: "다른 사람", sessionId: "session-0002", ip: "2.2.2.2" });
  assert.equal(r2.status, 429);
  assert.match(r2.body.text, /하루 질문 수가 다 찼습니다/);
});

test("Claude Code 방식: 읽기 전용 도구로 claude -p 를 부르고, 질문은 표준 입력으로, 이어지는 질문은 --resume", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "chatbot-cc-"));
  const bin = path.join(dir, "fake-claude.mjs");
  // 가짜 claude: 받은 인자·표준 입력·환경을 그대로 답에 실어 돌려준다.
  fs.writeFileSync(bin, `#!/usr/bin/env node
let input = ""; process.stdin.on("data", (d) => (input += d)); process.stdin.on("end", () => {
  if (input.includes("실패")) { console.log(JSON.stringify({ is_error: true, result: "Not logged in" })); process.exit(1); }
  console.log(JSON.stringify({ is_error: false, session_id: "cc-123", num_turns: 4, duration_ms: 9,
    result: JSON.stringify({ args: process.argv.slice(2), input, cwd: process.cwd(), key: process.env.ANTHROPIC_API_KEY ?? null }) }));
});`);
  fs.chmodSync(bin, 0o755);
  process.env.ANTHROPIC_API_KEY = "sk-test-should-not-leak";
  const session = {};
  const r = await answerWithClaudeCode({ question: "--help 징계란?", session, root: ROOT, bin });
  const got = JSON.parse(r.text);
  assert.equal(got.input, "성도의 질문:\n--help 징계란?");
  assert.equal(got.cwd, ROOT);
  assert.equal(got.key, null); // API 키는 넘기지 않는다(구독 로그인만)
  const flag = (name) => got.args[got.args.indexOf(name) + 1];
  assert.equal(got.args[0], "-p");
  assert.equal(flag("--output-format"), "json");
  assert.equal(flag("--tools"), "Read,Grep,Glob,Bash");
  assert.equal(flag("--permission-mode"), "dontAsk");
  assert.deepEqual(got.args.slice(got.args.indexOf("--allowedTools") + 1, got.args.indexOf("--permission-mode")), ["Read", "Grep", "Glob", "Bash(node tools/kjv.mjs *)"]);
  assert.equal(flag("--append-system-prompt"), buildClaudeCodePrompt());
  assert.ok(!got.args.includes("--resume"));
  assert.equal(session.ccSessionId, "cc-123");
  assert.equal(r.turns, 4);

  const again = JSON.parse((await answerWithClaudeCode({ question: "이어서", session, root: ROOT, bin })).text);
  assert.equal(again.args[again.args.indexOf("--resume") + 1], "cc-123");
  await assert.rejects(answerWithClaudeCode({ question: "실패", session: {}, root: ROOT, bin }), /claude 오류 \(exit 1\): Not logged in/);
  await assert.rejects(answerWithClaudeCode({ question: "x", session: {}, root: ROOT, bin: path.join(dir, "none") }), /claude 실행 실패/);
  delete process.env.ANTHROPIC_API_KEY;
  fs.rmSync(dir, { recursive: true });
});
