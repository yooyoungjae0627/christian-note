// 웹 채팅 요청 하나를 처리하는 로직(HTTP와 떼어 놓아 테스트할 수 있게).
// 돌려주는 값: { status, body } — body.text 가 화면에 보일 글.
import { plain } from "./format.mjs";
import { search } from "./search.mjs";

const SESSION_TTL = 30 * 60_000; // 대화를 이어 가는 시간
const reply = (status, text, extra = {}) => ({ status, body: { text, ...extra } });

export function createApp({
  answerFn, // ({ question, session }) => { text }   — null이면 AI 없이 검색 결과만 보여 준다
  index,
  accessCode = "", // 비어 있으면 주소를 아는 누구나 사용
  dailyLimit = 30, // 한 사람(브라우저)의 하루 질문 수
  dailyTotal = 300, // 서버 전체의 하루 질문 수(비용 보호)
  maxConcurrent = 3, // 동시에 만드는 답의 수
  log = () => {},
}) {
  const sessions = new Map(); // sessionId → { history, ccSessionId, busy, at }
  let day = "", counts = new Map(), total = 0, running = 0;

  const overLimit = (who) => {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== day) { day = today; counts = new Map(); total = 0; }
    const n = (counts.get(who) ?? 0) + 1;
    counts.set(who, n);
    total++;
    return n > dailyLimit ? "오늘은 질문을 모두 쓰셨습니다. 내일 다시 물어 주세요." : total > dailyTotal ? "오늘은 도우미의 하루 질문 수가 다 찼습니다. 내일 다시 물어 주세요." : null;
  };

  // AI를 쓸 수 없을 때: 1순위 강의에서 찾은 대목과 링크만 보여 준다.
  const searchOnly = (question) => {
    const hits = search(index, question, { tier: "1순위", k: 3 });
    if (!hits.length) return "첫열매들 강의에서 관련 대목을 찾지 못했습니다. 낱말을 바꿔 다시 물어 주세요.";
    return (
      "(AI 답변이 꺼져 있어 관련 강의 대목만 보여 드립니다.)\n\n" +
      hits.map(({ chunk: c }) => {
        const m = c.display.match(/^\[([\d:]+)\]\((\S+)\) (.+)$/m);
        const quote = c.display.replace(/\[[\d:]+\]\(\S+\) /g, "").replace(/\n/g, " ").slice(0, 160);
        return `「${c.title}」 ${m?.[1] ?? ""}\n${quote}…\n${m?.[2] ?? ""}`;
      }).join("\n\n")
    );
  };

  return async function chat({ message, sessionId, code = "", ip = "" }) {
    if (accessCode && code !== accessCode) return reply(401, code ? "인증 번호가 맞지 않습니다." : "인증 번호가 필요합니다.", { needCode: true });
    const question = typeof message === "string" ? message.trim() : "";
    if (!question) return reply(400, "질문을 적어 주세요.");
    if (question.length > 1000) return reply(400, "질문이 너무 깁니다. 1,000자 안으로 줄여 주세요.");
    if (typeof sessionId !== "string" || !/^[\w-]{8,64}$/.test(sessionId)) return reply(400, "화면을 새로 고친 뒤 다시 보내 주세요.");

    const now = Date.now();
    for (const [id, s] of sessions) if (!s.busy && now - s.at > SESSION_TTL) sessions.delete(id);
    let session = sessions.get(sessionId);
    if (!session) sessions.set(sessionId, (session = { history: [], ccSessionId: null, busy: false, at: now }));
    if (session.busy) return reply(429, "앞 질문의 답을 아직 찾고 있습니다. 잠시만 기다려 주세요.");
    if (running >= maxConcurrent) return reply(503, "지금 질문이 몰려 있습니다. 잠시 뒤에 다시 보내 주세요.");
    const limited = overLimit(ip || sessionId);
    if (limited) return reply(429, limited);

    session.busy = true;
    running++;
    try {
      const text = plain(answerFn ? (await answerFn({ question, session })).text : searchOnly(question));
      session.history = [...session.history, { role: "user", content: question }, { role: "assistant", content: text }].slice(-6);
      return reply(200, text);
    } catch (e) {
      log(`답 실패: ${e?.status ?? ""} ${e?.message ?? e}`);
      return reply(502, "지금은 답을 만들지 못했습니다. 잠시 뒤에 다시 물어 주세요.");
    } finally {
      session.busy = false;
      session.at = Date.now();
      running--;
    }
  };
}
