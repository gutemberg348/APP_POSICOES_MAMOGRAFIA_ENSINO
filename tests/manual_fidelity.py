"""Compara os 28 textos efetivamente servidos pela API ao PDF original."""
from pathlib import Path
import hashlib,json,re,unittest
import fitz
from api_tests import request

ROOT=Path(__file__).resolve().parent.parent
PDF=ROOT/'Projeto app Dominando a Mamografia - Manual_de_Posicionamentos.docx.pdf'

def normalized(text):return ' '.join(text.split())

class ManualFidelity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        credentials=dict(line.split(': ',1) for line in (ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8').splitlines() if ': ' in line)
        status,login,_=request('/admin/login','POST',{'email':credentials['Email'],'password':credentials['Senha']})
        assert status==200,login;cls.token=login['token'];cls.contents={}
        for tid in range(1,29):
            status,data,_=request(f'/contents/{tid}',token=cls.token)
            assert status==200,(tid,data);cls.contents[tid]=data
        doc=fitz.open(PDF)
        # Independent plain-text extraction: not the rich-text parsing code.
        text='\n'.join(page.get_text('text') for page in doc);doc.close()
        cls.footer=normalized(text[text.index('Dominando a Mamografia é um material de apoio educacional'):])
        text=text[text.index('Preparo da paciente'):text.index('Se possível, fixar essa Nota de rodapé')]
        for pattern in [r'\(Botão\s+clicável\s+para\s+abrir\s+o\s+conteúdo[^)]*\)',r'\[\d+\s+Imagens\s+ao\s+final\s+desse\s+texto\]',r'\[(?:gratuito|premium)\]',r'\(categoria premium\)',r'^\s*Categoria:[^\n]*',r'^\s*(?:Incidências de Rotina:|Incidências adicionais:|Manobras Complementares)\s*$']:
            text=re.sub(pattern,'',text,flags=re.M)
        cls.source=normalized(text)
        cls.seed=json.loads((ROOT/'database/materials.json').read_text(encoding='utf-8'))

    @classmethod
    def tearDownClass(cls):request('/auth/logout','POST',token=cls.token)

    def test_entire_clinical_word_stream_matches_pdf(self):
        chunks=[]
        for tid in [16,*range(1,16),*range(17,29)]:
            content=self.contents[tid]
            if tid==17:chunks.extend(['Quando complementar?',content['blocks'][0]['body']])
            if tid!=16:chunks.append(content['title'])
            for block in content['blocks']:
                if (block['metadata'] or {}).get('scope')=='category':continue
                chunks.extend([block['title'] or '',block['body']])
        self.assertEqual(normalized(' '.join(chunks)),self.source)

    def test_every_topic_matches_seed_and_pdf_trace(self):
        pdf_hash=hashlib.sha256(PDF.read_bytes()).hexdigest()
        for topic in self.seed['topics']:
            with self.subTest(topic=topic['title']):
                content=self.contents[topic['id']]
                self.assertEqual(content['topic_id'],topic['id']);self.assertEqual(content['title'],topic['title'])
                self.assertEqual(content['source_pages'],topic['source_pages'])
                self.assertEqual([{k:b[k] for k in ['type','title','body','metadata']} for b in content['blocks']],topic['blocks'])
                for block in content['blocks']:
                    self.assertEqual(block['metadata']['source_pdf_sha256'],pdf_hash)
                    paragraphs=block['metadata']['paragraphs']
                    rendered=' '.join(''.join(run['text'] for run in p['runs']) for p in paragraphs)
                    self.assertEqual(normalized(rendered),normalized(block['body']))
                    self.assertNotIn('Botão clicável',block['body'])

    def test_side_angle_compression_and_rotation_not_swapped(self):
        ml=self.contents[3];lm=self.contents[4]
        self.assertIn('face lateral da mama apoiada',ml['blocks'][2]['body'])
        self.assertIn('face medial da mama apoiada',lm['blocks'][2]['body'])
        self.assertIn('medial sobe, lateral desce',ml['blocks'][-1]['body'])
        mlo=self.contents[2]
        self.assertEqual(mlo['blocks'][1]['body'],'45° (quarenta e cinco graus).')
        orientation=self.contents[16]
        force=next(b for b in orientation['blocks'] if b['title']=='Força de compressão')
        self.assertIn('70 Newtons equivalem a 7,138 Kgf',force['body'])
        rotation=next(b for b in self.contents[13]['blocks'] if b['title']=='Etapas do posicionamento')
        paragraphs=rotation['metadata']['paragraphs']
        self.assertEqual([normalized(''.join(r['text'] for r in p['runs'])) for p in paragraphs if p['kind']=='subheading'],['Rotação Medial','Rotação Lateral'])
        self.assertEqual([int(re.match(r'^(\d+)',normalized(''.join(r['text'] for r in p['runs'])))[1]) for p in paragraphs if p['kind']=='numbered'],[1,2,3,4,1,2,3,4])
        for tid in range(1,16):self.assertEqual(self.contents[tid]['blocks'][-1]['title'],'Dica extra:')

    def test_pdf_bullets_and_shared_notice(self):
        status,settings,_=request('/settings')
        self.assertEqual(status,200)
        self.assertEqual(normalized(settings['footer_notice']),self.footer)
        body=self.contents[24]['blocks'][1]
        bullets=[p for p in body['metadata']['paragraphs'] if p['kind']=='bullet']
        self.assertEqual(len(bullets),5)
        notice=self.contents[17]['blocks'][0]
        self.assertIsNone(notice['title']);self.assertTrue(notice['body'].startswith('Importante:'))
        self.assertEqual(len(notice['metadata']['paragraphs']),1)
        self.assertEqual(len(self.contents[13]['blocks'][0]['metadata']['paragraphs']),1)
        for tid in range(18,29):self.assertEqual(self.contents[tid]['blocks'][0]['body'],notice['body'])
        self.assertNotIn('Botão',self.contents[27]['blocks'][1]['body'])

if __name__=='__main__':unittest.main(verbosity=2)
