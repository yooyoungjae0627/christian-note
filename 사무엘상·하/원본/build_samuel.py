"""사무엘상 장별 교재 빌드 — 창세기/원본/build_reference_chapters.py를 사무엘상용으로 옮긴 것.
같은 기준 스타일(reference_style.css)로 PDF를 만들고, 고정 배치 EPUB을 만든다.
   번들 Python -X utf8 사무엘상·하/원본/build_samuel.py [장 …]"""
import json,re,html,os,sys,subprocess,zipfile,logging
import pdfplumber
logging.getLogger('pdfminer').setLevel(logging.ERROR)
from pathlib import Path
from pypdf import PdfReader,PdfWriter
B=Path(__file__).resolve().parent;R=B.parents[1];OUT=R/'사무엘상·하'
T=Path(os.environ['TEMP'])/'samuel-style';T.mkdir(exist_ok=True)
QR=Path(os.environ['TEMP'])/'samuel-chapters'
NODE='C:/Program Files/nodejs/node.exe'
V=json.loads((B/'verses_01-15.json').read_text(encoding='utf-8-sig'))
CSS=(B/'reference_style.css').read_text(encoding='utf8')
CSS+='.source-text .basis{color:#6b8bb5;}.note.verse-q{margin-top:0;}\n'
FONT_CSS=''.join(f'@font-face{{font-family:"Noto {family} KR";font-weight:{weight};font-style:normal;src:url("{(T/f"Noto{family}KR-{weight}.ttf").as_uri()}") format("truetype");}}' for family,weights in [('Serif',[400,700]),('Sans',[300,400,500,700,900])] for weight in weights)
CSS=FONT_CSS+CSS
sys.path.insert(0,str(B))
from cover_art import CHAPTER_ART
BASIS={'direct':'','linked':' · 관련 강의 연결','doctrine':' · 교회 교리 적용'}
def esc(t):return html.escape(str(t),quote=True)
def run(args):subprocess.run(args,check=True,cwd=R)
def stamp(pages):
 ranges=[]
 for n in pages:
  if ranges and ranges[-1][-1]+1==n:ranges[-1].append(n)
  else:ranges.append([n])
 return ', '.join(str(a[0]) if len(a)==1 else f'{a[0]}–{a[-1]}' for a in ranges)
def time(url):
 n=int(re.search(r'[?&]t=(\d+)',url)[1]);return f'{n//3600}시간 {n%3600//60}분 {n%60:02d}초' if n>=3600 else f'{n//60}분 {n%60:02d}초'
def inline(c):
 out=[];pos=0
 spans=sorted(({'start':c['text'].index(s['text']),'end':c['text'].index(s['text'])+len(s['text']),'level':s['level']} for s in c.get('spans',[])),key=lambda s:s['start'])
 for s in spans:
  if s['start']<pos:continue
  out.append(esc(c['text'][pos:s['start']]));text=esc(c['text'][s['start']:s['end']])
  out.append(f'<span class="hl{s["level"]}">'+text+'</span>');pos=s['end']
 out.append(esc(c['text'][pos:]));return ''.join(out)
def where(e):
 if e['type']=='pdf':return f'PDF {stamp(e["pages"])}쪽'
 return f'강의 {e["time"]}'
def source(c,qr=False):
 out=[]
 for i,e in enumerate(c['evidence']):
  text=f'〔{esc(e["source"])} · {where(e)}〕<span class="basis">{BASIS[c["basis"]]}</span><br/><span class="file">{esc(Path(e["file"]).name)}</span>'
  image=''
  if e.get('url'):
   text+=f'<br/><a class="jump" href="{esc(e["url"])}">▶ {time(e["url"])}</a>'
   if qr:
    qrpath=(QR/f'{c["id"]}-{i}.png').as_uri()
    image=f'<div class="qr"><a href="{esc(e["url"])}"><img src="{qrpath}" alt="강의 구간 QR"/></a><div class="time">{time(e["url"])}</div><div class="hint">클릭하면 해당 구간으로 이동합니다.</div></div>'
  out.append('<div class="source-row"><div class="source-text">'+text+'</div>'+image+'</div>')
 return ''.join(out)
