"""A4 portrait edition. Text data and captured images are kept unchanged."""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import random
import shutil
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Flowable, Paragraph, Spacer, PageBreak, KeepTogether, Image, Table, TableStyle
from PIL import Image as PILImage

from book_data import TITLE, SUBTITLE, DATE, PAGES, SOURCES, QUIZ, FAQ, CORRECTIONS

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/f'{TITLE}.pdf'
W,H=A4
M=35
CW=W-2*M
BOTTOM=140
TOP=45
FRAME_H=H-TOP-BOTTOM
NAVY=colors.HexColor('#14263e')
INK=colors.HexColor('#253648')
GOLD=colors.HexColor('#c89d4e')
TEAL=colors.HexColor('#237f86')
CREAM=colors.HexColor('#fbf8f0')
PALE=colors.HexColor('#eaf3f2')
GRAY=colors.HexColor('#617080')
WHITE=colors.white
pdfmetrics.registerFont(TTFont('MG','C:/Windows/Fonts/malgun.ttf'))
pdfmetrics.registerFont(TTFont('MGB','C:/Windows/Fonts/malgunbd.ttf'))
pdfmetrics.registerFontFamily('MG',normal='MG',bold='MGB')
pdfmetrics.registerFont(TTFont('Latin','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('LatinB','C:/Windows/Fonts/arialbd.ttf'))

def style(name,size=15,leading=22,**kw):
    params=dict(fontName='MG',fontSize=size,leading=leading,wordWrap='CJK',textColor=INK,allowWidows=0,allowOrphans=0)
    params.update(kw)
    return ParagraphStyle(name,**params)

STYLES={
 'body':style('body',spaceAfter=8),
 'caption':style('caption',textColor=GRAY,spaceBefore=9,spaceAfter=14),
 'lead':style('lead',17,25,textColor=TEAL,spaceAfter=14,wordWrap=None,splitLongWords=False),
 'label':style('label',fontName='MGB',textColor=TEAL,spaceBefore=4,spaceAfter=4),
 'h1':style('h1',24,33,fontName='MGB',textColor=NAVY,spaceAfter=10,wordWrap=None,splitLongWords=False),
 'kicker':style('kicker',11,16,fontName='MGB',textColor=GRAY,spaceAfter=6),
 'small':style('small',11,14,textColor=GRAY),
 'ref':style('ref',12,18,textColor=TEAL,spaceAfter=13),
 'source':style('source',fontName='MGB',textColor=TEAL,spaceBefore=7,spaceAfter=7),
 'note':style('note',backColor=PALE,borderPadding=6,spaceBefore=5,spaceAfter=8),
}

def chunks(seq,n):return [seq[i:i+n] for i in range(0,len(seq),n)]

EXTRA=[]
for kind,items,n,title in [('quiz',QUIZ,5,'개념 문제'),('answers',QUIZ,5,'답안과 근거'),('faq',FAQ,2,'예상 질문과 답변'),('sources',SOURCES,5,'자료 확인 · 참고 출처'),('corrections',CORRECTIONS,3,'원문을 다듬고 확인한 부분')]:
    groups=chunks(items,n)
    for i,group in enumerate(groups):EXTRA.append(dict(type=kind,id=f'{kind}{i+1}',title=f'{title} {i+1}/{len(groups)}',items=group,start=i*n+1))
ALL=PAGES+EXTRA
BY_ID={p['id']:p for p in ALL}
REFS={x[0]:x for x in SOURCES}
PAGE_NO={}
CAPTURE_GROUPS={
 'neptune':dict(folder=ROOT/'원본'/'해왕성'/'screenshots',url='https://www.youtube.com/watch?v=U5eVzn6bx2I'),
 'oxygen':dict(folder=ROOT/'원본'/'산소'/'screenshots',url='https://www.youtube.com/watch?v=whHsl0w9abw'),
}
CAPTURES={}
for group,config in CAPTURE_GROUPS.items():
    data=json.loads((config['folder']/'manifest.json').read_text(encoding='utf-8-sig'))
    CAPTURES[group]={x['id']:x for x in data['images']}

def line(c,text,x,y,size=12,font='MG',color=INK):
    c.setFillColor(color);c.setFont(font,size);c.drawString(x,y,text)

def center(c,text,x,y,size=12,font='MG',color=INK):
    c.setFillColor(color);c.setFont(font,size);c.drawCentredString(x,y,text)

def font_safe(markup,bold=False):
    glyphs=pdfmetrics.getFont('MGB' if bold else 'MG').face.charToGlyph
    family='LatinB' if bold else 'Latin'
    return ''.join(f'<font name="{family}">{ch}</font>' if ord(ch)>127 and ord(ch) not in glyphs else ch for ch in markup)

def drawpara(c,text,x,top,width,size=12,leading=18,color=INK,bold=False,align=0,word_wrap='CJK'):
    st=style('draw',size,leading,textColor=color,fontName='MGB' if bold else 'MG',alignment=align,wordWrap=word_wrap,splitLongWords=word_wrap=='CJK')
    p=Paragraph(font_safe(escape(text).replace('\n','<br/>'),bold),st);_,h=p.wrap(width,H);p.drawOn(c,x,top-h);return top-h

def arrow(c,x1,y1,x2,y2,col=TEAL,width=2):
    c.setStrokeColor(col);c.setLineWidth(width);c.line(x1,y1,x2,y2)
    ang=math.atan2(y2-y1,x2-x1);p=c.beginPath();p.moveTo(x2,y2)
    for a in [ang+2.65,ang-2.65]:p.lineTo(x2+8*math.cos(a),y2+8*math.sin(a))
    p.close();c.setFillColor(col);c.drawPath(p,stroke=0,fill=1)

def planet(c,x,y,r,col=TEAL):
    c.setFillColor(col);c.circle(x,y,r,fill=1,stroke=0)
    c.setStrokeColor(colors.HexColor('#8cc6ca'));c.setLineWidth(1.6)
    for d in [-.45,-.1,.3]:
        half=math.sqrt(max(0,r*r-(d*r)**2));c.bezier(x-half,y+d*r,x-r*.3,y+d*r+4,x+r*.4,y+d*r-5,x+half,y+d*r)
    c.setStrokeColor(colors.HexColor('#d2e9e4'));c.arc(x-r*.9,y-r*.9,x+r*.9,y+r*.9,60,95)

def sun(c,x,y,r):
    c.setStrokeColor(GOLD);c.setLineWidth(1.5)
    for i in range(12):
        a=i*math.pi/6;c.line(x+(r+5)*math.cos(a),y+(r+5)*math.sin(a),x+(r+11)*math.cos(a),y+(r+11)*math.sin(a))
    c.setFillColor(GOLD);c.circle(x,y,r,stroke=0,fill=1)

def cover(c):
    c.setFillColor(NAVY);c.rect(0,0,W,H,stroke=0,fill=1)
    rng=random.Random(16)
    for _ in range(60):
        c.setFillColor(colors.HexColor('#546479'));c.circle(rng.uniform(275,W-30),rng.uniform(370,H-40),rng.choice([.5,.7,1]),stroke=0,fill=1)
    c.setStrokeColor(GOLD);c.setLineWidth(.9);c.rect(24,24,W-48,H-48,stroke=1,fill=0)
    line(c,'관측 · 가설 · 철학 · 믿음',42,H-58,11,'MGB',GOLD)
    for text,y in [('과학적으로',H-124),('풀 수가 없는',H-174),('난제',H-224)]:line(c,text,42,y,36,'MGB',WHITE)
    c.setFillColor(GOLD);c.rect(43,H-247,45,3,stroke=0,fill=1)
    drawpara(c,SUBTITLE,43,H-271,235,17,26,colors.HexColor('#d8e7e5'),word_wrap=None)
    planet(c,410,490,96,colors.HexColor('#2e738b'))
    c.setStrokeColor(GOLD);c.setLineWidth(1);c.ellipse(286,459,535,520,stroke=1,fill=0)
    c.setFillColor(CREAM);c.circle(525,496,3.5,stroke=0,fill=1)
    top=337
    for p in PAGES:
        if p['type']=='part':top=drawpara(c,f'{p["number"]}  {p["title"]}',43,top,W-86,15,23,WHITE,True)-17
    source_lines=["영상: 리뷰엉이: Owl’s Review 「존재 자체가 미스테리인 행성, 해왕성」","토론: 사용자 제공 자막 「과학자들이 신의 존재를 부정할 수 없는 이유」","영상: 리뷰엉이: Owl’s Review 「지구에 '산소'가 있다는 게 기적과도 같은 이유」"]
    top=119
    for text in source_lines:top=drawpara(c,text,43,top,W-86,10.5,15,colors.HexColor('#c0c8cf'))-5

def part(c,p):
    c.setFillColor(NAVY);c.rect(0,0,W,H,stroke=0,fill=1)
    c.setFillColor(colors.HexColor('#1c344c'));c.circle(W-55,H-40,170,stroke=0,fill=1)
    line(c,'CATEGORY',M,H-70,12,'MGB',GOLD);line(c,p['number'],M,H-170,72,'MGB',GOLD)
    drawpara(c,p['title'],M,H-235,CW,30,44,WHITE,True)
    drawpara(c,p['subtitle'],M,335,CW,17,26,colors.HexColor('#badad8'))
    drawpara(c,p.get('terms',''),M,133,CW,11,17,colors.HexColor('#c0c8cf'))
    c.linkAbsolute('', 'toc',(M,31,M+85,57),thickness=0);line(c,'차례로',M,44,11,color=GOLD)
    c.setFont('MGB',11);c.setFillColor(GOLD);c.drawRightString(W-M,44,str(c.getPageNumber()))
    if p['number']=='1':planet(c,W-110,H-116,55)
    elif p['number']=='2':
        c.setStrokeColor(GOLD);c.setLineWidth(1)
        for r in [25,40,58]:c.circle(W-110,H-116,r,fill=0,stroke=1)
        center(c,'?',W-110,H-129,38,'MGB',GOLD)
    else:
        for x in [W-126,W-96]:c.setFillColor(TEAL);c.circle(x,H-116,25,fill=1,stroke=0)
        for x in [W-126,W-96]:center(c,'O',x,H-124,22,'MGB',WHITE)
        center(c,'O2',W-111,H-174,15,'MGB',GOLD)

class FullPage(Flowable):
    def __init__(self,p):super().__init__();self.p=p;self.width=CW;self.height=FRAME_H;self.section_id=p['id']
    def drawOn(self,c,x,y,_sW=0):
        c.saveState();c.resetTransforms();cover(c) if self.p['type']=='cover' else part(c,self.p);c.restoreState()

class Anchor(Flowable):
    def __init__(self,p):super().__init__();self.p=p;self.section_id=p['id'];self.width=0;self.height=0
    def draw(self):
        self.canv.bookmarkPage(self.section_id)
        if self.p['type']=='part' or self.section_id in {'howto','toc','opening','closing','quiz1','answers1','faq1','sources1','corrections1'}:
            self.canv.addOutlineEntry(self.p['title'],self.section_id,level=0,closed=False)

class TaggedParagraph(Paragraph):
    def split(self,aW,aH):
        parts=super().split(aW,aH)
        for p in parts:
            if hasattr(self,'section_id'):p.section_id=self.section_id
        return parts

def para(text,p,kind='body',raw=False):
    markup=text if raw else escape(text).replace('\n','<br/>')
    out=TaggedParagraph(font_safe(markup,STYLES[kind].fontName=='MGB'),STYLES[kind]);out.section_id=p['id'];return out

class AnswerLine(Flowable):
    def __init__(self):super().__init__();self.width=CW;self.height=25
    def draw(self):self.canv.setStrokeColor(colors.HexColor('#cbd5d2'));self.canv.setLineWidth(.6);self.canv.line(28,8,CW,8)

class Diagram(Flowable):
    def __init__(self,p):super().__init__();self.p=p;self.section_id=p['id'];self.width=CW;self.height=210
    def drawOn(self,c,x,y,_sW=0):
        self.pdf_box=[x,H-y-self.height,x+self.width,H-y]
        super().drawOn(c,x,y,_sW)
    def draw(self):
        c=self.canv;c.translate(0,-15);n=self.p['diagram'];mid=CW/2
        if n=='formation':
            for x,col,value,label in [(124,GOLD,'100억 년','특정 모형이 요구한\n성장 시간'),(CW-124,TEAL,'약 45억 년','NASA가 설명하는\n실제 형성 시기')]:
                c.setStrokeColor(col);c.setLineWidth(3);c.circle(x,166,35,fill=0,stroke=1);c.line(x,166,x-14,184);c.line(x,166,x+20,168)
                center(c,value,x,109,18,'MGB',col);drawpara(c,label,x-105,89,210,12,18,INK,False,1)
            center(c,'서로 다른 종류의 값',mid,27,15,'MGB',colors.HexColor('#9e4b3e'))
        elif n=='heat':
            sun(c,55,150,23);planet(c,mid,150,42)
            arrow(c,98,150,mid-58,150,GOLD,3);drawpara(c,'흡수 태양에너지 1',95,211,150,14,20,INK,True,1)
            for dy in [-23,0,23]:arrow(c,mid+60,150+dy,CW-22,150+dy,TEAL,2)
            drawpara(c,'총 열방출 약 2.6',mid+50,224,CW-mid-50,14,20,TEAL,True,1)
            drawpara(c,'개념적 에너지 장부 · 시간에 따른 세부 변화 생략',10,58,CW-20,12,18,GRAY,False,1)
        elif n=='boundaries':
            for x,col,l1,l2 in [(82,TEAL,'과학의 방법','관측·실험·예측'),(mid,GOLD,'철학적 논증','전제·이유·반론'),(CW-82,NAVY,'개인의 신앙','믿음과 그 근거')]:
                c.setFillColor(colors.Color(col.red,col.green,col.blue,.10));c.circle(x,157,64,fill=1,stroke=0);c.setStrokeColor(col);c.setLineWidth(1);c.circle(x,157,64,fill=0,stroke=1)
                center(c,l1,x,165,15,'MGB',col);center(c,l2,x,134,12,color=INK)
            drawpara(c,'각 질문에 어떤 방법을 적용하는지 먼저 확인합니다',0,62,CW,12,18,GRAY,False,1)
        elif n=='brain':
            rng=random.Random(3);nodes=[(110+rng.uniform(-50,50),151+rng.uniform(-40,40)) for _ in range(14)]
            c.setStrokeColor(colors.HexColor('#b4cfca'));c.setLineWidth(.8)
            for i,a in enumerate(nodes):
                for b in nodes[i+1:i+4]:c.line(*a,*b)
            for x,y in nodes:c.setFillColor(TEAL);c.circle(x,y,4,fill=1,stroke=0)
            center(c,'믿는 사람의 뇌·행동',110,76,14,'MGB',TEAL);arrow(c,186,151,290,151)
            center(c,'연구할 수 있는 과정',365,205,14,'MGB',TEAL);center(c,'?',452,145,42,'MGB',GOLD)
            drawpara(c,'존재 여부는\n별도 질문',290,128,205,15,22,NAVY,True,1)
            drawpara(c,'심리 설명과 대상의 존재 판정을 같은 질문으로 바꾸지 않습니다',0,60,CW,12,18,GRAY,False,1)
        elif n=='cause':
            xs=[55,193,331,CW-55]
            for i,x in enumerate(xs):
                col=GOLD if i==0 else TEAL;c.setStrokeColor(col);c.setLineWidth(2);c.circle(x,164,28,fill=0,stroke=1);center(c,'?' if i==0 else f'원인 {i}',x,158,14,'MGB',col)
                if i<3:arrow(c,x+34,164,xs[i+1]-35,164)
            drawpara(c,'처음에서 멈춤? · 끝없이 이어짐?\n서로 순환함? · 주어진 사실로 둠?',0,103,CW,14,22,INK,True,1)
            drawpara(c,'이름만 붙이는 것으로 논증이 완성되지는 않습니다',0,42,CW,12,18,GRAY,False,1)
        elif n=='casimir':
            c.setStrokeColor(TEAL);c.setLineWidth(6);c.line(205,78,205,183);c.line(320,78,320,183)
            for xx in [50,105,155,370,420,475]:
                c.setStrokeColor(colors.HexColor('#a7c8c4'));c.setLineWidth(1);q=c.beginPath();q.moveTo(xx,83)
                for k in range(5):q.curveTo(xx-12,88+k*17,xx+12,94+k*17,xx,100+k*17)
                c.drawPath(q,stroke=1,fill=0)
            arrow(c,153,132,194,132,TEAL,2);arrow(c,372,132,331,132,TEAL,2)
            drawpara(c,'가까운 두\n금속판',210,156,105,15,22,NAVY,True,1)
            drawpara(c,'힘은 측정 대상 · 절대무에서 우주를 만든 실험은 아님',0,58,CW,12,18,GRAY,False,1)
        elif n=='matter':
            for base,col,count,label,mark in [(42,TEAL,10,'물질','M'),(327,GOLD,9,'반물질','A')]:
                for i in range(count):x=base+(i%5)*32;y=188-(i//5)*36;c.setFillColor(col);c.circle(x,y,10,fill=1,stroke=0);center(c,mark,x,y-4,12,'MGB',WHITE)
                center(c,label,base+64,109,15,'MGB',col)
            center(c,'왜 한쪽이 더 남았을까?',mid,75,15,'MGB',NAVY)
            drawpara(c,'표식과 개수는 개념을 설명하기 위한 것이며 실제 비율을 나타내지 않습니다',0,52,CW,12,18,GRAY,False,1)
        elif n=='oxygen_budget':
            sun(c,35,166,12)
            for x,y in [(89,170),(105,180),(117,163),(97,151),(120,147)]:c.setFillColor(TEAL);c.ellipse(x-10,y-5,x+10,y+5,fill=1,stroke=0)
            center(c,'남세균',103,100,14,'MGB',TEAL);arrow(c,155,165,225,165);center(c,'생성',188,193,14,'MGB',TEAL)
            c.setStrokeColor(TEAL);c.setFillColor(PALE);c.roundRect(240,119,53,83,5,fill=1,stroke=1);c.setFillColor(colors.HexColor('#9ccfcd'));c.rect(245,125,43,30,fill=1,stroke=0);center(c,'O2',266,175,17,'MGB',TEAL)
            arrow(c,308,165,380,165,GOLD);center(c,'소비',344,193,14,'MGB',GOLD)
            q=c.beginPath();q.moveTo(402,140);q.lineTo(425,190);q.lineTo(450,151);q.lineTo(468,169);q.lineTo(491,140);q.close();c.setFillColor(colors.HexColor('#8d8173'));c.drawPath(q,fill=1,stroke=0);center(c,'철·암석 등',447,100,14,'MGB',INK)
            drawpara(c,'생성량과 소비량이 달라지면 남는 O2도 달라집니다',0,57,CW,12,18,GRAY,False,1)
        elif n=='oxygen_atp':
            drawpara(c,'발효 예시\nATP 2',24,223,190,15,22,GOLD,True,1);drawpara(c,'산소호흡 예시\nATP 약 30',290,223,220,15,22,TEAL,True,1)
            for i in range(2):c.setFillColor(GOLD);c.roundRect(75+i*36,133,27,33,3,fill=1,stroke=0)
            for i in range(30):c.setFillColor(TEAL);c.roundRect(305+(i%10)*18,160-(i//10)*21,14,14,2,fill=1,stroke=0)
            c.setStrokeColor(colors.HexColor('#cbd5d2'));c.setLineWidth(1);c.line(248,110,248,195)
            center(c,'같은 포도당 한 분자를 비교한 예시',mid,79,14,'MGB',INK)
            drawpara(c,'ATP 수율은 세포와 조건에 따라 달라집니다',0,56,CW,12,18,GRAY,False,1)
        elif n=='oxygen_ozone':
            def atom(x,y):c.setFillColor(TEAL);c.circle(x,y,12,fill=1,stroke=0);center(c,'O',x,y-4,12,'MGB',WHITE)
            atom(46,154);atom(70,154);center(c,'O2',58,196,15,'MGB',TEAL)
            arrow(c,102,154,175,154,GOLD);center(c,'자외선',138,182,12,'MGB',GOLD)
            atom(210,154);atom(248,154);arrow(c,282,154,377,154);drawpara(c,'다른 O2와 결합',270,211,125,12,18,TEAL,True,1)
            atom(430,154);atom(454,154);atom(442,175);center(c,'O3',493,153,15,'MGB',TEAL)
            drawpara(c,'주변 분자의 충돌 도움 · 생성과 소멸이 함께 일어나는 과정의 일부를 표시',0,61,CW,12,18,GRAY,False,1)
        else:raise ValueError(f'Unknown diagram: {n}')

class BookDoc(BaseDocTemplate):
    def __init__(self,path):
        super().__init__(str(path),pagesize=A4,leftMargin=M,rightMargin=M,topMargin=TOP,bottomMargin=BOTTOM,title=TITLE,author='사용자 제공 자료를 바탕으로 집필',subject=SUBTITLE,pageCompression=1)
        frame=Frame(M,BOTTOM,CW,FRAME_H,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
        self.addPageTemplates(PageTemplate(id='portrait',frames=[frame],onPage=self.background,onPageEnd=self.footer))
        self.anchors={};self.section_pages={};self.capture_pages={};self.page_sections={};self.special_pages={};self.diagram_regions=[]
    def beforePage(self):self.touched=[]
    def background(self,c,doc):
        c.setFillColor(CREAM);c.rect(0,0,W,H,fill=1,stroke=0);c.setFillColor(GOLD);c.rect(M,H-29,28,3,fill=1,stroke=0)
        line(c,TITLE,M+39,H-30,9,color=GRAY)
    def afterFlowable(self,f):
        sid=getattr(f,'section_id',None)
        if sid:
            if sid not in self.touched:self.touched.append(sid)
            pages=self.section_pages.setdefault(sid,[])
            if self.page not in pages:pages.append(self.page)
        if isinstance(f,Anchor):
            self.anchors[f.section_id]=self.page
            if f.p['type'] in ['cover','part']:self.special_pages[self.page]=f.p['type']
        if hasattr(f,'capture_id'):self.capture_pages[f.capture_id]=self.page
        if isinstance(f,Diagram):self.diagram_regions.append(dict(page=self.page,id=f.p['id'],box=f.pdf_box))
    def footer(self,c,doc):
        self.page_sections[self.page]=list(self.touched)
        if self.page in self.special_pages:return
        terms=[];codes=[]
        for sid in self.touched:
            p=BY_ID[sid];term=p.get('terms')
            if term and term not in terms:terms.append(term)
            for code in p.get('sources',[]):
                if code not in codes:codes.append(code)
        if not terms:terms=['관측한 사실과 그 사실을 설명하는 모형의 범위를 함께 확인합니다.']
        if codes:
            x=M;line(c,'자료 확인',x,124,11,'MGB',TEAL);x+=58
            for code in codes:
                label=f'[{code}]';ww=pdfmetrics.stringWidth(label,'MG',11);line(c,label,x,124,11,color=TEAL);c.linkURL(REFS[code][2],(x,121,x+ww,138),relative=0,thickness=0);x+=ww+12
        pp=Paragraph(escape(' / '.join(terms)),STYLES['small']);_,hh=pp.wrap(CW,H)
        if hh>75:raise ValueError(f'Footer too tall page {self.page}: {hh}')
        pp.drawOn(c,M,105-hh)
        c.setStrokeColor(colors.HexColor('#d6d9d4'));c.setLineWidth(.6);c.line(M,29,W-M,29)
        line(c,TITLE,M,13,9,color=GRAY);line(c,'차례로',W-M-68,13,10,color=TEAL);c.linkAbsolute('', 'toc',(W-M-73,5,W-M-24,29),thickness=0)
        c.setFont('MGB',10);c.setFillColor(NAVY);c.drawRightString(W-M,13,str(self.page))

def block(p,label,text):return [para(label,p,'label'),para(text,p),Spacer(1,2)]

def capture(p):
    group=p.get('source_group','neptune');meta=CAPTURES[group][p['shot']];path=CAPTURE_GROUPS[group]['folder']/meta['file']
    with PILImage.open(path) as im:iw,ih=im.size
    out=Image(str(path),width=CW,height=CW*ih/iw);out.section_id=p['id'];out.capture_id=p['shot']
    seconds=int(meta['seconds']);stamp=f'{seconds//60:02d}:{seconds%60:02d}'
    caption=f'{p["shot"]} · 캡처 {stamp} / 논의 {p["time"]} · {p["caption"]}'
    return [out,para(caption,p,'caption')]

def toc_units(p):
    rows=[('시작하며','opening')]+[(f'{x["number"]}  {x["title"]}',x['id']) for x in PAGES if x['type']=='part']+[('마치며 · 대화에 가져갈 한 문장','closing'),(f'개념 문제 {len(QUIZ)}개','quiz1'),('답안과 근거','answers1'),(f'예상 질문과 답변 {len(FAQ)}개','faq1'),('자료 확인 · 참고 출처','sources1'),('원문을 다듬고 확인한 부분','corrections1')]
    units=[]
    for label,key in rows:
        left=para(f'<a href="#{key}" color="#14263e">{escape(label)}</a>',p,raw=True)
        right=para(f'<a href="#{key}" color="#237f86">{PAGE_NO.get(key,1)}</a>',p,raw=True)
        t=Table([[left,right]],colWidths=[CW-48,48],hAlign='LEFT');t.section_id=p['id']
        t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),4),('LINEBELOW',(0,0),(-1,-1),.5,colors.HexColor('#d6d9d4'))]))
        units.append([t])
    return units

def units_for(p):
    typ=p['type'];units=[]
    if typ=='text':
        units=[block(p,l,t) for l,t in p['blocks']]
        if p.get('note'):units[-1].append(para(p['note'],p,'note'))
    elif typ=='diagram':
        units=[[Diagram(p),Spacer(1,8)]]+[block(p,l,t) for l,t in p['blocks']]
        if p.get('note'):units[-1].append(para(p['note'],p,'note'))
    elif typ=='shot':units=[capture(p)]
    elif typ=='summary':units=[[para(f'<font color="#237f86"><b>{i+1:02d}</b></font>  {escape(text)}',p,raw=True),Spacer(1,8)] for i,text in enumerate(p['items'])]
    elif typ=='toc':units=toc_units(p)
    elif typ=='quiz':
        for i,(q,_,_) in enumerate(p['items']):units.append([para(f'<font color="#c89d4e"><b>{p["start"]+i:02d}</b></font>  {escape(q)}',p,raw=True),AnswerLine(),Spacer(1,8)])
    elif typ=='answers':
        for i,(_,answer,target) in enumerate(p['items']):units.append([para(f'<font color="#237f86"><b>{p["start"]+i:02d}</b></font>  {escape(answer)}',p,raw=True),para(f'<a href="#{target}" color="#237f86">본문 근거 {PAGE_NO.get(target,1)}쪽</a>',p,'ref',True)])
    elif typ=='faq':
        for i,(q,answer,target) in enumerate(p['items']):units.append([para(f'Q{p["start"]+i:02d}  {q}',p,'label'),para(answer,p),para(f'<a href="#{target}" color="#237f86">본문 근거 {PAGE_NO.get(target,1)}쪽</a>',p,'ref',True),Spacer(1,10)])
    elif typ=='sources':
        if p['id']=='sources1':units.append([para('<a href="https://www.youtube.com/watch?v=U5eVzn6bx2I" color="#237f86">영상 출처: 리뷰엉이: Owl’s Review · 존재 자체가 미스테리인 행성, 해왕성</a>',p,'body',True)])
        for code,title,url,desc in p['items']:units.append([para(f'<a href="{escape(url)}" color="#237f86">[{code}] {escape(title)}</a>',p,'source',True),para(desc,p),Spacer(1,8)])
        if p['id']==EXTRA[-len(chunks(CORRECTIONS,3))-1]['id']:
            units.append([para('출처명은 클릭할 수 있습니다. 자료 확인 기준일: '+DATE+' · 2번은 제공 자막만 사용했으며 발언자·프로그램명은 추정하지 않았습니다.',p,'ref')])
    elif typ=='corrections':
        for time,raw,action in p['items']:units.append([para(time,p,'ref'),para(raw,p,'label'),para(action,p),Spacer(1,12)])
    return units

def story():
    out=[];previous=None
    for p in ALL:
        typ=p['type']
        merge=previous and previous['type']=='shot' and typ=='text'
        if out and not merge:out.append(PageBreak())
        if typ in ['cover','part']:
            out.extend([Anchor(p),FullPage(p)])
        else:
            header=[Anchor(p),para(p.get('kicker','읽고 묻는 노트'),p,'kicker'),para(p['title'],p,'h1')]
            if p.get('lead'):header.append(para(p['lead'],p,'lead'))
            if typ=='quiz':header.append(para('자신의 말로 짧게 답해 보세요. 답안과 본문 근거는 뒤쪽에 있습니다.',p,'lead'))
            units=units_for(p)
            if units:out.append(KeepTogether(header+units[0]));out.extend(KeepTogether(u) for u in units[1:])
            else:out.extend(header)
        previous=p
    return out

def expected_content():
    rows=[]
    def add(text,minfont=0):
        if text:rows.append(dict(text=text,min_font=minfont))
    for p in PAGES:
        add(p['title']);add(p.get('subtitle'));add(p.get('lead'),15);add(p.get('note'),15);add(p.get('terms'))
        for label,text in p.get('blocks',[]):add(label,15);add(text,15)
        if p['type']=='shot':add(p['caption'],15)
        if p['type']=='summary':
            for text in p['items']:add(text,15)
    for q,a,_ in QUIZ:add(q,15);add(a,15)
    for q,a,_ in FAQ:add(q,15);add(a,15)
    for code,title,url,desc in SOURCES:add(title,15);add(desc,15)
    for time,raw,action in CORRECTIONS:add(time);add(raw,15);add(action,15)
    return rows

def manuscript():
    text=[f'# {TITLE}',f'\n{SUBTITLE}\n',f'집필 기준일: {DATE}\n','판형: A4 세로\n']
    for p in ALL:
        if p['type']=='cover':continue
        text.append(f'\n## {p["title"]}\n')
        if p.get('lead'):text.append(p['lead']+'\n')
        for label,body in p.get('blocks',[]):text.extend([f'### {label}',body+'\n'])
        if p['type']=='shot':
            sec=int(CAPTURES[p.get('source_group','neptune')][p['shot']]['seconds']);text.append(f'[{p["shot"]} · 캡처 {sec//60:02d}:{sec%60:02d} / 논의 {p["time"]}] {p["caption"]}\n')
        if p.get('note'):text.append(p['note']+'\n')
        if p['type']=='summary':text.extend(f'{i+1}. {t}' for i,t in enumerate(p['items']))
        if p['type']=='quiz':text.extend(f'{p["start"]+i}. {q}' for i,(q,_,_) in enumerate(p['items']))
        if p['type']=='answers':text.extend(f'{p["start"]+i}. {a} (본문 {PAGE_NO[k]}쪽)' for i,(_,a,k) in enumerate(p['items']))
        if p['type']=='faq':
            for q,a,k in p['items']:text.extend([f'### {q}',a+f' (본문 {PAGE_NO[k]}쪽)'])
        if p['type']=='sources':text.extend(f'- [{code}] [{title}]({url}) — {desc}' for code,title,url,desc in p['items'])
        if p['type']=='corrections':text.extend(f'- {tm} · {raw}: {act}' for tm,raw,act in p['items'])
        if p.get('sources'):text.append('자료 확인: '+', '.join(p['sources']))
        if p.get('terms'):text.append('용어: '+p['terms'])
    (ROOT/'원본'/'원고.md').write_text('\n'.join(text)+'\n',encoding='utf-8')

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--output',type=Path,default=OUT);ap.add_argument('--qa-dir',type=Path,required=True);a=ap.parse_args();a.qa_dir.mkdir(parents=True,exist_ok=True)
    previous_map=None
    for attempt in range(1,5):
        path=a.qa_dir/f'layout-pass-{attempt}.pdf';doc=BookDoc(path);doc.build(story())
        current=doc.anchors;PAGE_NO.clear();PAGE_NO.update(current)
        if current==previous_map:break
        previous_map=dict(current)
    else:raise RuntimeError('Page references did not converge')
    shutil.copyfile(path,a.output);manuscript()
    captures=[]
    for p in PAGES:
        if p['type']!='shot':continue
        group=p.get('source_group','neptune');meta=CAPTURES[group][p['shot']];file=CAPTURE_GROUPS[group]['folder']/meta['file']
        with PILImage.open(file) as im:iw,ih=im.size
        sec=int(meta['seconds']);captures.append(dict(id=p['shot'],group=group,file=str(file.relative_to(ROOT)).replace('\\','/'),width=iw,height=ih,page=doc.capture_pages[p['shot']],sha256=hashlib.sha256(file.read_bytes()).hexdigest(),source=CAPTURE_GROUPS[group]['url'],time_range=p['time'],captured_seconds=meta['seconds'],captured_time=f'{sec//60:02d}:{sec%60:02d}'))
    for group in CAPTURE_GROUPS:
        (CAPTURE_GROUPS[group]['folder']/'book_capture_manifest.json').write_text(json.dumps([x for x in captures if x['group']==group],ensure_ascii=False,indent=2),encoding='utf-8')
    layout=dict(portrait=True,page_size=[W,H],pages=doc.page,page_no=doc.anchors,section_pages=doc.section_pages,page_sections=doc.page_sections,special_pages=doc.special_pages,diagram_regions=doc.diagram_regions,captures=captures,expected_content=expected_content(),body_font=15,diagram_font_min=12)
    (a.qa_dir/'layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(dict(output=str(a.output),pages=doc.page,captures=len(captures),quizzes=len(QUIZ),faqs=len(FAQ),layout_passes=attempt),ensure_ascii=False))

if __name__=='__main__':main()
