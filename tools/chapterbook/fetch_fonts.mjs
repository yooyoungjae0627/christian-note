// 굵기별 정적 Noto 폰트(TrueType) 받기 — Google Fonts(SIL Open Font License). 저장소 밖 %TEMP%/chapterbook2/fonts에 둔다(커밋하지 않음).
// Edge(Skia) PDF는 TrueType만 글꼴로 묻고, 가변 폰트의 굵기 변형과 CFF(OTF) 글꼴은 Type3(글자 그림)로 넣어 용량이 커진다.
//   node tools/chapterbook/fetch_fonts.mjs   (사용자 승인 2026-10-12)
import fs from "node:fs";
import path from "node:path";
import { TMP } from "./lib.mjs";
const D = path.join(TMP, "fonts"); fs.mkdirSync(D, { recursive: true });
const css = await (await fetch("https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Noto+Serif+KR:wght@400;700", { headers: { "user-agent": "Wget/1.21" } })).text();
const NAME = { "Noto Sans KR": "NotoSansKR", "Noto Serif KR": "NotoSerifKR" };
for (const m of css.matchAll(/font-family: '([^']+)';[\s\S]*?font-weight: (\d+);[\s\S]*?src: url\(([^)]+\.ttf)\)/g)) {
  const f = path.join(D, `${NAME[m[1]]}-${m[2]}.ttf`); if (fs.existsSync(f)) continue;
  const r = await fetch(m[3]); if (!r.ok) throw new Error(m[3] + " HTTP " + r.status);
  fs.writeFileSync(f, Buffer.from(await r.arrayBuffer())); console.log(path.basename(f), fs.statSync(f).size);
}
console.log("fonts:", D);
