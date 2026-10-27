# Milk — 밀크(MILK) · 하나님 말씀의 기초원리

- **지침(단일 원본):** `docs/policy/밀크교재_제작지침_1_전체판.md` (전체판), `docs/policy/밀크교재_제작지침_2_말씀판.md` (말씀판)
- **근간:** `docs/core/`(밀크 교리 정리 · 교재 집필 정책). 없으면 `docs/doctrine/00_교리_총정리.md`, 강별 `docs/doctrine/milkNN.md`
- **책 단위:** 강의 1개 = 책 1권. 파일 `<제목>_밀크N강.pdf` + `.epub` (이 폴더)
- **EPUB:** 완성 PDF에서 `node tools/pdf2epub.mjs Milk/<파일>.pdf`, 검사 `node tools/check_epub.mjs Milk/<파일>.epub` (exit 0)
- PDF를 고치면 EPUB도 다시 만든다.
