# 첫열매들 성경 해석 챗봇 (웹 채팅)

성도가 웹 채팅 화면(브라우저, 앱의 웹뷰)에서 성경·교리를 물으면, 이 저장소에 모아 둔 첫열매들 강의와 교리 정리에서 찾아 **강의 제목·분:초 링크와 함께** 답하는 서버입니다.

- **규칙은 새로 만들지 않았습니다.** 답하는 순서와 근거의 순위는 [`docs/policy/성경해석_지침.md`](../docs/policy/성경해석_지침.md), 옳고 그름의 기준은 [`docs/doctrine/00_교리_총정리.md`](../docs/doctrine/00_교리_총정리.md)입니다. 챗봇은 이 문서들(과 `memory-bank/이단_판정/`)을 그대로 읽어 따릅니다. 문서를 고치면 챗봇도 바뀝니다.
- **AI를 다시 학습시키는 방식(파인튜닝)이 아닙니다.** Claude가 질문마다 저장소 자료를 찾아 읽고 답합니다. 새 강의 스크립트를 `memory-bank/`에 넣으면 그 강의도 답에 쓰이고, 답마다 출처를 확인할 수 있습니다.

## 답하는 방식 세 가지 (`CHATBOT_BACKEND`)

| 값 | 무엇으로 답하나 | 언제 |
|---|---|---|
| `claude-code` | **개인 Claude Code 구독**(Pro/Max 로그인). 서버에서 `claude -p`를 저장소 폴더에서 실행해 자료를 직접 찾아 읽게 한다. 읽기·찾기와 `node tools/kjv.mjs`만 허용 | **본인 혼자 시험하는 프로토타입** |
| `api` | Claude API 키(`ANTHROPIC_API_KEY`, 쓴 만큼 요금). 서버 안의 검색 도구로 자료를 찾는다 | 성도들에게 열 때 |
| `search` | AI 없이 관련 강의 대목 3개와 시각 링크만 보여 준다 | 키도 로그인도 없을 때(기본값) |

> **`claude-code` 방식은 본인 시험용입니다.** Anthropic은 구독 계정으로 다른 사용자들의 요청을 대신 처리하는 것을 허용하지 않습니다([Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)). 성도들에게 주소를 나눌 때는 `api` 방식으로 바꿉니다. 화면과 나머지 코드는 그대로이고 환경 변수만 바뀝니다.

## 시험해 보기

Node 20 이상. Windows에서는 저장소가 OneDrive 안에 있으므로 `node_modules`를 저장소 안에 두지 않으려면 OneDrive 밖에 저장소를 따로 받아 실행합니다.

```bash
cd chatbot
npm install
npm test                                                     # 테스트 8개 (키·로그인 없이 돈다)
node cli.mjs --search 1순위 "징계 가시"                       # 검색만
node cli.mjs --claude-code "징계와 가시는 어떻게 다른가요?"    # 개인 Claude Code 구독으로 답 (claude 로그인 필요)
ANTHROPIC_API_KEY=sk-ant-... node cli.mjs "성령은 누구신가요?"  # API 키로 답
```

## 서버 실행

```bash
CHATBOT_BACKEND=claude-code CHATBOT_ACCESS_CODE=1234 node chatbot/src/server.mjs
# → http://localhost:8787 을 브라우저(또는 앱의 웹뷰)로 연다
```

| 환경 변수 | 뜻 | 기본값 |
|---|---|---|
| `CHATBOT_BACKEND` | `claude-code` · `api` · `search` (위 표) | 키가 있으면 `api`, 없으면 `search` |
| `ANTHROPIC_API_KEY` | `api` 방식의 Claude API 키. 저장소에 올리지 않는다. (`claude-code` 방식에서는 쓰지 않고, 있어도 넘기지 않는다) | 없음 |
| `CHATBOT_ACCESS_CODE` | 인증 번호. 화면에서 처음 한 번 넣으면 그 브라우저에 기억된다. 비우면 주소를 아는 누구나 쓴다 | 없음 |
| `CHATBOT_DAILY_LIMIT` | 한 사람(접속 주소)의 하루 질문 수 | 30 |
| `CHATBOT_DAILY_TOTAL` | 서버 전체의 하루 질문 수(비용·사용량 보호) | 300 |
| `CHATBOT_MODEL` | 모델. `api` 방식 기본값은 `claude-opus-5-5`, `claude-code` 방식은 Claude Code의 설정을 따른다 | — |
| `CHATBOT_EFFORT` | `api` 방식의 생각 깊이(`low`·`medium`·`high`) | `low` |
| `CHATBOT_TRUST_PROXY` | nginx 같은 프록시 뒤에 둘 때 `1` (접속 주소를 `X-Forwarded-For`에서 읽는다) | 꺼짐 |
| `CLAUDE_BIN` | `claude` 실행 파일 경로 | `claude` |
| `PORT` | 포트 | 8787 |

