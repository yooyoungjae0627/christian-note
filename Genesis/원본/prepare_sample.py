import json, re, sys
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[2]
DEST = Path(__file__).parent
original = Path('C:/Users/PC/OneDrive/바탕 화면/창세기_1-3장_해설.pdf')
r = PdfReader(original)
text = '\n'.join(p.extract_text() for p in r.pages[4:21])
text = re.sub(r'@@[^@]+@@', '', text)
text = re.sub(r'(?m)^\d+\s*$', '', text)
headings = list(re.finditer(r'(?m)^1:(\d+(?:-\d+)?)\s+([^\n]+)', text))
sections = []
for i,h in enumerate(headings):
    block = text[h.end():headings[i+1].start() if i+1<len(headings) else len(text)]
    body = block.split('교회 강의·교재의 해설',1)
    comments = []
    notes = []
    if len(body)==2:
        remaining = body[1]
        # The original has one block quotation whose source uses a dash.
        remaining = remaining.replace('—  밀크 7강', '〔밀크 7강〕')
        end = 0
        for m in re.finditer(r'〔([^〕]+)〕', remaining):
            prose = re.sub(r'\s+', ' ', remaining[end:m.start()]).strip()
            comments.append({'id':f'g1-{h[1]}-{len(comments)+1}', 'text':prose, 'sources':m[1].split(' · '), 'evidence':[]})
            end = m.end()
        tail = re.sub(r'\s+', ' ', remaining[end:]).strip()
        if tail: notes.append(tail)
    else:
        m = re.search(r'해설 없음\s+(.+)',block,re.S)
        if m: notes.append(re.sub(r'\s+',' ',m[1]).strip())
    sections.append({'ref':'1:'+h[1], 'title':h[2].strip(), 'comments':comments, 'notes':notes})
out = {'title':'창세기 1장 해설', 'original':str(original), 'original_pages':[5,21], 'sections':sections}
DEST.mkdir(parents=True,exist_ok=True)
(DEST/'sample.json').write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'sections':len(sections),'comments':sum(len(s['comments']) for s in sections)},ensure_ascii=False))
for s in sections:
    for c in s['comments']:
        print(c['id'], ' / '.join(c['sources']), c['text'][:95])
