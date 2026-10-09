import os,json,math
from pathlib import Path
from PIL import Image,ImageDraw
T=Path(os.environ['TEMP'])/'genesis-chapters-20261010'
for ch in (1,2,3):
 pages=json.loads((T/f'ch{ch}-pages.json').read_text(encoding='utf-8'));batch=8
 for k in range(math.ceil(len(pages)/batch)):
  canvas=Image.new('RGB',(1200,1720),'#d8dde3');draw=ImageDraw.Draw(canvas)
  for j,p in enumerate(pages[k*batch:(k+1)*batch]):
   im=Image.open(T/f'ch{ch}-page{p["page"]}.png').convert('RGB');im.thumbnail((285,830));x=(j%4)*300+7;y=(j//4)*860+20;canvas.paste(im,(x,y));draw.text((x,y-15),f'Chapter {ch} / Page {p["page"]}',fill='black')
  dest=T/f'ch{ch}-sheet{k+1}.jpg';canvas.save(dest,quality=90);print(dest)
