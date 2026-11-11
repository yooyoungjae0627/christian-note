// 카카오 i 오픈빌더 스킬 요청·응답 형식(스킬 응답 v2.0).
// 말풍선(simpleText) 하나는 1,000자까지, 한 응답에 말풍선은 세 개까지.
export const BUBBLE_MAX = 950;
export const BUBBLE_COUNT = 3;
const CUT_NOTE = "\n\n(답이 길어 여기까지만 보냅니다. 질문을 나누어 다시 물어 주세요.)";

export function parseRequest(body) {
  const u = body?.userRequest ?? {};
  return {
    utterance: typeof u.utterance === "string" ? u.utterance.trim() : "",
    userId: String(u.user?.id ?? ""),
    callbackUrl: typeof u.callbackUrl === "string" && u.callbackUrl.startsWith("https://") ? u.callbackUrl : null,
  };
}

// 모델이 마크다운을 섞어 썼을 때를 대비해 카카오톡에서 깨져 보이는 표시를 걷어낸다.
export function plain(text) {
  return text
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 $2")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\s*)[*•]\s+/gm, "$1- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 줄 경계에서만 자른다(주소가 중간에 끊기지 않게). 한 줄이 상한보다 길면 낱말 경계에서 자른다.
export function splitBubbles(text, max = BUBBLE_MAX, count = BUBBLE_COUNT) {
  const pieces = [];
  for (const line of text.split("\n")) {
    if (line.length <= max) { pieces.push(line); continue; }
    let cur = "";
    for (const w of line.split(" ")) {
      if (cur && cur.length + 1 + w.length > max) { pieces.push(cur); cur = w; }
      else cur = cur ? cur + " " + w : w;
      while (cur.length > max) { pieces.push(cur.slice(0, max)); cur = cur.slice(max); }
    }
    if (cur) pieces.push(cur);
  }
  const bubbles = [];
  let cur = "";
  for (const p of pieces) {
    if (cur && cur.length + 1 + p.length > max) { bubbles.push(cur.trim()); cur = p; }
    else cur = cur ? cur + "\n" + p : p;
  }
  if (cur.trim()) bubbles.push(cur.trim());
  if (bubbles.length <= count) return bubbles;
  const kept = bubbles.slice(0, count);
  kept[count - 1] = kept[count - 1].slice(0, max - CUT_NOTE.length).trimEnd() + CUT_NOTE;
  return kept;
}

export function skillResponse(text, quickReplies = []) {
  const template = { outputs: splitBubbles(plain(text)).map((t) => ({ simpleText: { text: t } })) };
  if (quickReplies.length) {
    template.quickReplies = quickReplies.map((label) => ({ label, action: "message", messageText: label }));
  }
  return { version: "2.0", template };
}

// 콜백을 쓸 때 5초 안에 먼저 돌려주는 응답. 진짜 답은 나중에 callbackUrl로 보낸다.
export const callbackAck = (text) => ({ version: "2.0", useCallback: true, data: { text } });
