"""Fontes locais licenciadas OFL, compartilhadas entre app e painel."""
from io import BytesIO
from pathlib import Path
import shutil
import urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset

root=Path(__file__).resolve().parent.parent
target=root/'mobile/assets/fonts';target.mkdir(parents=True,exist_ok=True)
public=root/'admin/public/fonts';public.mkdir(parents=True,exist_ok=True)
families=[('DMSans','dmsans','DMSans%5Bopsz,wght%5D.ttf',[400,500,600,700]),('Manrope','manrope','Manrope%5Bwght%5D.ttf',[600,700,800])]
for name,folder,filename,weights in families:
    base=f'https://raw.githubusercontent.com/google/fonts/main/ofl/{folder}/'
    data=urllib.request.urlopen(base+filename,timeout=30).read()
    license_text=urllib.request.urlopen(base+'OFL.txt',timeout=30).read()
    (target/f'{name}-OFL.txt').write_bytes(license_text)
    shutil.copy2(target/f'{name}-OFL.txt',public/f'{name}-OFL.txt')
    for weight in weights:
        font=TTFont(BytesIO(data));axes={'wght':weight}
        if any(a.axisTag=='opsz' for a in font['fvar'].axes):axes['opsz']=14
        font=instantiateVariableFont(font,axes,inplace=True)
        options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
        selected=subset.Subsetter(options=options)
        selected.populate(unicodes=[*range(0x20,0x250),*range(0x370,0x400),*range(0x2000,0x2070),*range(0x2190,0x2200)])
        selected.subset(font)
        path=target/f'{name}-{weight}.ttf';font.save(path);shutil.copy2(path,public/path.name)
print('Fontes DM Sans e Manrope preparadas localmente para app e painel.')