### 개인 서버(AWS 등)에 올릴 때

1. 저장소 전체를 받고 `cd chatbot && npm install`.
2. `claude-code` 방식이면 서버에 Claude Code를 설치하고 본인 계정으로 로그인해 둔다(`claude`를 한 번 실행). Claude Code의 공식 요구 사양은 **메모리 4GB 이상**이다 — 1GB짜리 무료 서버(t3.micro)에서는 뜨지 않을 수 있다.
3. `get_verse`·`node tools/kjv.mjs`는 `kingjamesbiblekorea.com`에 접속하므로 그 사이트로 나가는 접속이 열려 있어야 한다. 막혀 있으면 챗봇은 본문 없이 장절만 적는다.
4. 인터넷에 열 때는 https(예: nginx + 인증서) 뒤에 두고 `CHATBOT_ACCESS_CODE`를 꼭 건다.
5. 자료를 새로 넣었으면 `git pull` 뒤 서버를 다시 켠다(`api`·`search` 방식은 켤 때 자료를 읽어 둔다. `claude-code` 방식은 질문마다 파일을 직접 읽으므로 다시 켜지 않아도 된다).

## 구조

```
웹 화면(web/index.html) ──POST /api/chat──▶ src/server.mjs ─▶ src/app.mjs   인증 번호·하루 횟수·대화 이어 가기
                                                                │
                              ┌─────────────────────────────────┼──────────────────────────┐
                              ▼                                 ▼                          ▼
                    src/claudecode.mjs                    src/agent.mjs              (search 방식)
                    claude -p (저장소에서                  Claude API + 도구            src/search.mjs
                    Grep·Read·kjv.mjs)                    search / get_verse
```

| 파일 | 하는 일 |
|---|---|
| `web/index.html` | 채팅 화면 한 장(휴대폰 우선, 어두운 화면 지원). 답은 글로만 넣고 주소만 링크로 바꾼다 |
| `src/server.mjs` | HTTP 서버 — `GET /`, `GET /api/info`, `POST /api/chat` |
| `src/app.mjs` | 요청 처리 흐름 |
| `src/claudecode.mjs` | 개인 Claude Code로 답하기(`claude -p`) |
| `src/agent.mjs` | Claude API로 답하기(도구 루프) |
| `src/prompt.mjs` | 두 방식의 시스템 프롬프트(지침·교리 문서를 가리키거나 그대로 싣는다 + 답 형식) |
| `src/corpus.mjs`, `src/search.mjs` | 자료를 조각으로 나누고 낱말로 찾기(BM25, 한글 두 글자 단위) — `api`·`search` 방식에서 쓴다 |
| `cli.mjs` | 터미널에서 시험 |
| `test/` | 테스트 |

## 알아 둘 것

- **검수.** AI가 정리한 답입니다. "자료에 없으면 없다고 말한다", 출처 링크를 지침대로 걸어 두었지만, 다른 사람에게 열기 전에 자주 나올 질문 20~30개를 돌려 보고 답을 검수하는 것을 권합니다. 화면 머리에도 "비공식 도우미, 링크의 강의 원문으로 확인"이라고 나갑니다.
- **교회의 허락.** 강의 영상과 교재의 저작권은 교회에 있습니다. 성도들에게 나누기 전에 교회에 알리고 허락을 받는 것이 좋습니다.
- **답하는 시간.** `claude-code` 방식은 질문 하나에 40~50초쯤 걸렸습니다(2026-11-11 시험 두 번). 화면에는 그동안 "강의 자료를 찾고 있습니다"가 보입니다.
- **개인 정보.** 질문 글은 답을 만들기 위해 Claude(Anthropic)로 보내집니다. 서버 기록에는 질문 글을 남기지 않고 걸린 시간·토큰 수만 남깁니다. 대화는 30분 동안만 이어 갑니다. (`claude-code` 방식에서는 Claude Code가 자기 세션 기록을 서버의 `~/.claude/`에 남깁니다.)
- **2순위.** 저장소에 보관된 스코필드 관주 해설(영어 원문)만 씁니다. 무디·라킨·럭크만은 보관본이 없어 인용하지 않습니다.
- **`api`·`search` 방식의 검색 범위.** 밀크 교재 원문(`source_text/`)과 완성된 교재 원고는 검색 조각에 넣지 않았습니다. 필요하면 `src/corpus.mjs`에 더합니다.
