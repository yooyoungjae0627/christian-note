// 카카오톡 스킬 요청 하나를 처리하는 로직(HTTP와 떼어 놓아 테스트할 수 있게).
//
// 카카오톡은 스킬 서버가 5초 안에 답해야 한다. AI 답은 그보다 오래 걸리므로 두 길을 둔다.
//   ① 콜백(오픈빌더에서 블록에 「콜백」 설정, 승인 필요): 먼저 "찾는 중"을 돌려주고 1분 안에 callbackUrl로 답을 보낸다.
//   ② 콜백이 없을 때: 4초 기다려 보고, 아직이면 「답 보기」 버튼을 준다. 성도가 누르면 다 된 답을 돌려준다.
// 어느 길이든 답은 사용자별로 보관하므로 콜백 시한을 넘겨도 「답 보기」로 받을 수 있다.
import fs from "fs";
import path from "path";
import { skillResponse, callbackAck } from "./kakao.mjs";
import { search } from "./search.mjs";

const SHOW = "답 보기";
const HELP = `첫열매들 성경 해석 도우미입니다.
성경 구절의 뜻이나 교리를 물어보시면 첫열매들 강의에서 찾아 강의 제목·시각 링크와 함께 답합니다.

예) 징계와 가시는 어떻게 다른가요?
예) 성령은 누구신가요?

한 성도가 강의 자료로 만든 비공식 도우미입니다. AI가 정리한 답이니 링크의 강의 원문으로 꼭 확인해 주세요.`;

export function createApp({
  answerFn, // ({ question, history }) => { text }   — null이면 AI 없이 검색 결과만 보여 준다
  index,
  accessCode = "", // 비어 있으면 누구나 사용
  dailyLimit = 30,
  dataDir,
  waitMs = 4_000,
  callbackWindowMs = 55_000,
  fetchFn = fetch,
  log = () => {},
}) {
  const jobs = new Map(); // userId → { question, promise, done, text, shown, at }
  const histories = new Map(); // userId → { turns: [{role, content}], at }
  const counts = new Map(); // "userId|YYYY-MM-DD" → 횟수
  const usersFile = dataDir ? path.join(dataDir, "users.json") : null;
  const users = new Set(usersFile && fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile, "utf8")) : []);

  const allow = (userId) => {
    users.add(userId);
    if (usersFile) { fs.mkdirSync(dataDir, { recursive: true }); fs.writeFileSync(usersFile, JSON.stringify([...users])); }
  };

  const overLimit = (userId) => {
    const key = `${userId}|${new Date().toISOString().slice(0, 10)}`;
    for (const k of counts.keys()) if (!k.endsWith(key.slice(-10))) counts.delete(k); // 지난 날짜 정리
    const n = (counts.get(key) ?? 0) + 1;
    counts.set(key, n);
    return n > dailyLimit;
  };

  // AI를 쓸 수 없을 때(키 없음): 1순위 강의에서 찾은 대목과 링크만 보여 준다.
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

  const start = (userId, question) => {
    const h = histories.get(userId);
    const history = h && Date.now() - h.at < 30 * 60_000 ? h.turns : [];
    const job = { question, done: false, text: "", shown: false, at: Date.now() };
    job.promise = (async () => {
      try {
        job.text = answerFn ? (await answerFn({ question, history })).text : searchOnly(question);
        histories.set(userId, { turns: [...history, { role: "user", content: question }, { role: "assistant", content: job.text }].slice(-6), at: Date.now() });
      } catch (e) {
        log(`답 실패: ${e?.status ?? ""} ${e?.message ?? e}`);
        job.text = "지금은 답을 만들지 못했습니다. 잠시 뒤에 다시 물어 주세요.";
      }
      job.done = true;
      return job.text;
    })();
    jobs.set(userId, job);
    return job;
  };

  const timeout = (ms) => new Promise((r) => setTimeout(() => r(null), ms));

  // 스킬 요청 → 5초 안에 돌려줄 응답(JSON)
  return async function handle({ utterance, userId, callbackUrl }) {
    if (!userId) return skillResponse("요청에 사용자 정보가 없습니다.");
    if (!utterance) return skillResponse(HELP);

    const code = utterance.match(/^인증\s+(\S+)$/)?.[1];
    if (code !== undefined) {
      if (!accessCode) return skillResponse("인증 없이 쓰실 수 있습니다. 질문을 보내 주세요.");
      if (code !== accessCode) return skillResponse("인증 번호가 맞지 않습니다. 교회에서 받은 번호를 확인해 주세요.");
      allow(userId);
      return skillResponse("인증되었습니다. 이제 질문을 보내 주세요.\n\n" + HELP);
    }
    if (accessCode && !users.has(userId)) {
      return skillResponse("첫열매들 성도 전용 도우미입니다. 교회에서 받은 인증 번호를 「인증 번호」 꼴로 보내 주세요.\n예) 인증 1234");
    }
    if (/^(도움말|처음|시작|안녕하세요?|\/?help)$/i.test(utterance)) return skillResponse(HELP);

    let job = jobs.get(userId);
    if (utterance === SHOW) {
      if (!job) return skillResponse("기다리는 답이 없습니다. 질문을 보내 주세요.");
      const text = job.done ? job.text : await Promise.race([job.promise, timeout(waitMs)]);
      if (text === null) return skillResponse("아직 자료를 찾고 있습니다. 조금 뒤에 다시 눌러 주세요.", [SHOW]);
      job.shown = true;
      return skillResponse(text);
    }
    if (job && !job.done) return skillResponse("앞 질문의 답을 아직 찾고 있습니다. 조금 뒤에 「답 보기」를 눌러 주세요.", [SHOW]);
    if (utterance.length > 1000) return skillResponse("질문이 너무 깁니다. 1,000자 안으로 줄여 보내 주세요.");
    if (overLimit(userId)) return skillResponse(`오늘은 질문을 ${dailyLimit}번 모두 쓰셨습니다. 내일 다시 물어 주세요.`);

    job = start(userId, utterance);

    if (callbackUrl) {
      job.promise.then(async (text) => {
        if (Date.now() - job.at > callbackWindowMs) return; // 시한을 넘긴 답은 「답 보기」로 받는다
        try {
          const r = await fetchFn(callbackUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(skillResponse(text)) });
          if (r.ok) job.shown = true;
          else log(`콜백 실패: HTTP ${r.status}`);
        } catch (e) { log(`콜백 실패: ${e.message}`); }
      });
      return callbackAck("강의 자료를 찾고 있습니다. 1분 안에 답이 오지 않으면 「답 보기」라고 보내 주세요.");
    }

    const text = await Promise.race([job.promise, timeout(waitMs)]);
    if (text === null) return skillResponse("강의 자료를 찾고 있습니다. 20초쯤 뒤에 아래 「답 보기」를 눌러 주세요.", [SHOW]);
    job.shown = true;
    return skillResponse(text);
  };
}
