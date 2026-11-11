// 답 글 다듬기. 웹 화면은 답을 보통 글(줄바꿈 + 누를 수 있는 주소)로 보여 주므로
// 모델이 마크다운을 섞어 썼을 때 깨져 보이는 표시를 걷어낸다.
export function plain(text) {
  return text
    .replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, "$1 $2")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^(\s*)[*•]\s+/gm, "$1- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
