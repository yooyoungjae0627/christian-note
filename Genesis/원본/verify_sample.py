import json,re,zipfile,html
from pathlib import Path
from pypdf import PdfReader
import xml.etree.ElementTree as ET

BASE=Path(__file__).parent; ROOT=BASE.parents[1]
data=json.loads((BASE/'sample.json').read_text(encoding='utf-8'))
vs=json.loads((BASE/'verses.json').read_text(encoding='utf-8-sig'))
pdf=PdfReader(ROOT/'Genesis/창세기_1장_해설_근거링크_샘플.pdf')
pdftext='\n'.join(p.extract_text() for p in pdf.pages)
def n(t): return re.sub(r'\s+','',t)
errors=[]
for v in vs:
    for lang in ['ko','en']:
        if n(v[lang]) not in n(pdftext): errors.append(f'PDF verse mismatch {v["ref"]} {lang}')
expected=[e['url'] for s in data['sections'] for c in s['comments'] for e in c['evidence'] if e['url']]
annotations=[str(a.get_object().get('/A',{}).get('/URI','')) for p in pdf.pages for a in p.get('/Annots',[]) if 'youtu' in str(a.get_object().get('/A',{}).get('/URI',''))]
if sorted(annotations)!=sorted(expected*2): errors.append('PDF link multiset mismatch')
with zipfile.ZipFile(ROOT/'Genesis/창세기_1장_해설_근거링크_샘플.epub') as z:
    xml=ET.fromstring(z.read('OEBPS/book.xhtml'))
    epubtext=''.join(xml.itertext())
    for v in vs:
        for lang in ['ko','en']:
            if v[lang] not in epubtext: errors.append(f'EPUB verse mismatch {v["ref"]} {lang}')
    links=[e.get('href') for e in xml.iter() if e.tag.endswith('}a') and 'youtu' in str(e.get('href'))]
    if sorted(links)!=sorted(expected): errors.append('EPUB link multiset mismatch')
    ids={e.get('id') for e in xml.iter() if e.get('id')}
    nav=ET.fromstring(z.read('OEBPS/nav.xhtml'))
    for e in nav.iter():
        if e.tag.endswith('}a') and e.get('href','').startswith('book.xhtml#') and e.get('href').split('#')[1] not in ids: errors.append('EPUB broken fragment '+e.get('href'))
for s in data['sections']:
    for c in s['comments']:
        if n(c['text']) not in n(pdftext): errors.append('PDF missing commentary '+c['id'])
        if c['text'] not in epubtext: errors.append('EPUB missing commentary '+c['id'])
        for e in c['evidence']:
            if e['status']=='needs_review': errors.append('Unreviewed source '+c['id'])
            if e['url'] and e['url'] not in [l['url'] for l in e['candidates']]: errors.append('Link not from recorded source '+c['id'])
if '@@' in pdftext: errors.append('Unremoved source markers')
result={'pdf_pages':len(pdf.pages),'bilingual_verses_checked':len(vs),'commentary_paragraphs':sum(len(s['comments']) for s in data['sections']),'linked_source_entries':len(expected),'unique_video_segments':len(set(expected)),'pdf_video_annotations':len(annotations),'epub_video_links':len(links),'errors':errors}
(BASE/'content-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False));raise SystemExit(bool(errors))
