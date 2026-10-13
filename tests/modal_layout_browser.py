"""Checks dialog centering, bounded scrolling and profile alignment on the web export."""
import secrets
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from api_tests import request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
status, account, _ = request('/auth/register', 'POST', {
    'name': 'Teste entrada', 'email': f'gate-{secrets.token_hex(8)}@example.test', 'password': secrets.token_hex(12),
})
assert status == 200, status

def check_card(page, width, height):
    box = page.get_by_test_id('centered-modal-card').bounding_box()
    assert box, 'Dialog must have a visible card'
    assert box['y'] >= 15, box
    assert box['y'] + box['height'] <= height - 15, box
    assert abs(box['y'] + box['height'] / 2 - height / 2) <= 2, box
    assert abs(box['x'] + box['width'] / 2 - width / 2) <= 2, box
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')

try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 390, 'height': 844})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto('http://localhost/app_mamografia/preview/home', wait_until='networkidle')
        page.get_by_role('button', name='Começar gratuitamente', exact=True).click()
        page.wait_for_timeout(400)
        for width, height in [(390,844), (320,568), (768,1024), (1440,900), (640,360)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.wait_for_timeout(150)
            check_card(page, width, height)
            page.get_by_role('button', name='Já tenho uma conta', exact=True).scroll_into_view_if_needed()
            expect(page.get_by_role('button', name='Fechar convite de cadastro', exact=True)).to_be_in_viewport()
        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUT/'convite-centralizado.png'))
        page.get_by_role('button', name='Fechar convite de cadastro', exact=True).click()
        page.evaluate('(token) => sessionStorage.setItem("mamografia_token",token)', account['token'])
        page.reload(wait_until='networkidle')
        page.get_by_role('button', name='Perfil', exact=True).click()
        expect(page.get_by_text('Teste entrada', exact=True)).to_be_visible()
        badge = page.get_by_text('Gratuito', exact=True).locator('..').bounding_box()
        assert abs(badge['x'] + badge['width']/2 - 195) <= 2, badge
        buttons = [page.get_by_role('button',name=name,exact=True).bounding_box()
                   for name in ['Explorar biblioteca','Conhecer Premium','Sair da conta']]
        assert all(abs(b['x'] + b['width']/2 - 195) <= 2 for b in buttons), buttons
        assert max(b['width'] for b in buttons) - min(b['width'] for b in buttons) <= 2
        page.wait_for_timeout(300)
        page.screenshot(path=str(OUT/'perfil-centralizado.png'))
        page.get_by_role('button', name='Conhecer Premium', exact=True).click()
        page.wait_for_timeout(400)
        for width, height in [(390,844), (320,568), (768,1024), (1440,900), (640,360)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.wait_for_timeout(150)
            check_card(page, width, height)
            close = page.get_by_role('button', name='Fechar Premium', exact=True)
            before = close.bounding_box()
            end = page.get_by_role('button', name='Continuar explorando', exact=True)
            end.scroll_into_view_if_needed()
            expect(end).to_be_in_viewport()
            expect(close).to_be_in_viewport()
            assert abs(close.bounding_box()['y'] - before['y']) <= 2, 'Close must stay fixed while scrolling'
        page.set_viewport_size({'width':390,'height':844})
        page.get_by_text('Seu aprendizado, sem anúncios',exact=True).scroll_into_view_if_needed()
        page.wait_for_timeout(150)
        page.screenshot(path=str(OUT/'premium-margens.png'))
        page.get_by_role('button', name='Continuar explorando',exact=True).click()
        expect(page.get_by_role('button', name='Fechar Premium',exact=True)).to_have_count(0)
        assert not errors, errors
        browser.close()
finally:
    subprocess.run(['C:/xampp/php/php.exe', str(ROOT/'scripts/billing-test-fixtures.php'),
                    'cleanup-user', str(account['user']['id'])], check=True, capture_output=True)
print('PASS: centered dialogs, screen margins, scrollable footer, fixed close and aligned profile; 5 viewport sizes.')
