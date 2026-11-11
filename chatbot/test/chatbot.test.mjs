// node --test chatbot/test/*.test.mjs     (API 키·네트워크 없이 돈다 — Claude와 카카오는 가짜로 대신한다)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { loadCorpus, TIERS } from "../src/corpus.mjs";
import { buildIndex, search, tokenize } from "../src/search.mjs";
import { buildSystem } from "../src/prompt.mjs";
import { answer, TOOLS, REFUSAL_TEXT } from "../src/agent.mjs";
import { plain, splitBubbles, skillResponse, parseRequest, BUBBLE_MAX } from "../src/kakao.mjs";
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

test("카카오 형식: 마크다운을 걷고, 말풍선은 950자·세 개를 넘지 않고, 주소가 끊기지 않는다", () => {
  assert.equal(plain("## 제목\n**굵게** [12:34](https://youtu.be/abc?t=754)"), "제목\n굵게 12:34 https://youtu.be/abc?t=754");
  const url = "https://youtu.be/K2oLTyo0zN8?t=1234";
  const long = Array.from({ length: 120 }, (_, i) => `${i}번째 줄입니다. 징계와 가시의 차이를 설명합니다. ${url}`).join("\n");
  const bubbles = splitBubbles(long);
  assert.equal(bubbles.length, 3);
  for (const b of bubbles) assert.ok(b.length <= BUBBLE_MAX, `${b.length}자`);
  for (const b of bubbles.slice(0, 2)) for (const m of b.matchAll(/https:\S+/g)) assert.equal(m[0], url);
  assert.match(bubbles[2], /질문을 나누어/);
  assert.ok(splitBubbles("가".repeat(2500)).every((b) => b.length <= BUBBLE_MAX));
  const r = skillResponse("짧은 답", ["답 보기"]);
  assert.deepEqual(r, { version: "2.0", template: { outputs: [{ simpleText: { text: "짧은 답" } }], quickReplies: [{ label: "답 보기", action: "message", messageText: "답 보기" }] } });
  assert.deepEqual(parseRequest({ userRequest: { utterance: " 질문 ", user: { id: "u1" }, callbackUrl: "http://evil" } }), { utterance: "질문", userId: "u1", callbackUrl: null });
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

const req = (utterance, userId = "u1", callbackUrl = null) => ({ utterance, userId, callbackUrl });
const texts = (r) => r.template.outputs.map((o) => o.simpleText.text).join("\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("서버 흐름: 인증 → 질문 → 늦은 답은 「답 보기」, 하루 횟수 제한, 이어지는 대화", async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chatbot-test-"));
  const seen = [];
  let delay = 0;
  const app = createApp({
    index, accessCode: "1234", dailyLimit: 3, dataDir, waitMs: 50,
    answerFn: async ({ question, history }) => { seen.push({ question, history }); await sleep(delay); return { text: `답: ${question}` }; },
  });
  assert.match(texts(await app(req("징계란?"))), /인증 번호/);
  assert.match(texts(await app(req("인증 9999"))), /맞지 않습니다/);
  assert.match(texts(await app(req("인증 1234"))), /인증되었습니다/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, "users.json"), "utf8")), ["u1"]);
  assert.equal(seen.length, 0);

  assert.equal(texts(await app(req("징계란?"))), "답: 징계란?");

  delay = 150; // 4초(시험에서는 50ms) 안에 못 끝나는 답
  const late = await app(req("가시란?"));
  assert.match(texts(late), /답 보기/);
  assert.equal(late.template.quickReplies[0].messageText, "답 보기");
  assert.match(texts(await app(req("또 질문"))), /앞 질문의 답을 아직/);
  await sleep(200);
  assert.equal(texts(await app(req("답 보기"))), "답: 가시란?");
  assert.deepEqual(seen[1].history, [{ role: "user", content: "징계란?" }, { role: "assistant", content: "답: 징계란?" }]);

  delay = 0;
  assert.equal(texts(await app(req("셋째"))), "답: 셋째");
  assert.match(texts(await app(req("넷째"))), /3번 모두/);
  assert.equal(seen.length, 3);
  assert.match(texts(await app(req("질문", "u2"))), /인증 번호/); // 다른 사용자는 인증부터
  fs.rmSync(dataDir, { recursive: true });
});

test("서버 흐름: 콜백이 있으면 먼저 접수 응답, 답은 callbackUrl로 보낸다 · 키가 없으면 검색 결과만", async () => {
  const posts = [];
  const fetchFn = async (url, init) => { posts.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
  const app = createApp({ index, waitMs: 50, fetchFn, answerFn: async ({ question }) => { await sleep(30); return { text: `**답**: ${question}` }; } });
  const ack = await app(req("징계란?", "u1", "https://bot-api.kakao.com/callback/abc"));
  assert.equal(ack.useCallback, true);
  assert.equal(posts.length, 0);
  await sleep(80);
  assert.equal(posts[0].url, "https://bot-api.kakao.com/callback/abc");
  assert.equal(texts(posts[0].body), "답: 징계란?");

  const failing = createApp({ index, waitMs: 50, answerFn: async () => { throw new Error("API 오류"); } });
  assert.match(texts(await failing(req("징계란?"))), /답을 만들지 못했습니다/);

  const noKey = createApp({ index, answerFn: null, waitMs: 500 });
  const out = texts(await noKey(req("징계와 가시의 차이")));
  assert.match(out, /AI 답변이 꺼져/);
  assert.match(out, /https:\/\/youtu\.be\/[\w-]{11}\?t=\d+/);
});
