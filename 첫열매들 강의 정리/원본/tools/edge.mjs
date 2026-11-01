// Edge 명령줄 도우미(이 PC의 Edge는 puppeteer 원격 제어를 막아 명령줄을 쓴다. Claude Code 샌드박스 밖에서 실행할 것)
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

// Windows는 Edge, 리눅스(클라우드 세션)는 Chromium으로 대신한다. BROWSER 환경 변수로 직접 지정할 수도 있다.
export const EDGE = [process.env.BROWSER, "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe", "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell", "/usr/bin/chromium", "/usr/bin/google-chrome"].filter(Boolean).find(fs.existsSync);
const LINUX = process.platform === "linux";
const wait = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const url = (f) => { const p = path.resolve(f).split(path.sep).join("/"); return "file://" + (p.startsWith("/") ? "" : "/") + p; };
const base = (tag) => [...(LINUX ? ["--no-sandbox"] : []), "--headless=new", "--mute-audio", "--no-first-run", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files", "--user-data-dir=" + path.join(os.tmpdir(), `tb_edge_${tag}_${process.pid}`)];

// 파일이 다 써질 때까지 기다린다(Edge가 실행기만 먼저 끝내는 경우가 있다)
function waitFile(f) {
  let last = -1;
  for (let i = 0; i < 240; i++) {
    const sz = fs.existsSync(f) ? fs.statSync(f).size : -1;
    if (sz > 0 && sz === last) return;
    last = sz;
    wait(500);
  }
  throw new Error("Edge 결과 파일이 없음: " + f);
}

export function edgePrint(htmlFile, pdfFile) {
  if (fs.existsSync(pdfFile)) fs.rmSync(pdfFile);
  execFileSync(EDGE, [...base("p"), "--no-pdf-header-footer", "--virtual-time-budget=20000", "--run-all-compositor-stages-before-draw", "--print-to-pdf=" + path.resolve(pdfFile), url(htmlFile)], { stdio: "ignore", timeout: 240000 });
  waitFile(pdfFile);
}

export function edgeShot(htmlFile, pngFile, width, height, scale = 1) {
  if (fs.existsSync(pngFile)) fs.rmSync(pngFile);
  execFileSync(EDGE, [...base("s"), `--force-device-scale-factor=${scale}`, `--window-size=${width},${height}`, "--virtual-time-budget=8000", "--screenshot=" + path.resolve(pngFile), url(htmlFile)], { stdio: "ignore", timeout: 120000 });
  waitFile(pngFile);
}
