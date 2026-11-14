#!/bin/bash
# dl.sh <pick.json> <videoId> <outdir> <병렬수>
PJ=$1; ID=$2; OUT=$3; P=${4:-4}
export PATH="$TEMP/books_e/bin:$PATH"
mkdir -p "$OUT"; cd "$OUT"
node -e 'const p=require(process.argv[1]);const s=new Set();for(const v of Object.values(p))for(const t of v.times)s.add(t);console.log([...s].sort((a,b)=>a-b).join("\n"))' "$PJ" > times.txt
rm -f part_*; split -n r/$P times.txt part_
for f in part_??; do
  ( args=(); while read t; do [ -f "$t.mp4" ] && continue; args+=(--download-sections "*$((t-1))-$((t+3))"); done < $f
    [ ${#args[@]} -gt 0 ] && yt-dlp.exe --js-runtimes node -f 299 "${args[@]}" -o "%(section_start)s.%(ext)s" --no-progress -q "https://www.youtube.com/watch?v=$ID" > $f.log 2>&1
    echo "done $f" ) &
done
wait
ls *.mp4 | wc -l
