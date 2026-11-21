# Milk — 밀크(MILK) · 하나님 말씀의 기초원리

> **EPUB 제작 중단(사용자 지시 2026-11-21):** 이 문서의 EPUB 관련 서술(PDF + EPUB, build_epub·verify_epub·check_epub 등)은 효력이 없다. 완성본은 PDF 하나만 만든다 — 단일 원본 `docs/policy/로컬_EPUB_보관정책.md`.

- **지침(단일 원본):** `docs/policy/밀크교재_제작지침_1_전체판.md` (전체판), `docs/policy/밀크교재_제작지침_2_말씀판.md` (말씀판)
- **근간:** `docs/core/`(밀크 교리 정리 · 교재 집필 정책). 없으면 `docs/doctrine/00_교리_총정리.md`, 강별 `docs/doctrine/milkNN.md`
- **책 단위:** 강의 1개 = 책 1권. 파일 `<제목>_밀크N강.pdf` + `.epub` (이 폴더)
- **EPUB:** 완성 PDF에서 `node tools/pdf2epub.mjs Milk/<파일>.pdf`, 검사 `node tools/check_epub.mjs Milk/<파일>.epub` (exit 0)
- PDF를 고치면 EPUB도 다시 만든다.
- **원고(2026-11-21~):** 1~10강(9강은 9-1·9-2 두 권) 모두 원고를 새로 써서 `원본/<책폴더>/`(story.txt·transcript_raw.txt(영상 둘이면 _2)·slides·cover.svg·book.json)에 두고, 주제별 교재 빌드 도구(`첫열매들 성경해석/원본/tools`)로 조판한다. 책 번호 = 강 번호(1~7, 8, 9-1=9, 9-2=10, 10=11), 공통 `원본/book.json`(allowGaps)과 책 폴더 book.json(표지 「제N강」 줄): `node fit.mjs <원본> out N` → `build_pdf.mjs <원본> out N` → `verify_pdf.mjs <원본> <pdf> N` → `audit.mjs <pdf> <toc_pages.json>`. 녹취는 YouTube 한국어 자막(메모리 뱅크 95~107번).
