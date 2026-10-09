# 창세기 1–3장 교재 원본

현재 배포본은 `chapter01.json`–`chapter03.json`의 확정 해설과 `verses_01-03.json`의 표준킹제임스성경 한영 본문을 사용한다. `chapter_extras.py`에는 장별 문제·답안, FAQ와 요약 구성이 있다. 근거 항목에는 원본 파일·쪽수·인용 부분·확정 상태·기존 영상 주소를 보존한다.

재생성은 저장소 루트에서 다음 순서로 실행한다. Python은 Codex 번들 Python의 절대 경로를 사용하고 `-X utf8` 옵션을 준다. Node 패키지는 기존 `%TEMP%/topicbook/node_modules`에서 읽으며 설치·캐시를 저장소에 만들지 않는다.

1. `node Genesis/원본/verify_chapter_pdfs.mjs qr`
2. 번들 Python으로 `Genesis/원본/build_chapters.py` 실행
3. 번들 Python으로 `Genesis/원본/verify_chapters.py` 실행
4. `node Genesis/원본/verify_chapter_pdfs.mjs check`
5. `tools/check_epub.mjs`를 의존성이 있는 임시 런타임에 복사해 완성본 EPUB 3개 검사
6. PDF 페이지 PNG와 EPUB 렌더링을 확인한다. PDF 검사용 이미지는 `%TEMP%/genesis-chapters-20261010`에 생성된다.

`prepare_chapters.py`와 `review_chapters.py`는 원문 추출·근거 확정 단계의 스크립트다. 전자는 바탕화면의 기존 해설 PDF가 필요하며 장별 JSON을 덮어쓰므로 확정 원본으로 다시 빌드할 때 실행하지 않는다. 기존 자료의 오류 수정은 `corrections.json`에 있다.

## 이전 1장 샘플의 기록

2026-10-10 승인된 샘플. 바탕화면 원본 PDF는 변경하지 않는다.

- `sample.json`: 10개 단락, 37개 해설 문단, 41개 출처 연결의 기록. 출처 PDF의 실제 쪽수, 해당 쪽의 글자, 기존 구간 주소와 선택 이유를 보존한다.
- `verses.json`: 저장소 `tools/kjv.mjs --json "창세기 1:1-31"`로 가져온 표준킹제임스성경 한영대역 31절. 본문은 수정하지 않는다.
- `prepare_sample.py`: 원본 PDF의 5-21쪽에서 해설을 추출한다.
- `extract_sources.mjs`, `match_sources.py`: 관련 교재 17권의 글자와 링크를 읽고 문단별 근거 후보를 찾는다. 자동 점수는 확정 근거가 아니다.
- `review_sources.py`: 검토한 근거 쪽과 기존 구간 링크의 명시적 대응표. PDF의 다음 소제목 링크가 같은 쪽에 있다고 선택하지 않는다. 본문 앞쪽에 있는 실제 해당 소제목을 확인한다.
- `build_sample.py`: PDF와 텍스트형 EPUB을 함께 만든다. EPUB에는 인쇄용 QR을 넣지 않고 클릭 링크를 사용한다.
- `verify_sample.py`: 한영 본문, 해설 문단, 두 형식의 주소 목록, EPUB 목차 fragment를 검사한다.
- `qr_render_verify.mjs`: PDF의 모든 QR을 300dpi로 실제 판독하고 주소와 비교한다. PDF 내부 목차 연결을 검사하고 전체 페이지를 저장소 밖에 렌더링한다.
- `content-check.json`, `pdf-check.json`: 최종 검사 결과.

## 환경과 재생성

Python은 Codex 번들 Python(reportlab, pypdf 포함)을 사용한다. Windows 맑은 고딕과 Times New Roman을 PDF에 사용한다. Node의 mupdf, qrcode, jsqr는 기존 `%TEMP%/topicbook/node_modules`에서 읽기 전용으로 로드한다. 런타임, QR 이미지, 페이지 PNG와 색인은 `%TEMP%/genesis-sample-20261010`에 보관한다.

확정 원본 `sample.json`으로 다시 빌드할 때 후보 추출과 재검토는 필요 없다. 아래를 순서대로 실행한다.

1. `node Genesis/원본/qr_render_verify.mjs qr C:/BibleStudy`
2. 번들 Python으로 `Genesis/원본/build_sample.py` 실행
3. 번들 Python으로 `Genesis/원본/verify_sample.py` 실행
4. `node Genesis/원본/qr_render_verify.mjs verify C:/BibleStudy`
5. 기존 `tools/check_epub.mjs`를 의존성이 있는 임시 런타임에서 실행
6. 최종 PDF 페이지 이미지 시각 점검

## 구간의 의미와 한계

연결한 22개 출처 항목은 18개의 서로 다른 구간을 사용한다. 출처 PDF의 소제목·답안 등에 이미 실린 주소를 그대로 재사용했다. 영상에서 문장 시작 시각을 새로 측정한 것이 아니며 영상 재생·삭제·접근 가능 여부도 실제 재생 검사하지 않았다. 관련 Theme PDF 중 영상 주소가 없는 자료는 교재 쪽수만 제공한다.