INTRO=[('이 책은','사무엘상의 절 순서로 읽으며 첫열매들 교회의 강의와 교재, 그리고 교회 교리로 본문을 이해하는 교재입니다. 해설을 붙일 근거를 찾지 못한 부분은 본문을 그대로 읽도록 남겼습니다.'),
 ('해설의 세 갈래','출처 줄에 표시가 없는 해설은 강의·교재가 그 절을 직접 풀이한 것입니다. ‘관련 강의 연결’은 다른 장을 다룬 강의가 이 절을 인용하며 한 설명이고, ‘교회 교리 적용’은 강의에 이 절의 풀이가 없어 교회 교리(밀크 교재 등)의 원리를 이 절에 비추어 본 설명입니다. 세 갈래를 구분하며 읽으십시오.'),
 ('출처','해설마다 강의·교재 이름과 쪽수(PDF) 또는 강의 시각을 적었습니다. 「다윗의 삶」 강의는 서울침례교회 이이레 강사의 사무엘기 연속 강의이며, 이 재생목록은 사무엘상 16장부터 강의하므로 1–15장은 다른 장 강의에서 인용된 대목입니다.'),
 ('성경 본문','한글과 영어 본문은 표준킹제임스성경 한영대역의 글자 그대로입니다.'),
 ('영상 구간과 차례','QR 또는 ▶ 시각을 누르면 그 구간부터 영상이 재생됩니다. 강의 시각은 YouTube 자동 자막에 표시된 그 줄의 시작 시각이고, 교재 PDF의 시각은 원 교재에 실린 구간 주소입니다. 이번 제작에서 영상을 재생하여 발언 시점을 다시 확인하지는 않았습니다. 차례의 제목을 누르면 해당 단락으로 이동합니다.')]
def header(label,en,key,marker):return f'<section class="front" id="{key}">{marker(key)}<p class="eyebrow">{en}</p><h1>{esc(label)}</h1><div class="gold"></div>'
def basis_of(L,x,comments,refs):
 if x.get('key'):return f'근거: 사무엘상 {refs[x["key"]]} 해설'
 return f'근거: 사무엘상 {x["verse"]} 본문'
