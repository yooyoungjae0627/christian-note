// 질문 하나에 답한다: Claude가 search·get_verse 도구로 저장소 자료를 찾아보고 답을 쓴다.
// 도구 호출 루프를 직접 돌리는 이유: 카카오톡 응답 시한이 있어 전체 시간·횟수를 서버가 끊어야 한다.
import Anthropic from "@anthropic-ai/sdk";
import { TIERS } from "./corpus.mjs";
import { search, formatHits } from "./search.mjs";

export const MODEL = process.env.CHATBOT_MODEL || "claude-opus-5-5";
// 답이 늦으면 카카오톡 콜백 시한(1분)을 넘긴다. 자료 찾아 요약하는 일이라 낮은 effort로 충분하다.
const EFFORT = process.env.CHATBOT_EFFORT || "low";
const MAX_TURNS = 8;

export const TOOLS = [
  {
    name: "search",
    description:
      "저장소의 근거 자료에서 낱말로 대목을 찾는다. tier로 순위를 고른다: " +
      "\"교리\"=밀크 교리 정리(1~10강), \"1순위\"=첫열매들 영상 강의 스크립트(줄마다 시각 링크), " +
      "\"2순위\"=스코필드 관주 해설 원문(영어 — 영어 낱말이나 'Genesis 1'처럼 영어 책 이름과 장으로 찾는다), " +
      "\"3순위\"=이이레 목사 강의 스크립트. 낱말이 겹치는 정도로 찾으므로 문장보다 핵심 낱말 몇 개가 잘 맞는다.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        tier: { type: "string", enum: TIERS },
        query: { type: "string", description: "찾을 낱말들. 예: \"징계 가시 차이\", \"요한복음 3장 16절\"" },
      },
      required: ["tier", "query"],
      additionalProperties: false,
    },
  },
  {
    name: "get_verse",
    description: "표준킹제임스성경 본문을 글자 그대로 가져온다. 성경 본문을 답에 인용할 때 쓴다.",
    strict: true,
    input_schema: {
      type: "object",
      properties: { ref: { type: "string", description: "책 장:절 또는 절 범위. 예: \"창세기 1:1-3\", \"요한복음 3:16\"" } },
      required: ["ref"],
      additionalProperties: false,
    },
  },
];

export const REFUSAL_TEXT = "이 질문에는 답을 드리기 어렵습니다. 성경 구절이나 교리에 대한 질문을 다시 보내 주세요.";

async function runTool(name, input, { index, getVerse }) {
  if (name === "search") {
    if (!TIERS.includes(input?.tier) || typeof input?.query !== "string") throw new Error("tier와 query가 필요합니다.");
    return formatHits(search(index, input.query, { tier: input.tier, k: 6 }));
  }
  if (name === "get_verse") {
    if (typeof input?.ref !== "string") throw new Error("ref가 필요합니다.");
    const vs = await getVerse(input.ref);
    return vs.map((v) => `${v.book} ${v.ref} | ${v.ko}`).join("\n") + "\n(표준킹제임스성경)";
  }
  throw new Error(`없는 도구: ${name}`);
}

const textOf = (content) => content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

// history: 이전 문답 [{ role: "user"|"assistant", content: "글" }, …] — 글만 넘긴다.
// 돌려주는 값: { text, usage, turns }
export async function answer({ question, history = [], system, index, getVerse, client = new Anthropic({ maxRetries: 1 }), deadline = Date.now() + 110_000 }) {
  const messages = [...history, { role: "user", content: question }];
  const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

  for (let turn = 1; turn <= MAX_TURNS; turn++) {
    const left = deadline - Date.now();
    if (left < 3_000) throw new Error("시간 초과");
    const res = await client.beta.messages.create(
      {
        model: MODEL,
        max_tokens: 4000, // 카카오톡 말풍선 세 개(3,000자)가 답의 상한
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default", // 안전 분류기가 거절하면 API가 같은 요청을 대체 모델로 다시 돌린다
        output_config: { effort: EFFORT },
        system,
        tools: TOOLS,
        messages,
      },
      { timeout: left },
    );
    usage.input += res.usage?.input_tokens ?? 0;
    usage.output += res.usage?.output_tokens ?? 0;
    usage.cacheRead += res.usage?.cache_read_input_tokens ?? 0;
    usage.cacheWrite += res.usage?.cache_creation_input_tokens ?? 0;

    if (res.stop_reason === "refusal") return { text: REFUSAL_TEXT, usage, turns: turn };
    if (res.stop_reason === "pause_turn") { messages.push({ role: "assistant", content: res.content }); continue; }
    if (res.stop_reason !== "tool_use") {
      return { text: textOf(res.content) || "답을 만들지 못했습니다. 질문을 조금 바꿔 다시 보내 주세요.", usage, turns: turn };
    }

    messages.push({ role: "assistant", content: res.content });
    const results = await Promise.all(
      res.content.filter((b) => b.type === "tool_use").map(async (b) => {
        try {
          return { type: "tool_result", tool_use_id: b.id, content: await runTool(b.name, b.input, { index, getVerse }) };
        } catch (e) {
          return { type: "tool_result", tool_use_id: b.id, content: `오류: ${e.message}`, is_error: true };
        }
      }),
    );
    if (turn === MAX_TURNS - 1) results.push({ type: "text", text: "(서버 안내: 검색은 여기까지입니다. 지금까지 찾은 자료로 답을 써 주세요.)" });
    messages.push({ role: "user", content: results });
  }
  throw new Error("도구 호출이 너무 많아 답을 끝내지 못했습니다.");
}
