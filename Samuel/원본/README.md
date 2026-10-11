# 사무엘상 1–15장 교재 원본

규칙 원본: [docs/policy/사무엘상_교재_제작지침.md](../../docs/policy/사무엘상_교재_제작지침.md) (형식·디자인은 창세기 지침을 따름).

| 파일 | 내용 |
|---|---|
| `verses_01-15.json` | `node tools/kjv.mjs --json "사무엘상 N:1-M"`으로 받은 표준킹제임스성경 한영대역 383절. 고치지 않는다. |
| `chapterNN.json` | 장별 원고(해설·근거·학습 자료). 아래 형식. |
| `search.mjs` | Theme·Milk PDF 쪽 글자와 강의 스크립트 전체에서 낱말 찾기. `node Samuel/원본/search.mjs 한나 언약궤` |
| `check_content.mjs` | 빌드 전 원고 검사. `node Samuel/원본/check_content.mjs 1 2 3` → 종료 코드 0이어야 한다. |
| `build_samuel.py` 등 | PDF·EPUB 빌드와 검사(창세기 도구를 사무엘상용으로 옮김). |

## chapterNN.json 형식

```json
{
  "chapter": 1,
  "title": "사무엘상 1장",
  "subtitle": "한나의 절망과 기도, 사무엘의 출생",            // 표지·장 머리의 부제
  "motto": "사람은 무너져야 합니다.",                          // 표지 표어 — motto_comment 해설 문장 안에 그대로 있어야 함
  "motto_comment": "s1-3",
  "sections": [
    {
      "ref": "1:1-8",                                         // 절 범위. 단락들이 1절~끝 절을 빠짐없이 한 번씩 덮어야 함
      "title": "한나의 슬픔",
      "comments": [
        {
          "id": "s1-1",                                       // s장-번호, 장 안에서 고유
          "text": "해설 문단(존댓말 ~습니다).",
          "spans": [{"text": "해설 안의 정확히 한 번 나오는 구절", "level": 2}],   // 강조 1·2·3단계, 문단당 0~3개
          "quote": false,                                     // 교재 문장을 거의 그대로 옮긴 인용 문단이면 true
          "basis": "direct",                                  // direct | linked | doctrine (지침 표 참고)
          "evidence": [
            {"type": "pdf", "source": "예배 강의 「절망」", "file": "Theme/25_절망.pdf", "pages": [42],
             "excerpt": "그 쪽 글자 그대로(여러 조각은 \n…\n 으로 이음)", "url": null,
             "review": "왜 이 근거인지 한두 문장"},
            {"type": "transcript", "source": "다윗의 삶 24편 「인생의 마지막 장」(사무엘상 31장 강의)",
             "file": "Samuel/강의스크립트/24_사무엘상31장_인생의_마지막_장.md", "time": "10:41",
             "excerpt": "그 시각 줄부터 이어지는 자막 원문 그대로(오인식 포함)",
             "url": "https://youtu.be/SaJZZlyM4J4?t=641", "review": "…"}
          ]
        }
      ],
      "notes": ["(해설이 없는 절이 있으면) 1:4-5를 풀이한 교회 강의·교재 내용과 연결할 교리를 찾지 못했습니다. 본문만 싣습니다."]
    }
  ],
  "learning": {
    "summary":   [{"text": "요약 문장", "key": "s1-1"}, {"text": "본문 요약 문장", "verse": "1:20"}],   // 12–22개
    "questions": [{"key": "s1-1", "q": "해설에 근거한 문제", "a": "답"},
                  {"verse": "1:2", "q": "엘카나의 두 아내의 이름은?", "a": "한나, 프닌나"}],       // 25–41개
    "faq":       [{"q": "예상 질문", "key": "s1-1"}],                                               // 12–14개, 답 = 그 해설 문단
    "glossary":  [{"term": "실로", "key": "s1-2", "text": "풀이"}, {"term": "나실인", "verse": "1:11", "text": "본문이 말하는 대로의 풀이"}]
  }
}
```

- 본문 확인 문제(`verse`)의 답은 그 절의 표준킹제임스 본문 글자에 있어야 한다(쉼표·가운뎃점으로 나눈 낱말마다 검사). 본문 표기를 그대로 쓴다(예: 엘카나, 프닌나, 피느하스, 필리스티아인).
- 해설 안에서 성경 구절을 인용하면 `verses_01-15.json`(그 장) 또는 `node tools/kjv.mjs`의 글자 그대로 쓴다.
