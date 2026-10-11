"""사무엘상 1–15장 표지 선 그림: 창세기 표지와 같은 색·틀, 장마다 그 장을 상징하는 그림 하나.
십자가·하나님 얼굴·사람 얼굴은 그리지 않는다(docs/policy/창세기_교재_제작지침.md, 사무엘상 지침)."""
HEAD='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 350"><defs><radialGradient id="glow"><stop stop-color="#fff7d0" stop-opacity=".45"/><stop offset="1" stop-color="#fff7d0" stop-opacity="0"/></radialGradient></defs><ellipse cx="170" cy="140" rx="112" ry="92" fill="url(#glow)"/>'
LINE='<g fill="none" stroke="#e8c983" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'
THIN='<g fill="none" stroke="#b9c5d7" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
DOT='<g fill="#f6e3a5">'
END='</g>'
def svg(*parts):return HEAD+''.join(parts)+'</svg>'
GROUND=THIN+'<path d="M24 300Q170 276 316 300"/>'+END
def drops(points,r=4):return DOT+''.join(f'<path d="M{x} {y-r*2.2}C{x+r} {y-r*.6} {x+r} {y+r} {x} {y+r}C{x-r} {y+r} {x-r} {y-r*.6} {x} {y-r*2.2}Z"/>' for x,y in points)+END
def lamp(x,y,s=1):
 return (LINE+f'<path d="M{x-34*s} {y}Q{x} {y+26*s} {x+34*s} {y}Q{x+10*s} {y-8*s} {x-34*s} {y}Z"/><path d="M{x+34*s} {y}L{x+52*s} {y-10*s}"/><path d="M{x-28*s} {y+4*s}Q{x-46*s} {y+2*s} {x-44*s} {y-10*s}"/>'+END
  +DOT+f'<path d="M{x+52*s} {y-12*s}C{x+60*s} {y-30*s} {x+50*s} {y-42*s} {x+54*s} {y-56*s}C{x+40*s} {y-40*s} {x+42*s} {y-24*s} {x+52*s} {y-12*s}Z"/>'+END)
