# 로컬 EPUB 보관 정책

이 프로젝트의 로컬 작업 폴더에는 PDF와 원고를 보관한다. GitHub에는 검증한 PDF와 EPUB을 모두 보관한다. 이 정책은 모든 시리즈와 샘플, Codex와 Claude Code 작업에 적용한다.

## 작업 시작

새 로컬 복제본에서 아래 명령을 한 번 실행한다. 이 설정은 해당 작업 트리에 유지되며 이후 pull과 브랜치 전환에도 적용된다.

```powershell
git sparse-checkout set --no-cone '/*' '!*.[eE][pP][uU][bB]'
```

교재 작업 전에는 `git sparse-checkout list`로 위 두 패턴을 확인한다. 다른 sparse 설정이 있는 작업 트리에서는 기존 범위를 유지하면서 EPUB 제외 패턴을 마지막에 추가한다. 로컬 정리를 위해 추적 중인 EPUB을 git rm 하거나 삭제 변경을 커밋하지 않는다.

## 교재 빌드와 작업 종료

시리즈 지침대로 두 형식을 제작하고 검사한다. EPUB 배포 시 해당 파일만 명시해 `git add --sparse -- "경로/교재.epub"`로 스테이징하고 커밋한 뒤 `git sparse-checkout reapply`를 실행한다. 미커밋 원고나 수정된 EPUB이 있으면 먼저 변경 상태를 확인한다.

추적되지 않는 임시 EPUB과 샘플 EPUB은 검수·배포가 끝나면 정리한다. 별도 임시 빌드 폴더에 이번 작업이 생성한 EPUB도 정리한다. 저장소 루트에서 다음 명령의 결과가 0이고 `git status --short`에 EPUB 삭제가 없는지 확인한다.

```powershell
(Get-ChildItem -LiteralPath . -Recurse -Force -File -Filter '*.epub' -ErrorAction Stop | Measure-Object).Count
```
