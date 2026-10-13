"""Aponta o painel e os testes para a prévia estática servida pelo Apache."""
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
p=ROOT/'admin/src/main.tsx';text=p.read_text(encoding='utf-8')
text=text.replace('href="http://localhost:8081"','href={APP_PREVIEW}')
p.write_text(text,encoding='utf-8')
p=ROOT/'tests/browser_smoke.py';text=p.read_text(encoding='utf-8')
text=text.replace('http://localhost:8081','http://localhost/app_mamografia/preview/')
p.write_text(text,encoding='utf-8')
print('Painel e testes apontam para a prévia local do Apache.')
