import json,re,html,zipfile,os,uuid,subprocess
from pathlib import Path
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,PageBreak,KeepTogether,Table,TableStyle,Image,Flowable
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import mm
from chapter_extras import QA,FAQ,FAQ_PICKS
B=Path(__file__).parent;R=B.parents[1];OUT=R/'Genesis';TMP=Path(os.environ['TEMP'])/'genesis-chapters-20261010';TMP.mkdir(exist_ok=True)
V=json.loads((B/'verses_01-03.json').read_text(encoding='utf-8-sig'))
pdfmetrics.registerFont(TTFont('Myeongjo','C:/Windows/Fonts/batang.ttc',subfontIndex=0))
pdfmetrics.registerFont(TTFont('Gothic','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('GothicBold','C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFont(TTFont('Latin','C:/Windows/Fonts/times.ttf'))
pdfmetrics.registerFontFamily('Myeongjo',normal='Myeongjo',bold='GothicBold',italic='Myeongjo',boldItalic='GothicBold')
NAVY=colors.HexColor('#18233f');GOLD=colors.HexColor('#c9973b');W,H=148*mm,210*mm
ST={
'body':ParagraphStyle('body',fontName='Myeongjo',fontSize=10.3,leading=10.3*1.86,wordWrap='CJK',spaceAfter=8,textColor=NAVY),
'h1':ParagraphStyle('h1',fontName='GothicBold',fontSize=16,leading=23,wordWrap='CJK',spaceBefore=10,spaceAfter=9,textColor=NAVY,keepWithNext=True),
'h2':ParagraphStyle('h2',fontName='GothicBold',fontSize=10.3,leading=17,spaceBefore=6,spaceAfter=7,textColor=GOLD,keepWithNext=True),
'source':ParagraphStyle('source',fontName='Gothic',fontSize=7.4,leading=11,wordWrap='CJK',textColor=colors.HexColor('#596275'),spaceAfter=4),
'en':ParagraphStyle('en',fontName='Latin',fontSize=8.4,leading=12.5,spaceAfter=8,textColor=colors.HexColor('#596275')),
'note':ParagraphStyle('note',fontName='Myeongjo',fontSize=9.3,leading=17,wordWrap='CJK',backColor=colors.HexColor('#edf3f8'),borderPadding=7,spaceBefore=7,spaceAfter=12),
'question':ParagraphStyle('question',fontName='GothicBold',fontSize=10,leading=18,wordWrap='CJK',spaceAfter=8,keepWithNext=True),
'answer':ParagraphStyle('answer',fontName='Myeongjo',fontSize=10.3,leading=19,wordWrap='CJK',backColor=colors.HexColor('#fff7db'),borderPadding=7,spaceAfter=10)
}
def esc(t):return html.escape(t,quote=True)
def p(t,k='body'):return Paragraph(t,ST[k])
class AtomicParagraph(Paragraph):
 def split(self,availWidth,availHeight):return []
def latin(t):return re.sub(r'([\u00c0-\u024f\u1e00-\u1eff]+)',r'<font name="Latin">\1</font>',t)
def marked(c):
 t=esc(c['text']);part=esc(c['emphasis']);level=c['emphasis_level']
 if level>=2:part='<b>'+part+'</b>'
 if level==3:part='<u color="#b32629">'+part+'</u>'
 return latin(t.replace(esc(c['emphasis']),'<font backColor="#fff0a8">'+part+'</font>',1))
def ebook_marked(c):
 return esc(c['text']).replace(esc(c['emphasis']),f'<span class="level{c["emphasis_level"]}">'+esc(c['emphasis'])+'</span>',1)
def time(url):
 m=re.search(r'[?&]t=(\d+)',url);n=int(m[1]);return f'{n//60}분 {n%60:02d}초'
def sourcelabel(e,epub=False):
 nums=e['pages'];runs=[]
 for n in nums:
  if runs and runs[-1][-1]+1==n:runs[-1].append(n)
  else:runs.append([n])
 pages=', '.join(str(x[0]) if len(x)==1 else f'{x[0]}–{x[-1]}' for x in runs)
 text=esc(e['source'])+' · PDF '+pages+'쪽<br/>'+esc(Path(e['file']).name)
 if e.get('url'):text+=f'<br/><a href="{esc(e["url"])}" color="#b32629">▶ {time(e["url"])}</a><br/>클릭하면 해당 구간으로 이동합니다.'
 return text
class QR(Image):
 def __init__(self,file,url):super().__init__(str(file),width=13.6*mm,height=13.6*mm);self.url=url
 def draw(self):super().draw();self.canv.linkURL(self.url,(0,0,self.drawWidth,self.drawHeight),relative=1,thickness=0)
def sourceflows(c,width,qr=True):
 rows=[]
 for i,e in enumerate(c['evidence']):
  label=AtomicParagraph(sourcelabel(e),ST['source'])
  if e.get('url') and qr:
   n=time(e['url']);small=ParagraphStyle('time',parent=ST['source'],fontSize=6.6,leading=9,alignment=1)
   cell=[QR(TMP/f'{c["id"]}-{i}.png',e['url']),Paragraph(n,small)]
   row=Table([[label,cell]],colWidths=[width-20*mm,20*mm]);row.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#f8f4ea')),('LEFTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]));rows.append(row)
  else:rows.append(label)
 return rows
class Book(SimpleDocTemplate):
 def afterFlowable(self,f):
  if isinstance(f,Paragraph) and hasattr(f,'anchor'):
   self.canv.bookmarkHorizontalAbsolute(f.anchor,self.frame._y+f.height)
  if isinstance(f,Paragraph) and hasattr(f,'key'):
   self.canv.bookmarkHorizontalAbsolute(f.key,self.frame._y+f.height)
   self.canv.addOutlineEntry(f.getPlainText(),f.key,0,False)
   self.notify('TOCEntry',(0,f.getPlainText(),self.page,f.key))
def symbol(c,ch,cx,cy):
 c.saveState();c.setStrokeColor(colors.HexColor('#f3d79b'));c.setLineWidth(1.5)
 if ch==1:
  c.circle(cx,cy,29*mm,stroke=1,fill=0);c.ellipse(cx-29*mm,cy-10*mm,cx+29*mm,cy+10*mm,stroke=1,fill=0)
  c.ellipse(cx-12*mm,cy-29*mm,cx+12*mm,cy+29*mm,stroke=1,fill=0);c.line(cx-29*mm,cy,cx+29*mm,cy)
  for x,y in [(-35,20),(33,30),(38,-15),(-30,-30)]:c.circle(cx+x*mm,cy+y*mm,1.1*mm,stroke=1,fill=0)
 elif ch==2:
  c.line(cx,cy-29*mm,cx,cy+12*mm)
  for dx,dy in [(-14,0),(14,0),(-12,14),(12,14),(0,24)]:c.circle(cx+dx*mm,cy+dy*mm,10*mm,stroke=1,fill=0)
  c.arc(cx-32*mm,cy-40*mm,cx+32*mm,cy-15*mm,0,180);c.line(cx-30*mm,cy-29*mm,cx+30*mm,cy-29*mm)
 else:
  path=c.beginPath();path.moveTo(cx-12*mm,cy+25*mm)
  for x,y in [(-29,16),(-20,0),(-12,4),(-15,-28),(15,-28),(12,4),(20,0),(29,16),(12,25),(0,13),(-12,25)]:path.lineTo(cx+x*mm,cy+y*mm)
  c.drawPath(path,stroke=1,fill=0);c.line(cx,cy+13*mm,cx,cy-27*mm)
 c.restoreState()
SUB={1:'하늘과 땅, 그리고 사람의 창조',2:'안식과 생명의 호흡, 에덴과 한 육체',3:'뱀의 말과 사람의 선택, 저주와 가죽옷'}
def cover(c,doc):
 ch=doc.chapter
 a=[.094,.137,.247];b=[.45,.33,.14]
 for n in range(160):
  t=n/159;c.setFillColor(colors.Color(*[a[i]*(1-t)+b[i]*t for i in range(3)]));c.rect(0,H-(n+1)*H/160,W,H/160+.5,stroke=0,fill=1)
 c.setStrokeColor(GOLD);c.setLineWidth(.8);c.rect(10*mm,10*mm,W-20*mm,H-20*mm,stroke=1,fill=0)
 c.setFillColor(colors.HexColor('#eed6a2'));c.setFont('Gothic',9);c.drawCentredString(W/2,181*mm,'FIRSTFRUITS · GENESIS')
 c.setFillColor(colors.white);c.setFont('GothicBold',31);c.drawCentredString(W/2,156*mm,f'창세기 {ch}장')
 c.setFont('Gothic',14);c.drawCentredString(W/2,143*mm,'성경 공부 교재')
 c.setFont('Gothic',9);c.drawCentredString(W/2,128*mm,SUB[ch]);symbol(c,ch,W/2,83*mm)
 c.setFillColor(colors.HexColor('#f6e9cb'));c.setFont('Gothic',9);c.drawCentredString(W/2,32*mm,'첫열매들 교회 강의와 교재로 읽는 창세기')
 c.setFont('GothicBold',10);c.drawCentredString(W/2,23*mm,'성도 유영재 교재')
def decor(c,doc):
 c.setStrokeColor(GOLD);c.setLineWidth(.5);c.line(16*mm,H-12*mm,W-14*mm,H-12*mm)
 c.setFont('Gothic',7);c.setFillColor(NAVY);c.drawString(16*mm,H-10*mm,f'FIRSTFRUITS · 창세기 {doc.chapter}장')
 c.drawRightString(W-14*mm,10*mm,str(doc.page))
def title(t,key=None):
 f=p(esc(t),'h1')
 if key:f.key=key
 return f
def cover_svg(ch):
 symbols={1:'<circle cx="300" cy="580" r="110"/><ellipse cx="300" cy="580" rx="110" ry="38"/><ellipse cx="300" cy="580" rx="45" ry="110"/>',2:'<path d="M300 670V525"/><circle cx="255" cy="545" r="40"/><circle cx="345" cy="545" r="40"/><circle cx="300" cy="480" r="45"/><path d="M190 675H410"/>',3:'<path d="M255 475L190 515L225 570L255 555L245 680H355L345 555L375 570L410 515L345 475L300 515Z"/><path d="M300 515V675"/>'}
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850"><defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="#18233f"/><stop offset="1" stop-color="#735424"/></linearGradient></defs><rect width="600" height="850" fill="url(#bg)"/><rect x="40" y="40" width="520" height="770" fill="none" stroke="#c9973b"/><g fill="#fff" text-anchor="middle" font-family="sans-serif"><text x="300" y="120" font-size="20">FIRSTFRUITS · GENESIS</text><text x="300" y="240" font-size="64">창세기 {ch}장</text><text x="300" y="300" font-size="30">성경 공부 교재</text><text x="300" y="360" font-size="20">{SUB[ch]}</text><text x="300" y="760" font-size="24">성도 유영재 교재</text></g><g fill="none" stroke="#f3d79b" stroke-width="5">{symbols[ch]}</g></svg>'
intro=[
'창세기의 절 순서로 읽으며 첫열매들 교회 강의와 교재의 설명을 확인하는 교재입니다. 해설을 찾지 못한 부분은 본문을 그대로 읽도록 남겼습니다.',
'한글과 영어 본문은 표준킹제임스성경 한영대역의 글자 그대로입니다. 해설의 성경 인용은 해당 강의의 설명과 표기를 따릅니다.',
'노란 바탕은 중요한 내용, 노란 바탕과 굵은 글씨는 더 중요한 내용, 여기에 빨간 밑줄을 더한 문장은 핵심 명제입니다.',
'해설마다 강의명, PDF 파일명과 쪽수를 적었습니다. 여러 출처가 붙은 설명은 각 자료의 내용을 연결한 설명입니다. 해당 절의 직접 풀이와 관련 교리를 연결한 설명을 구분하며 읽으십시오.',
'원 교재에 관련 구간 주소가 있는 곳은 QR 또는 ▶ 시각을 통해 이동합니다. QR 아래 시각을 확인하고 스캔하거나 클릭하십시오. 출처에 링크가 없어도 쪽수로 근거를 확인할 수 있습니다.',
'시각은 원 PDF에 실린 기존 구간 주소입니다. 이번 제작에서 유튜브 영상을 재생하여 발언의 시작 시점을 다시 확인하지 않았습니다.',
'차례의 제목을 누르면 해당 단락으로 이동합니다. 뒤의 요약·문제·답안·질문은 이 장에 채택한 해설과 교재만으로 정리했습니다.'
]
CSS='body{font-family:serif;color:#18233f;line-height:1.86;margin:5%;}h1,h2,.source{font-family:sans-serif;}h1{font-size:1.5em;line-height:1.5;margin-top:1.5em;}h2{font-size:1em;color:#9a7125;}section{break-before:page;}.bib{background:#faf6ee;padding:.5em;break-inside:avoid;}.en{font-size:.8em;line-height:1.5;color:#596275;}.source{font-size:.8em;line-height:1.6;background:#f8f4ea;padding:.5em;}a{color:#b32629;}.note{background:#edf3f8;padding:.7em;}.level1,.level2,.level3{background:#fff0a8;}.level2,.level3{font-weight:bold;}.level3{text-decoration:underline;text-decoration-color:#b32629;}.answer{background:#fff7db;padding:.7em;}.cover{width:100%;max-height:90vh;}nav li{padding:.4em 0;}'
for ch in (1,2,3):
 d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf-8'));comments={c['id']:c for s in d['sections'] for c in s['comments']};qs=QA[ch]
 assert len(qs)==25 and all(f'g{ch}-{key}' in comments for key,q,a in qs)
 doc=Book(str(OUT/f'창세기_{ch:02}장_교재.pdf'),pagesize=(W,H),leftMargin=16*mm,rightMargin=14*mm,topMargin=16*mm,bottomMargin=19*mm,title=f'창세기 {ch}장 성경 공부 교재',author='성도 유영재');doc.chapter=ch
 story=[Spacer(1,140*mm),PageBreak(),title('이 책을 읽는 법')]+[p(esc(t)) for t in intro]+[PageBreak(),title('차례')]
 toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='Gothic',fontSize=8.8,leading=12.5,wordWrap='CJK',spaceBefore=0.8,textColor=NAVY)];story+=[toc,PageBreak()]
 story[story.index(toc)-1].anchor='toc'
 sections=[];nav=[]
 for i,s in enumerate(d['sections']):
  key=f's{i+1}';label=s['ref']+' '+s['title'];sectionheading=title(label,key);back=p('<a href="#toc">◀ 목차로 이동</a>','source');nav.append((key,label))
  nums=s['ref'].split(':')[1].split('-');lo=int(nums[0]);hi=int(nums[-1]);selected=[v for v in V if v['ref'].startswith(str(ch)+':') and lo<=int(v['ref'].split(':')[1])<=hi]
  sect=[f'<section id="{key}"><h1>{esc(label)}</h1><p><a href="nav.xhtml#toc">◀ 목차로 이동</a></p>']
  for vi,v in enumerate(selected):
   num=v['ref'].split(':')[1];ko=re.sub(r'<span[^>]*>',r'<b>',v['koHtml']).replace('</span>','</b>')
   en=re.sub(r'</?span[^>]*>','',v['enHtml'])
   vg=[p('<b>'+num+'</b> '+ko),p(en,'en')]
   story.append(KeepTogether(([sectionheading,back] if vi==0 else [])+vg))
   sect.append(f'<div class="bib"><p><b>{num}</b> {v["koHtml"]}</p><p class="en">{v["enHtml"]}</p></div>')
  story.append(p('창세기 '+s['ref']+' · 표준킹제임스성경','source'));sect.append('<p class="source">창세기 '+s['ref']+' · 표준킹제임스성경</p>')
  if s['comments']:sect.append('<h2>교회 강의·교재의 해설</h2>')
  for ci,c in enumerate(s['comments']):
   paragraph=p(marked(c));refs=sourceflows(c,doc.width)
   # A paragraph stays with its first citation. Further citations can flow
   # separately when a composite source set is longer than the page.
   group=([p('교회 강의·교재의 해설','h2')] if ci==0 else [])+[paragraph,refs[0]]
   story.append(KeepTogether(group));story.extend(refs[1:]);story.append(Spacer(1,8))
   sect.append('<div class="comment"><p>'+ebook_marked(c)+'</p>'+''.join('<p class="source">'+sourcelabel(e,True)+'</p>' for e in c['evidence'])+'</div>')
  for t in s['notes']:
   t=re.sub(r'^해설 없음\s*','',t);t=t.replace('교회 강의· 교재','교회 강의·교재');story.append(KeepTogether([p('<b>해설 미수록</b><br/>'+esc(t),'note')]));sect.append('<p class="note"><b>해설 미수록</b><br/>'+esc(t)+'</p>')
  sect.append('</section>');sections.append(''.join(sect))
 extras=[]
 def start(label,key):
  story.extend([PageBreak(),title(label,key)]);nav.append((key,label));extras.append(f'<section id="{key}"><h1>{label}</h1>')
 start('한눈에 보는 이야기','summary')
 # Twenty items span the complete chapter, rather than its opening alone.
 picks=[round(i*24/19) for i in range(20)]
 for i,j in enumerate(picks,1):
  key,q,a=qs[j];c=comments[f'g{ch}-{key}'];a=re.split(r'(?<=[.!?])\s+',c['text'])[0]
  story.append(p(f'<b>{i}.</b> '+latin(esc(a))));extras.append('<p><b>'+str(i)+'.</b> '+esc(a)+'</p>')
 extras.append('</section>');start('개념 문제','questions')
 for i,(key,q,a) in enumerate(qs,1):story.append(p(f'<b>{i:02}.</b> '+esc(q)));extras.append('<p><b>'+str(i)+'.</b> '+esc(q)+'</p>')
 extras.append('</section>');start('답안과 근거','answers')
 for i,(key,q,a) in enumerate(qs,1):
  c=comments[f'g{ch}-{key}'];story.append(KeepTogether([p(f'{i:02}. '+esc(q),'question'),p(esc(a),'answer'),p('근거: 창세기 '+key.rsplit('-',1)[0]+' 해설','source')]));story.extend(sourceflows(c,doc.width,False))
  extras.append('<p><b>'+str(i)+'. '+esc(q)+'</b></p><p class="answer">'+esc(a)+'</p>'+''.join('<p class="source">'+sourcelabel(e)+'</p>' for e in c['evidence']))
 extras.append('</section>');start('예상 질문과 답변','faq')
 story.append(p('이 장의 교회 자료에서 확인한 설명으로 답합니다.','note'))
 for i,j in enumerate(FAQ_PICKS[ch]):
  key,q,a=qs[j];c=comments[f'g{ch}-{key}'];question=FAQ[ch][i]
  refs=sourceflows(c,doc.width,False)
  story.append(KeepTogether([p(f'Q{i+1}. '+esc(question),'question'),p(latin(esc(c['text']))),refs[0]]));story.extend(refs[1:]);story.append(Spacer(1,7))
  extras.append('<p><b>Q'+str(i+1)+'. '+esc(question)+'</b></p><p>'+esc(c['text'])+'</p>'+''.join('<p class="source">'+sourcelabel(e)+'</p>' for e in c['evidence']))
 extras.append('</section>');start('용어와 핵심 표현','glossary')
 gp={1:[0,1,8,17,18,22],2:[3,5,8,10,13,23],3:[1,6,8,11,18,21]}[ch]
 terms={1:['하나님','태초','성령','형상과 몸','보조 생명','상속자'],2:['몸','생명의 호흡','아담과 새 아담','두 나무','지혜와 성령','결혼의 신비'],3:['살짝 바꾼 말씀','혼의 전쟁터','몸에 사는 죄','깨달음의 눈','몸의 저주','가죽옷']}[ch]
 for j,term in zip(gp,terms):
  key,q,a=qs[j];story.append(p(esc(term),'h2'));story.append(p(esc(a)));story.append(p('근거: 창세기 '+key.rsplit('-',1)[0]+' 해설','source'));extras.append('<h2>'+esc(term)+'</h2><p>'+esc(a)+'</p>')
 extras.append('</section>');start('참고한 교회 자료','sources')
 files={e['file']:e['source'] for c in comments.values() for e in c['evidence']}
 for file,label in files.items():story.append(p(esc(label),'h2'));story.append(p(esc(file),'source'));extras.append('<p>'+esc(label)+'<br/>'+esc(file)+'</p>')
 extras.append('</section>')
 # The explicit anchor is independent of the TOC's dynamically generated entries.
 doc.multiBuild(story,onFirstPage=cover,onLaterPages=decor)
 coverpng=TMP/f'cover{ch}.png'
 subprocess.run(['C:/Program Files/nodejs/node.exe',str(B/'render_epub_cover.mjs'),doc.filename,str(coverpng)],check=True)
 ns='xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko"'
 head=f'<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html {ns}><head><title>창세기 {ch}장 교재</title><link rel="stylesheet" href="book.css"/></head><body>'
 book=head+'<section id="cover"><img class="cover" src="cover.png" alt="창세기 '+str(ch)+'장 표지"/></section><section id="intro"><h1>이 책을 읽는 법</h1>'+''.join('<p>'+esc(t.replace('QR 또는 ▶ 시각','▶ 시각').replace('QR 아래 시각을 확인하고 스캔하거나 클릭하십시오.','표시된 시각 링크를 누르십시오.'))+'</p>' for t in intro)+'</section>'+''.join(sections+extras)+'</body></html>'
 navdoc=head+'<nav epub:type="toc" id="toc"><h1>차례</h1><ol>'+''.join(f'<li><a href="book.xhtml#{k}">{esc(t)}</a></li>' for k,t in nav)+'</ol></nav></body></html>'
 uid='urn:uuid:'+str(uuid.uuid5(uuid.NAMESPACE_URL,f'https://github.com/yooyoungjae0627/christian-note/Genesis/{ch}'))
 ncx='<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="'+uid+'"/></head><docTitle><text>창세기 '+str(ch)+'장 교재</text></docTitle><navMap>'+''.join(f'<navPoint id="n{i}" playOrder="{i+1}"><navLabel><text>{esc(t)}</text></navLabel><content src="book.xhtml#{k}"/></navPoint>' for i,(k,t) in enumerate(nav))+'</navMap></ncx>'
 opf=f'<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">{uid}</dc:identifier><dc:title>창세기 {ch}장 성경 공부 교재</dc:title><dc:creator>성도 유영재</dc:creator><dc:language>ko</dc:language><meta property="dcterms:modified">2026-10-10T00:00:00Z</meta><meta name="cover" content="cover"/></metadata><manifest><item id="book" href="book.xhtml" media-type="application/xhtml+xml" properties="svg"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="book.css" media-type="text/css"/><item id="cover" href="cover.svg" media-type="image/svg+xml" properties="cover-image"/></manifest><spine toc="ncx"><itemref idref="nav"/><itemref idref="book"/></spine></package>'
 with zipfile.ZipFile(OUT/f'창세기_{ch:02}장_교재.epub','w') as z:
  z.writestr('mimetype','application/epub+zip',compress_type=zipfile.ZIP_STORED)
  files={'META-INF/container.xml':'<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>','OEBPS/content.opf':opf,'OEBPS/book.xhtml':book,'OEBPS/nav.xhtml':navdoc,'OEBPS/toc.ncx':ncx,'OEBPS/book.css':CSS,'OEBPS/cover.svg':cover_svg(ch)}
  files['OEBPS/content.opf']=files['OEBPS/content.opf'].replace('properties="svg"','').replace('href="cover.svg" media-type="image/svg+xml"','href="cover.png" media-type="image/png"')
  del files['OEBPS/cover.svg']
  for name,txt in files.items():z.writestr(name,txt,compress_type=zipfile.ZIP_DEFLATED)
  z.writestr('OEBPS/cover.png',coverpng.read_bytes(),compress_type=zipfile.ZIP_DEFLATED)
 print(json.dumps({'chapter':ch,'pdf':doc.filename,'comments':len(comments),'questions':len(qs),'faq':len(FAQ[ch])},ensure_ascii=False))