def htmlbook(ch,d,pages,markers=False):
 marker=(lambda key:f'<span class="marker">@@{key}@@</span>') if markers else (lambda key:'')
 comments={c['id']:c for s in d['sections'] for c in s['comments']};refs={c['id']:s['ref'] for s in d['sections'] for c in s['comments']};L=d['learning']
 nav=[('chapter',f'사무엘상 {ch}장')]+[(f's{i+1}',s['ref']+' '+s['title']) for i,s in enumerate(d['sections'])]+[('summary','한눈에 보는 이야기'),('questions','개념 문제'),('answers','답안과 근거'),('faq','예상 질문과 답변'),('glossary','용어 풀이'),('sources','참고한 교회 자료')]
 motto=esc(d['motto'])
 out=[f'<section class="cover"><i class="diamond top"></i><i class="diamond bottom"></i><div class="ed">FIRSTFRUITS · 첫열매들 교리로 읽는 성경</div><h1>사무엘상<br/>{ch}장 해설</h1><div class="sub">{esc(d["subtitle"])} — 교회 강의와 교리로 풀어 읽기</div><div class="art">{CHAPTER_ART[ch]}</div><div class="motto">{motto}</div><div class="bar"></div><div class="bot">첫열매들(FIRSTFRUITS) 강의와 교재로 엮은</div></section>']
 out.append(header('이 책을 읽는 법','HOW TO READ','howto',marker))
 for label,text in INTRO:out.append('<div class="lab">'+label+'</div><p>'+esc(text)+'</p>')
 out.append('<div class="lab">강조 표시</div><table class="legend"><tr><td><span class="hl1">노란 바탕</span></td><td>중요</td></tr><tr><td><span class="hl2">노란 바탕 + 굵게</span></td><td>더 중요</td></tr><tr><td><span class="hl3">노란 바탕 + 굵게 + 빨간 밑줄</span></td><td>핵심 명제</td></tr><tr><td>파란 인용 상자</td><td>교재 문장을 그대로 옮긴 곳</td></tr></table></section>')
 out.append(header('차례','CONTENTS','toc',marker)+'<div class="toc">')
 for key,label in nav:
  cls='group' if key=='chapter' else 'row' if key.startswith('s') and key[1:].isdigit() else 'row extra'
  out.append(f'<a class="{cls}" href="#{key}"><span>{esc(label)}</span><span class="dots"></span><span class="pg">{pages.get(key,"·")}</span></a>')
 out.append('</div></section><section class="front" id="chapter">'+marker('chapter')+f'<div class="chapter-header"><p class="eyebrow">1 SAMUEL {ch}</p><h1>사무엘상 {ch}장</h1><div class="subtitle">{esc(d["subtitle"])}</div><div class="gold"></div></div>')
 for i,s in enumerate(d['sections']):
  key=f's{i+1}';a=s['ref'].split(':')[1].split('-');verses=[v for v in V if v['ref'].split(':')[0]==str(ch) and int(a[0])<=int(v['ref'].split(':')[1])<=int(a[-1])]
  out.append(f'<div class="keep-start"><div class="sech" id="{key}">{marker(key)}<span class="badge">{s["ref"]}</span><h2>{esc(s["title"])}</h2></div><div class="verse"><div class="vl">본문 · 사무엘상 {s["ref"]}</div>')
  for vi,v in enumerate(verses):
   if vi==1:out.append('</div></div><div class="verse continuation">')
   out.append(f'<div class="vrow"><span class="num">{v["ref"].split(":")[1]}</span><p class="ko">{v["koHtml"]}</p><p class="en">{v["enHtml"]}</p></div>')
  out.append('<div class="vs">표준킹제임스성경 한영대역 · kingjamesbiblekorea.com</div></div>'+('</div>' if len(verses)==1 else ''))
  if s['comments']:out.append('<div class="category">교회 강의·교재·교리의 해설</div>')
  for c in s['comments']:
   cls='quote' if c.get('quote') else ''
   out.append(f'<div class="comment"><p class="{cls}">{inline(c)}</p>{source(c,True)}</div>')
  for text in s.get('notes',[]):
   text=re.sub(r'^해설 없음\s*','',text)
   out.append('<div class="note"><b>해설 미수록</b><br/>'+esc(text)+'</div>')
 out.append('</section>'+header('한눈에 보는 이야기','SUMMARY','summary',marker)+'<ol class="summary">')
 for x in L['summary']:out.append('<li>'+esc(x['text'])+'</li>')
 out.append('</ol></section>'+header('개념 문제','QUESTIONS','questions',marker)+'<ol class="questions">')
 for x in L['questions']:out.append('<li>'+esc(x['q'])+'</li>')
 out.append('</ol></section>'+header('답안과 근거','ANSWERS','answers',marker))
 for i,x in enumerate(L['questions']):
  out.append(f'<div class="qa"><p class="q">{i+1:02}. {esc(x["q"])}</p><p class="answer">{esc(x["a"])}</p><div class="source-text">{basis_of(L,x,comments,refs)}</div>'+(source(comments[x['key']]) if x.get('key') else '')+'</div>')
 out.append('</section>'+header('예상 질문과 답변','QUESTIONS & ANSWERS','faq',marker)+'<div class="note">이 장의 해설에서 확인한 설명으로 답합니다.</div>')
 for i,x in enumerate(L['faq']):
  c=comments[x['key']];out.append(f'<p class="q">Q{i+1}. {esc(x["q"])}</p><p>{esc(c["text"])}</p>'+source(c))
 out.append('</section>'+header('용어 풀이','GLOSSARY','glossary',marker))
 for x in L['glossary']:
  out.append('<div class="gl"><div class="gt">'+esc(x['term'])+'</div><p>'+esc(x['text'])+'</p><div class="source-text">'+basis_of(L,x,comments,refs)+'</div></div>')
 out.append('</section>'+header('참고한 교회 자료','SOURCES','sources',marker)+'<table class="source-table"><thead><tr><th>강의·교재</th><th>파일</th></tr></thead><tbody>')
 files={}
 for c in comments.values():
  for e in c['evidence']:
   label=e['source']
   if e['type']=='transcript':
    vid=re.search(r'youtu\.be/([\w-]{11})',e['url'])[1];label+=f' · youtu.be/{vid}'
   files.setdefault(e['file'],label)
 for file,label in files.items():out.append('<tr><td>'+esc(label)+'</td><td>'+esc(file)+'</td></tr>')
 out.append('</tbody></table><p class="note" style="margin-top:4mm">성경 본문: 표준킹제임스성경 한영대역(kingjamesbiblekorea.com). 교리의 근간: 「MILK · 하나님 말씀의 기초원리」 1–10강.</p></section>')
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"/><title>사무엘상 '+str(ch)+'장 성경 공부 교재</title><style>'+CSS+'</style></head><body>'+''.join(out)+'</body></html>',nav
def finish_pdf(raw,final,nav,pages):
 reader=PdfReader(raw);writer=PdfWriter();writer.clone_document_from_reader(reader)
 from pypdf.generic import ArrayObject,NameObject
 for page in writer.pages:
  refs=page.get('/Annots',[]);kept=[]
  for i,ref in enumerate(refs):
   obj=ref.get_object();uri=obj.get('/A',{}).get('/URI');rect=obj.get('/Rect');duplicate=False
   if uri and rect:
    for j,other in enumerate(refs):
     if i==j:continue
     o=other.get_object();r=o.get('/Rect')
     if o.get('/A',{}).get('/URI')!=uri or not r:continue
     same=all(abs(float(a)-float(b))<.1 for a,b in zip(rect,r))
     inner=rect[0]<=r[0]+.1 and rect[1]<=r[1]+.1 and rect[2]>=r[2]-.1 and rect[3]>=r[3]-.1
     if (same and j<i) or (inner and not same):duplicate=True;break
   if not duplicate:kept.append(ref)
  if refs:page[NameObject('/Annots')]=ArrayObject(kept)
 writer.add_metadata({'/Title':final.stem,'/Author':'성도 유영재'})
 for key,label in nav:writer.add_outline_item(label,pages[key]-1)
 with open(final,'wb') as f:writer.write(f)
