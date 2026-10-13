"""Recovery journey: simulated delivery only, real reset endpoint and login/session checks."""
import json
import secrets
import subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from api_tests import request

ROOT=Path(__file__).resolve().parent.parent
email=f'gate-{secrets.token_hex(8)}@example.test'
password=secrets.token_hex(10)
status,user,_=request('/auth/register','POST',{'name':'Teste entrada','email':email,'password':password})
assert status==200,user
uid=user['user']['id']
try:
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':390,'height':844})
        failures=[]
        page.on('pageerror',lambda error: failures.append(str(error)))
        page.goto('http://localhost/app_mamografia/preview/home',wait_until='networkidle')
        page.get_by_role('button',name='Perfil',exact=True).click()
        page.get_by_role('button',name='Já tenho uma conta',exact=True).click()
        page.get_by_role('button',name='Esqueci minha senha',exact=True).click()
        page.get_by_label('E-mail',exact=True).fill(email)
        def delivery(route):
            result=subprocess.run(['C:/xampp/php/php.exe',str(ROOT/'tests/password_reset_tests.php'),'issue',email],check=True,capture_output=True,text=True)
            delivery.code=json.loads(result.stdout)['code']
            route.fulfill(json={'message':'Se este e-mail estiver cadastrado, você receberá um código válido por 15 minutos. Confira também a caixa de spam.'})
        page.route('**/api/index.php?route=%2Fauth%2Fforgot-password',delivery)
        page.get_by_role('button',name='Enviar código',exact=True).click()
        expect(page.get_by_label('Código recebido',exact=True)).to_be_visible()
        page.get_by_label('Código recebido',exact=True).fill('00000000')
        page.get_by_label('Nova senha',exact=True).fill('NovaSenha123!')
        page.get_by_label('Confirmar nova senha',exact=True).fill('OutraSenha123!')
        page.get_by_role('button',name='Salvar nova senha',exact=True).click()
        expect(page.get_by_text('As senhas precisam ser iguais.',exact=True)).to_be_visible()
        page.get_by_label('Confirmar nova senha',exact=True).fill('NovaSenha123!')
        page.get_by_role('button',name='Salvar nova senha',exact=True).click()
        expect(page.get_by_text('Código inválido ou expirado.',exact=False)).to_be_visible()
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
        page.set_viewport_size({'width':390,'height':844})
        page.get_by_label('Código recebido',exact=True).fill(delivery.code)
        page.get_by_role('button',name='Salvar nova senha',exact=True).click()
        expect(page.get_by_text('Senha atualizada! Entre com sua nova senha.',exact=True)).to_be_visible()
        assert request('/profile',token=user['token'])[0]==401,'Old token must be revoked'
        assert request('/auth/login','POST',{'email':email,'password':password})[0]==401
        assert request('/auth/reset-password','POST',{'email':email,'code':delivery.code,'password':'Replay123!'})[0]==422
        page.get_by_label('Senha',exact=True).fill('NovaSenha123!')
        page.get_by_role('button',name='Entrar',exact=True).click()
        expect(page.get_by_role('button',name='Quero ser Premium',exact=True)).to_be_visible()
        assert not failures,failures
        browser.close()
finally:
    subprocess.run(['C:/xampp/php/php.exe',str(ROOT/'scripts/billing-test-fixtures.php'),'cleanup-user',str(uid)],check=True,capture_output=True)
print('PASS: recovery UI, confirmation mismatch, invalid code, real password reset, session revocation, code replay and login with new password; no email sent.')
