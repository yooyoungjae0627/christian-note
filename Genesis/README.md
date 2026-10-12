# 창세기 장별 해설서 (2판)

성도 유영재 교재. 창세기 1–50장을 장마다 PDF와 고정 배치 EPUB 한 권씩 냈다(`창세기_NN장_교재.pdf·.epub`). 2026-10-12 제작.

- 규칙: [장별 해설서 제작지침(2판)](../docs/policy/장별해설서_제작지침.md) · 근거 순위: [성경 해석 지침](../docs/policy/성경해석_지침.md)
- 원고: [원본/2판/](원본/2판/) `chapterNN.json` — 도구·형식은 [tools/chapterbook/README.md](../tools/chapterbook/README.md)
- 다시 만들기: `node tools/chapterbook/check.mjs genesis all` → `node tools/chapterbook/build.mjs genesis 1 2 …` → `node tools/chapterbook/verify.mjs genesis all`
- 1판 원고·도구(`원본/chapterNN.json`, Python 빌더)는 기록으로 남겨 두었다.
