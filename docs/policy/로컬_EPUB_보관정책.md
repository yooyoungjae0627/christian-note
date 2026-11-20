# EPUB 정책 — 제작 중단 (2026-11-21부터)

> **이 문서가 EPUB에 관한 규칙의 유일한 원본이다.** 다른 지침·POLICY·README·스킬에 남아 있는 「PDF + EPUB」 「verify_epub」 「check_epub」 같은 서술은 2026-11-21부터 효력이 없고, 이 문서가 우선한다. Codex(`AGENTS.md`, `.agents/skills/`)와 Claude Code(`CLAUDE.md`, `.claude/skills/`) 모두에 똑같이 적용한다.

## 1. 새로 만들지 않는다
- **사용자 지시 2026-11-21 「현시간 부로 epub 파일은 제작하지 않는다」**: 모든 시리즈(밀크·다윗·주제별·이이레·창세기·사무엘·열왕기·출애굽기·사사기·욥기·에스겔·에스더·줌 녹화·실시간 받아쓰기 등)에서 교재 완성본은 **PDF 하나만** 만든다.
- `build_epub.mjs`·`verify_epub.mjs`·`check_epub.mjs`·`pdf2epub.mjs`는 돌리지 않는다. 검사·보고는 PDF 쪽(check_story, verify_pdf, audit, QR 판독 등)만 한다.
- 「강의 1개 = 책 1권, PDF + EPUB」은 「강의 1개 = 책 1권, PDF」로 읽는다. 표지·본문 디자인, 영상 구간 이동(QR) 등 PDF 규칙은 그대로다.
- 사용자가 어떤 책의 EPUB을 다시 직접 요청하면 그때만 만든다(그 책 한정).

## 2. 이미 있는 EPUB
- GitHub에 이미 올라간 EPUB은 지우지 않는다(지우라는 지시가 없음). 다시 빌드하지도 않는다.
- 로컬 작업 트리에는 EPUB을 두지 않는다. 새 복제본에서 한 번:

```powershell
git sparse-checkout set --no-cone '/*' '!*.[eE][pP][uU][bB]'
```

- 교재 작업 전 `git sparse-checkout list`로 위 두 패턴을 확인한다. 로컬 정리를 위해 추적 중인 EPUB을 `git rm` 하거나 삭제 변경을 커밋하지 않는다.

## 3. 작업 종료
저장소 루트에서 다음 결과가 0이고 `git status --short`에 EPUB 변경이 없어야 한다.

```powershell
(Get-ChildItem -LiteralPath . -Recurse -Force -File -Filter '*.epub' -ErrorAction Stop | Measure-Object).Count
```

## 바뀐 내력
| 날짜 | 지시 | 결과 |
|---|---|---|
| 2026-11-21 | 「현시간 부로 epub 파일은 제작하지 않는다는 것이 정책 업데이트 해서 코덱스, 클로드 코드 전부 적용시켜」 | EPUB 제작 중단. 이 문서를 EPUB 규칙의 단일 원본으로 바꾸고, CLAUDE.md·AGENTS.md·README·각 시리즈 지침·POLICY·스킬 머리에 이 문서를 가리키는 줄을 넣음 |
| (이전) | 로컬 EPUB 보관 정책 | 로컬에는 EPUB을 두지 않고 GitHub에만 보관 — §2·§3으로 남김 |
