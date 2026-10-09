"""Apply manually reviewed PDF sections; never infer a video timestamp."""
import json,os
from pathlib import Path
BASE=Path(__file__).parent
data=json.loads((BASE/'sample.json').read_text(encoding='utf-8'))
index=json.loads((Path(os.environ['TEMP'])/'genesis-sample-20261010/source-index.json').read_text(encoding='utf-8'))
# key=(commentary id, source label); value=(text pages, original link page, original URL timestamp).
choices={
 ('g1-1-1','밀크 3강'):([15,16,17],15,704),
 ('g1-1-2','밀크 3강'):([30,31,32],30,1900),
 ('g1-1-6','밀크 3강'):([45,46],45,3039),
 ('g1-1-6','밀크 10강'):([56,57],56,834),
 ('g1-2-1','밀크 7강'):([32],32,1749),
 ('g1-2-2','밀크 7강'):([32],32,1749),
 ('g1-2-7','밀크 8강'):([72,73,74,75],129,4449),
 ('g1-2-8','밀크 4강'):([38,39],38,1781),
 ('g1-2-9','밀크 4강'):([36,37,38,39],36,1668),
 ('g1-3-5-2','밀크 3강'):([55,56,57,58],55,3736),
 ('g1-3-5-3','밀크 3강'):([55,56,57,58],55,3736),
 ('g1-3-5-4','밀크 5강'):([17,18,19],17,753),
 ('g1-3-5-5','밀크 2강'):([10,11,12],10,372),
 ('g1-9-13-1','밀크 9-2강'):([56],54,740),
 ('g1-26-28-1','밀크 3강'):([51,52,53],51,3280),
 ('g1-26-28-2','밀크 3강'):([67,68,69,70],67,5117),
 ('g1-26-28-3','밀크 3강'):([66,67],65,4910),
 ('g1-26-28-4','밀크 2강'):([37],37,2082),
 ('g1-26-28-4','밀크 10강'):([57,58],57,883),
 ('g1-26-28-7','밀크 10강'):([57,91],57,883),
 ('g1-29-31-1','밀크 2강'):([37,38],37,2082),
 ('g1-29-31-2','예배 강의 「이브는 어떻게 선악과를 먹게 됐을까?」'):([22],22,870),
}
extra_pages={
 ('g1-1-4','예배 강의 「사탄 정확히 알기」'):[22,23],
 ('g1-2-5','예배 강의 「사탄 정확히 알기」'):[24,25],
 ('g1-2-6','예배 강의 「사탄 정확히 알기」'):[27,28],
 ('g1-3-5-1','예배 강의 「사탄 정확히 알기」'):[23,27,28],
 ('g1-26-28-5','예배 강의 「살아야 하는 이유」'):[20,21],
 ('g1-26-28-6','예배 강의 「하나님은 왜 비극적인 일들을 허락하실까?」'):[7,8],
 ('g1-26-28-10','예배 강의 「천사와 인간이 거인을 낳았을까?」'):[9,10,11],
 ('g1-26-28-10','예배 강의 「성경 해석의 원칙」'):[33,34],
}
for s in data['sections']:
 for c in s['comments']:
  for e in c['evidence']:
   key=(c['id'],e['source']); ps=index[e['file']]
   e['original_commentary_ref']=s['ref']
   if key in choices:
    pages,link_page,seconds=choices[key]
    candidates=ps[link_page-1]['links']
    selected=[l for l in candidates if l['url'].endswith('t='+str(seconds))]
    assert len(selected)==1,(key,candidates)
    e.update(pages=pages,page=pages[0],link_page=link_page,candidates=candidates,url=selected[0]['url'],status='reviewed_existing_segment',review='원자료 본문과 소제목을 대조하고 이미 실린 구간 주소를 재사용. 문장 시작 시각을 새로 추정하지 않음.')
   else:
    assert not any(p['links'] for p in ps),key
    e.update(pages=extra_pages.get(key,[e['page']]),status='reviewed_source_without_video',review='원자료 본문 대조. 이 출처 PDF에는 유튜브 링크가 없어 강의명과 쪽수만 표시.')
   e['excerpt']='\n'.join('교재 '+str(n)+'쪽\n'+ps[n-1]['text'] for n in e['pages'])
   del e['match_score']
   if not e['url']: e['candidates']=[]
# Clean only typography artifacts introduced by PDF text extraction, outside Scripture.
for s in data['sections']:
 for c in s['comments']:
  c['text']=c['text'].replace('(elohiym )','(elohiym)').replace('엘로힘 (','엘로힘(').replace('( ṭ ôb)','(ṭôb)').replace('( ṭ ôb)', '(ṭôb)').replace('성령) 이','성령)이').replace('(혼) 에','(혼)에')
(BASE/'sample.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print('Reviewed source entries:',sum(len(c['evidence']) for s in data['sections'] for c in s['comments']))
print('Linked source entries:',len(choices))
