import json, re, html, zipfile, os
from pathlib import Path
from datetime import datetime, timezone
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether, Table, TableStyle, Image
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import mm

BASE=Path(__file__).parent
ROOT=BASE.parents[1]
OUT=ROOT/'Genesis'
TMP=Path(os.environ['TEMP'])/'genesis-sample-20261010'
TMP.mkdir(exist_ok=True)
data=json.loads((BASE/'sample.json').read_text(encoding='utf-8'))
verses=json.loads((BASE/'verses.json').read_text(encoding='utf-8-sig'))
pdfmetrics.registerFont(TTFont('Korean','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('KoreanBold','C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFont(TTFont('Latin','C:/Windows/Fonts/times.ttf'))
pdfmetrics.registerFontFamily('Korean',normal='Korean',bold='KoreanBold',italic='Korean',boldItalic='KoreanBold')
NAVY=colors.HexColor('#18233f'); GOLD=colors.HexColor('#c9973b')
styles={
 'body':ParagraphStyle('body',fontName='Korean',fontSize=10.2,leading=18.5,wordWrap='CJK',spaceAfter=7,textColor=NAVY),
 'h1':ParagraphStyle('h1',fontName='KoreanBold',fontSize=17,leading=24,wordWrap='CJK',spaceBefore=12,spaceAfter=13,textColor=NAVY,keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='KoreanBold',fontSize=10,leading=16,spaceBefore=7,spaceAfter=8,textColor=GOLD,keepWithNext=True),
 'verse':ParagraphStyle('verse',fontName='Korean',fontSize=10.5,leading=18,wordWrap='CJK',spaceAfter=5),
 'en':ParagraphStyle('en',fontName='Times-Roman',fontSize=8.4,leading=12,spaceAfter=10,textColor=colors.HexColor('#687086')),
 'source':ParagraphStyle('source',fontName='Korean',fontSize=8,leading=12,wordWrap='CJK',textColor=colors.HexColor('#48617c')),
 'note':ParagraphStyle('note',fontName='Korean',fontSize=9,leading=16,wordWrap='CJK',spaceAfter=12,backColor=colors.HexColor('#f1f4f8'),borderPadding=9),
}
def p(t,k='body'): return Paragraph(t,styles[k])
def esc(t): return html.escape(t,quote=True)
def ko_markup(v):
    return re.sub(r'<span class="g[123]">([^<]*)</span>',r'<font name="KoreanBold">\1</font>',v['koHtml'])
def prose_markup(t):
    value=esc(t)
    value=value.replace('ṭôb','<font name="Latin">ṭôb</font>')
    for sentence in ["'하나님'은 이름이 아니라 격(직함)입니다.","성경의 '태초'는 한 시점이 아니라 기간입니다.",'창조는 전부 아들을 통해서, 곧 말씀을 통해서 하셨습니다.','사람은 선택을 하기에 하나님 사랑의 짝입니다.']:
        value=value.replace(esc(sentence),'<b><u color="#b02424"><font backColor="#fff0a8">'+esc(sentence)+'</font></u></b>')
    return value
def time_label(url):
    n=int(re.search(r'[?&]t=(\d+)',url)[1]); return f'{n//60}분 {n%60:02d}초'
def source_text(e, markup=True):
    nums=e.get('pages',[e['page']]); ranges=[]
    for num in nums:
        if ranges and ranges[-1][-1]+1==num:ranges[-1].append(num)
        else:ranges.append([num])
    pages=', '.join(str(r[0]) if len(r)==1 else f'{r[0]}-{r[-1]}' for r in ranges)
    text=f"{esc(e['source'])} · 교재 {pages}쪽"
    if e['url']:
        text+=f'<br/><a href="{esc(e["url"])}" color="#b02424"><b>▶ 근거 구간 보기 · {time_label(e["url"])}</b></a>'
    else: text+='<br/>이 자료에는 영상 구간 링크가 없습니다.'
    return text

class LinkedQR(Image):
    def __init__(self,path,url):
        super().__init__(path,width=15*mm,height=15*mm)
        self.url=url
    def draw(self):
        super().draw()
        self.canv.linkURL(self.url,(0,0,self.drawWidth,self.drawHeight),relative=1,thickness=0)

class Book(SimpleDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable,Paragraph) and hasattr(flowable,'section_key'):
            self.canv.bookmarkPage(flowable.section_key)
            self.canv.addOutlineEntry(flowable.getPlainText(),flowable.section_key,0,False)
            self.notify('TOCEntry',(0,flowable.getPlainText(),self.page,flowable.section_key))
def page_decor(c,doc):
    if doc.page==1: return
    w,h=148*mm,210*mm
    c.setStrokeColor(GOLD); c.setLineWidth(.5); c.line(16*mm,h-13*mm,w-14*mm,h-13*mm)
    c.setFillColor(NAVY); c.setFont('Korean',7)
    c.drawString(16*mm,h-10*mm,'FIRSTFRUITS · 창세기 1장 해설')
    c.drawRightString(w-14*mm,10*mm,str(doc.page))

doc=Book(str(OUT/'창세기_1장_해설_근거링크_샘플.pdf'),pagesize=(148*mm,210*mm),rightMargin=14*mm,leftMargin=16*mm,topMargin=19*mm,bottomMargin=19*mm,title=data['title'],author='성도 유영재')
story=[]
cover_small=ParagraphStyle('coverSmall',fontName='Korean',fontSize=10,leading=18,textColor=GOLD,alignment=TA_CENTER)
cover_title=ParagraphStyle('coverTitle',fontName='KoreanBold',fontSize=35,leading=49,textColor=NAVY,alignment=TA_CENTER)
story.extend([Spacer(1,24*mm),Paragraph('FIRSTFRUITS<br/>첫열매들 교리로 읽는 성경',cover_small),Spacer(1,16*mm),Paragraph('창세기<br/>1장 해설',cover_title),Spacer(1,12*mm),Paragraph('하늘과 땅, 그리고 사람의 창조',cover_small),Spacer(1,14*mm),p('교회 강의와 교재로 풀어 읽고<br/>해설의 근거 구간으로 바로 이동합니다.','note'),Spacer(1,12*mm),Paragraph('성도 유영재 교재<br/>근거 링크 연결 샘플 · 2026.10.10',cover_small),PageBreak()])
intro=[
 '창세기 1장 전체를 읽으며, 기존 해설에 기록된 교회 자료의 근거를 확인하는 샘플입니다. 여러 강의의 내용을 본문 순서로 모았습니다. 해설은 첫열매들 강의와 교재에서 가져왔으며 일반 신학으로 채우지 않았습니다.',
 '한글 본문과 영어 KJV는 표준킹제임스성경 한영대역의 글자를 그대로 실었습니다. 해설 안의 인용문은 기존 교재의 표기를 따릅니다.',
 '각 해설 아래에 강의명과 출처 교재의 쪽수를 표시했습니다. 영상 링크가 있는 자료는 빨간 ▶ 글자 또는 QR을 누르거나 스캔하여 해당 구간으로 이동할 수 있습니다.',
 '표시된 시각은 출처 PDF에 실린 구간 시작 링크입니다. 해당 문장을 영상에서 초 단위로 다시 확인한 시각은 아닙니다. 출처에 링크가 없는 문단은 강의명과 쪽수로 확인할 수 있습니다.',
 '풀이를 찾지 못한 단락은 「해설 없음」으로 표시합니다. 성경 본문을 설명한 대목과 다른 구절·교리를 연결한 대목은 기존 해설의 구분을 유지합니다.'
]
story.append(p('이 책을 읽는 법','h1'))
story.extend(p(esc(t)) for t in intro)
story.extend([Spacer(1,8),p('차례의 제목을 누르면 해당 단락으로 이동합니다.','note'),PageBreak(),p('차례','h1')])
toc=TableOfContents(); toc.levelStyles=[ParagraphStyle('toc',fontName='Korean',fontSize=10,leading=19,wordWrap='CJK',spaceBefore=6,textColor=NAVY)]
story.extend([toc,PageBreak()])
sections_html=[]
for index,sec in enumerate(data['sections']):
    key=f's{index+1}'; heading=p(esc(sec['ref']+' '+sec['title']),'h1'); heading.section_key=key
    story.append(heading)
    a,b=(sec['ref'].split(':')[1].split('-')+[None])[:2]; lo=int(a); hi=int(b or a)
    selected=[v for v in verses if lo<=int(v['ref'].split(':')[1])<=hi]
    verse_html=[]
    for v in selected:
        ko=p(f'<b>{v["ref"].split(":")[1]}</b> '+ko_markup(v),'verse')
        en=p(v['enHtml'],'en')
        story.append(KeepTogether([ko,en]))
        verse_html.append(f'<div class="verse"><p class="ko"><b>{v["ref"].split(":")[1]}</b> {v["koHtml"]}</p><p class="en">{v["enHtml"]}</p></div>')
    story.append(p('창세기 '+sec['ref']+' · 표준킹제임스성경','source'))
    commentary_html=[]
    if sec['comments']: story.append(p('교회 강의·교재의 해설','h2'))
    for c in sec['comments']:
        group=[p(prose_markup(c['text']))]
        src_html=[]
        for j,e in enumerate(c['evidence']):
            label=p(source_text(e),'source')
            if e['url']:
                qr=LinkedQR(str(TMP/f'{c["id"]}-{j}.png'),e['url'])
                row=Table([[label,qr]],colWidths=[doc.width-19*mm,19*mm]); row.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#f7f4ed')),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),3),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]))
                group.append(row)
            else: group.append(label)
            src_html.append('<p class="source">'+source_text(e)+'</p>')
        group.append(Spacer(1,11))
        story.append(KeepTogether(group))
        commentary_html.append('<div class="comment"><p>'+esc(c['text'])+'</p>'+''.join(src_html)+'</div>')
    for note in sec['notes']: story.append(p('<b>해설 없음</b><br/>'+esc(note),'note'))
    sections_html.append(f'<section id="{key}"><h1>{esc(sec["ref"]+" "+sec["title"])}</h1>'+''.join(verse_html)+f'<p class="source">창세기 {sec["ref"]} · 표준킹제임스성경</p>'+('<h2>교회 강의·교재의 해설</h2>' if sec['comments'] else '')+''.join(commentary_html)+''.join('<p class="note"><b>해설 없음</b><br/>'+esc(n)+'</p>' for n in sec['notes'])+'</section>')
story.extend([PageBreak(),p('참고한 교회 자료','h1')])
source_files={e['file']:e['source'] for s in data['sections'] for c in s['comments'] for e in c['evidence']}
for file,name in source_files.items(): story.append(p(esc(name+' · '+Path(file).name),'source')); story.append(Spacer(1,7))
story.append(Spacer(1,12)); story.append(p('해설 아래에 표시한 교재 쪽수와 영상 구간을 통해 근거 내용을 직접 확인하실 수 있습니다.','note'))
doc.multiBuild(story,onFirstPage=page_decor,onLaterPages=page_decor)

# Reflowable EPUB: native text and clickable source links, without print QR images.
epub=OUT/'창세기_1장_해설_근거링크_샘플.epub'
uid='urn:uuid:02838b71-57b5-4ab4-bb10-dbabdc8e3fa6'
xhead='<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="ko" xml:lang="ko"><head><title>창세기 1장 해설</title><link rel="stylesheet" href="book.css"/></head><body>'
navlist=''.join(f'<li><a href="book.xhtml#s{i+1}">{esc(s["ref"]+" "+s["title"])}</a></li>' for i,s in enumerate(data['sections']))
book=xhead+'<section id="cover"><p>FIRSTFRUITS · 첫열매들 교리로 읽는 성경</p><h1>창세기 1장 해설</h1><p>하늘과 땅, 그리고 사람의 창조</p><p>성도 유영재 교재 · 근거 링크 연결 샘플</p></section><section><h1>이 책을 읽는 법</h1>'+''.join('<p>'+esc(t).replace('빨간 ▶ 글자 또는 QR을 누르거나 스캔하여','빨간 ▶ 글자를 눌러')+'</p>' for t in intro)+'</section>'+''.join(sections_html)+'<section><h1>참고한 교회 자료</h1>'+''.join('<p>'+esc(n+' · '+Path(f).name)+'</p>' for f,n in source_files.items())+'</section></body></html>'
nav=xhead+'<nav epub:type="toc" id="toc"><h1>차례</h1><ol>'+navlist+'</ol></nav></body></html>'
ncx='<?xml version="1.0" encoding="UTF-8"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head><meta name="dtb:uid" content="'+uid+'"/></head><docTitle><text>창세기 1장 해설</text></docTitle><navMap>'+''.join(f'<navPoint id="n{i}" playOrder="{i+1}"><navLabel><text>{esc(s["ref"]+" "+s["title"])}</text></navLabel><content src="book.xhtml#s{i+1}"/></navPoint>' for i,s in enumerate(data['sections']))+'</navMap></ncx>'
opf='<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">'+uid+'</dc:identifier><dc:title>창세기 1장 해설</dc:title><dc:creator>성도 유영재</dc:creator><dc:language>ko</dc:language><meta property="dcterms:modified">2026-10-10T00:00:00Z</meta></metadata><manifest><item id="book" href="book.xhtml" media-type="application/xhtml+xml"/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="css" href="book.css" media-type="text/css"/></manifest><spine toc="ncx"><itemref idref="nav"/><itemref idref="book"/></spine></package>'
css='body{font-family:serif;line-height:1.85;color:#18233f;margin:5%;}h1{font-family:sans-serif;line-height:1.45;margin-top:2em;}h2{font-family:sans-serif;color:#9a7125;font-size:1em;}p{margin:.6em 0;}.verse{break-inside:avoid;background:#faf6ee;padding:.3em .7em;}.en{font-family:serif;font-size:.8em;color:#687086;line-height:1.5;}.source{font-family:sans-serif;font-size:.8em;background:#f7f4ed;padding:.6em;}.source a{color:#b02424;}.note{background:#f1f4f8;padding:1em;}#cover{text-align:center;padding:10% 0;}.comment{margin:1.4em 0;}a{text-decoration:none;}'
with zipfile.ZipFile(epub,'w') as z:
    z.writestr('mimetype','application/epub+zip',compress_type=zipfile.ZIP_STORED)
    for name,content in {'META-INF/container.xml':'<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>','OEBPS/content.opf':opf,'OEBPS/book.xhtml':book,'OEBPS/nav.xhtml':nav,'OEBPS/toc.ncx':ncx,'OEBPS/book.css':css}.items(): z.writestr(name,content,compress_type=zipfile.ZIP_DEFLATED)
print(json.dumps({'pdf':str(doc.filename),'epub':str(epub),'sections':len(data['sections']),'comments':sum(len(s['comments']) for s in data['sections'])},ensure_ascii=False))
