# 장별 해설서 2판 도구 — 원고 형식과 작업 순서

규칙 원본: [docs/policy/장별해설서_제작지침.md](../../docs/policy/장별해설서_제작지침.md) · 근거 순위: [docs/policy/성경해석_지침.md](../../docs/policy/성경해석_지침.md).
이 문서는 **원고(JSON)를 어떻게 쓰고 검사하는지**만 적는다. 규칙이 어긋나면 지침이 우선한다.
샘플(형식의 본보기): `Genesis/원본/2판/chapter12.json`(1순위 위주), `Samuel/원본/2판/1sam-17.json`(3순위·2순위 위주).

## 1. 작업 순서 (장 하나)

1. 본문 읽기: `node -e "…"`로 `verses-<책>.json`에서 그 장 절을 본다(한글 `ko`, KJV `en`). 현대 영어는 `verses-<책>-web.json`.
2. 근거 찾기(순위대로): `node tools/chapterbook/search.mjs 낱말1 낱말2 … [--only ff|pdf|ext|sbc] [--ctx 120]`
   - ff = 1순위 첫열매들 영상 스크립트, pdf = 1순위 교회 교재 PDF, ext = 2순위 스코필드(장별 md + 1917판 OCR), sbc = 3순위 이이레 「다윗의 삶」.
   - 인물 이름·지명·핵심 낱말·“N장” 등을 여러 개 넣어 본다. 자동 자막이라 비슷한 소리(예: 블레셋/필리스티아, 사무엘기상/사계상)도 찾는다.
   - 걸린 곳은 반드시 앞뒤 줄을 직접 읽고(파일을 열어 그 시각 근처) 그 절을 실제로 말하는지 확인한다.
3. 단락 나누기: 절 1부터 끝 절까지 빠짐없이, 겹치지 않게 4–10개 단락(`sections`).
4. 단락마다 **높은 순위 근거부터** 해설을 쓴다. 1순위가 있는 단락에는 2·3순위를 넣지 않고, 2순위가 있는 단락에는 3순위를 넣지 않는다(검사기가 막는다). 근거가 하나도 없으면 `notes`에 「해설 미수록」 안내를 쓴다.
5. 칠판 표시·이야기·영어 강의·단어장, 인물·관계도·지도, 학습 자료를 채운다.
6. `node tools/chapterbook/fill.mjs <책> <장>` — 강의 근거의 `excerpt`·`url`을 스크립트에서 그대로 채운다.
7. `node tools/chapterbook/check.mjs <책> <장>` — **종료 코드 0**이 될 때까지 고친다.
8. 빌드·시각 검수는 총괄 세션이 한다(`build.mjs`, `render.mjs`).

책 이름: `genesis`, `1sam`, `2sam`. 원고 위치: `Genesis/원본/2판/chapterNN.json`, `Samuel/원본/2판/1sam-NN.json`, `Samuel/원본/2판/2sam-NN.json`.

## 2. 원고 형식

