// 등장인물 관계도(벡터 SVG). 지도와 같은 방식으로 PDF에는 SVG, EPUB에는 PNG로 들어간다.
const F = `font-family="Noto Sans KR, sans-serif"`;
const C = { ink: "#18233f", gold: "#c9973b", red: "#c0392b", green: "#2f7d4f", pink: "#c2577a", grey: "#8a8a8a", phil: "#7a4b2a" };

// 인물 상자: 가운데 (x, y), 이름과 한 줄 설명
function node(x, y, name, sub, { w = 74, fill = "#ffffff", stroke = C.ink, bold = true, star = false } = {}) {
  const h = sub ? 30 : 20;
  return `<g><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="${star ? 2 : 1.1}"/>
  <text x="${x}" y="${y + (sub ? -2 : 4)}" ${F} font-size="10.5" font-weight="${bold ? 700 : 500}" fill="${C.ink}" text-anchor="middle">${name}</text>
  ${sub ? `<text x="${x}" y="${y + 10}" ${F} font-size="8.2" fill="#555" text-anchor="middle">${sub}</text>` : ""}</g>`;
}
// 관계선: 점 목록을 잇고 끝에 화살표. 글씨는 (lx, ly)에 흰 바탕을 깔고 쓴다.
function edge(pts, color, label, lx, ly, { dash = "", both = false, width = 1.4, anchor = "middle", size = 8.4 } = {}) {
  const id = color.replace("#", "");
  const line = `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ""} marker-end="url(#a${id})" ${both ? `marker-start="url(#a${id})"` : ""}/>`;
  const lines = label.split("\n");
  const tw = Math.max(...lines.map((l) => l.length)) * size * 0.92 + 6, th = lines.length * size * 1.25 + 3;
  const bx = anchor === "middle" ? lx - tw / 2 : anchor === "start" ? lx - 3 : lx - tw + 3;
  const txt = lines.map((l, i) => `<tspan x="${lx}" dy="${i ? size * 1.25 : 0}">${l}</tspan>`).join("");
  return `${line}<rect x="${bx}" y="${ly - size - 1}" width="${tw}" height="${th}" rx="2" fill="#fbf8f1" opacity=".95"/><text x="${lx}" y="${ly}" ${F} font-size="${size}" fill="${color}" font-weight="700" text-anchor="${anchor}">${txt}</text>`;
}
const marker = (color) => `<marker id="a${color.replace("#", "")}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;

function people1() {
  const W = 380, H = 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="map people" role="img" aria-label="1강 등장인물 관계도">
  <defs>${Object.values(C).map(marker).join("")}</defs>
  <rect width="${W}" height="${H}" fill="#fbf8f1"/>
  <!-- 무리 표시 -->
  <rect x="8" y="128" width="182" height="168" rx="8" fill="#eef3f8" stroke="#c9d6e6"/>
  <text x="16" y="142" ${F} font-size="8" fill="#5a7397" font-weight="700">사울 왕가 · 기브아 궁정</text>
  <rect x="246" y="256" width="126" height="96" rx="8" fill="#f6ece4" stroke="#e2cdbd"/>
  <text x="254" y="270" ${F} font-size="8" fill="${C.phil}" font-weight="700">블레셋</text>

  <!-- 하나님: 다윗과 함께하심 / 사울을 떠나심 -->
  ${edge([[205, 38], [300, 104]], C.green, "함께하심\n18:12·14·28", 262, 52, { width: 2, anchor: "end" })}
  ${edge([[175, 38], [95, 150]], C.red, "떠나심 ✕\n16:14 · 18:12", 112, 82, { dash: "4 3", width: 1.6 })}
  <!-- 사무엘의 기름 부음 -->
  ${edge([[66, 66], [80, 138]], C.grey, "기름 부음\n10장", 46, 104, { dash: "2 2", size: 8.0 })}
  ${edge([[84, 52], [262, 112]], C.gold, "기름 부음(16:13)", 180, 74, { size: 8.2 })}
  <!-- 이새 - 다윗 -->
  ${edge([[340, 66], [325, 104]], C.grey, "막내아들", 377, 90, { size: 8.0, anchor: "end" })}
  <!-- 사울 → 다윗 -->
  ${edge([[128, 158], [262, 132]], C.red, "질투 · 두려움 · 창을 던짐\n딸을 미끼로 한 계략(18:8-25)", 196, 162, { width: 1.8 })}
  <!-- 요나단 ↔ 다윗 -->
  ${edge([[78, 226], [252, 202], [284, 142]], C.gold, "언약 · 혼같이 사랑\n겉옷과 칼을 줌(18:1-4)", 166, 196, { both: true, width: 2 })}
  <!-- 미갈 → 다윗 -->
  ${edge([[166, 276], [300, 142]], C.pink, "사랑 → 아내(18:20·27)", 228, 236, { size: 8.2 })}
  <!-- 메랍 → 아드리엘 -->
  ${edge([[110, 290], [110, 318]], C.grey, "아내로 감(18:19)", 116, 308, { anchor: "start", size: 8.0 })}
  <!-- 사울 가족선 -->
  <polyline points="90,172 90,212 46,212 46,222" fill="none" stroke="${C.ink}" stroke-width="1"/>
  <polyline points="90,212 110,212 110,262" fill="none" stroke="${C.ink}" stroke-width="1"/>
  <polyline points="90,212 158,212 158,262" fill="none" stroke="${C.ink}" stroke-width="1"/>
  <text x="64" y="208" ${F} font-size="6.6" fill="#555">자녀</text>
  <!-- 아브넬 -->
  ${edge([[203, 112], [258, 116]], C.grey, "데려옴(17:57)", 232, 104, { size: 7.8 })}
  <!-- 다윗 → 블레셋 -->
  ${edge([[318, 148], [300, 286]], C.phil, "쓰러뜨림(17장)\n포피 이백(18:27)", 340, 210, { size: 8.0, anchor: "middle" })}

  ${node(190, 26, "주(하나님)", "", { w: 84, fill: "#fff7d6", stroke: C.gold, star: true })}
  ${node(60, 52, "사무엘", "선지자", { w: 62 })}
  ${node(322, 52, "이새", "다윗의 아버지 · 베들레헴", { w: 112 })}
  ${node(165, 112, "아브넬", "사울의 군대 장관", { w: 74 })}
  ${node(90, 160, "사울", "이스라엘의 첫 왕", { w: 76, star: true })}
  ${node(300, 126, "다윗", "이새의 막내 · 목동", { w: 84, fill: "#fff7d6", stroke: C.gold, star: true })}
  ${node(46, 236, "요나단", "사울의 맏아들", { w: 62 })}
  ${node(110, 276, "메랍", "사울의 맏딸", { w: 54 })}
  ${node(162, 276, "미갈", "사울의 작은딸", { w: 54 })}
  ${node(110, 332, "아드리엘", "므홀랏 사람", { w: 62 })}
  ${node(286, 298, "골리앗", "가드의 거인", { w: 60, stroke: C.phil })}
  ${node(326, 330, "아기스", "가드 왕(21장)", { w: 70, stroke: C.phil })}
  ${node(348, 298, "통치자들", "18:30", { w: 48, stroke: C.phil, bold: false })}
</svg>`;
  return { svg, caption: "1강 등장인물 관계도 — 가운데 화살표 두 개가 1강의 핵심입니다. 주께서 다윗과 함께하시고(초록) 사울에게서 떠나셨습니다(빨간 점선). 사울의 질투와 계략, 요나단의 언약, 미갈의 사랑이 모두 다윗을 향합니다." };
}

export const PEOPLE = { people1 };
