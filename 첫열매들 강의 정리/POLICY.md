# Theme — 성경 주제별 교재

- **지침(단일 원본):** `docs/policy/성경주제별_교재_제작지침.md` + 바탕 `docs/policy/밀크교재_제작지침_1_전체판.md`
- **근간:** `docs/core/`(밀크 교리 정리 · 교재 집필 정책). 없으면 `docs/doctrine/00_교리_총정리.md`
- **책 단위:** 첫열매들 예배 강의 1개 = 책 1권. 파일 `NN_이름.pdf` + `NN_이름.epub` (이 폴더)
- **작업 원본:** `원본/NN_이름/`(story.txt · transcript_raw.txt · figs · slides), 도구 `원본/tools/` (사용법 `원본/tools/README.md`)

## 새 강의가 오면
1. 다음 번호로 `원본/NN_이름/` 만들고 녹취록·슬라이드를 넣는다.
2. story.txt를 쓰고 `node check_story.mjs 원본/NN_이름` exit 0.
3. 그 책만 빌드·검사: `fit.mjs` → `build_pdf.mjs <원본> out NN` → `verify_pdf.mjs` → `build_epub.mjs` → `verify_epub.mjs` → `audit.mjs`.
4. PDF·EPUB을 이 폴더에 저장하고 커밋·푸시.
