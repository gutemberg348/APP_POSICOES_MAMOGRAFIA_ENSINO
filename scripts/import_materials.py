"""Importação rastreável do material da cliente; não cria conteúdo clínico."""
from pathlib import Path
import hashlib
import json
import re
import shutil
import unicodedata
import fitz
import cv2
from PIL import Image, ImageOps
from manual_content import extract_manual, PDF

ROOT = Path(__file__).resolve().parent.parent
doc = fitz.open(PDF)
pages = [page.get_text() for page in doc]
raw = '\n'.join(pages)
def slug(text):
    return re.sub(r'[^a-z0-9]+', '-', unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()).strip('-')

categories = [
    (1,'Orientações','Prepare-se para o exame','reader-outline','FREE'),
    (2,'Incidências de Rotina','Os posicionamentos de rotina','layers-outline','FREE'),
    (3,'Incidências Adicionais','Explore as incidências adicionais','scan-outline','PREMIUM'),
    (4,'Manobras Complementares','Aprofunde seu conhecimento','options-outline','PREMIUM'),
    (5,'Quando complementar?','Consulte os conteúdos de complementação','help-circle-outline','PREMIUM'),
]
titles = [
    'Craniocaudal (CC)', 'Médio-Lateral Oblíqua (MLO)', 'Perfil Médio-Lateral (ML)',
    'Perfil Látero-Medial (LM)', 'Craniocaudal Exagerada (XCC)', 'Cleavage (Vale - CV)',
    'Caudocranial (From Below - FB)', 'Axilar (AX)', 'Látero-Medial Oblíqua (LMO)',
    'Manobra de Eklund (EKLUND)', 'Compressão Localizada (SPOT)', 'Magnificação (MAG)',
    'Manobra Rotacional (RL)', 'Manobra Tangencial (TAN)', 'Manobra Angular (ANG)',
]
starts = [raw.index(title) for title in titles]
end_positions = starts[1:]+[raw.index(' Quando complementar?')]
manual = extract_manual()
topics = [{**topic, 'slug':slug(topic['title']), 'subtitle':None} for topic in manual['topics']]

media=[]; report=[]
source=next(p for p in ROOT.iterdir() if p.is_dir() and p.name.startswith('Mídia'))
for folder in sorted(source.iterdir(),key=lambda p:int(p.name.split()[0])):
    topic_id=int(folder.name.split()[0]); topic=topics[topic_id-1]
    files=sorted(folder.iterdir(),key=lambda p:(p.suffix.lower()=='.mp4',int(re.match(r'\d+',p.name)[0]) if re.match(r'\d+',p.name) else 100,p.name))
    for order,path in enumerate(files):
        if path.suffix.lower() not in ['.jpg','.jpeg','.png','.mp4']: continue
        key=hashlib.sha256(str(path.relative_to(ROOT)).encode()).hexdigest()
        is_video=path.suffix.lower()=='.mp4'
        destination=ROOT/'uploads'/('videos' if is_video else 'images')/(key[:32]+path.suffix.lower())
        destination.parent.mkdir(parents=True,exist_ok=True)
        if not destination.exists(): shutil.copy2(path,destination)
        thumb=ROOT/'uploads'/'thumbnails'/(key[:32]+'.jpg'); thumb.parent.mkdir(parents=True,exist_ok=True)
        width=height=duration=None
        if is_video:
            cap=cv2.VideoCapture(str(path)); fps=cap.get(cv2.CAP_PROP_FPS); frame_count=cap.get(cv2.CAP_PROP_FRAME_COUNT)
            duration=round(frame_count/fps,2) if fps else None
            cap.set(cv2.CAP_PROP_POS_MSEC,min(2000,(duration or 0)*200))
            ok,frame=cap.read()
            if ok:
                height,width=frame.shape[:2]; im=Image.fromarray(cv2.cvtColor(frame,cv2.COLOR_BGR2RGB)); im.thumbnail((640,640)); im.save(thumb,quality=82)
            cap.release()
        else:
            with Image.open(path) as original:
                im=ImageOps.exif_transpose(original); width,height=im.size
                im=im.convert('RGB'); im.thumbnail((640,640)); im.save(thumb,quality=82)
        number=re.match(r'\d+',path.name)
        title=topic['title']+(' · Vídeo' if is_video else ' · Imagem '+(number[0] if number else str(order+1)))
        if '(1)' in path.stem: title+=' (arquivo adicional)'
        media.append({'topic_id':topic_id,'type':'VIDEO_UPLOAD' if is_video else 'IMAGE','title':title,
            'file_path':destination.relative_to(ROOT).as_posix(),'original_name':path.name,
            'thumbnail_path':thumb.relative_to(ROOT).as_posix() if thumb.exists() else None,
            'mime_type':'video/mp4' if is_video else 'image/png' if path.suffix.lower()=='.png' else 'image/jpeg',
            'size':path.stat().st_size,'duration':duration,'width':width,'height':height,
            'order_position':order,'access_type':topic['access_type'],'source_key':key})
    expected=re.search(r'\[(\d+) Imagens ao final desse texto\]',raw[starts[topic_id-1]:end_positions[topic_id-1]])
    images=[p for p in files if p.suffix.lower()!='.mp4']
    if expected and int(expected[1])!=len(images): report.append(f'- {topic["title"]}: manual prevê {expected[1]} imagens; pasta contém {len(images)}. Todos os arquivos foram preservados.')
    for path in images:
        if topic_id==3 and 'látero-medial' in path.name.lower(): report.append(f'- Pasta Perfil Médio-Lateral: arquivo `{path.name}` tem nomenclatura Látero-Medial. Relação mantida conforme a pasta; confirmar com a cliente.')
        if '(1)' in path.stem: report.append(f'- `{folder.name}/{path.name}`: numeração repetida. Não removido automaticamente.')
settings={'app_name':'Dominando a Mamografia','footer_notice':manual['footer_notice'],
    'premium_title':'Seu próximo passo no aprendizado','premium_description':'Acesso às incidências adicionais, manobras complementares e conteúdos de quando complementar. Pagamento único.',
    'premium_price':'','support_email':'','privacy_url':'','terms_url':'','logo':'assets/Logo do app.png'}
data={'categories':[dict(id=i,name=name,slug=slug(name),description=desc,icon=icon,access_type=access,order_position=i) for i,name,desc,icon,access in categories],
    'topics':topics,'media':media,'settings':settings}
(ROOT/'database'/'materials.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'docs'/'revisao-material.md').write_text('# Revisão do material\n\nFonte: manual de 27 páginas e pastas originais de mídia.\n\n'+'\n'.join(report)+'\n\nConteúdo clínico importado do PDF, sem correções técnicas. Valores, nomenclaturas e eventuais inconsistências clínicas dependem de validação pela cliente.\n',encoding='utf-8')
shutil.copy2(ROOT/'assets'/'Logo do app.png',ROOT/'mobile'/'assets'/'brand.png')
print(f'Importados: {len(topics)} tópicos, {len(media)} mídias; {sum(m["type"]=="IMAGE" for m in media)} imagens e {sum(m["type"]!="IMAGE" for m in media)} vídeos.')
