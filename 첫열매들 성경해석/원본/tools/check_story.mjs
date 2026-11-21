// 이야기 한 개 원고 검사: node check_story.mjs <이야기폴더>
// 녹취록 모든 줄이 문단 하나에만, 그림 한 번씩, 뒷부분 분량, 강조 괄호, 태그 형식(빌드와 같은 검사). 만든 그림은 figs/NN.html만 있어도 된다.
process.env.FIGS_OK = "1";
const { parseStory, inline } = await import("./parse.mjs");
const dir = process.argv[2];
try {
  const S = parseStory(dir);
  const blocks = S.chapters.flatMap((c) => [...c.blocks, ...c.secs.flatMap((s) => s.blocks)]);
  const n = (t) => blocks.filter((b) => b.t === t).length;
  [...S.quiz, ...S.faq].forEach((q) => { inline(q.q); inline(q.a); });
  if (S.vid === "" && /유튜브|QR/.test(S.storynotes.join(" ")) === false) console.log("  (참고) 영상 링크 없는 이야기 — 안내문 @storynote 확인");
  // 책에 넣는 그림은 내용이 그림 가운데에 와야 한다(사용자 지시 2026-11-14 「pdf 파일에 넣는 이미지는 … 중앙을 기준으로 딱 아구가 맞아야」)
  const { readdirSync, existsSync } = await import("fs");
  const { execFileSync } = await import("child_process");
  const { join, dirname } = await import("path");
  const { fileURLToPath } = await import("url");
  const sd = join(dir, "slides");
  if (existsSync(sd)) {
    // 정리한 사람이 만든 그림(figs/NN.html → slides/NN.jpg)은 검사하지 않는다 — 제목 칩·출처 위치가 정해진 슬라이드 디자인(사용자 결정 2026-11-21 「Exempt made pictures」)
    const madeFig = (f) => existsSync(join(dir, "figs", f.replace(/\.(jpe?g|png)$/i, ".html")));
    const imgs = readdirSync(sd).filter((f) => /\.(jpe?g|png)$/i.test(f) && !madeFig(f)).map((f) => join(sd, f));
    if (imgs.length) {
      try { execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), "center_fit.mjs"), "--check", ...imgs], { stdio: "pipe" }); }
      catch (e) {
        const out = String(e.stdout || "") + String(e.stderr || "");
        throw new Error("그림 가운데 맞춤 검사(center_fit --check) 실패 — 내용이 그림 가운데에 오도록 다시 만드세요:\n" + out.split("\n").filter((l) => l.startsWith("✗") || /Error|Cannot/.test(l)).join("\n"));
      }
    }
  }
  // 예상 질문 중복 금지(사용자 지시 2026-11-21 「중복 검사도 정책으로 넣어」): 같은 책 안에서 두 질문이 거의 같거나
  // (글자 두 개씩 묶음 겹침 85% 이상) 두 답이 같은 내용을 되풀이하면(50% 이상) 실패. 비슷한 질문은 합치거나 강의의 다른 요점으로 답한다.
  {
    const big = (s) => { const t = String(s).replace(/[^가-힣A-Za-z0-9]/g, ""), o = new Set(); for (let i = 0; i < t.length - 1; i++) o.add(t.slice(i, i + 2)); return o; };
    const sim = (a, b) => { const A = big(a), B = big(b); let k = 0; for (const x of A) if (B.has(x)) k++; return k / Math.max(1, Math.min(A.size, B.size)); };
    const dup = [];
    for (let i = 0; i < S.faq.length; i++) for (let j = i + 1; j < S.faq.length; j++) {
      const q = sim(S.faq[i].q, S.faq[j].q), a = sim(S.faq[i].a, S.faq[j].a);
      if (q >= 0.85 || a >= 0.5) dup.push(`  ${i + 1}번 「${S.faq[i].q}」 ↔ ${j + 1}번 「${S.faq[j].q}」 (질문 ${Math.round(q * 100)}% · 답 ${Math.round(a * 100)}%)`);
    }
    if (dup.length) throw new Error("예상 질문 중복 — 합치거나 강의의 다른 요점으로 답을 바꾼다:\n" + dup.join("\n"));
  }
  // 강의 스크립트·타임스탬프는 메모리 뱅크에도 있어야 한다(사용자 지시 2026-11-21 「책 집필 … 하면 해당 강의 스크립트와 타임스탬프
  // 전부 메모리뱅크 업데이트」, 규칙 원본 README §3). 영상ID를 가진 책은 그 영상ID가 적힌 스크립트 파일이 있어야 통과.
  const vids = [...new Set([S.vid, ...S.lecVids].filter(Boolean))];
  if (vids.length) {
    const { readFileSync, statSync } = await import("fs");
    let repo = dir;
    while (repo && !existsSync(join(repo, "memory-bank"))) { const up = dirname(repo); if (up === repo) { repo = ""; break; } repo = up; }
    repo = repo || process.env.CN_REPO || "";
    if (!repo) throw new Error("메모리 뱅크를 찾을 수 없음 — 저장소 안의 원고로 검사하거나 CN_REPO=<저장소 경로>를 준다");
    const roots = ["memory-bank/첫열매들_강의스크립트", "memory-bank/이이레_강의스크립트", "사무엘상·하/강의스크립트"].map((r) => join(repo, r)).filter(existsSync);
    const mds = [];
    const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".md") && f !== "README.md") mds.push(p); } };
    roots.forEach(walk);
    const missing = vids.filter((v) => !mds.some((p) => readFileSync(p, "utf8").includes(v)));
    if (missing.length) throw new Error(`메모리 뱅크에 강의 스크립트 없음(영상 ${missing.join(", ")}) — 받은 스크립트 전부를 줄마다 시각 링크와 함께 memory-bank/첫열매들_강의스크립트/ 또는 memory-bank/이이레_강의스크립트/에 넣는다(README §3)`);
  }
  console.log(`정상: ${S.n}번째 이야기 「${S.title}」 | 녹취록 ${S.transcriptLines}줄 | 강의 ${Math.max(1, S.lectures.length)}개 | 장 ${S.chapters.length} | 문단 ${n("p")} | 그림 ${n("img")} | 말씀 상자 ${n("verse")} | 용어 ${n("note")} | 요약 ${S.summary.length} | 문제 ${S.quiz.length} | 질문 ${S.faq.length}`);
} catch (e) {
  console.log("실패:\n" + e.message);
  process.exit(1);
}
