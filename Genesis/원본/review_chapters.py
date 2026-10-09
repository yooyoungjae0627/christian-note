import json,re
from pathlib import Path
B=Path(__file__).parent;R=B.parents[1]
corpus={b['file']:b for b in json.loads((R/'Genesis/자료검토/전체_PDF_본문색인.json').read_text(encoding='utf-8'))['books']}
overrides={
 ('g2-1-3-2','밀크 10강'):[14,15,41,42,43],
 ('g2-7-6','밀크 4강'):[49,50,51,54,55,56,57],
 ('g2-8-9-5','예배 강의 「이브는 어떻게 선악과를 먹게 됐을까?」'):[21,22,23],
 ('g2-15-17-5','예배 강의 「이브는 어떻게 선악과를 먹게 됐을까?」'):[24,25],
 ('g2-18-20-2','예배 강의 「성경 해석의 원칙」'):[19,20,21],
 ('g2-24-25-3','밀크 3강'):[74,75,76,77],
 ('g3-1-4','밀크 7강'):[32,33,34],
 ('g3-2-3-2','예배 강의 「이브는 어떻게 선악과를 먹게 됐을까?」'):[24,25,26],
 ('g3-7-4','예배 강의 「절망이 꼭 필요한 이유」'):[23,24,25],
 ('g3-17-19-2','예배 강의 「이브는 어떻게 선악과를 먹게 됐을까?」'):[32,33,34],
 ('g3-17-19-9','밀크 3강'):[65,66],
 ('g3-17-19-9','밀크 9-1강'):[38,39],
 ('g3-20-21-3','예배 강의 「족보 있는 교회」'):[28,29],
 ('g3-22-24-4','밀크 7강'):[24,25,26,27,28],
 ('g3-22-24-4','밀크 8강'):[98,99],
 ('g3-22-24-4','밀크 9-2강'):[14,15,16,17,18,19],
}
changes=[]
for ch in (1,2,3):
 d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf-8'))
 for s in d['sections']:
  for c in s['comments']:
   if c['id']=='g3-20-21-5':
    before=c['text'];c['text']=c['text'].replace('주의 날 1','주의 날 2');changes.append({'id':c['id'],'before':before,'after':c['text'],'reason':'밀크 9-2강 PDF 61–62쪽은 아브라함 이전 의인들의 회복을 주의 날 2로 설명한다.'})
   c['text']=c['text'].replace('영·혼 ·몸','영·혼·몸').replace('혈통 (피)','혈통(피)').replace('21- 22장','21-22장').replace('(‘etseb), 이사봉(‘i ṣṣ ā ḇ ôn)','(‘etseb), 이사봉(‘iṣṣāḇôn)')
   for e in c['evidence']:
    if ch==1:continue
    b=corpus[e['file']];n=e['page'];pages=overrides.get((c['id'],e['source']),list(range(max(1,n-1),min(b['pages'],n+1)+1)))
    e.update(pages=pages,page=pages[0],excerpt='\n'.join('교재 '+str(i)+'쪽\n'+b['content'][i-1]['text'] for i in pages))
    # Reuse only an original, single section link on the matched page. Multi-link
    # pages and broad composite explanations keep their page citations instead.
    candidates=b['content'][n-1]['links'];urls=sorted(set(x['url'] for x in candidates))
    if len(urls)==1 and e['match_score']>=.30 and (c['id'],e['source']) not in overrides:
     e.update(url=urls[0],link_page=n,candidates=candidates,status='reviewed_existing_segment')
    else:e.update(url=None,candidates=[],status='reviewed_pdf_pages')
    e['review']='기존 해설의 출처를 PDF 본문과 재대조하고 앞뒤 쪽을 포함해 기록했다. 단일 구간 링크가 있는 대응 쪽만 연결하며 복합 설명은 쪽수로 안내한다. 영상 재생 확인은 하지 않았다.'
   # Three emphasis levels are source-based text ranges, never additions.
   sentences=re.split(r'(?<=[.!?])\s+',c['text'])
   c['emphasis']=next((t for t in sentences if 20<len(t)<155),sentences[0])
   c['emphasis_level']=1+(int(c['id'].split('-')[-1])-1)%3
 d['source_corpus']='Theme 33권 + Milk 11권 전페이지 색인'
 (B/f'chapter{ch:02}.json').write_text(json.dumps(d,ensure_ascii=False,indent=2),encoding='utf-8')
 print(ch,[(s['ref'],s['notes']) for s in d['sections'] if s['notes']])
(B/'corrections.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf-8')
print('Corrections',len(changes))
