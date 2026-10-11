"""Cover line drawings for chapters 4-10: same palette and frame as the chapter 1-3 tree, one symbol per chapter.
No crosses, faces of God or human faces (docs/policy/창세기_교재_제작지침.md)."""
HEAD='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 350"><defs><radialGradient id="glow"><stop stop-color="#fff7d0" stop-opacity=".45"/><stop offset="1" stop-color="#fff7d0" stop-opacity="0"/></radialGradient></defs><ellipse cx="170" cy="130" rx="110" ry="90" fill="url(#glow)"/>'
LINE='<g fill="none" stroke="#e8c983" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">'
THIN='<g fill="none" stroke="#b9c5d7" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
DOT='<g fill="#f6e3a5">'
def svg(*parts):return HEAD+''.join(parts)+'</svg>'
CHAPTER_ART={
# 4: two altars, the smoke of one rising up, the other drifting low
4:svg(LINE,'<path d="M70 250H150M80 250V222H140V250M86 222V196H134V222M96 196L110 172L124 196"/>',
 '<path d="M110 168C98 148 122 132 110 112C98 92 122 76 110 56C104 44 112 34 110 26"/>',
 '<path d="M190 250H270M200 250V222H260V250M206 222V196H254V222M216 196L230 176L244 196"/>',
 '<path d="M232 172C246 166 254 176 270 170C286 164 294 174 312 168"/>','</g>',
 THIN,'<path d="M24 262Q170 236 316 262"/>','</g>',DOT,'<circle cx="110" cy="20" r="6"/></g>'),
# 5: the generations from Adam to Noah, one taken up
5:svg(THIN,'<path d="M110 300L150 270L110 240L150 210L110 180L150 150L110 120L150 90L110 60L150 30"/>','</g>',
 DOT,''.join(f'<circle cx="{110 if i%2==0 else 150}" cy="{300-30*i}" r="{6 if i in (0,9) else 4.6}"/>' for i in range(10)),'</g>',
 LINE,'<path d="M110 120C150 112 196 92 236 54M236 54L222 56M236 54L232 68"/><circle cx="252" cy="40" r="9"/>','</g>',
 THIN,'<path d="M30 318Q170 294 310 318"/>','</g>'),
# 6: the ark being built, with its measuring line
6:svg(LINE,'<path d="M48 200H292L272 252H68Z"/><path d="M68 200L100 162H240L272 200"/><path d="M100 172H240"/>',
 '<path d="M96 200V250M128 200V252M160 200V252M192 200V252M224 200V252M256 200V250"/><path d="M200 214H222V240H200Z"/>','</g>',
 THIN,'<path d="M48 282H292M48 274V290M292 274V290M110 278V286M170 278V286M230 278V286"/>','</g>',
 DOT,'<circle cx="170" cy="96" r="7"/></g>'),
# 7: the ark on the waters under the rain
7:svg(THIN,'<path d="M62 70Q92 46 122 66Q150 44 182 64Q214 44 246 66Q272 56 286 76"/>',
 ''.join(f'<path d="M{x} {96+(x%3)*8}L{x-12} {126+(x%3)*8}"/>' for x in range(74,290,22)),'</g>',
 LINE,'<path d="M86 196H254L238 232H102Z"/><path d="M102 196L124 170H216L238 196"/><path d="M124 180H216"/>',
 '<path d="M30 252Q60 236 90 252T150 252T210 252T270 252T330 252M14 282Q44 266 74 282T134 282T194 282T254 282T314 282"/>','</g>'),
# 8: the ark resting on the mountains, the dove with the olive leaf
8:svg(THIN,'<path d="M20 290L104 176L150 230L196 160L320 290"/><path d="M14 306Q60 296 106 306T198 306T290 306"/>','</g>',
 LINE,'<path d="M160 168H236L226 190H170Z"/><path d="M170 168L182 154H214L226 168"/>',
 '<path d="M150 82C172 64 194 66 210 80C226 72 242 74 254 66C246 84 230 92 212 92C196 106 172 104 150 82Z"/><path d="M212 92L222 108"/>',
 '<path d="M150 82L126 94"/><path d="M122 96C112 92 108 100 116 106C124 104 126 98 122 96Z"/>','</g>',
 DOT,'<circle cx="240" cy="70" r="2.2"/></g>'),
# 9: the bow set in the cloud over the renewed earth
9:svg(LINE,'<path d="M50 230A120 120 0 0 1 290 230"/>','</g>',
 '<g fill="none" stroke="#f6e3a5" stroke-width="1.8" stroke-linecap="round"><path d="M68 230A102 102 0 0 1 272 230"/></g>',
 THIN,'<path d="M86 230A84 84 0 0 1 254 230"/><path d="M36 232Q66 212 98 230Q128 214 158 232"/><path d="M182 232Q212 214 242 230Q274 212 304 232"/>',
 '<path d="M30 296Q170 270 310 296"/>','</g>',
 LINE,'<path d="M150 284V262M150 270L140 262M150 268L160 258M190 286V266M190 274L182 266M190 272L198 264"/>','</g>'),
# 10: one family spreading into the nations, the earth divided
10:svg(LINE,'<path d="M170 300V220"/><path d="M170 220C150 200 110 192 86 160M170 220V140M170 220C190 200 230 192 254 160"/>',
 '<path d="M86 160L60 122M86 160L98 112M170 140L146 92M170 140L194 92M254 160L242 112M254 160L280 122"/>','</g>',
 DOT,''.join(f'<circle cx="{x}" cy="{y}" r="4.4"/>' for x,y in [(60,122),(98,112),(146,92),(194,92),(242,112),(280,122)]),'</g>',
 THIN,'<path d="M30 316Q90 300 150 314M190 314Q250 300 310 316"/><path d="M52 66L66 58M88 50L104 46M236 46L252 50M274 58L288 66"/>','</g>'),
}
