import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
DEST=ROOT/'Genesis/자료검토'
corpus=json.loads((DEST/'전체_PDF_본문색인.json').read_text(encoding='utf-8'))
def clean(t):
    previous=None
    while previous!=t:
        previous=t;t=re.sub(r'\{(?:[123b]):([^{}]*)\}',r'\1',t)
    return t
def norm(t):
    t=re.sub(r'(?m)^\s*\d+\s*$','',t)
    return re.sub(r'\s+','',clean(t))
packets=[];checks=[]
for book in corpus['books']:
    if book['file'].startswith('Theme/'):
        prefix=Path(book['file']).stem[:2]
        story=next(ROOT.glob('Theme/원본/'+prefix+'_*/story.txt'))
        lines=story.read_text(encoding='utf-8').splitlines(); full=''.join(p['text'] for p in book['content']); flat=norm(full)
        paragraphs=[l.split('|',2)[2] for l in lines if l.startswith('@p|')]
        missing=[i+1 for i,t in enumerate(paragraphs) if norm(t) not in flat]
        summary=[clean(l.split('|',1)[1]) for l in lines if l.startswith('@summary|')]
        core=[clean(m) for l in lines if l.startswith('@p|') for m in re.findall(r'\{3:([^{}]+)\}',l)]
        chapters=[clean(' — '.join(l.split('|')[2:4])) for l in lines if l.startswith('@ch|')]
        refs=sorted(set(re.findall(r'창세기\s*(\d+)(?::\d+(?:-\d+)?|장)?',full)),key=int)
        packets.append({'file':book['file'],'pages':book['pages'],'links':book['video_annotations'],'chapters':chapters,'summary':summary,'core_claims':core,'genesis_chapters':refs})
        checks.append({'file':book['file'],'source_paragraphs':len(paragraphs),'verbatim_found':len(paragraphs)-len(missing),'mismatch_indices':missing})
    else:
        # Whole-book recap pages are part of the PDF, not generated summaries.
        start=None; selected=[]
        for p in book['content']:
            if re.search(r'한눈에\s*보는\s*(?:오늘\s*)?이야기',p['text']) and p['page']>book['pages']*.45: start=p['page']
            if start:
                if '개념 문제' in p['text'] or '개념문제' in p['text']:break
                selected.append(p)
        refs=sorted(set(re.findall(r'창세기\s*(\d+)(?::\d+(?:-\d+)?|장)?',''.join(p['text'] for p in book['content']))),key=int)
        packets.append({'file':book['file'],'pages':book['pages'],'links':book['video_annotations'],'summary_pages':[p['page'] for p in selected],'summary_text':'\n'.join(p['text'] for p in selected),'genesis_chapters':refs})
(DEST/'권별_검토자료.json').write_text(json.dumps(packets,ensure_ascii=False,indent=2),encoding='utf-8')
(DEST/'PDF_원고대조.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'books':len(packets),'source_paragraphs':sum(c['source_paragraphs'] for c in checks),'exact_matches':sum(c['verbatim_found'] for c in checks),'mismatches':[(c['file'],c['mismatch_indices']) for c in checks if c['mismatch_indices']]},ensure_ascii=False))
