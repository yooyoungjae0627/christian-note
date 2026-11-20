# 2026-11-21 이이레 2권 「AI, 마지막 때의 바벨탑인가」 · EPUB 제작 중단

## 한 일
- 정책: 사용자 지시 「현시간 부로 epub 파일은 제작하지 않는다 … 코덱스, 클로드 코드 전부 적용」.
  - `docs/policy/로컬_EPUB_보관정책.md`를 EPUB 규칙의 단일 원본으로 다시 씀(새로 만들지 않음, 기존 EPUB은 지우지 않음, 로컬 0개 유지).
  - CLAUDE.md·AGENTS.md 절대 규칙(PDF 하나), 각 시리즈 지침·POLICY·README·스킬(.claude/.agents) 머리에 배너.
  - 하네스: `build_epub.mjs`·`tools/pdf2epub.mjs`는 ALLOW_EPUB=1 없으면 exit 3, chapterbook build/verify는 EPUB을 건너뜀. 실제 실행으로 exit 3 확인.
- 책: 이이레 목사 특강 「[특강] 바벨탑 평행이론과 재림의 임박성」(ye5paStTA1s) → `이이레 목사 성경 해석/AI_마지막_때의_바벨탑인가.pdf`(92쪽, QR 62개). 바탕화면에도 복사.
  - check_story exit 0(녹취 660줄), verify_pdf exit 0, audit exit 0(공란 80% 미만 12쪽).

## 배운 것
- 이 영상은 카메라 구도상 TV 화면 오른쪽·위쪽이 프레임 밖이라 screen_crop 방식(좌우 대칭·글자 잘림 없음)이 불가능 → 만든 그림 14장 + 표준킹제임스 구절 상자. POLICY.md에 규칙으로 남김.
- 브라우저 창이 숨겨져 있으면 setTimeout이 늦어져 스캔이 10배 느려짐 → seeked 이벤트만 기다리고 타이머를 빼면 빨라짐.
- 유튜브 페이지를 다시 열면 광고(video.duration 64초)가 끼어 seek가 안 먹음 → .ad-showing 확인 후 광고 끝으로 넘김.
- `figs.mjs <원본>`은 원본 폴더의 모든 책 그림을 다시 찍는다 → 다른 책(팔복) slides가 바뀜. git checkout으로 되돌림. 하네스 개선 대상(책 지정 인자).
- 만든 그림의 `.title`(오른쪽 위 절대 위치)은 center_fit --check에 걸림 → 제목을 흐름 안 `.chip`으로.
