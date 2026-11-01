"""녹화 음성을 한국어로 받아써 시각 포함 .srt로 저장한다(faster-whisper, 무료·오픈소스, CPU).
사용: python3 tools/zoom/transcribe.py <음성.wav|.m4a|.mp4> <출력.srt> [모델=medium]
 - 모델 이름(small/medium/large-v3) 또는 이미 받아 둔 모델 폴더 경로.
 - 모델 이름을 주면 huggingface.co에서 내려받는다 → 클라우드 세션은 그 주소가 네트워크 설정에서 허용돼야 한다.
 - 결과는 고치지 않는다(오인식 그대로). 이어서: node tools/zoom/vtt2raw.mjs <출력.srt> > transcript_raw.txt
 - 진행은 10분 단위로 찍는다.
"""
import sys, time


def ts(s):
    ms = int(round(s * 1000)); h, ms = divmod(ms, 3600000); m, ms = divmod(ms, 60000); sec, ms = divmod(ms, 1000)
    return f"{h:02}:{m:02}:{sec:02},{ms:03}"


def main():
    if len(sys.argv) < 3:
        print(__doc__); sys.exit(2)
    src, out = sys.argv[1], sys.argv[2]
    model_name = sys.argv[3] if len(sys.argv) > 3 else "medium"
    from faster_whisper import WhisperModel
    try:
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception as e:  # 모델을 받을 수 없을 때 — 지어서 채우지 않고 멈춘다
        print(f"모델을 불러오지 못함({model_name}): {e}\n"
              "클라우드 세션이면 환경 네트워크 설정에서 huggingface.co를 허용하거나, 받아 둔 모델 폴더 경로를 셋째 인자로 주세요.",
              file=sys.stderr)
        sys.exit(3)
    t0 = time.time()
    segs, info = model.transcribe(src, language="ko", beam_size=5, vad_filter=True,
                                  condition_on_previous_text=False)
    n, mark = 0, 600
    with open(out, "w", encoding="utf-8") as f:
        for s in segs:
            text = s.text.strip()
            if not text:
                continue
            n += 1
            f.write(f"{n}\n{ts(s.start)} --> {ts(s.end)}\n{text}\n\n")
            if s.end >= mark:
                print(f"  {int(s.end // 60)}분까지 ({int(time.time() - t0)}초 경과)", file=sys.stderr, flush=True)
                mark += 600
    print(f"transcribe: {n}구간, 길이 {info.duration / 60:.1f}분, {int(time.time() - t0)}초 걸림 → {out}", file=sys.stderr)


if __name__ == "__main__":
    main()
