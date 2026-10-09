# 다윗의 삶 — 빌드 도구

한 권(`다윗의_삶_말씀판.pdf` + `.epub`)에 강을 계속 이어 붙인다. 정책: `../../제작정책.md`.

## 새 강 더하기
1. `원본/NN강/transcript_raw.txt` — 받은 녹취록 그대로.
2. `원본/NN강/lesson.txt` — 다듬은 원고(아래 형식). 1강 파일을 본보기로.
3. 아래 "빌드"를 돌리고, 검사 두 개가 exit 0인지 확인한 뒤 바탕화면에 덮어쓴다.

## lesson.txt 형식 (한 줄 = 한 항목, `|` 구분)
- `@lesson|번호|제목|본문 범위|유튜브ID|날짜|강사|원 강의 제목`
- `@ch|번호|장 제목|부제` — 번호 `0`=시작하며, `end`=마치며
- `@sec|소제목|시각` — 시각은 녹취록의 `m:ss`
- `@p|시각|문단` — 시각은 그 문단이 시작하는 녹취록 줄. 순서가 거꾸로면 빌드가 멈춘다
- `@verse|머리|구절 // 다음 절|출처` — 말씀 상자. `//`는 절 나눔
- `@note|용어|설명` — 용어 상자(그 문단 바로 아래)
- `@summary|한 줄` — 한눈에 보는 N강 이야기. `**굵게**`
- `@gloss|용어|설명` — 용어·인물 풀이에만 싣는 핵심 용어
- 강조: `{1:중요}` `{2:더 중요}` `{3:핵심 명제}`

## 빌드 (이 PC: Python 없음, Node + Edge 명령줄 인쇄)
OneDrive 안에 node_modules를 두지 않는다. 작업 폴더를 따로 만들어 쓴다.
```
mkdir %TEMP%\dw && cd %TEMP%\dw && npm init -y && npm i qrcode mupdf jsqr pngjs jszip fast-xml-parser
copy "<원본>\tools\*" .
node build_pdf.mjs  "<원본>" out main    && node verify_pdf.mjs  "<원본>" out\다윗의_삶_말씀판.pdf main
node build_epub.mjs "<원본>" out main    && node verify_epub.mjs "<원본>" out\다윗의_삶_말씀판.epub main
node build_pdf.mjs  "<원본>" out english && node verify_pdf.mjs  "<원본>" out\다윗의_삶_킹제임스영어강의.pdf english
node build_epub.mjs "<원본>" out english && node verify_epub.mjs "<원본>" out\다윗의_삶_킹제임스영어강의.epub english
```
- Edge는 원격 제어(puppeteer)가 막혀 있어 `--print-to-pdf`/`--screenshot` 명령줄을 쓴다. Claude Code 샌드박스 안에서는 Edge가 바로 종료되므로 샌드박스 밖에서 실행해야 한다.
- 차례 쪽 번호: 제목마다 보이지 않는 표식(@@id@@)을 넣어 찍고, 표식이 나온 쪽을 읽어 다시 찍는다(값이 안 바뀔 때까지).
- verify_pdf: 모든 QR을 300dpi로 판독해 링크와 비교, 영상ID, 빠진 링크, 표지 밖 이미지 0장.
- verify_epub: mimetype(첫 항목·무압축), XML 문법, 내부 이동·영상 링크, 원고와 문단·말씀 상자·용어 상자·강조 수 일치, mupdf로 열림.

## 추가 형식 (2026-10-02)
- lesson.txt
  - `@ch|bg|이야기의 무대와 시대|부제` — 강 첫머리. 그 아래 `@sec|소제목|`(시각 비움), `@p|-|글`(시각 대신 `-`)
  - `@map|land` `@map|gibeah` — 지도(tools/maps.mjs에 정의)
  - `@years|머리1|머리2|머리3` 다음 줄들 `@yr|연도|사건|성경`, `@yearnote|주석` — 연표. 사건이 `★`로 시작하면 강조 줄
  - `@verse|머리|본문|출처|언급` — 다섯째 칸 `언급`이면 "강의에서 언급한 구절"(점선)
- english.txt (+ kjv_en.json): `@g|문법 소제목` `@gp|설명` `@ge|영문 예|우리말`, `@w|단어|뜻|나온 절`, `@en|1 Samuel 18:1|사무엘기상 18:1` `@c|청크|직독직해` `@pt|구문 포인트`
- kjv_en.json은 bible-api.com(translation=kjv)에서 받은 KJV 원문. 청크를 이은 문장이 이것과 다르면 빌드가 멈춘다.
- 추가 npm 패키지: 없음(pngjs는 이미 설치 목록에 있음)
- (2026-10-02 개정) 영어 강의 원고는 세 파일로 나눈다.
  - english.txt: `@w` 필수 단어, `@en`·`@c` 직독직해 청크
  - grammar.txt: `@g|제N강의 — 제목` `@gp|강의 문단({1:}~{3:} 강조)` `@gs|영어 / 영어|역할 / 역할` `@gx|흔히 틀리는 점` `@gq|질문|답`
  - syntax.txt: `@ref|1 Samuel 18:1` 다음에 `@sk|영어 / 영어|역할 / 역할`(1개 이상) `@ex|구문 강의 문단`(1개 이상)
  - 역할 칸이 "주어…"면 파랑, "동사·조동사…"면 빨강, "목적어·보어·대상"이면 초록, 나머지는 회색 칩.
- (2026-10-02) 영어 강의는 별권(english). modern.txt: `@m|킹제임스 청크(글자 그대로)|현대 영어`, `@w|필수 단어|현대 영어`. 고어가 남은 청크에 @m이 없으면 빌드가 멈춘다.

## 영어 별권 「영어로 읽는 사무엘기」 (2026-10-02 새 형태)
- 원고: `원본/영어/사무엘상_NN.txt` + 본문 `원본/영어/bsb_1sa_NN.json` (curl https://bible.helloao.org/api/BSB/1SA/N.json)
- 새 장 더하기: 위 json을 받고, 같은 형식으로 사무엘상_NN.txt를 쓴 뒤 빌드. 청크를 이은 문장이 BSB와 다르면 빌드가 멈춘다.
- 추가 npm 패키지: jpeg-js
```
node build_samuel_pdf.mjs  "<원본>" out
node build_samuel_epub.mjs "<원본>" out
node verify_samuel.mjs "<원본>" out다윗의_삶_영어로읽는사무엘기.pdf out다윗의_삶_영어로읽는사무엘기.epub
```
- 작업 폴더에 tools/fonts/도 함께 복사한다(칠판 글꼴).
- build_pdf.mjs·build_epub.mjs의 english 볼륨(킹제임스)은 더 이상 쓰지 않는다. 본책은 main만 빌드한다.
