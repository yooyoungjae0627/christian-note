"""Freeze installed Noto variable fonts (subset to the 사무엘상 text) so Edge embeds named weights. Copied from Genesis/원본/prepare_reference_fonts.py."""
import sys,os,hashlib
from pathlib import Path
T=Path(os.environ['TEMP'])/'samuel-style';T.mkdir(exist_ok=True)
sys.path.insert(0,str(Path(os.environ['TEMP'])/'genesis-style-20261010'/'python-libs'))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
B=Path(__file__).resolve().parent
text=''.join(p.read_text(encoding='utf-8-sig') for p in B.glob('*.json'))+''.join(p.read_text(encoding='utf8') for p in B.glob('*.py'))
text+=''.join(chr(c) for c in range(0x20,0x7f))
digest=hashlib.sha256(text.encode('utf8')).hexdigest();stamp=T/'font-text.sha256'
if not stamp.exists() or stamp.read_text()!=digest:
 for old in T.glob('Noto*KR-*.ttf'):old.unlink()
for family,weights in [('Serif',[400,700]),('Sans',[300,400,500,700,900])]:
 for weight in weights:
  file=T/f'Noto{family}KR-{weight}.ttf'
  if file.exists():continue
  font=TTFont(f'C:/Windows/Fonts/Noto{family}KR-VF.ttf')
  font=instantiateVariableFont(font,{'wght':weight},inplace=True)
  options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
  s=subset.Subsetter(options=options);s.populate(text=text);s.subset(font)
  label={300:'Light',400:'Regular',500:'Medium',700:'Bold',900:'Black'}[weight]
  for name in font['name'].names:
   if name.nameID in (2,17):name.string=label.encode(name.getEncoding(),errors='replace')
   if name.nameID==6:name.string=f'Noto-{family}-KR-{label}'.encode(name.getEncoding(),errors='replace')
  font.save(file);print(f'{family} {weight}: {file.stat().st_size} bytes',flush=True)
stamp.write_text(digest)
