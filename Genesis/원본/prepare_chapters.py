import json,re,hashlib
from pathlib import Path
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[2];BASE=Path(__file__).parent
original=Path('C:/Users/PC/OneDrive/바탕 화면/창세기_1-3장_해설.pdf')
r=PdfReader(original)
corpus=json.loads((ROOT/'Genesis/자료검토/전체_PDF_본문색인.json').read_text(encoding='utf-8'))['books']
aliases={'결혼, 누구와 어떻게?':'11','천사와 인간이 거인을 낳았을까?':'26','하나님은 왜 비극적인 일들을 허락하실까?':'32','이브는 어떻게 선악과를 먹게 됐을까?':'01','성경이 말하는 사랑':'03','성경이 말하는 믿음':'20','사탄 정확히 알기':'08','성경 해석의 원칙':'28','살아야 하는 이유':'14','헤어질 결심':'13','절망':'25','부활':'27','두려움과 기쁨':'19','베드로':'21'}
aliases.update({'겁쟁이들의 하나님':'23','아리마대 요셉':'04','예수님과 눈이 마주친 베드로':'21','절망이 꼭 필요한 이유':'25','족보 있는 교회':'33','천국에 가는 사람이 적은 이유':'31','잘못된 교회':'17'})
def norm(t):return re.sub('[^가-힣a-zA-Z0-9]','',t).lower()
def grams(t):
 t=norm(t);return {t[i:i+5] for i in range(max(0,len(t)-4))}
def score(a,b):
 a=grams(a);return len(a&grams(b))/max(1,len(a))
def findbook(source):
 m=re.fullmatch(r'밀크 (\d+(?:-\d+)?)강',source)
 if m:return next(b for b in corpus if b['file'].startswith('Milk/') and f'밀크{m[1]}강.pdf' in b['file'])
 name=re.search('「(.+)」',source)[1]
 if name in aliases:return next(b for b in corpus if b['file'].startswith('Theme/'+aliases[name]+'_'))
 return next(b for b in corpus if name.replace(' ','_') in b['file'])
for ch,a,z in [(1,5,21),(2,22,35),(3,36,54)]:
 if ch==1:data=json.loads((BASE/'sample.json').read_text(encoding='utf-8'))
 else:
  text='\n'.join(p.extract_text() for p in r.pages[a-1:z]);text=re.sub(r'@@[^@]+@@','',text);text=re.sub(r'(?m)^\d+\s*$','',text)
  headings=list(re.finditer(r'(?m)^'+str(ch)+r':(\d+(?:-\d+)?)\s+([^\n]+)',text));sections=[]
  for i,h in enumerate(headings):
   block=text[h.end():headings[i+1].start() if i+1<len(headings) else len(text)];body=block.split('교회 강의·교재의 해설',1);comments=[];notes=[]
   if len(body)==2:
    remaining=body[1];end=0
    for m in re.finditer(r'〔([^〕]+)〕',remaining):
     prose=re.sub(r'\s+',' ',remaining[end:m.start()]).strip();sources=re.sub(r'\s+',' ',m[1]).strip().split(' · ')
     comments.append({'id':f'g{ch}-{h[1]}-{len(comments)+1}','text':prose,'sources':sources,'evidence':[]});end=m.end()
    tail=re.sub(r'\s+',' ',remaining[end:]).strip()
    if tail:notes.append(tail)
   else:
    m=re.search(r'해설 없음\s+(.+)',block,re.S)
    if m:notes.append(re.sub(r'\s+',' ',m[1]).strip())
   sections.append({'ref':f'{ch}:{h[1]}','title':h[2].strip(),'comments':comments,'notes':notes})
  data={'title':f'창세기 {ch}장 해설','original':str(original),'original_pages':[a,z],'sections':sections}
 for s in data['sections']:
  for c in s['comments']:
   c['text']=c['text'].replace('Inpu t','Input').replace('Ou tpu t','Output')
   if ch==1:continue
   for source in c['sources']:
    b=findbook(source);ranked=sorted(b['content'],key=lambda p:score(c['text'],p['text']),reverse=True)
    p=ranked[0]
    c['evidence'].append({'source':source,'file':b['file'],'page':p['page'],'pages':[p['page']],
      'excerpt':p['text'],'url':None,'candidates':p['links'],'match_score':round(score(c['text'],p['text']),3),
      'status':'needs_review','review':''})
 data['chapter']=ch;data['original_sha256']=hashlib.sha256(original.read_bytes()).hexdigest()
 (BASE/f'chapter{ch:02}.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print('CHAPTER',ch,'sections',len(data['sections']),'comments',sum(len(s['comments']) for s in data['sections']))
 if ch==3:
  for s in data['sections']:
   for c in s['comments']:
    print(c['id'],c['text']);print('SOURCES',[(e['source'],e['page'],e['match_score']) for e in c['evidence']])
