"""Rebuild chapters using measured typography and layout of the user's reference PDF."""
import json,re,html,os,sys,subprocess,zipfile,xml.etree.ElementTree as ET,logging
import pdfplumber
logging.getLogger('pdfminer').setLevel(logging.ERROR)
from pathlib import Path
from pypdf import PdfReader,PdfWriter
from chapter_extras import QA,FAQ,FAQ_PICKS
B=Path(__file__).resolve().parent;R=B.parents[1];OUT=R/'Genesis'
T=Path(os.environ['TEMP'])/'genesis-style-20261010';T.mkdir(exist_ok=True)
QR=Path(os.environ['TEMP'])/'genesis-chapters-20261010'
NODE='C:/Program Files/nodejs/node.exe'
STYLE=json.loads((B/'reference_style.json').read_text(encoding='utf8'))
V=json.loads((B/'verses_01-03.json').read_text(encoding='utf-8-sig'))
CSS=(B/'reference_style.css').read_text(encoding='utf8')
FONT_CSS=''.join(f'@font-face{{font-family:"Noto {family} KR";font-weight:{weight};font-style:normal;src:url("{(T/f"Noto{family}KR-{weight}.ttf").as_uri()}") format("truetype");}}' for family,weights in [('Serif',[400,700]),('Sans',[300,400,500,700,900])] for weight in weights)
CSS=FONT_CSS+CSS
def esc(t):return html.escape(str(t),quote=True)
def run(args):subprocess.run(args,check=True,cwd=R)
def stamp(pages):
 ranges=[]
 for n in pages:
  if ranges and ranges[-1][-1]+1==n:ranges[-1].append(n)
  else:ranges.append([n])
 return ', '.join(str(a[0]) if len(a)==1 else f'{a[0]}–{a[-1]}' for a in ranges)
def time(url):
 n=int(re.search(r'[?&]t=(\d+)',url)[1]);return f'{n//60}분 {n%60:02d}초'
def inline(c):
 spans=STYLE['comments'][c['id']]['spans'];out=[];pos=0
 for s in spans:
  out.append(esc(c['text'][pos:s['start']]));text=esc(c['text'][s['start']:s['end']])
  out.append('<b>'+text+'</b>' if s['level']==4 else f'<span class="hl{s["level"]}">'+text+'</span>');pos=s['end']
 out.append(esc(c['text'][pos:]));return ''.join(out)
def source(c,qr=False):
 out=[]
 for i,e in enumerate(c['evidence']):
  text=f'〔{esc(e["source"])} · PDF {stamp(e["pages"])}쪽〕<br/><span class="file">{esc(Path(e["file"]).name)}</span>'
  image=''
  if e.get('url'):
   text+=f'<br/><a class="jump" href="{esc(e["url"])}">▶ {time(e["url"])}</a>'
   if qr:
    qrpath=(QR/f'{c["id"]}-{i}.png').as_uri()
    image=f'<div class="qr"><a href="{esc(e["url"])}"><img src="{qrpath}" alt="강의 구간 QR"/></a><div class="time">{time(e["url"])}</div><div class="hint">클릭하면 해당 구간으로 이동합니다.</div></div>'
  out.append('<div class="source-row"><div class="source-text">'+text+'</div>'+image+'</div>')
 return ''.join(out)