CHAPTER_ART={
# 1: 성전 문설주 곁의 기도 — 두 기둥, 등잔, 떨어지는 눈물
1:svg(LINE,'<path d="M92 290V120M248 290V120M80 120H260M86 108H254M92 290H120M220 290H248"/><path d="M104 120V290M236 120V290"/>',END,
 lamp(160,224,.9),drops([(150,150),(170,170),(190,146)],4.2),GROUND),
# 2: 높아진 뿔과 떠오르는 빛 — "내 뿔이 주 안에서 높아졌으며"(2:1)
2:svg(LINE,'<path d="M118 262C140 230 160 196 196 150C214 128 236 108 252 76"/><path d="M146 268C166 236 186 206 214 170C230 150 246 126 258 82"/><path d="M118 262Q132 276 146 268"/><path d="M252 76Q258 70 258 82"/>',END,
 THIN,''.join(f'<path d="M{170+int(70*c)} {120-int(70*s)}L{170+int(92*c)} {120-int(92*s)}"/>' for c,s in [(1,0),(.87,.5),(.5,.87),(0,1),(-.5,.87),(-.87,.5),(-1,0)]),END,
 DOT,'<circle cx="252" cy="76" r="5"/></g>',GROUND),
# 3: 꺼지지 않은 하나님의 등불과 밤에 들린 부르심
3:svg(THIN,'<path d="M262 56A26 26 0 1 0 284 96A20 20 0 1 1 262 56Z"/>',END,
 DOT,''.join(f'<circle cx="{x}" cy="{y}" r="2.4"/>' for x,y in [(70,70),(110,48),(150,66),(206,44),(96,104)]),END,
 lamp(150,236,1.15),
 LINE,'<path d="M226 168Q240 182 226 196M240 156Q262 182 240 208M254 144Q284 182 254 220"/>',END,GROUND),
# 4: 메고 나간 궤와 꺾인 창 — 영광이 떠나다
4:svg(LINE,'<path d="M98 196H242V250H98Z"/><path d="M90 196H250"/><path d="M40 222H300"/>',
 '<path d="M120 196C112 168 130 150 156 160M220 196C228 168 210 150 184 160"/>','</g>',
 THIN,'<path d="M70 132L132 92M150 80L196 50"/><path d="M196 50L188 64M196 50L182 54"/><path d="M280 118Q300 96 296 70"/>',END,
 DOT,'<circle cx="170" cy="178" r="5"/></g>',GROUND),
# 5: 궤 앞에 넘어져 부서진 신상
5:svg(LINE,'<path d="M190 168H290V214H190Z"/><path d="M184 168H296"/><path d="M206 168C200 146 216 132 236 140M274 168C280 146 264 132 244 140"/>',END,
 THIN,'<path d="M40 262L132 238L140 264L48 288Z"/><path d="M146 252H176V280H146Z"/><path d="M60 220L86 210L94 230L68 240Z"/><path d="M106 214L122 208"/>',END,
 DOT,'<circle cx="240" cy="154" r="4.6"/></g>',GROUND),
# 6: 젖 나는 암소가 끄는 새 수레 위의 궤, 곧게 뻗은 길
6:svg(THIN,'<path d="M60 300L150 150M280 300L190 150"/><path d="M170 300V286M170 270V256M170 240V226M170 210V198M170 184V174"/>',END,
 LINE,'<path d="M118 180H222V214H118Z"/><path d="M110 214H230"/><circle cx="132" cy="232" r="16"/><circle cx="208" cy="232" r="16"/>',
 '<path d="M136 180C130 160 146 150 162 156M204 180C210 160 194 150 178 156"/><path d="M230 206L272 196"/>',END,
 DOT,'<circle cx="170" cy="168" r="4.4"/></g>'),
# 7: 에벤에셀 — 세운 돌과 우레
7:svg(LINE,'<path d="M146 290V170Q170 146 194 170V290"/><path d="M160 200H180M160 224H180M160 248H180"/>',END,
 THIN,'<path d="M70 92Q96 70 124 88Q150 68 180 86Q212 66 244 88Q270 78 284 96"/>',END,
 LINE,'<path d="M110 100L92 140H112L96 176"/><path d="M246 104L230 138H250L236 170"/>',END,GROUND),
# 8: 왕을 구하는 백성 — 빈 왕관과 그 아래 모인 무리
8:svg(LINE,'<path d="M110 170L124 108L150 144L170 96L190 144L216 108L230 170Z"/><path d="M110 186H230"/>',END,
 DOT,''.join(f'<circle cx="{x}" cy="{y}" r="4.2"/>' for x,y in [(80,250),(104,262),(128,248),(152,264),(176,250),(200,264),(224,248),(248,262),(272,250),(116,284),(164,286),(212,284),(256,282)]),END,
 THIN,'<path d="M150 126L170 116L190 126"/>',END,GROUND),
# 9: 잃은 나귀를 찾아 나선 굽은 길과 산지
9:svg(THIN,'<path d="M20 214L84 140L128 188L190 110L250 176L320 120"/>',END,
 LINE,'<path d="M150 300C110 276 210 254 168 232C130 214 222 200 188 182C164 168 214 156 196 144"/>',END,
 DOT,''.join(f'<circle cx="{x}" cy="{y}" r="3"/>' for x,y in [(160,288),(176,262),(160,240),(186,214),(176,190),(196,160)]),END,
 LINE,'<path d="M236 70l6 12 13 2-10 9 3 13-12-6-12 6 3-13-10-9 13-2Z"/>',END),
# 10: 기름병에서 흘러내리는 기름 — 기름 부음
10:svg(LINE,'<path d="M150 78H190V98Q226 120 226 160Q226 206 170 206Q114 206 114 160Q114 120 150 98Z"/><path d="M146 70H194"/>',
 '<path d="M226 150Q252 160 260 186"/>',END,
 drops([(262,206),(262,236),(262,262)],4.6),
 THIN,'<path d="M200 296Q262 276 324 296"/><path d="M226 286Q262 270 298 286"/>',END,GROUND),
# 11: 성벽의 성읍과 떠오르는 해 — 야베스 길르앗의 구원
11:svg(LINE,'<path d="M60 290V200H92V184H112V200H144V184H164V200H196V184H216V200H248V184H268V200H280V290"/><path d="M150 290V250Q170 230 190 250V290"/>',END,
 THIN,'<path d="M126 150A44 44 0 0 1 214 150"/>'+''.join(f'<path d="M{170+int(56*c)} {150-int(56*s)}L{170+int(72*c)} {150-int(72*s)}"/>' for c,s in [(1,0),(.7,.7),(0,1),(-.7,.7),(-1,0)]),END,
 DOT,'<circle cx="170" cy="150" r="6"/></g>',GROUND),
# 12: 밀 거둘 때 내린 우레와 비
12:svg(THIN,'<path d="M66 96Q92 72 122 90Q150 70 182 88Q214 68 246 90Q272 80 286 100"/>',
 ''.join(f'<path d="M{x} {112+(x%3)*6}L{x-10} {138+(x%3)*6}"/>' for x in range(84,280,24)),END,
 LINE,'<path d="M206 104L190 140H210L194 174"/>',
 ''.join(f'<path d="M{x} 300V214M{x} 232L{x-12} 220M{x} 232L{x+12} 220M{x} 250L{x-12} 238M{x} 250L{x+12} 238M{x} 214L{x-8} 202M{x} 214L{x+8} 202"/>' for x in (110,150,190,230)),END),
# 13: 기다리지 못하고 드린 번제 — 제단과 모래시계
13:svg(LINE,'<path d="M70 290H170M80 290V258H160V290M88 258V230H152V258M100 230L120 204L140 230"/>',
 '<path d="M120 200C108 182 132 166 120 146C108 126 132 112 120 92"/>',END,
 LINE,'<path d="M214 150H286M214 290H286M224 150Q224 200 250 220Q276 200 276 150M224 290Q224 240 250 220Q276 240 276 290"/>',END,
 DOT,'<path d="M236 290Q250 262 264 290Z"/><circle cx="250" cy="232" r="2.4"/></g>'),
# 14: 두 바위 사이로 올라가는 길과 숲의 꿀
14:svg(LINE,'<path d="M30 300L70 180L96 196L120 150L150 300"/><path d="M190 300L222 160L246 178L274 120L312 300"/>',END,
 THIN,'<path d="M160 300C164 270 150 250 170 230C186 214 168 196 178 176"/>',END,
 DOT,''.join(f'<path d="M{x} {y}l7 -4 7 4v8l-7 4 -7 -4Z"/>' for x,y in [(156,108),(170,116),(184,108),(170,100),(142,116)]),END,
 THIN,'<path d="M170 92V70"/>',END),
# 15: 찢어진 겉옷 자락 — 순종이 희생물보다 낫고
15:svg(LINE,'<path d="M96 80H244L262 292H78Z"/><path d="M96 80Q170 106 244 80"/>',
 '<path d="M206 292L214 268L198 252L218 236L204 220"/>','</g>',
 THIN,'<path d="M228 292L238 270L226 256L242 242"/><path d="M110 120H230M104 170H236M98 220H226"/>',END,
 DOT,'<circle cx="170" cy="56" r="5"/></g>'),
}
