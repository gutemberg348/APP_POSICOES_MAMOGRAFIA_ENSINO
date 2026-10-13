"""Gera a transcrição fiel e uma atualização SQL limitada ao conteúdo do manual."""
from pathlib import Path
import json
from manual_content import extract_manual, normalize

ROOT = Path(__file__).resolve().parent.parent
manual = extract_manual()
path = ROOT/'database/materials.json'
seed = json.loads(path.read_text(encoding='utf-8'))
before = json.loads(path.read_text(encoding='utf-8'))
for topic in seed['topics']:
    exact = next(t for t in manual['topics'] if t['id'] == topic['id'])
    topic.update(exact)
seed['settings']['footer_notice'] = manual['footer_notice']
path.write_text(json.dumps(seed,ensure_ascii=False,indent=2),encoding='utf-8')
payload = {'source_pdf_sha256':manual['pdf_sha256'],'topics':manual['topics'],'footer_notice':manual['footer_notice']}
(ROOT/'database/manual-correction.json').write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')

def sql_text(value):
    return 'NULL' if value is None else "CONVERT(UNHEX('"+value.encode('utf-8').hex()+"') USING utf8mb4)"

sql = [
    '-- Correção fiel ao PDF fornecido. Selecione o banco existente no phpMyAdmin.',
    '-- Atualiza somente os 28 tópicos/textos originais e o aviso educacional.',
    '-- Senhas, clientes, Premium das contas, anúncios e arquivos não são alterados.',
    '-- SHA-256 do PDF: '+manual['pdf_sha256'],
    'SET NAMES utf8mb4;', 'START TRANSACTION;',
]
report = ['# Conferência integral dos textos do manual', '',
    f'Fonte: `{manual["pages"]}` páginas; SHA-256 `{manual["pdf_sha256"]}`.', '',
    'A redação, os números, a capitalização, os acentos e a pontuação são os do PDF. Não houve correção clínica ou de redação. Espaços de diagramação são normalizados para permitir a quebra de linha na tela. Listas, numeração e destaques são extraídos da posição dos elementos e das fontes do documento.', '',
    'As instruções sobre botões, etiquetas de acesso, indicação de categoria e quantidade de imagens são especificações de interface e não parágrafos clínicos. Foram excluídas apenas da transcrição exibida. O aviso geral de Quando complementar? é repetido nos tópicos dessa categoria e identificado como texto compartilhado.', '',
    '| ID | Tópico | Páginas do tópico | Blocos | Revisão |', '|---|---|---|---|---|',
]
report_path = ROOT/'docs/conferencia-textos-pdf.md'
changes = [line for line in report_path.read_text(encoding='utf-8').splitlines() if line.startswith('- ')] if report_path.exists() else []
for t in manual['topics']:
    tid=t['id']; old=next(x for x in before['topics'] if x['id']==tid)
    source=' '.join((b['title'] or '')+' '+b['body'] for b in t['blocks'] if b['metadata'].get('scope')!='category')
    assert normalize(source) == manual['excerpts'][str(tid)]
    if any(b['title']=='Dica extra' for b in old['blocks']): changes.append(f'- {t["title"]}: título `Dica extra:` recuperado com os dois-pontos originais.')
    if old['source_pages']!=t['source_pages']: changes.append(f'- {t["title"]}: referências de páginas ajustadas de `{old["source_pages"]}` para `{t["source_pages"]}` após separar os limites dos tópicos.')
    sql.extend([
        f'-- Tópico {tid}: {t["title"]} · páginas {t["source_pages"]}',
        f"UPDATE topics SET title={sql_text(t['title'])},category_id={t['category_id']},access_type={sql_text(t['access_type'])} WHERE id={tid};",
        f"UPDATE contents SET topic_id={tid},source_pages={sql_text(t['source_pages'])} WHERE id={tid};",
        f'DELETE FROM content_blocks WHERE content_id={tid};',
    ])
    for order,b in enumerate(t['blocks']):
        values=[str(tid),sql_text(b['type']),sql_text(b['title']),sql_text(b['body']),sql_text(json.dumps(b['metadata'],ensure_ascii=False)),str(order)]
        sql.append('INSERT INTO content_blocks(content_id,type,title,body,metadata,order_position) VALUES('+','.join(values)+');')
    report.append(f'| {tid} | {t["title"]} | {t["source_pages"]} | {len(t["blocks"])} | Texto integral conferido |')
sql.extend([f"INSERT INTO settings(`key`,value) VALUES('footer_notice',{sql_text(manual['footer_notice'])}) ON DUPLICATE KEY UPDATE value=VALUES(value);",'COMMIT;'])
(ROOT/'database/manual-correction.sql').write_text('\n'.join(sql)+'\n',encoding='utf-8')
report.extend(['','## Divergências encontradas na importação anterior','',*changes,
    '- Calcificações agrupadas sugestivas de localização na pele: removida a instrução editorial de botão que havia escapado por estar dividida em duas linhas.',
    '- Aviso geral de Quando complementar?: removido o título acrescentado `Importante`, mantendo o parágrafo original iniciado por `Importante:`.',
    '- Reconstituídos parágrafos, marcadores das listas, destaques e a separação entre Rotação Medial e Rotação Lateral. A numeração permanece a do PDF em cada rotação.',
    '', 'A comparação do fluxo completo de texto clínico, em ordem de documento, passou sem palavras omitidas, acrescentadas, trocadas ou reordenadas. Cada bloco guarda as páginas e o hash do PDF para rastreamento.',
    '', 'Os nomes divergentes e as quantidades extras de imagens estão documentados em `revisao-material.md`. Esta correção não deduz uma troca de imagem a partir do nome de arquivo; o conteúdo escrito vem do PDF.',
])
seen = set(); formatted = []
for line in report:
    if line.startswith('- ') and line in seen: continue
    formatted.append(line); seen.add(line)
report_path.write_text('\n'.join(formatted)+'\n',encoding='utf-8')
print(f'Transcrição verificada: {len(manual["topics"])} tópicos, {sum(len(t["blocks"]) for t in manual["topics"])} blocos. SQL e relatório gerados.')
