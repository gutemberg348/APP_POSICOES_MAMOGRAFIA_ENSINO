"""Transcrição do PDF com limites explícitos e formatação rastreável.

Nunca corrige termos clínicos, números, acentos ou pontuação. Somente instruções
editoriais de interface são excluídas; espaços de diagramação são normalizados.
"""
from pathlib import Path
import hashlib
import re
import fitz

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / 'Projeto app Dominando a Mamografia - Manual_de_Posicionamentos.docx.pdf'
POSITIONING = [
    'Craniocaudal (CC)', 'Médio-Lateral Oblíqua (MLO)', 'Perfil Médio-Lateral (ML)',
    'Perfil Látero-Medial (LM)', 'Craniocaudal Exagerada (XCC)', 'Cleavage (Vale - CV)',
    'Caudocranial (From Below - FB)', 'Axilar (AX)', 'Látero-Medial Oblíqua (LMO)',
    'Manobra de Eklund (EKLUND)', 'Compressão Localizada (SPOT)', 'Magnificação (MAG)',
    'Manobra Rotacional (RL)', 'Manobra Tangencial (TAN)', 'Manobra Angular (ANG)',
]
COMPLEMENTS = [
    'Queixa de nódulo palpável', 'Nódulo sobreposto ou assimetria focal',
    'Nódulo na região medial da mama', 'Nódulo ou assimetria focal no prolongamento axilar',
    'Linfonodo aumentado ou palpável', 'Múltiplos nódulos em apenas uma mama',
    'Múltiplos nódulos em ambas as mamas', 'Microcalcificações agrupadas suspeitas',
    'Calcificações difusas em toda a mama — unilateral',
    'Calcificações difusas em toda a mama — bilateral',
    'Calcificações agrupadas sugestivas de localização na pele',
    'Queixa de descarga papilar espontânea',
]
HEADINGS = {
    'Finalidade': 'paragraph', 'Ângulo do tubo/bucky': 'paragraph',
    'Posição da paciente': 'paragraph', 'Etapas do posicionamento': 'numbered_list',
    'Critérios de qualidade': 'quality_criteria', 'Erros comuns': 'common_errors',
    'Dica extra:': 'tip', 'Importante': 'important',
    'Preparo da paciente': 'paragraph', 'Confira o pedido médico': 'paragraph',
    'Preencha a anamnese': 'paragraph', 'Investigue possíveis queixas': 'paragraph',
    'Confira os exames anteriores': 'paragraph', 'Força de compressão': 'important',
    'Durante o posicionamento': 'paragraph',
}
EDITORIAL = [
    r'\(Botão\s+clicável\s+para\s+abrir\s+o\s+conteúdo[^)]*\)',
    r'\[\d+\s+Imagens\s+ao\s+final\s+desse\s+texto\]',
    r'\[(?:gratuito|premium)\]', r'\(categoria premium\)',
    r'^\s*Categoria:[^\n]*',
    r'^\s*(?:Incidências de Rotina:|Incidências adicionais:|Manobras Complementares)\s*$',
]

def normalize(value):
    return ' '.join(value.split())

def page_label(pages):
    pages = sorted(set(pages)); ranges = []
    for n in pages:
        if ranges and n == ranges[-1][-1] + 1:
            ranges[-1].append(n)
        else:
            ranges.append([n])
    return ','.join(str(group[0]) if len(group) == 1 else f'{group[0]}-{group[-1]}' for group in ranges)

