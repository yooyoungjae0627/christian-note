"""완성 PDF·EPUB 검사(창세기/원본/verify_chapters.py를 사무엘상용으로 옮김). 원고 근거 대조는 check_content.mjs가 한다.
   번들 Python -X utf8 사무엘상·하/원본/verify_samuel.py [장 …]"""
import json,re,zipfile,sys,logging,xml.etree.ElementTree as ET
import pdfplumber
logging.getLogger('pdfminer').setLevel(logging.ERROR)
from pathlib import Path
from collections import Counter
from pypdf import PdfReader
B=Path(__file__).parent;R=B.parents[1]
vs=json.loads((B/'verses_01-15.json').read_text(encoding='utf-8-sig'));results=[]
def norm(t):return re.sub(r'\s+','',t)
CHAPTERS=[int(x) for x in sys.argv[1:]] or list(range(1,16))
for ch in CHAPTERS:
 errors=[];d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf-8'));L=d['learning']
 comments={c['id']:c for s in d['sections'] for c in s['comments']}
 pdfpath=R/f'사무엘상·하/사무엘상_{ch:02}장_교재.pdf';epubpath=pdfpath.with_suffix('.epub');pdf=PdfReader(pdfpath)
 with pdfplumber.open(pdfpath) as pp:pdftext='\n'.join(re.sub(r'\n\s*\d+\s*$','',p.extract_text() or '') for p in pp.pages)
 selected=[v for v in vs if v['ref'].split(':')[0]==str(ch)]
 with zipfile.ZipFile(epubpath) as z:
  first=z.infolist()[0]
  if first.filename!='mimetype' or first.compress_type!=0 or z.read('mimetype')!=b'application/epub+zip':errors.append('Invalid mimetype')
  for f in z.namelist():
   if f.endswith(('.xml','.xhtml','.opf','.ncx','.svg')):
    try:ET.fromstring(z.read(f))
    except Exception as e:errors.append(f+' '+str(e))
  pagesx=sorted(f for f in z.namelist() if re.fullmatch(r'OEBPS/p\d+\.xhtml',f))
  books=[ET.fromstring(z.read(f)) for f in pagesx]
  epubtext='\n'.join(''.join(book.find('{http://www.w3.org/1999/xhtml}body').itertext()) for book in books)
  ids={f.split('/')[-1] for f in pagesx}
  nav=ET.fromstring(z.read('OEBPS/nav.xhtml'))
  for e in nav.iter():
   href=e.get('href','')
   if href and href.split('#')[0] not in ids:errors.append('Broken EPUB navigation '+href)
  epuburls=[e.get('href') for book in books for e in book.iter() if 'youtu' in e.get('href','')]
  if len(pagesx)!=len(pdf.pages):errors.append(f'EPUB pages {len(pagesx)} != PDF pages {len(pdf.pages)}')
 for v in selected:
  for lang in ['ko','en']:
   if norm(v[lang]) not in norm(pdftext):errors.append('PDF verse '+v['ref']+' '+lang)
   if norm(v[lang]) not in norm(epubtext):errors.append('EPUB verse '+v['ref']+' '+lang)
 for c in comments.values():
  if norm(c['text']) not in norm(pdftext):errors.append('PDF commentary '+c['id'])
  if norm(c['text']) not in norm(epubtext):errors.append('EPUB commentary '+c['id'])
 for x in L['questions']:
  if norm(x['q']) not in norm(pdftext):errors.append('PDF question '+x['q'][:20])
 main=[e['url'] for c in comments.values() for e in c['evidence'] if e.get('url')]
 extras=[e['url'] for x in L['questions'] if x.get('key') for e in comments[x['key']]['evidence'] if e.get('url')]
 extras+=[e['url'] for x in L['faq'] for e in comments[x['key']]['evidence'] if e.get('url')]
 pdfurls=[str(a.get_object().get('/A',{}).get('/URI','')) for p in pdf.pages for a in p.get('/Annots',[]) if 'youtu' in str(a.get_object().get('/A',{}).get('/URI',''))]
 if Counter(pdfurls)!=Counter(main*2+extras):errors.append(f'PDF URL count differs {len(pdfurls)} vs {len(main)*2+len(extras)}')
 if Counter(epuburls)!=Counter(pdfurls):errors.append(f'EPUB URL count differs {len(epuburls)} vs {len(pdfurls)}')
 if '@@' in pdftext or '@@' in epubtext:errors.append('Leftover source marker')
 fonts={str(v.get_object().get('/BaseFont') or v.get_object().get('/FontDescriptor',{}).get_object().get('/FontName')) for p in pdf.pages for v in p['/Resources'].get('/Font',{}).get_object().values()}
 if not any('Noto-Serif-KR' in f for f in fonts):errors.append('Noto Serif KR body font missing')
 basis=Counter(c['basis'] for c in comments.values())
 result={'chapter':ch,'pages':len(pdf.pages),'verses_bilingual':len(selected),'comments':len(comments),'basis':dict(basis),'source_entries':sum(len(c['evidence']) for c in comments.values()),'qr_expected':len(main),'pdf_video_links':len(pdfurls),'epub_video_links':len(epuburls),'questions':len(L['questions']),'faq':len(L['faq']),'summary':len(L['summary']),'errors':errors}
 results.append(result);print(json.dumps(result,ensure_ascii=False),flush=True)
(B/'samuel-verify.json').write_text(json.dumps(results,ensure_ascii=False,indent=1),encoding='utf-8');raise SystemExit(1 if any(x['errors'] for x in results) else 0)
