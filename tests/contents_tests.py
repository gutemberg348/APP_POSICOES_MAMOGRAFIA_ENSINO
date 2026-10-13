"""Exercise real manual edits with temporary text fixtures, never original topics."""
import copy
import json
import subprocess
import time
import unittest
from api_tests import ROOT, request

def fixture(command, *args):
    result = subprocess.run(['php', str(ROOT / 'scripts/contents-test-fixtures.php'), command, *map(str, args)], check=True, capture_output=True)
    return json.loads(result.stdout) if result.stdout else None

def payload(detail):
    return {key: copy.deepcopy(detail[key]) for key in ['title', 'revision', 'blocks']}

class ContentsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        access = (ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8')
        credentials = dict(line.split(': ', 1) for line in access.splitlines() if ': ' in line)
        status, result, _ = request('/admin/login', 'POST', {'email': credentials['Email'], 'password': credentials['Senha']})
        assert status == 200, result
        cls.admin = result['token']
        status, result, _ = request('/auth/register', 'POST', {'name': 'Teste textos', 'email': f'integration-texts-{time.time_ns()}@example.invalid', 'password': 'Integration1234!'})
        assert status == 200, result
        cls.user, cls.user_id = result['token'], result['user']['id']

    @classmethod
    def tearDownClass(cls):
        fixture('cleanup-user', cls.user_id)
        request('/auth/logout', 'POST', token=cls.admin)

    def setUp(self):
        self.fixture = fixture('create')
        self.route = f"/admin/contents/{self.fixture['id']}"
        self.addCleanup(fixture, 'cleanup', self.fixture['id'])

    def detail(self):
        status, result, _ = request(self.route, token=self.admin)
        self.assertEqual(status, 200, result)
        return result

    def save(self, body, expected=200):
        status, result, _ = request(self.route, 'PUT', body, self.admin)
        self.assertEqual(status, expected, result)
        return result

    def test_authorization_and_catalog(self):
        for route in ['/admin/contents', self.route]:
            self.assertEqual(request(route)[0], 401)
            self.assertEqual(request(route, token=self.user)[0], 403)
        body = payload(self.detail())
        self.assertEqual(request(self.route, 'PUT', body)[0], 401)
        self.assertEqual(request(self.route, 'PUT', body, self.user)[0], 403)
        status, rows, _ = request('/admin/contents', token=self.admin)
        self.assertEqual(status, 200)
        self.assertTrue(any(row['id'] == self.fixture['id'] and row['block_count'] == 2 for row in rows))
        self.assertEqual(request('/admin/contents/4294967295', token=self.admin)[0], 404)

    def test_save_public_text_order_new_sections_and_conflict(self):
        before = self.detail()
        body = payload(before)
        body['title'] = 'Título revisado — fixture'
        body['blocks'][0]['title'] = 'Texto revisado'
        body['blocks'][0]['body'] = 'Orientação atualizada com acentuação.\n\nOutro parágrafo.'
        body['blocks'][1]['body'] = '1. Etapa atualizada.\n2. Próxima etapa.'
        body['blocks'].reverse()
        body['blocks'].append({'id': None, 'type': 'quality_criteria', 'title': 'Critérios de teste', 'body': 'Primeiro critério\nSegundo critério'})
        after = self.save(body)
        self.assertNotEqual(after['revision'], before['revision'])
        status, public, headers = request(f"/contents/{self.fixture['id']}")
        self.assertEqual(status, 200, public)
        self.assertEqual(headers.get('Cache-Control'), 'no-store')
        self.assertEqual(public['title'], body['title'])
        self.assertEqual([b['body'] for b in public['blocks']], [b['body'] for b in body['blocks']])
        self.assertEqual([b['id'] for b in after['blocks'][:2]], [b['id'] for b in body['blocks'][:2]])
        self.assertEqual([p['kind'] for p in public['blocks'][0]['metadata']['paragraphs']], ['numbered', 'numbered'])
        self.assertEqual([p['kind'] for p in public['blocks'][2]['metadata']['paragraphs']], ['bullet', 'bullet'])
        self.assertEqual(public['blocks'][1]['metadata']['source_pdf_sha256'], 'fixture-origin')
        self.save(payload(before), 409)
        trimmed = payload(after)
        trimmed['blocks'] = trimmed['blocks'][1:]
        self.save(trimmed)
        self.assertEqual(len(self.detail()['blocks']), 2)

    def test_unchanged_emphasis_preserved(self):
        before = self.detail()
        body = payload(before)
        body['title'] += ' revisado'
        body['blocks'][0]['title'] = 'Novo título da seção'
        after = self.save(body)
        self.assertEqual(after['blocks'][0]['metadata'], before['blocks'][0]['metadata'])
        self.assertTrue(after['blocks'][0]['metadata']['paragraphs'][0]['runs'][0]['bold'])

    def test_invalid_edits_are_atomic(self):
        before = self.detail()
        bad = payload(before)
        for edit in [
            {'title': ''}, {'title': 'x' * 191}, {'blocks': []},
            {'blocks': [{'id': None, 'type': 'html', 'title': '', 'body': 'texto'}]},
            {'blocks': [{**bad['blocks'][0], 'body': ' '}]},
            {'blocks': [{**bad['blocks'][0], 'body': 'x' * 50001}]},
            {'blocks': [bad['blocks'][0], bad['blocks'][0]]},
            {'blocks': [{**bad['blocks'][0], 'id': 1}]},
        ]:
            self.save({**bad, **edit}, 422)
            self.assertEqual(self.detail(), before)

if __name__ == '__main__':
    unittest.main(verbosity=2)
