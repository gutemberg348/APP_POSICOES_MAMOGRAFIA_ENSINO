"""Configura a identidade do app e o caminho da prévia local, sem build Android."""
import json
from pathlib import Path
from PIL import Image, ImageOps
ROOT=Path(__file__).resolve().parent.parent
p=ROOT/'mobile/package.json'
data=json.loads(p.read_text(encoding='utf-8'))
data['name']='dominando-a-mamografia'
data['main']='expo-router/entry'
data['scripts'].update({'lint':'expo lint','typecheck':'tsc --noEmit','export:web':'expo export --platform web --output-dir ../preview'})
p.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
p=ROOT/'mobile/app.json'
data=json.loads(p.read_text(encoding='utf-8'));config=data['expo']
config['android'].pop('usesCleartextTraffic',None)
config['scheme']='mamografia'
config['experiments']={'baseUrl':'/app_mamografia/preview'}
config['android']['adaptiveIcon']={'backgroundColor':'#FFFFFF','foregroundImage':'./assets/brand-mark.png'}
config['icon']='./assets/brand-mark.png'
config['web']['favicon']='./assets/brand-mark.png'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
with Image.open(ROOT/'assets/Ícone preto.png') as original:
    ImageOps.pad(original.convert('RGBA'),(1024,1024),color=(255,255,255,255)).save(ROOT/'mobile/assets/brand-mark.png')
p=ROOT/'mobile/App.tsx';text=p.read_text(encoding='utf-8')
text=text.replace("setActiveCategory(c);navigate('category');","setActiveCategory(c);setPage(1);router.push({pathname:'/category',params:{id:c.id}});")
text=text.replace('key={t.id} accessibilityRole="tab"','key={t.id} accessibilityLabel={t.label} accessibilityRole="tab"')
text=text.replace('key={n.id} onPress={()=>navigate(n.id)}','key={n.id} accessibilityLabel={n.label} onPress={()=>navigate(n.id)}')
text=text.replace('style={s.close} accessibilityLabel="Ampliar imagem"','accessibilityRole="button" style={s.close} accessibilityLabel="Ampliar imagem"')
text=text.replace('style={s.close} accessibilityLabel="Diminuir imagem"','accessibilityRole="button" style={s.close} accessibilityLabel="Diminuir imagem"')
p.write_text(text,encoding='utf-8')
print('Identidade e configuração local aplicadas.')
