// 이야기 한 개 원고 검사: node check_story.mjs <이야기폴더>
// 녹취록 모든 줄이 문단 하나에만, 그림 한 번씩, 뒷부분 분량, 강조 괄호, 태그 형식(빌드와 같은 검사). 만든 그림은 figs/NN.html만 있어도 된다.
process.env.FIGS_OK = "1";
const { parseStory, inline } = await import("./parse.mjs");
const dir = process.argv[2];
try {
  const S = parseStory(dir);
  const blocks = S.chapters.flatMap((c) => [...c.blocks, ...c.secs.flatMap((s) => s.blocks)]);
  const n = (t) => blocks.filter((b) => b.t === t).length;
  [...S.quiz, ...S.faq].forEach((q) => { inline(q.q); inline(q.a); });
  if (S.vid === "" && /유튜브|QR/.test(S.storynotes.join(" ")) === false) console.log("  (참고) 영상 링크 없는 이야기 — 안내문 @storynote 확인");
  console.log(`정상: ${S.n}번째 이야기 「${S.title}」 | 녹취록 ${S.transcriptLines}줄 | 강의 ${Math.max(1, S.lectures.length)}개 | 장 ${S.chapters.length} | 문단 ${n("p")} | 그림 ${n("img")} | 말씀 상자 ${n("verse")} | 용어 ${n("note")} | 요약 ${S.summary.length} | 문제 ${S.quiz.length} | 질문 ${S.faq.length}`);
} catch (e) {
  console.log("실패:\n" + e.message);
  process.exit(1);
}
