import json,re,zipfile,xml.etree.ElementTree as ET
import pdfplumber,logging
logging.getLogger('pdfminer').setLevel(logging.ERROR)
from pathlib import Path
from collections import Counter
from pypdf import PdfReader
from build_reference_chapters import learning
import sys
B=Path(__file__).parent;R=B.parents[1]
corpus={b['file']:b for b in json.loads((R/'Genesis/자료검토/전체_PDF_본문색인.json').read_text(encoding='utf-8'))['books']}
vs=[v for f in ('verses_01-03.json','verses_04-10.json') for v in json.loads((B/f).read_text(encoding='utf-8-sig'))];results=[]
def norm(t):return re.sub(r'\s+','',t)
CHAPTERS=[int(x) for x in sys.argv[1:]] or list(range(1,11))
for ch in CHAPTERS:
 count=sum(v['ref'].split(':')[0]==str(ch) for v in vs)
 errors=[];d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf-8'));L=learning(ch,d);comments={c['id']:c for s in d['sections'] for c in s['comments']};pdfpath=R/f'Genesis/창세기_{ch:02}장_교재.pdf';pdf=PdfReader(pdfpath)
 with pdfplumber.open(pdfpath) as pp:pdftext='\n'.join(re.sub(r'\n\s*\d+\s*$','',p.extract_text() or '') for p in pp.pages)
 selected=[v for v in vs if v['ref'].startswith(str(ch)+':')]
 if [v['ref'] for v in selected]!=[f'{ch}:{i}' for i in range(1,count+1)]:errors.append('Verse range differs')
 refs=[]
 for s in d['sections']:
  a=s['ref'].split(':')[1].split('-');refs.extend(range(int(a[0]),int(a[-1])+1))
 if refs!=list(range(1,count+1)):errors.append('Chapter sections omit or duplicate verses')
 with zipfile.ZipFile(R/f'Genesis/창세기_{ch:02}장_교재.epub') as z:
  if z.infolist()[0].filename!='mimetype' or z.infolist()[0].compress_type!=0 or z.read('mimetype')!=b'application/epub+zip':errors.append('Invalid mimetype')
  for f in z.namelist():
   if f.endswith(('.xml','.xhtml','.opf','.ncx','.svg')):
    try:ET.fromstring(z.read(f))
    except Exception as e:errors.append(f+' '+str(e))
  fixed='OEBPS/fl.css' in z.namelist()
  books=[ET.fromstring(z.read(f)) for f in z.namelist() if re.fullmatch(r'OEBPS/p\d+\.xhtml',f)] if fixed else [ET.fromstring(z.read('OEBPS/book.xhtml'))]
  epubtext='\n'.join(''.join((book.find('{http://www.w3.org/1999/xhtml}body') if fixed else book).itertext()) for book in books);ids={e.get('id') for book in books for e in book.iter() if e.get('id')}
  nav=ET.fromstring(z.read('OEBPS/nav.xhtml'))
  for e in nav.iter():
   href=e.get('href','')
   if href.startswith('book.xhtml#') and href.split('#')[1] not in ids:errors.append('Broken EPUB navigation '+href)
  for e in (e for book in books for e in book.iter()):
   if e.get('href','').startswith('nav.xhtml#') and e.get('href')!='nav.xhtml#toc':errors.append('Broken back link')
  epuburls=[e.get('href') for book in books for e in book.iter() if 'youtu' in e.get('href','')]
 for v in selected:
  for lang in ['ko','en']:
   if norm(v[lang]) not in norm(pdftext):errors.append('PDF verse '+v['ref']+' '+lang)
   if norm(v[lang]) not in norm(epubtext):errors.append('EPUB verse '+v['ref']+' '+lang)
 for c in comments.values():
  if norm(c['text']) not in norm(pdftext):errors.append('PDF commentary '+c['id'])
  if norm(c['text']) not in norm(epubtext):errors.append('EPUB commentary '+c['id'])
  if not c['evidence']:errors.append('No source '+c['id'])
  for e in c['evidence']:
   b=corpus.get(e['file'])
   if b is None or any(i<1 or i>b['pages'] for i in e['pages']):errors.append('Bad source page '+c['id']);continue
   if e['status']=='needs_review':errors.append('Unreviewed source '+c['id'])
   if e.get('url') and e['url'] not in {l['url'] for p in b['content'] for l in p['links']}:errors.append('Invented URL '+c['id'])
   if not e['excerpt'].strip():errors.append('Missing source excerpt '+c['id'])
   if ch>=4:
    # Later chapters quote their evidence verbatim from the cited pages (pieces joined with an ellipsis line).
    pagetext=norm(''.join(x['text'] for x in b['content'] if x['page'] in e['pages']))
    if any(norm(piece) and norm(piece) not in pagetext for piece in re.split(r'\n…\n',e['excerpt'])):errors.append('Excerpt not found on cited pages '+c['id'])
    if e.get('url') and e['url'] not in {l['url'] for x in b['content'] if x['page'] in e['pages'] for l in x['links']}:errors.append('URL not on cited pages '+c['id'])
  if 'spans' in c and any(c['text'].count(sp['text'])!=1 or sp['level'] not in (1,2,3) for sp in c['spans']):errors.append('Bad emphasis span '+c['id'])
 main=[e['url'] for c in comments.values() for e in c['evidence'] if e.get('url')]
 extras=[]
 keys=[k for k,q,a in L['qs']]+[k for q,k in L['faq']]
 if any(f'g{ch}-{k}' not in comments for k in keys+[k for t,k,x in L['glossary']]):errors.append('Learning key without commentary')
 if len(L['qs'])<25 or not 12<=len(L['faq'])<=14 or not 12<=len(L['summary'])<=22:errors.append('Learning counts outside policy')
 for k in keys:
  c=comments[f'g{ch}-{k}'];extras.extend(e['url'] for e in c['evidence'] if e.get('url'))
 pdfurls=[str(a.get_object().get('/A',{}).get('/URI','')) for p in pdf.pages for a in p.get('/Annots',[]) if 'youtu' in str(a.get_object().get('/A',{}).get('/URI',''))]
 if Counter(pdfurls)!=Counter(main*2+extras):errors.append('PDF URL count differs')
 if Counter(epuburls)!=Counter(main*(2 if fixed else 1)+extras):errors.append('EPUB URL count differs')
 if '@@' in pdftext or '@@' in epubtext:errors.append('Leftover source marker')
 fonts={str(v.get_object().get('/BaseFont') or v.get_object().get('/FontDescriptor',{}).get_object().get('/FontName')) for p in pdf.pages for v in p['/Resources'].get('/Font',{}).get_object().values()}
 if not any('Noto-Serif-KR' in f for f in fonts):errors.append('Reference Noto Serif KR body font missing')
 result={'chapter':ch,'pages':len(pdf.pages),'verses_bilingual':len(selected),'comments':len(comments),'source_entries':sum(len(c['evidence']) for c in comments.values()),'qr_expected':len(main),'pdf_video_links':len(pdfurls),'epub_video_links':len(epuburls),'questions':len(L['qs']),'faq':len(L['faq']),'summary':len(L['summary']),'errors':errors};results.append(result);print(json.dumps(result,ensure_ascii=False))
(B/'chapters-content-check.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');raise SystemExit(1 if any(x['errors'] for x in results) else 0)