def extract_manual():
    doc = fitz.open(PDF); lines = []; parts = []; offset = 0
    for p, page in enumerate(doc, 1):
        dots = [d['rect'] for d in page.get_drawings() if d['type'] == 'f' and d.get('fill') == (0.0, 0.0, 0.0) and 3 <= d['rect'].width <= 7 and abs(d['rect'].width-d['rect'].height) < .5]
        for block in page.get_text('dict')['blocks']:
            for line in block.get('lines', []):
                text = ''.join(s['text'] for s in line['spans'])
                spans = []; span_offset = offset
                for s in line['spans']:
                    spans.append({'start': span_offset, 'end': span_offset+len(s['text']), 'bold': bool(s['flags'] & 16), 'italic': bool(s['flags'] & 2)})
                    span_offset += len(s['text'])
                bbox = line['bbox']
                bullet = any(d.x1 < bbox[0] and bbox[0]-d.x1 < 20 and bbox[1] <= (d.y0+d.y1)/2 <= bbox[3] for d in dots)
                lines.append({'start': offset, 'end': offset+len(text), 'text': text, 'spans': spans, 'page': p, 'bbox': bbox, 'bullet': bullet})
                parts.append(text+'\n'); offset += len(text)+1
    raw = ''.join(parts); masked = list(raw); ignored = []
    for pattern in EDITORIAL:
        for m in re.finditer(pattern, ''.join(masked), re.M):
            ignored.append({'start': m.start(), 'end': m.end(), 'text': raw[m.start():m.end()]})
            for i in range(m.start(), m.end()):
                if masked[i] != '\n': masked[i] = ' '
    cleaned = ''.join(masked)
    pdf_hash = hashlib.sha256(PDF.read_bytes()).hexdigest()

    def anchor(title):
        matches = list(re.finditer(r'^\s*'+re.escape(title)+r'\s*$', cleaned, re.M))
        if len(matches) != 1:
            raise ValueError(f'Título ambíguo ou ausente: {title}: {len(matches)}')
        return matches[0]

    def chosen_lines(start, end):
        result = []
        for line in lines:
            if line['end'] <= start or line['start'] >= end: continue
            runs = []
            for span in line['spans']:
                a = max(span['start'], start); b = min(span['end'], end)
                if b > a:
                    text = cleaned[a:b]
                    if text.strip(): runs.append({'text': text, 'bold': span['bold'], 'italic': span['italic']})
            if runs:
                result.append({**line, 'runs': runs, 'text': normalize(''.join(r['text'] for r in runs))})
        return result

    def rich_runs(source):
        result = []
        for i, line in enumerate(source):
            fragments = ([{'text': ' ', 'bold': False, 'italic': False}] if i else []) + line['runs']
            for run in fragments:
                text = re.sub(r'\s+', ' ', run['text'])
                if not result or result[-1]['text'].endswith(' '): text = text.lstrip()
                if not text: continue
                if result and all(result[-1][k] == run[k] for k in ['bold', 'italic']): result[-1]['text'] += text
                else: result.append({**run, 'text': text})
        if result: result[-1]['text'] = result[-1]['text'].rstrip()
        return result

    def make_block(title, source, block_type=None):
        paragraphs = []; group = []; group_kind = 'paragraph'; previous = None
        def flush():
            nonlocal group
            if group:
                paragraphs.append({'kind': group_kind, 'runs': rich_runs(group), 'source_pages': page_label(x['page'] for x in group)})
                group = []
        for line in source:
            numbered = bool(re.match(r'^\d+[.)]\s', line['text']))
            emphasized = all(r['bold'] for r in line['runs'])
            gap = line['bbox'][1] - previous['bbox'][3] if previous and line['page'] == previous['page'] else 0
            standalone_bold = emphasized and (previous is None or (line['page'] == previous['page'] and gap > 10))
            kind = 'bullet' if line['bullet'] else 'numbered' if numbered else 'subheading' if standalone_bold else 'paragraph'
            new = kind in ['bullet','numbered','subheading'] or (previous and line['page'] == previous['page'] and gap > 10)
            if new: flush()
            if not group: group_kind = kind
            group.append(line); previous = line
        flush()
        body = '\n\n'.join(''.join(r['text'] for r in p['runs']) for p in paragraphs)
        metadata = {'source_pdf_sha256': pdf_hash, 'source_pages': page_label(x['page'] for x in source), 'paragraphs': paragraphs}
        assert normalize(body) == normalize(' '.join(line['text'] for line in source))
        return {'type': block_type or HEADINGS.get(title,'paragraph'), 'title': title, 'body': body, 'metadata': metadata}

    def sections(start, end):
        result = []; source = []; title = None; title_line = None
        def flush():
            if source:
                block = make_block(title, source)
                if title_line: block['metadata']['source_pages'] = page_label([title_line['page'],*[x['page'] for x in source]])
                result.append(block)
        for line in chosen_lines(start, end):
            if line['text'] in HEADINGS:
                flush(); title = line['text']; title_line = line; source = []
            else: source.append(line)
        flush()
        rendered = ' '.join((b['title'] or '')+' '+b['body'] for b in result)
        assert normalize(rendered) == normalize(cleaned[start:end]), 'Texto de seção não corresponde à origem'
        return result

    positions = [anchor(t) for t in POSITIONING]
    complement_heading = anchor('Quando complementar?')
    comp = [anchor(t) for t in COMPLEMENTS]
    orientation = anchor('Preparo da paciente')
    footer = raw.index('Dominando a Mamografia é um material de apoio educacional')
    footer_instruction = raw.index('Se possível, fixar essa Nota de rodapé')
    intro_start = cleaned.index('Importante: As informações apresentadas')
    intro = make_block(None, chosen_lines(intro_start, comp[0].start()), 'important')
    intro['metadata']['scope'] = 'category'
    topics = []; excerpts = {}
    specs = [(i+1,title,2 if i<2 else 3 if i<9 else 4,positions[i].end(),positions[i+1].start() if i<14 else complement_heading.start(),positions[i].start()) for i,title in enumerate(POSITIONING)]
    specs.append((16,'Orientações',1,orientation.start(),positions[0].start(),orientation.start()))
    specs.extend((17+i,title,5,comp[i].end(),comp[i+1].start() if i<11 else footer_instruction,comp[i].start()) for i,title in enumerate(COMPLEMENTS))
    for tid,title,category,start,end,title_start in specs:
        blocks = sections(start,end)
        selected = chosen_lines(title_start,end)
        source_pages = page_label(line['page'] for line in selected)
        if category == 5: blocks = [intro, *blocks]
        excerpts[str(tid)] = normalize(cleaned[start:end])
        topics.append({'id':tid,'category_id':category,'title':title,'access_type':'FREE' if category in [1,2] else 'PREMIUM','source_pages':source_pages,'blocks':blocks})
    # Check all clinical text in document order, not merely the individual slices.
    ordering = [16,*range(1,16),*range(17,29)]
    source = normalize(cleaned[orientation.start():footer_instruction])
    reconstructed = []
    for tid in ordering:
        t = next(t for t in topics if t['id'] == tid)
        if tid == 17: reconstructed.extend(['Quando complementar?',intro['body']])
        if tid != 16: reconstructed.append(t['title'])
        reconstructed.append(excerpts[str(tid)])
    assert normalize(' '.join(reconstructed)) == source, 'Texto clínico omitido, duplicado ou fora de ordem'
    doc.close()
    return {'topics':topics,'footer_notice':normalize(raw[footer:]),'pdf_sha256':pdf_hash,'excerpts':excerpts,'common_notice':intro['body'],'ignored_editorial':ignored,'pages':27}
