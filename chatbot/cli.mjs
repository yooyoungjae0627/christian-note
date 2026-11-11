// 카카오톡 없이 터미널에서 챗봇을 시험한다.
//   node chatbot/cli.mjs "징계와 가시는 어떻게 다른가요?"        ← AI 답(ANTHROPIC_API_KEY 필요)
//   node chatbot/cli.mjs --search 1순위 "징계 가시"              ← 검색만(키 없이). tier: 교리|1순위|2순위|3순위
import path from "path";
import { fileURLToPath } from "url";
import { loadCorpus, TIERS } from "./src/corpus.mjs";
import { buildIndex, search, formatHits } from "./src/search.mjs";
import { buildSystem } from "./src/prompt.mjs";
import { answer } from "./src/agent.mjs";
import { plain, splitBubbles } from "./src/kakao.mjs";
import { verses } from "../tools/kjv.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const index = buildIndex(loadCorpus(ROOT));

if (args[0] === "--search") {
  const [tier, query] = args.length >= 3 ? [args[1], args[2]] : ["1순위", args[1]];
  if (!TIERS.includes(tier) || !query) { console.error(`쓰는 법: node chatbot/cli.mjs --search <${TIERS.join("|")}> "낱말"`); process.exit(2); }
  console.log(formatHits(search(index, query, { tier, k: 4 })));
} else if (args[0]) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    console.error("ANTHROPIC_API_KEY가 없습니다. 검색만 해 보려면: node chatbot/cli.mjs --search 1순위 \"낱말\"");
    process.exit(2);
  }
  const r = await answer({ question: args[0], system: buildSystem(ROOT), index, getVerse: verses });
  splitBubbles(plain(r.text)).forEach((b, i) => console.log(`\n── 말풍선 ${i + 1} (${b.length}자) ──\n${b}`));
  console.error(`\n[${r.turns}턴 · 입력 ${r.usage.input} · 캐시 읽기 ${r.usage.cacheRead} · 출력 ${r.usage.output} 토큰]`);
} else {
  console.error("쓰는 법: node chatbot/cli.mjs \"질문\"   |   node chatbot/cli.mjs --search 1순위 \"낱말\"");
  process.exit(2);
}
