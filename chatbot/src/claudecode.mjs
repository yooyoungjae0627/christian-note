// 개인 Claude Code(구독 로그인)로 답한다:  claude -p  를 저장소 폴더에서 실행해 자료를 직접 찾아 읽게 한다.
// ※ 본인 시험용. 구독 계정으로 다른 사람들의 질문에 답하게 하는 것은 Anthropic 약관이 허용하지 않는다
//   (https://code.claude.com/docs/en/legal-and-compliance). 성도들에게 열 때는 API 키 방식(agent.mjs)으로 바꾼다.
import { spawn } from "child_process";
import { buildClaudeCodePrompt } from "./prompt.mjs";

// 읽기·찾기와 성경 본문 조회만 허용한다. 그 밖의 도구는 아예 주지 않고, 허락이 필요한 일은 모두 거절(dontAsk).
const ARGS = [
  "-p",
  "--output-format", "json",
  "--tools", "Read,Grep,Glob,Bash",
  "--allowedTools", "Read", "Grep", "Glob", "Bash(node tools/kjv.mjs *)",
  "--permission-mode", "dontAsk",
];

// session: 웹 대화 하나의 상태 객체. 이어지는 질문은 같은 Claude Code 세션(--resume)으로 보낸다.
export function answerWithClaudeCode({ question, session, root, bin = process.env.CLAUDE_BIN || "claude", model = process.env.CHATBOT_MODEL, timeoutMs = 170_000 }) {
  const args = [...ARGS, "--append-system-prompt", buildClaudeCodePrompt()];
  if (model) args.push("--model", model);
  if (session?.ccSessionId) args.push("--resume", session.ccSessionId);

  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY; // 키가 있으면 구독이 아니라 API 요금으로 나간다 — 이 방식은 구독 로그인만 쓴다
    const child = spawn(bin, args, { cwd: root, env, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    child.on("error", (e) => { clearTimeout(timer); reject(new Error(`claude 실행 실패: ${e.message}`)); });
    child.on("close", (code) => {
      clearTimeout(timer);
      let r;
      try { r = JSON.parse(out); } catch { return reject(new Error(`claude 출력을 읽지 못함 (exit ${code}): ${(err || out).slice(0, 300)}`)); }
      if (code !== 0 || r.is_error || typeof r.result !== "string") return reject(new Error(`claude 오류 (exit ${code}): ${String(r.result ?? err).slice(0, 300)}`));
      if (session && r.session_id) session.ccSessionId = r.session_id;
      resolve({ text: r.result.trim(), turns: r.num_turns ?? null, ms: r.duration_ms ?? null });
    });
    // 질문은 인자가 아니라 표준 입력으로 준다(「-」「/」로 시작하는 글이 옵션·명령으로 읽히지 않게 머리말을 붙인다).
    child.stdin.end(`성도의 질문:\n${question}`);
  });
}
