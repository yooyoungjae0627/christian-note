"""Measure the supplied PDF and transfer its actual inline emphasis, never its instructions."""
import json,re,logging,hashlib,unicodedata
from pathlib import Path
import pdfplumber
logging.getLogger('pdfminer').setLevel(logging.ERROR)
B=Path(__file__).parent
SOURCE=Path('C:/Users/PC/OneDrive/바탕 화면/창세기_1-3장_해설.pdf')
def normchar(t):return ''.join(x for x in unicodedata.normalize('NFC',t) if not x.isspace())
def colorlike(value,target):return isinstance(value,(tuple,list)) and len(value)==3 and max(abs(a-b) for a,b in zip(value,target))<.005
doc=pdfplumber.open(SOURCE); streams={}; summary=[]
for ch,a,z in [(1,5,21),(2,22,35),(3,36,54)]:
 chars=[]
 for pn in range(a,z+1):
  page=doc.pages[pn-1]
  yellow=[r for r in page.rects if colorlike(r.get('non_stroking_color'),(1,.949,.6588))]
  red=[r for r in page.rects if colorlike(r.get('non_stroking_color'),(.8157,.2118,.1686))]
  blues=[r for r in page.curves if colorlike(r.get('non_stroking_color'),(.949,.961,.9843))]
  # Chrome puts the footer first in its content stream; sort actual rows.
  rows={}
  for c in page.chars:
   if c['top']>550 or c['size']<2:continue
   rows.setdefault(round(c['top']/2)*2,[]).append(c)
  for y,row in sorted(rows.items()):
   for c in sorted(row,key=lambda x:x['x0']):
    if not normchar(c['text']):continue
    cx=(c['x0']+c['x1'])/2;cy=(c['top']+c['bottom'])/2
    highlighted=any(r['x0']-.4<=cx<=r['x1']+.4 and r['top']-2<=cy<=r['bottom']+2 for r in yellow)
    bold='Bold' in c['fontname'];under=any(r['x0']-.4<=cx<=r['x1']+.4 and -1<=r['top']-c['bottom']<=8 for r in red)
    level=(3 if under else 2 if bold else 1) if highlighted else (4 if bold else 0)
    for x in normchar(c['text']):chars.append({'char':x,'level':level,'page':pn,'x':round(c['x0'],2),'top':round(c['top'],2),'size':round(c['size'],3),'font':c['fontname']})
  summary.append({'page':pn,'width':page.width,'height':page.height,'yellow_rectangles':len(yellow)})
 streams[ch]=chars
mapped={};errors=[]
for ch in (1,2,3):
 d=json.loads((B/f'chapter{ch:02}.json').read_text(encoding='utf8'));chars=streams[ch];flat=''.join(x['char'] for x in chars);cursor=0
 for section in d['sections']:
  for c in section['comments']:
   text=c['text'];clean=normchar(text);start=flat.find(clean[:35],cursor)
   if start<0:start=flat.find(clean[:25],cursor)
   if start<0:errors.append(c['id']+' start');continue
   end=flat.find(clean[-30:],start)+30
   if end<start:
    end=flat.find('〔',start)
    if end<start:errors.append(c['id']+' end');continue
   selected=chars[start:end];cursor=end
   from difflib import SequenceMatcher
   flags=[0]*len(clean)
   matcher=SequenceMatcher(None,clean,''.join(x['char'] for x in selected),autojunk=False)
   for block in matcher.get_matching_blocks():
    for i in range(block.size):flags[block.a+i]=selected[block.b+i]['level']
   indices=[]
   for i,x in enumerate(text):
    indices.extend([i]*len(normchar(x)))
   spans=[];k=0
   while k<len(flags):
    level=flags[k];j=k+1
    while j<len(flags) and flags[j]==level:j+=1
    if level:spans.append({'start':indices[k],'end':indices[j-1]+1,'level':level,'text':text[indices[k]:indices[j-1]+1]})
    k=j
   mapped[c['id']]={'spans':spans,'source_pages':sorted({x['page'] for x in selected}),'quote':c['id']=='g1-2-2','match_ratio':round(matcher.ratio(),4)}
result={'reference':str(SOURCE),'reference_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'page_mm':[148,210],'margins_mm':{'top':16,'bottom':19,'inside':16,'outside':14},'body':{'font':'Noto Serif KR','size_pt':10.3,'line_height':1.86,'letter_spacing_pt':0},'section_heading':{'font':'Noto Sans KR','weight':700,'size_pt':12.4},'verse':{'ko_pt':9.8,'ko_line_height':1.82,'en_font':'Times New Roman','en_pt':7.6,'background':'#f7f1e3','left_border':'#b39a5f','label_pt':7.6,'inset_mm':[2.6,4,2.2]},'highlight':{'background':'#fff2a8','red':'#d0362b'},'comments':mapped,'pages':summary,'errors':errors}
(B/'reference_style.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'comments_mapped':len(mapped),'highlight_spans':sum(sum(s['level']<=3 for s in c['spans']) for c in mapped.values()),'errors':errors},ensure_ascii=False))
raise SystemExit(1 if errors else 0)
