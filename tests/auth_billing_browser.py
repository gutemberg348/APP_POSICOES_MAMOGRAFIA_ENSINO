"""Real auth flow; checkout response is intercepted so no external charge is created."""
import json
from pathlib import Path
import secrets
import subprocess
from playwright.sync_api import sync_playwright, expect
from api_tests import request

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT/'test-results'
OUT.mkdir(exist_ok=True)
identity = {'name': 'Teste entrada', 'email': f'gate-{secrets.token_hex(8)}@example.test', 'password': secrets.token_hex(10)}
user_id = None
errors = []
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width':390, 'height':844})
        # Even if an old server setting allows ads for Premium, the app hides them.
        page.route('**/api/index.php?route=%2Fadvertising', lambda route: route.fulfill(json={
            'settings': {'partners_enabled':True, 'google_enabled':False, 'adsense_enabled':False,
                         'hide_for_premium':False, 'google_placements':[], 'contact_email':''},
            'partners':[], 'banners':[{'id':99999,'partner_id':99999,'partner_name':'Parceiro de teste',
                'title':'Anúncio de teste Premium','description':'','image_url':None,'logo_url':None,
                'url':'https://example.test','cta':'Saiba mais','placements':['HOME']}]}))
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto('http://localhost/app_mamografia/preview/home', wait_until='networkidle')
        expect(page.get_by_role('button', name='Orientações', exact=True)).to_be_visible()
        expect(page.get_by_label('Fechar convite de cadastro', exact=True)).to_have_count(0)
        for label in ['Orientações', 'Incidências Adicionais', 'Estudar com vídeos', 'Revisar imagens', 'Conhecer parceiros', 'Mídias', 'Favoritos', 'Parceiros', 'Perfil', 'Abrir perfil', 'Começar gratuitamente']:
            page.get_by_role('button', name=label, exact=True).click()
            expect(page.get_by_role('button', name='Criar minha conta gratuita', exact=True)).to_be_visible()
            assert page.url.endswith('/home')
            page.get_by_label('Fechar convite de cadastro', exact=True).click()
            expect(page.get_by_label('Fechar convite de cadastro', exact=True)).to_have_count(0)
        page.screenshot(path=str(OUT/'home-visitante.png'), full_page=True)
        page.get_by_role('button', name='Mídias', exact=True).click()
        page.get_by_role('button', name='Criar minha conta gratuita', exact=True).click()
        expect(page.get_by_text('Seu próximo passo começa aqui', exact=True)).to_be_visible()
        expect(page.get_by_text('Biblioteca de mídias', exact=True)).to_have_count(0)
        page.wait_for_timeout(350)  # Let the invitation modal finish fading out.
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width, 'height':900})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'Auth overflow {width}'
        page.set_viewport_size({'width':390, 'height':844})
        page.screenshot(path=str(OUT/'cadastro-renovado.png'), full_page=True)
        page.get_by_placeholder('Como podemos chamar você?').fill(identity['name'])
        page.get_by_label('E-mail', exact=True).fill(identity['email'])
        page.get_by_label('Senha', exact=True).fill(identity['password'])
        page.get_by_role('button', name='Criar conta gratuita', exact=True).click()
        expect(page.get_by_role('button', name='Mídias', exact=True)).to_be_visible(timeout=15000)
        assert page.url.endswith('/home'), page.url
        token = page.evaluate("sessionStorage.getItem('mamografia_token')")
        code, user, _ = request('/profile', token=token)
        assert code == 200
        user_id = user['id']
        expect(page.get_by_text('Anúncio de teste Premium', exact=True)).to_have_count(1)
        expect(page.get_by_label('Fechar Premium', exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='Quero ser Premium', exact=True)).to_be_visible()
        page.get_by_role('button', name='Quero ser Premium', exact=True).click()
        expect(page.get_by_text('Seu aprendizado, sem anúncios', exact=True)).to_be_visible()
        expect(page.get_by_text('Compra do Premium em preparação.', exact=False)).to_be_visible()
        page.wait_for_timeout(350)  # Wait for the modal fade before capturing it.
        page.screenshot(path=str(OUT/'premium-sem-anuncios.png'), full_page=True)
        page.get_by_label('Fechar Premium', exact=True).click()
        page.get_by_role('button', name='Incidências Adicionais', exact=True).click()
        expect(page.get_by_label('Fechar Premium', exact=True)).to_be_visible()
        assert page.url.endswith('/home'), 'Locked module should open the offer before navigating'
        page.get_by_label('Fechar Premium', exact=True).click()
        expect(page.get_by_label('Fechar Premium', exact=True)).to_have_count(0)
        page.screenshot(path=str(OUT/'home-premium-fixo.png'), full_page=True)
        page.reload(wait_until='networkidle')
        expect(page.get_by_label('Fechar Premium', exact=True)).to_have_count(0)
        expect(page.get_by_role('button', name='Mídias', exact=True)).to_be_visible()
        page.get_by_role('button', name='Mídias', exact=True).click()
        expect(page.get_by_text('77 mídias', exact=True)).to_be_visible(timeout=15000)
        page.get_by_role('button', name='Perfil', exact=True).click()
        page.get_by_role('button', name='Conhecer Premium', exact=True).click()
        expect(page.get_by_text('Compra do Premium em preparação.', exact=False)).to_be_visible()
        page.get_by_label('Fechar Premium', exact=True).click()
        captured = []
        def billing(route):
            url = route.request.url
            if '%2Fbilling%2Foffer' in url:
                route.fulfill(json={'enabled':True,'amount_cents':12990,'test_mode':False,'purchase_type':'ONE_TIME'})
            elif '%2Fbilling%2Fcheckout' in url:
                captured.append(route.request.post_data)
                route.fulfill(json={'id':999,'status':'PENDING','checkout_url':'https://asaas.com/checkoutSession/show?id=test'})
            elif '%2Fbilling%2Fstatus' in url:
                route.fulfill(json={'user':{**user,'is_premium':1,'premium_permanent':True,'trial_active':False},'payment':{'id':999,'status':'PAID','checkout_url':None}})
            else:
                route.continue_()
        page.route('**/api/index.php?route=*', billing)
        page.route('https://asaas.com/**', lambda route: route.fulfill(body='Checkout de teste'))
        page.get_by_role('button', name='Conhecer Premium', exact=True).click()
        expect(page.get_by_text('R$ 129,90', exact=True)).to_be_visible()
        with page.expect_popup() as popup:
            page.get_by_role('button', name='Comprar Premium', exact=True).click()
        popup.value.close()
        assert captured == [None], captured
        page.get_by_role('button', name='Já paguei, verificar', exact=True).click()
        expect(page.get_by_text('Premium liberado! Bons estudos.', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Quero ser Premium', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Início', exact=True).click()
        expect(page.get_by_text('Anúncio de teste Premium', exact=True)).to_have_count(0)
        page.get_by_role('button', name='Perfil', exact=True).click()
        page.unroute('**/api/index.php?route=*', billing)
        page.get_by_role('button', name='Sair da conta', exact=True).click()
        expect(page.get_by_role('button', name='Começar gratuitamente', exact=True)).to_be_visible()
        page.get_by_role('button', name='Perfil', exact=True).click()
        page.get_by_role('button', name='Já tenho uma conta', exact=True).click()
        expect(page.get_by_role('button', name='Esqueci minha senha', exact=True)).to_be_visible()
        page.wait_for_timeout(350)
        page.screenshot(path=str(OUT/'login-renovado.png'), full_page=True)
        page.get_by_label('E-mail', exact=True).fill(identity['email'])
        page.get_by_label('Senha', exact=True).fill(identity['password'])
        page.get_by_role('button', name='Entrar', exact=True).click()
        expect(page.get_by_role('button', name='Mídias', exact=True)).to_be_visible()
        # Simulate temporary profile outage: preserve token and show retry.
        def outage(route):
            if '%2Fprofile' in route.request.url: route.fulfill(status=503,json={'error':'Servidor de teste indisponível.'})
            else: route.continue_()
        page.route('**/api/index.php?route=*', outage)
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('button', name='Tentar novamente', exact=True)).to_be_visible()
        assert page.evaluate("!!sessionStorage.getItem('mamografia_token')")
        page.unroute('**/api/index.php?route=*', outage)
        page.get_by_role('button', name='Tentar novamente', exact=True).click()
        expect(page.get_by_role('button', name='Mídias', exact=True)).to_be_visible()
        page.evaluate("sessionStorage.setItem('mamografia_token','expired-test')")
        page.reload(wait_until='networkidle')
        expect(page.get_by_role('button', name='Começar gratuitamente', exact=True)).to_be_visible()
        expect(page.get_by_label('Fechar convite de cadastro', exact=True)).to_have_count(0)
        assert not errors, errors
        browser.close()
finally:
    if user_id:
        # A fixture tool removes only this temporary user, with its tokens/logs.
        subprocess.run(['C:/xampp/php/php.exe',str(ROOT/'scripts/billing-test-fixtures.php'),'cleanup-user',str(user_id)], check=True, capture_output=True)
print('PASS: home pública, convite nos atalhos, cadastro/login, restauração, saída, sessão inválida, falha/retry, compra e confirmação simuladas; 320/390/768/1440 sem overflow.')
