"""Verify portrait layout, original content, captured assets and PDF navigation."""
import argparse
import hashlib
import io
import json
import math
from pathlib import Path

import pymupdf as fitz
from PIL import Image, ImageDraw

from build_book import ALL, QUIZ, FAQ, SOURCES, ROOT, OUT, W, H, CW

def normalize(s):return ''.join(s.split())

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--pdf',type=Path,default=OUT);ap.add_argument('--qa-dir',type=Path,required=True);a=ap.parse_args()
    a.qa_dir.mkdir(parents=True,exist_ok=True)
    layout=json.loads((a.qa_dir/'layout.json').read_text(encoding='utf-8'))
    pdf=fitz.open(a.pdf);errors=[];details=[];clipped=[];overlaps=[];textchars=[];fontchars=[];uris=set();image_count=0;link_count=0;thumbs=[]
    if len(pdf)!=layout['pages']:errors.append('Actual page count differs from the layout map')
    for i,page in enumerate(pdf):
        if page.rect.width>=page.rect.height or abs(page.rect.width-W)>.5 or abs(page.rect.height-H)>.5:errors.append(f'Not A4 portrait: page {i+1}')
        text=page.get_text()
        if len(text.strip())<12:errors.append(f'Near-empty page {i+1}')
        if '\ufffd' in text or '\x00' in text:errors.append(f'Replacement or missing glyph page {i+1}')
        data=page.get_text('dict');lineboxes=[]
        for block in data['blocks']:
            if block.get('type')!=0:continue
            for line in block['lines']:
                textline=''.join(s['text'] for s in line['spans'])
                lineboxes.append((fitz.Rect(line['bbox']),textline))
                for span in line['spans']:
                    box=fitz.Rect(span['bbox'])
                    if box.x0<-.5 or box.y0<-.5 or box.x1>W+.5 or box.y1>H+.5:clipped.append(dict(page=i+1,text=span['text'],box=list(box)))
                    for ch in span['text']:
                        if not ch.isspace():textchars.append(ch);fontchars.append(span['size'])
        if str(i+1) not in layout['special_pages']:
            for j,(r1,t1) in enumerate(lineboxes):
                for r2,t2 in lineboxes[j+1:]:
                    rr=r1&r2
                    if not rr.is_empty and rr.width>1.5 and rr.height>1.5:overlaps.append(dict(page=i+1,text1=t1,text2=t2,intersection=list(rr)))
        imgs=page.get_images(full=True);image_count+=len(imgs)
        if len(imgs)>1:errors.append(f'More than one captured image on page {i+1}')
        links=page.get_links();link_count+=len(links)
        for link in links:
            if link['kind']==fitz.LINK_GOTO and not 0<=link.get('page',-1)<len(pdf):errors.append(f'Broken internal link page {i+1}')
            if link.get('uri'):uris.add(link['uri'])
        pix=page.get_pixmap(matrix=fitz.Matrix(1.1,1.1),alpha=False);pix.save(a.qa_dir/f'page-{i+1:03d}.png')
        small=page.get_pixmap(matrix=fitz.Matrix(.36,.36),alpha=False);im=Image.frombytes('RGB',[small.width,small.height],small.samples)
        tile=Image.new('RGB',(im.width,im.height+21),'white');tile.paste(im,(0,0));ImageDraw.Draw(tile).text((7,im.height+3),str(i+1),fill='black');thumbs.append(tile)
        details.append(dict(page=i+1,characters=len(text),images=len(imgs),links=len(links)))
    if clipped:errors.append(f'Clipped text spans: {len(clipped)}')
    if overlaps:errors.append(f'Overlapping text lines: {len(overlaps)}')
    whole=''.join(textchars);missing=[];small_body=[];font_checked=0
    for expected in layout['expected_content']:
        needle=normalize(expected['text']);pos=whole.find(needle)
        if pos<0:missing.append(expected['text']);continue
        if expected['min_font']:
            font_checked+=1;actual=min(fontchars[pos:pos+len(needle)]);found=False
            while pos>=0:
                actual=min(fontchars[pos:pos+len(needle)])
                if actual>=expected['min_font']-.1:found=True;break
                pos=whole.find(needle,pos+1)
            if not found:small_body.append(dict(text=expected['text'][:70],size=actual))
    if missing:errors.append(f'Missing original texts: {len(missing)}')
    if small_body:errors.append(f'Body text below 15 pt: {len(small_body)}')
    small_diagrams=[]
    for region in layout['diagram_regions']:
        rect=fitz.Rect(region['box'])
        for block in pdf[region['page']-1].get_text('dict')['blocks']:
            if block.get('type')!=0:continue
            for line in block['lines']:
                for span in line['spans']:
                    if rect.contains(fitz.Rect(span['bbox'])) and span['size']<11.9:small_diagrams.append(dict(page=region['page'],text=span['text'],size=span['size']))
    if small_diagrams:errors.append(f'Diagram text below 12 pt: {len(small_diagrams)}')
    if image_count!=20 or len(layout['captures'])!=20:errors.append(f'Capture count differs from 20: {image_count}')
    asset_matches=0
    for capture in layout['captures']:
        page=pdf[capture['page']-1];imgs=page.get_images(full=True)
        if len(imgs)!=1:errors.append(f'Image mapping {capture["id"]}');continue
        img=pdf.extract_image(imgs[0][0]);embedded=Image.open(io.BytesIO(img['image'])).convert('RGB');source=Image.open(ROOT/capture['file']).convert('RGB')
        if embedded.size==source.size and embedded.tobytes()==source.tobytes():asset_matches+=1
        else:errors.append(f'Captured asset changed: {capture["id"]}')
        rect=page.get_image_rects(imgs[0][0])[0]
        if abs(rect.width-CW)>.2 or abs(rect.width/rect.height-source.width/source.height)>.005:errors.append(f'Image width/aspect mismatch: {capture["id"]}')
    for code,title,url,desc in SOURCES:
        if url not in uris:errors.append(f'Missing source URL: {code}')
    for p in ALL:
        if p['id'] not in layout['page_no']:errors.append(f'Missing section mapping: {p["id"]}')
    preserved=[];backup=a.qa_dir.parent/'before-tools'
    for name in ['book_data.py','oxygen_data.py']:
        original=backup/name;current=ROOT/'원본'/'tools'/name
        if original.is_file():
            same=original.read_bytes()==current.read_bytes();preserved.append(dict(file=name,identical=same,sha256=hashlib.sha256(current.read_bytes()).hexdigest()))
            if not same:errors.append(f'Original manuscript data changed: {name}')
    if not pdf.get_toc():errors.append('Missing PDF bookmarks')
    cols=6;tw,th=thumbs[0].size;sheet=Image.new('RGB',(cols*tw,math.ceil(len(thumbs)/cols)*th),'#e3e6e8')
    for i,im in enumerate(thumbs):sheet.paste(im,((i%cols)*tw,(i//cols)*th))
    sheet.save(a.qa_dir/'contact-sheet.png')
    report=dict(pdf=str(a.pdf),portrait_pages=len(pdf),captures=image_count,identical_embedded_assets=asset_matches,quizzes=len(QUIZ),faqs=len(FAQ),original_texts_checked=len(layout['expected_content']),body_font_checks=font_checked,body_font_min=15,diagram_font_min=12,links=link_count,outline_entries=len(pdf.get_toc()),missing_texts=missing,body_font_failures=small_body,diagram_font_failures=small_diagrams,clipped_spans=clipped,text_overlap_candidates=overlaps,preserved_data=preserved,errors=errors,per_page=details,bytes=a.pdf.stat().st_size,sha256=hashlib.sha256(a.pdf.read_bytes()).hexdigest())
    (a.qa_dir/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k not in ['per_page','clipped_spans','text_overlap_candidates','missing_texts','body_font_failures','diagram_font_failures']},ensure_ascii=False))
    raise SystemExit(1 if errors else 0)

if __name__=='__main__':main()