def epub_transcript(file,pdf):
 with pdfplumber.open(pdf) as reader:texts=[re.sub(r'\n\s*\d+\s*$','',page.extract_text() or '') for page in reader.pages]
 with zipfile.ZipFile(file) as z:items=[(i,z.read(i.filename)) for i in z.infolist()]
 with zipfile.ZipFile(file,'w') as z:
  for info,data in items:
   m=re.fullmatch(r'OEBPS/p(\d+)\.xhtml',info.filename)
   if m:
    layer='<div class="text-layer">'+esc(texts[int(m[1])-1])+'</div>'
    data=data.decode('utf8').replace('</body>',layer+'</body>').encode('utf8')
   if info.filename=='OEBPS/fl.css':data+=b'.text-layer{position:absolute;left:0;top:0;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden;font-size:1px;line-height:1px;}'
   z.writestr(info,data)
def main():
 CHAPTERS=[int(x) for x in sys.argv[1:]] or list(range(1,16))
 run([sys.executable,'-X','utf8',str(B/'prepare_fonts.py')])
 tool=Path(os.environ['TEMP'])/'topicbook/pdf2epub-samuel.mjs'
 tool.write_text((R/'tools/pdf2epub.mjs').read_text(encoding='utf8'),encoding='utf8')
 for ch in CHAPTERS:
  d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf8'));pages={};raw=T/f'ch{ch}-raw.pdf';hf=T/f'ch{ch}.html'
  for passno in range(4):
   content,nav=htmlbook(ch,d,pages,True);hf.write_text(content,encoding='utf8')
   run([NODE,str(B/'print_html.mjs'),str(hf),str(raw)])
   measured={}
   reader=PdfReader(raw)
   for i,p in enumerate(reader.pages):
    for key in re.findall(r'@@(\w+)@@',re.sub(r'\s+','',p.extract_text() or '')):measured.setdefault(key,i+1)
   if any(key not in measured for key,label in nav):raise RuntimeError(f'Missing anchors {ch}: {set(k for k,t in nav)-measured.keys()}')
   print(f'CHAPTER {ch} PASS {passno+1}: {len(reader.pages)} pages, {len(measured)} anchors',flush=True)
   if measured==pages:break
   pages=measured
  content,nav=htmlbook(ch,d,pages,False);hf.write_text(content,encoding='utf8')
  run([NODE,str(B/'print_html.mjs'),str(hf),str(raw)])
  final=OUT/f'사무엘상_{ch:02}장_교재.pdf';finish_pdf(raw,final,nav,pages)
  run([NODE,str(tool),str(final),str(final.with_suffix('.epub')),'--width','1600','--quality','90'])
  epub_transcript(final.with_suffix('.epub'),final)
  print(json.dumps({'chapter':ch,'pages':len(PdfReader(final).pages),'epub':'fixed-layout','toc':pages},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
