#!/usr/bin/env bash
# 클라우드 세션(리눅스) 준비: 한글 글꼴, 빌드 의존성, 받아쓰기 엔진. Windows 기기에서는 쓰지 않는다.
# 사용: bash tools/cloud_setup.sh   (다 되면 /tmp/topicbook/.ready 생김, 1~2분)
# 빌드: /tmp/topicbook에 도구를 복사해 실행(cp "첫열매들 강의 정리/첫열매들 성경해석/tools/"* /tmp/topicbook/).
#       Edge 대신 headless Chromium을 쓴다(edge.mjs가 알아서 고름).
set -u
[ "$(uname -s)" = "Linux" ] || { echo "리눅스 전용"; exit 0; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
TB=/tmp/topicbook; mkdir -p "$TB"; rm -f "$TB/.ready"
ok=1

# 1) 한글 글꼴 — print.css의 "Noto Sans KR"·"Noto Serif KR" (Google Fonts 정적 TTF, npm으로 받는다)
if ! fc-list | grep -q "Noto Serif KR"; then
  for p in noto-sans-kr noto-serif-kr; do
    d=$(mktemp -d)
    (cd "$d" && npm pack -s "@expo-google-fonts/$p" >/dev/null && tar xzf ./*.tgz) \
      && mkdir -p ~/.local/share/fonts/$p && cp "$d"/package/*/*.ttf ~/.local/share/fonts/$p/ || ok=0
    rm -rf "$d"
  done
  fc-cache -f >/dev/null
fi
fc-list | grep -q "Noto Sans KR" && echo "글꼴 OK" || { echo "글꼴 실패"; ok=0; }

# 2) 빌드 의존성 — 저장소 밖 임시 폴더(Windows의 %TEMP%\topicbook과 같은 방식)
cp "$REPO/tools/package.json" "$TB/" && (cd "$TB" && npm i -s --no-audit --no-fund >/dev/null 2>&1) \
  && echo "npm OK" || { echo "npm 실패"; ok=0; }

# 3) 받아쓰기 엔진(모델은 처음 쓸 때 huggingface.co에서 받는다 — 네트워크 설정에서 허용 필요)
python3 -c "import faster_whisper" 2>/dev/null || pip3 install -q faster-whisper >/dev/null 2>&1
python3 -c "import faster_whisper" 2>/dev/null && echo "faster-whisper OK" || { echo "faster-whisper 실패"; ok=0; }
command -v ffmpeg >/dev/null && echo "ffmpeg OK" || { echo "ffmpeg 없음"; ok=0; }

if [ $ok = 1 ]; then touch "$TB/.ready"; echo "준비 완료: $TB"; else echo "준비 일부 실패 — 위 기록 확인"; exit 1; fi
