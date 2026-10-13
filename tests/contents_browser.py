"""Edit temporary manual text through the panel and verify the published app."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from contents_tests import fixture

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT/'test-results'
OUT.mkdir(exist_ok=True)
credentials = dict(line.split(': ', 1) for line in (ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8').splitlines() if ': ' in line)
entry = fixture('create')
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        admin = browser.new_page(viewport={'width': 1440, 'height': 1000})
        errors = []
        admin.on('pageerror', lambda error: errors.append(str(error)))
        admin.goto('http://localhost/app_mamografia/admin/', wait_until='networkidle')
        admin.get_by_label('E-mail', exact=True).fill(credentials['Email'])
        admin.get_by_label('Senha', exact=True).fill(credentials['Senha'])
        admin.get_by_role('button', name='Entrar no painel').click()
        admin.locator('.sidebar').get_by_role('button', name='Conteúdos do manual', exact=True).click()
        expect(admin.get_by_role('heading', name='Conteúdos do manual', exact=True)).to_be_visible()
        admin.get_by_label('Buscar conteúdo', exact=True).fill(entry['title'])
        expect(admin.get_by_text('1 conteúdos', exact=True)).to_be_visible()
        admin.get_by_role('button', name='Editar '+entry['title'], exact=True).click()
        expect(admin.get_by_role('heading', name='Editar conteúdo', exact=True)).to_be_visible()
        admin.get_by_label('Título do conteúdo', exact=True).fill('Manual revisado de teste')
        admin.get_by_label('Texto da seção 1', exact=True).fill('Texto salvo pelo painel com acentuação.\n\nSegundo parágrafo revisado.')
        admin.get_by_label('Texto da seção 2', exact=True).fill('1. Etapa editada pelo painel.\n2. Próxima etapa revisada.')
        admin.get_by_role('button', name='Adicionar seção', exact=True).click()
        admin.get_by_label('Tipo da seção 3', exact=True).select_option('quality_criteria')
        admin.get_by_label('Título da seção 3', exact=True).fill('Critérios revisados')
        admin.get_by_label('Texto da seção 3', exact=True).fill('Critério novo um\nCritério novo dois')
        for width in [320, 390, 768, 1440]:
            admin.set_viewport_size({'width': width, 'height': 900})
            assert admin.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), f'Editor overflow {width}'
        admin.set_viewport_size({'width': 390, 'height': 844})
        admin.screenshot(path=str(OUT/'painel-textos-editor-mobile.png'), full_page=True)
        admin.get_by_role('button', name='Salvar conteúdo', exact=True).click()
        expect(admin.get_by_role('heading', name='Conteúdos do manual', exact=True)).to_be_visible()
        admin.get_by_label('Buscar conteúdo', exact=True).fill('Manual revisado de teste')
        admin.get_by_role('button', name='Editar Manual revisado de teste', exact=True).click()
        expect(admin.get_by_label('Texto da seção 1', exact=True)).to_have_value('Texto salvo pelo painel com acentuação.\n\nSegundo parágrafo revisado.')
        expect(admin.get_by_label('Texto da seção 3', exact=True)).to_have_value('Critério novo um\nCritério novo dois')
        admin.get_by_role('button', name='Voltar aos conteúdos', exact=True).click()
        admin.get_by_label('Buscar conteúdo', exact=True).fill('')
        admin.screenshot(path=str(OUT/'painel-textos-lista-mobile.png'), full_page=True)
        app = browser.new_page(viewport={'width': 390, 'height': 844})
        app.on('pageerror', lambda error: errors.append(str(error)))
        app.goto(f"http://localhost/app_mamografia/preview/topic?id={entry['id']}", wait_until='networkidle')
        expect(app.get_by_text('Manual revisado de teste', exact=True)).to_be_visible(timeout=20000)
        expect(app.get_by_text('Texto salvo pelo painel com acentuação.', exact=True)).to_be_visible()
        expect(app.get_by_text('Segundo parágrafo revisado.', exact=True)).to_be_visible()
        expect(app.get_by_text('Etapa editada pelo painel.', exact=True)).to_be_visible()
        expect(app.get_by_text('Critério novo dois', exact=True)).to_be_visible()
        assert app.locator('[data-testid^="manual-item-"]').count() == 6
        app.screenshot(path=str(OUT/'app-textos-atualizados-mobile.png'), full_page=True)
        assert not errors, errors
        browser.close()
finally:
    fixture('cleanup', entry['id'])
print('OK: edição e persistência de títulos, textos, etapas e critérios pelo painel; publicação no app; larguras 320/390/768/1440 sem overflow ou erro JavaScript.')
