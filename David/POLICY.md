# David — 다윗의 삶

- **지침(단일 원본):** `docs/policy/다윗의삶_교재_제작지침.md` (바탕: 밀크 말씀판·전체판 지침)
- **근간:** `docs/core/`(밀크 교리 정리 · 교재 집필 정책). 없으면 `docs/doctrine/00_교리_총정리.md`
- **책 단위:** 본책은 강의 1개 = 책 1권 → `다윗의_삶_NN강_말씀판.pdf` + `.epub`. 영어 별권 「영어로 읽는 사무엘기」는 장 순서로 한 권에 이어 붙임 → `다윗의_삶_영어로읽는사무엘기.pdf` + `.epub`
- **작업 원본:** `원본/NN강/`(transcript_raw.txt · lesson.txt), `원본/영어/`, 도구 `원본/tools/`
- **빌드:** `node build_pdf.mjs <원본> out NN` → `verify_pdf.mjs <원본> out/다윗의_삶_NN강_말씀판.pdf NN` → `build_epub.mjs` → `verify_epub.mjs` (지침 §4-3)
- `원본/제작정책.md`는 옛 안내 파일이다. 규칙은 위 지침에만 적는다.
