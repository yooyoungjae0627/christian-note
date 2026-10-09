import json,re,os
from pathlib import Path
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[2]
DEST=Path(__file__).parent
data=json.loads((DEST/'sample.json').read_text(encoding='utf-8'))
def norm(t): return re.sub(r'[^가-힣a-zA-Z0-9]','',t).lower()
def grams(t):
    t=norm(t)
    return set(t[i:i+5] for i in range(max(0,len(t)-4)))
def score(t, candidate):
    a,b=grams(t),grams(candidate)
    return len(a&b)/max(1,len(a))
index=json.loads((Path(os.environ['TEMP'])/'genesis-sample-20261010/source-index.json').read_text(encoding='utf-8'))
cache={ROOT/filename:pages for filename,pages in index.items()}
for sec in data['sections']:
    for c in sec['comments']:
        for source in c['sources']:
            m=re.fullmatch(r'밀크 (\d+(?:-\d+)?)강',source)
            if m:
                file=next(ROOT.glob('Milk/*밀크'+m[1]+'강.pdf'))
            else:
                name=re.search('「(.+)」',source)[1]
                aliases={'결혼, 누구와 어떻게?':'11_','천사와 인간이 거인을 낳았을까?':'26_','하나님은 왜 비극적인 일들을 허락하실까?':'32_','이브는 어떻게 선악과를 먹게 됐을까?':'01_'}
                prefix=aliases.get(name)
                file=next(ROOT.glob('Theme/'+(prefix+'*' if prefix else '*'+name.replace(',','').replace(' ','_')+'*')+'.pdf'))
            if file not in cache:
                reader=PdfReader(file)
                pages=[]
                for i,p in enumerate(reader.pages):
                    urls=[]
                    for ann in p.get('/Annots',[]):
                        obj=ann.get_object(); u=str(obj.get('/A',{}).get('/URI',''))
                        if 'youtu' in u: urls.append({'url':u,'rect':[float(v) for v in obj['/Rect']]})
                    pages.append({'page':i+1,'text':p.extract_text() or '', 'links':urls})
                cache[file]=pages
            pages=cache[file]
            ranked=sorted(pages,key=lambda p:score(c['text'],p['text']),reverse=True)
            p=ranked[0]
            e={'source':source,'file':file.relative_to(ROOT).as_posix(),'page':p['page'],'match_score':round(score(c['text'],p['text']),3),'excerpt':p['text'],'candidates':p['links'],'url':None,'status':'needs_review' if p['links'] else 'source_has_no_video_link'}
            c['evidence'].append(e)
            print(c['id'],source,'PAGE',p['page'],'score',e['match_score'],'URLS',','.join(l['url'] for l in p['links']))
            if p['links']: print(p['text'][:1500].replace('\n',' '))
(DEST/'sample.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