ART='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 350"><defs><radialGradient id="glow"><stop stop-color="#fff7d0" stop-opacity=".45"/><stop offset="1" stop-color="#fff7d0" stop-opacity="0"/></radialGradient></defs><ellipse cx="170" cy="110" rx="97" ry="78" fill="url(#glow)"/><g fill="none" stroke="#e8c983" stroke-width="2.1" stroke-linecap="round"><circle cx="170" cy="38" r="11" fill="#f6e3a5" stroke="none"/><path d="M170 3V16M170 60V73M136 38H147M193 38H205M146 15L153 22M187 54L194 61M146 61L153 54M187 22L194 15"/><path d="M72 147C67 119 98 93 128 111C150 111 170 134 165 155C187 190 140 196 119 194C93 204 62 186 72 147ZM187 151C183 117 218 108 243 122C264 125 271 146 266 160C282 186 254 197 230 194C205 208 178 178 187 151Z"/><path d="M119 189V240M119 203L102 183M119 200L137 181M228 187V236M228 208L209 193M228 206L246 190M27 241Q168 211 314 241"/></g><g fill="#f6e3a5"><circle cx="100" cy="142" r="4"/><circle cx="125" cy="127" r="4"/><circle cx="153" cy="139" r="3.4"/><circle cx="87" cy="157" r="3.4"/><circle cx="106" cy="169" r="4"/><circle cx="132" cy="172" r="4"/><circle cx="146" cy="157" r="4"/></g><g fill="none" stroke="#e8c983" stroke-width="1.5"><circle cx="212" cy="150" r="4"/><circle cx="240" cy="143" r="4"/><circle cx="219" cy="172" r="4"/><circle cx="249" cy="166" r="4"/></g><path d="M172 233L169 271M169 271L88 300M169 271L253 300M169 271L140 310M169 271L198 310" fill="none" stroke="#b9c5d7" stroke-width="1.8"/></svg>'''
SUB={1:'하늘과 땅, 그리고 사람의 창조',2:'안식, 흙의 몸과 생명의 호흡, 에덴동산',3:'뱀의 말, 사람의 선택, 저주와 가죽옷'}
INTRO=[('이 책은','창세기의 절 순서로 읽으며 첫열매들 교회 강의와 교재의 설명을 확인하는 교재입니다. 해설을 찾지 못한 부분은 본문을 그대로 읽도록 남겼습니다.'),('해설의 원칙','해설마다 강의명, PDF 파일명과 쪽수를 적었습니다. 여러 출처가 붙은 설명은 각 자료의 내용을 연결한 설명입니다. 해당 절의 직접 풀이와 관련 교리를 연결한 설명을 구분하며 읽으십시오.'),('성경 본문','한글과 영어 본문은 표준킹제임스성경 한영대역의 글자 그대로입니다. 해설의 성경 인용은 해당 강의의 설명과 표기를 따릅니다.'),('영상 구간과 차례','원 교재에 관련 구간 주소가 있는 곳은 QR 또는 ▶ 시각을 통해 이동합니다. 출처에 링크가 없어도 쪽수로 근거를 확인할 수 있습니다. 시각은 원 PDF에 실린 기존 구간 주소입니다. 이번 제작에서 유튜브 영상을 재생하여 발언의 시작 시점을 다시 확인하지 않았습니다. 차례의 제목을 누르면 해당 단락으로 이동합니다.')]
def header(label,en,key,marker):return f'<section class="front" id="{key}">{marker(key)}<p class="eyebrow">{en}</p><h1>{esc(label)}</h1><div class="gold"></div>'
def htmlbook(ch,d,pages,markers=False):
 marker=(lambda key:f'<span class="marker">@@{key}@@</span>') if markers else (lambda key:'')
 comments={c['id']:c for s in d['sections'] for c in s['comments']};comment_refs={c['id']:s['ref'] for s in d['sections'] for c in s['comments']};qs=QA[ch];nav=[('chapter',f'창세기 {ch}장')]+[(f's{i+1}',s['ref']+' '+s['title']) for i,s in enumerate(d['sections'])]+[('summary','한눈에 보는 이야기'),('questions','개념 문제'),('answers','답안과 근거'),('faq','예상 질문과 답변'),('glossary','용어 풀이'),('sources','참고한 교회 자료')]
 out=[f'<section class="cover"><i class="diamond top"></i><i class="diamond bottom"></i><div class="ed">FIRSTFRUITS · 첫열매들 교리로 읽는 성경</div><h1>창세기<br/>{ch}장 해설</h1><div class="sub">{esc(SUB[ch])} — 교회 강의와 교재로 풀어 읽기</div><div class="art">{ART}</div><div class="motto">창조는 전부 아들을 통해서 하셨다는 것입니다.<br/>말씀을 통해서요.</div><div class="bar"></div><div class="bot">첫열매들(FIRSTFRUITS) 강의와 교재로 엮은<br/>성도 유영재 교재</div></section>']
 out.append(header('이 책을 읽는 법','HOW TO READ','howto',marker))
 for label,text in INTRO:out.append('<div class="lab">'+label+'</div><p>'+esc(text)+'</p>')
 out.append('<div class="lab">강조 표시</div><table class="legend"><tr><td><span class="hl1">노란 바탕</span></td><td>중요</td></tr><tr><td><span class="hl2">노란 바탕 + 굵게</span></td><td>더 중요</td></tr><tr><td><span class="hl3">노란 바탕 + 굵게 + 빨간 밑줄</span></td><td>핵심 명제</td></tr><tr><td>파란 인용 상자</td><td>교재 문장을 그대로 옮긴 곳</td></tr></table></section>')
 out.append(header('차례','CONTENTS','toc',marker)+'<div class="toc">')
 for key,label in nav:
  cls='group' if key=='chapter' else 'row' if key.startswith('s') and key[1:].isdigit() else 'row extra'
  out.append(f'<a class="{cls}" href="#{key}"><span>{esc(label)}</span><span class="dots"></span><span class="pg">{pages.get(key,"·")}</span></a>')
 out.append('</div></section><section class="front" id="chapter">'+marker('chapter')+f'<div class="chapter-header"><p class="eyebrow">GENESIS {ch}</p><h1>창세기 {ch}장</h1><div class="subtitle">{SUB[ch]}</div><div class="gold"></div></div>')
 for i,s in enumerate(d['sections']):
  key=f's{i+1}';a=s['ref'].split(':')[1].split('-');verses=[v for v in V if v['ref'].startswith(f'{ch}:') and int(a[0])<=int(v['ref'].split(':')[1])<=int(a[-1])]
  out.append(f'<div class="keep-start"><div class="sech" id="{key}">{marker(key)}<span class="badge">{s["ref"]}</span><h2>{esc(s["title"])}</h2></div><div class="verse"><div class="vl">본문 · 창세기 {s["ref"]}</div>')
  for vi,v in enumerate(verses):
   if vi==1:out.append('</div></div><div class="verse continuation">')
   out.append(f'<div class="vrow"><span class="num">{v["ref"].split(":")[1]}</span><p class="ko">{v["koHtml"]}</p><p class="en">{v["enHtml"]}</p></div>')
  out.append('<div class="vs">표준킹제임스성경 한영대역 · kingjamesbiblekorea.com</div></div>'+('</div>' if len(verses)==1 else ''))
  if s['comments']:out.append('<div class="category">교회 강의·교재의 해설</div>')
  for c in s['comments']:
   cls='quote' if STYLE['comments'][c['id']]['quote'] else ''
   out.append(f'<div class="comment"><p class="{cls}">{inline(c)}</p>{source(c,True)}</div>')
  for text in s['notes']:
   text=re.sub(r'^해설 없음\s*','',text).replace('교회 강의· 교재','교회 강의·교재')
   out.append('<div class="note"><b>해설 미수록</b><br/>'+esc(text)+'</div>')
 out.append('</section>'+header('한눈에 보는 이야기','SUMMARY','summary',marker)+'<ol class="summary">')
 allc=list(comments.values());picks=[round(i*(len(allc)-1)/19) for i in range(20)]
 for j in picks:out.append('<li>'+esc(re.split(r'(?<=[.!?])\s',allc[j]['text'],maxsplit=1)[0])+'</li>')
 out.append('</ol></section>'+header('개념 문제','QUESTIONS','questions',marker)+'<ol class="questions">')
 for key,q,a in qs:out.append('<li>'+esc(q)+'</li>')
 out.append('</ol></section>'+header('답안과 근거','ANSWERS','answers',marker))
 for i,(key,q,a) in enumerate(qs):
  c=comments[f'g{ch}-{key}'];out.append(f'<div class="qa"><p class="q">{i+1:02}. {esc(q)}</p><p class="answer">{esc(a)}</p><div class="source-text">근거: 창세기 {comment_refs[c["id"]]} 해설</div>{source(c)}</div>')
 out.append('</section>'+header('예상 질문과 답변','QUESTIONS & ANSWERS','faq',marker)+'<div class="note">이 장의 교회 자료에서 확인한 설명으로 답합니다.</div>')
 for i,j in enumerate(FAQ_PICKS[ch]):
  c=comments[f'g{ch}-{qs[j][0]}'];out.append(f'<p class="q">Q{i+1}. {esc(FAQ[ch][i])}</p><p>{esc(c["text"])}</p>'+source(c))
 out.append('</section>'+header('용어 풀이','GLOSSARY','glossary',marker))
 picks={1:[0,1,8,17,18,22],2:[3,5,8,10,13,23],3:[1,6,8,11,18,21]}[ch]
 terms={1:['하나님','태초','성령','형상과 몸','보조 생명','상속자'],2:['몸','생명의 호흡','아담과 새 아담','두 나무','지혜와 성령','결혼의 신비'],3:['살짝 바꾼 말씀','혼의 전쟁터','몸에 사는 죄','깨달음의 눈','몸의 저주','가죽옷']}[ch]
 for j,term in zip(picks,terms):
  key,q,a=qs[j];out.append('<div class="gl"><div class="gt">'+term+'</div><p>'+esc(a)+'</p><div class="source-text">근거: 창세기 '+comment_refs[f'g{ch}-{key}']+' 해설</div></div>')
 out.append('</section>'+header('참고한 교회 자료','SOURCES','sources',marker)+'<table class="source-table"><thead><tr><th>강의·교재</th><th>파일</th></tr></thead><tbody>')
 files={e['file']:e['source'] for c in comments.values() for e in c['evidence']}
 for file,label in files.items():out.append('<tr><td>'+esc(label)+'</td><td>'+esc(file)+'</td></tr>')
 out.append('</tbody></table></section>')
 return '<!doctype html><html lang="ko"><head><meta charset="utf-8"/><title>창세기 '+str(ch)+'장 성경 공부 교재</title><style>'+CSS+'</style></head><body>'+''.join(out)+'</body></html>',nav
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
 namespace={'h':'http://www.w3.org/1999/xhtml'}
 with zipfile.ZipFile(file,'w') as z:
  for info,data in items:
   m=re.fullmatch(r'OEBPS/p(\d+)\.xhtml',info.filename)
   if m:
    text=texts[int(m[1])-1]
    layer='<div class="text-layer">'+esc(text)+'</div>'
    data=data.decode('utf8').replace('</body>',layer+'</body>').encode('utf8')
   if info.filename=='OEBPS/fl.css':data+=b'.text-layer{position:absolute;left:0;top:0;opacity:0;pointer-events:none;width:1px;height:1px;overflow:hidden;font-size:1px;line-height:1px;}'
   z.writestr(info,data)