```jsonc
{
 "chapter": 12,
 "subtitle": "아브람을 부르심 — 보여 줄 지역과 이집트의 겁쟁이",   // 표지·장 머리 부제
 "motto": "…",                       // 표지 표어 — motto_comment 해설 text 안에 글자 그대로 있어야 함
 "motto_comment": "g12-1",
 "cover": [{"m": "tent", "x": 110, "y": 278, "s": 0.85}, …],   // 표지 선 그림(art.mjs MOTIFS). 340×350 판 안의 좌표. 2–5개
 "people": [{"id": "abram", "name": "아브람", "en": "Abram", "gen": 1, "role": "god|enemy"(선택), "desc": "본문·해설 근거 안의 1–2문장", "refs": ["12:4"]}],
 "relations": [{"from": "abram", "to": "sarai", "type": "spouse|parent|sibling|kin|ruler|enemy|god|other", "label": "아내", "ref": "12:5", "directed": false}],
 "map": {"places": [{"key": "haran", "ref": "12:4", "name"?: "본문 표기"}], "routes": [{"path": ["haran", "shechem"], "ref": "12:4-6"}],
         "views"?: [{"title": "① …", "keys": [...], "minSpan"?: 0.55}], "minSpan"?: 0.5,
         "unknown": [{"name": "모레의 평야", "ref": "12:6", "note": "…"}]},
 "sections": [{
   "ref": "12:1-3", "title": "단락 제목",
   "marks": [{"v": "12:1", "t": "u|y|g|p|b", "ko": "한글 본문 글자 그대로(그 절에 한 번만 나오는 조각)", "en": "같은 뜻의 KJV 글자 그대로"}],
   "story": "이야기로 읽기 3–6문장. 그 단락 본문이 말한 사건만 쉬운 말로(고2–3 수준, ~습니다).",
   "english": [{"ref": "12:1", "phrase": "KJV 글자 그대로", "grammar": "문법 이름", "text": "풀이(현대 영어와 비교 가능)", "key"?: "g12-4"}],   // 1–3개
   "vocab": [{"w": "kindred", "ko": "친족", "ref": "12:1"}],   // 3–8개, 그 절 KJV에 실제로 있는 낱말
   "comments": [{
     "id": "g12-1",                    // 창세기 gNN-번호, 사무엘상 sNN-번호, 사무엘하 tNN-번호 (장 안에서 고유)
     "basis": "direct|linked|doctrine|external|sbc",
     "text": "해설 문단(쉬운 이야기체, 근거가 말한 범위 안에서만)",
     "spans": [{"text": "text 안에 정확히 한 번 나오는 조각", "level": 1|2|3}],   // 0–3개
     "quote": false,
     "evidence": [
       {"type": "transcript", "source": "첫열매들 예배 「강의 제목」", "file": "memory-bank/첫열매들_강의스크립트/…md", "time": "22:42", "to": "23:34"},
       {"type": "transcript", "source": "이이레 목사 「다윗의 삶」 N편 「제목」(사무엘상 N장 강의)", "file": "Samuel/강의스크립트/…md", "time": "…", "to": "…"},
       {"type": "pdf", "source": "예배 강의 「제목」", "file": "Theme/23_겁쟁이들의_하나님.pdf", "pages": [19], "excerpt": "그 쪽 글자 그대로(조각은 \n…\n 으로)", "url": null},
       {"type": "external", "author": "C. I. 스코필드", "source": "스코필드 관주 해설(1917) …", "where": "Gen. 12:10 주석", "file": "memory-bank/세대주의_해설/scofield/genesis-12.md 또는 scofield_1917_archive_ocr.txt", "excerpt": "영어 원문 그대로(조각은 \n…\n)", "url": "확인한 주소"}
     ]}],
   "notes": ["(근거가 없을 때) …을 풀이한 근거를 찾지 못했습니다. 본문만 싣습니다."]
 }],
 "learning": {
   "summary": [{"text": "…", "key": "g12-1"} | {"text": "…", "verse": "12:4"}],   // 12–22
   "questions": [{"key": "g12-1", "q": "…", "a": "…"} | {"verse": "12:4", "q": "…", "a": "본문 글자에 있는 낱말(쉼표로 여러 개)"}],   // 25–41
   "faq": [{"q": "…", "key": "g12-1"}],   // 12–14, 답 = 그 해설 문단
   "glossary": [{"term": "…", "key"|"verse": "…", "text": "…"}]
 }
}
```

## 3. 쓰는 법의 핵심

- **지어내지 않는다.** 해설은 근거 원문이 말한 것만. 일반 신학·주석·역사 지식, 기억 속 인용으로 채우지 않는다. 쉬운 말로 바꿔 쓰는 것은 되지만 뜻을 보태지 않는다.
- 강의 근거의 시각은 스크립트 md 파일의 줄 시각 그대로(`time`=시작 줄, `to`=끝 줄). 해설 문단이 말하는 내용이 그 구간 안에 다 들어 있어야 한다.
- 2순위(external)는 교회 교리(밀크 정리 `docs/doctrine/`)와 어긋나지 않는 대목만. `scofield/<책>-NN.md`에 없으면 1917판 OCR(`scofield_1917_archive_ocr.txt`)에서 `search.mjs 낱말 --only ext`로 찾는다. OCR 잡음이 없는 깨끗한 조각만 excerpt로. url은 장별 md는 그 md의 주소, OCR은 `https://archive.org/details/scofieldreferenc00unse`.
- 3순위(sbc)는 사무엘상 16장–사무엘하 24장 강의가 대부분이다. 다른 장 강의에서 인용한 대목이면 `source`에 “(사무엘상 N장 강의)”로 출처 맥락을 남긴다.
- 칠판 표시 색: u 밑줄=중요, y 노랑=하나님의 말씀·약속·언약·명령, g 초록=믿음·순종·은혜·구원, p 분홍=죄·불순종·심판·경고, b 하늘=예표(근거가 예표라고 할 때만). 한 절 최대 3곳, ko·en 한 쌍.
- 지도 지명 key는 `tools/chapterbook/places.json`에 있으면 그대로 쓴다. **places.json은 고치지 않는다**(여러 장을 동시에 작업하므로). 없는 지명은 위치가 널리 알려진 곳이면 원고의 `map.places`에 `{"key":"새키","name":"본문 표기","at":[경도,위도],"ref":"…"}`처럼 대략 좌표를 직접 주고, 학설이 갈리거나 모르면 `unknown`에 적는다. 지명이 몰리면 `views`로 전체·확대를 나눈다.
- 관계도: 같은 세대(gen)를 같은 줄에, 줄 안 순서는 관계가 있는 사람끼리 이웃하게 `people` 순서를 정한다. 관계 낱말은 짧게(2–6자).
- 고유 명사는 표준킹제임스 표기(예: 필리스티아인, 쇼코흐, 에크론, 이집트, 하이).
- 문체: 출판용 이야기체, 고2–3 독해 수준, 짧은 문장, 존댓말.
