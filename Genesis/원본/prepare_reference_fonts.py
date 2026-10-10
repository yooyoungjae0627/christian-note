"""Freeze installed Noto variable fonts so Edge embeds the same named font weights."""
import sys,os,json
from pathlib import Path
T=Path(os.environ['TEMP'])/'genesis-style-20261010'
sys.path.insert(0,str(T/'python-libs'))
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
R=Path(__file__).resolve().parents[2]
text=''.join(p.read_text(encoding='utf-8-sig') for p in (R/'Genesis/원본').glob('*.json'))
text+=(R/'Genesis/원본/build_reference_chapters.py').read_text(encoding='utf8')
for family,weights in [('Serif',[400,700]),('Sans',[300,400,500,700,900])]:
 for weight in weights:
  file=T/f'Noto{family}KR-{weight}.ttf'
  if file.exists():continue
  font=TTFont(f'C:/Windows/Fonts/Noto{family}KR-VF.ttf')
  font=instantiateVariableFont(font,{'wght':weight},inplace=True)
  options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
  selected=subset.Subsetter(options=options);selected.populate(text=text);selected.subset(font)
  # Edge otherwise emits unnamed Type3 glyphs for a non-default instance.
  label={300:'Light',400:'Regular',500:'Medium',700:'Bold',900:'Black'}[weight]
  for name in font['name'].names:
   if name.nameID in (2,17):name.string=label.encode(name.getEncoding(),errors='replace')
   if name.nameID==6:name.string=f'Noto-{family}-KR-{label}'.encode(name.getEncoding(),errors='replace')
  font.save(file);print(f'{family} {weight}: {file.stat().st_size} bytes',flush=True)