def main():
 run([sys.executable,'-X','utf8',str(B/'prepare_reference_fonts.py')])
 tool=Path(os.environ['TEMP'])/'topicbook/pdf2epub-reference.mjs'
 tool.write_text((R/'tools/pdf2epub.mjs').read_text(encoding='utf8'),encoding='utf8')
 for ch in (1,2,3):
  d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf8'));pages={};raw=T/f'ch{ch}-raw.pdf';hf=T/f'ch{ch}.html'
  for passno in range(4):
   content,nav=htmlbook(ch,d,pages,True);hf.write_text(content,encoding='utf8')
   run([NODE,str(B/'print_reference_html.mjs'),str(hf),str(raw)])
   measured={}
   reader=PdfReader(raw)
   for i,p in enumerate(reader.pages):
    for key in re.findall(r'@@(\w+)@@',re.sub(r'\s+','',p.extract_text() or '')):measured.setdefault(key,i+1)
   if any(key not in measured for key,label in nav):raise RuntimeError(f'Missing anchors {ch}: {set(k for k,t in nav)-measured.keys()}')
   print(f'CHAPTER {ch} PASS {passno+1}: {len(reader.pages)} pages, {len(measured)} anchors',flush=True)
   if measured==pages:break
   pages=measured
  content,nav=htmlbook(ch,d,pages,False);hf.write_text(content,encoding='utf8')
  run([NODE,str(B/'print_reference_html.mjs'),str(hf),str(raw)])
  final=OUT/f'창세기_{ch:02}장_교재.pdf';finish_pdf(raw,final,nav,pages)
  run([NODE,str(tool),str(final),str(final.with_suffix('.epub')),'--width','1600','--quality','90'])
  epub_transcript(final.with_suffix('.epub'),final)
  print(json.dumps({'chapter':ch,'pages':len(PdfReader(final).pages),'style_reference':'Noto Serif KR / Noto Sans KR','epub':'fixed-layout','toc':pages},ensure_ascii=False),flush=True)
if __name__=='__main__':main()
