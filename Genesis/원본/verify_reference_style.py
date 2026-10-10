"""Inspect the rendered PDF's fonts, coordinates, highlight coverage and page limits."""
import json,re,logging,statistics,unicodedata
from pathlib import Path
import pdfplumber
from pypdf import PdfReader
logging.getLogger('pdfminer').setLevel(logging.ERROR)
B=Path(__file__).parent;R=B.parents[1];ref=json.loads((B/'reference_style.json').read_text(encoding='utf8'));results=[]
def nc(t):return ''.join(x for x in unicodedata.normalize('NFC',t) if not x.isspace())
def like(v,t):return isinstance(v,(list,tuple)) and len(v)==3 and max(abs(a-b) for a,b in zip(v,t))<.005
for ch in (1,2,3):
 errors=[];r=PdfReader(R/f'Genesis/창세기_{ch:02}장_교재.pdf');end=r.get_destination_page_number(next(x for x in r.outline if x.title=='한눈에 보는 이야기'))
 d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf8'));comments=[c for s in d['sections'] for c in s['comments']]
 stream=[];sizes=[];gaps=[];outside=[];verse_backgrounds=0
 with pdfplumber.open(R/f'Genesis/창세기_{ch:02}장_교재.pdf') as doc:
  for pn,page in enumerate(doc.pages):
   if abs(page.width-420)>.1 or abs(page.height-594.96)>.1:errors.append(f'Page size {pn+1}')
   if pn<3 or pn>=end:continue
   yellow=[x for x in page.rects if like(x.get('non_stroking_color'),(1,.949,.6588))]
   red=[x for x in page.rects if like(x.get('non_stroking_color'),(.8157,.2118,.1686))]
   verse_backgrounds+=sum(like(x.get('non_stroking_color'),(.9686,.9451,.8902)) for x in page.curves)
   rows={}
   for c in page.chars:
    if c['top']>550 or c['size']<2:continue
    if c['x0']<37 or c['x1']>382:outside.append([pn+1,c['text'],round(c['x0'],2),round(c['x1'],2)])
    if 'Noto-Serif-KR' in c['fontname'] and 10.2<c['size']<10.4:sizes.append(c['size'])
    # A fallback Latin glyph can have a different ink top but the same baseline.
    rows.setdefault(round(c['matrix'][5]/2)*2,[]).append(c)
   for y,row in sorted(rows.items(),reverse=True):
    row.sort(key=lambda x:x['x0'])
    for i,c in enumerate(row):
     cx=(c['x0']+c['x1'])/2;cy=(c['top']+c['bottom'])/2
     colored=any(x['x0']-.4<=cx<=x['x1']+.4 and x['top']-2<=cy<=x['bottom']+2 for x in yellow)
     bold='Bold' in c['fontname'];under=any(x['x0']-.4<=cx<=x['x1']+.4 and -1<=x['top']-c['bottom']<=8 for x in red)
     level=(3 if under else 2 if bold else 1) if colored else (4 if bold else 0)
     stream.extend((x,level) for x in nc(c['text']))
     if i and 'Noto-Serif-KR' in c['fontname'] and 'Noto-Serif-KR' in row[i-1]['fontname'] and re.fullmatch('[가-힣]',c['text']) and re.fullmatch('[가-힣]',row[i-1]['text']) and abs(c['size']-10.3)<.05:gaps.append(c['x0']-row[i-1]['x1'])
  if ch==1:
   with pdfplumber.open(ref['reference']) as original:
    original_lines=[x for x in original.pages[4].extract_text_lines() if 295<=x['top']<383]
   new_lines=[x for x in doc.pages[3].extract_text_lines() if 295<=x['top']<383]
   if [x['text'] for x in new_lines]!=[x['text'] for x in original_lines]:errors.append('Reference first paragraph line wrapping differs')
   deltas=[round(b['top']-a['top'],3) for a,b in zip(original_lines,new_lines)]
   if any(abs(x)>1 for x in deltas):errors.append('Reference first paragraph vertical positions differ by over 1pt')
  else:deltas=None
 flat=''.join(x for x,level in stream);cursor=0;checked=0;misses=[]
 for c in comments:
  clean=nc(c['text']);start=flat.find(clean,cursor)
  if start<0:errors.append('Cannot locate rendered commentary '+c['id']);continue
  cursor=start+len(clean)
  for s in ref['comments'][c['id']]['spans']:
   k=len(nc(c['text'][:s['start']]));n=len(nc(s['text']))
   if s['level']<=3:
    actual=[v for x,v in stream[start+k:start+k+n]]
    if any(v!=s['level'] for v in actual):misses.append({'comment':c['id'],'text':s['text'],'expected':s['level'],'actual_levels':sorted(set(actual))})
    checked+=1
 if misses:errors.append(f'Reference emphasis differs in {len(misses)} spans')
 if outside:errors.append(f'{len(outside)} text glyphs outside content bounds')
 if not sizes or abs(statistics.median(sizes)-10.3)>.05:errors.append('Body size differs')
 if gaps and abs(statistics.median(gaps))>.05:errors.append('Body tracking differs from zero')
 result={'chapter':ch,'body_font':'Noto Serif KR','body_size_pt':round(statistics.median(sizes),4) if sizes else None,'median_tracking_pt':round(statistics.median(gaps),4) if gaps else None,'reference_highlight_spans_checked':checked,'reference_first_paragraph_y_deltas_pt':deltas,'verse_background_shapes':verse_backgrounds,'highlight_mismatches':misses,'outside_glyphs':outside,'errors':errors};results.append(result);print(json.dumps(result,ensure_ascii=False))
(B/'reference-style-check.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf8')
raise SystemExit(1 if any(x['errors'] for x in results) else 0)
