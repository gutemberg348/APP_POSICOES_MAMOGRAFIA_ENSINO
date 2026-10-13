"""Price edited in admin, persisted and consumed by billing; restores original settings."""
import json
from pathlib import Path
import subprocess
import time
from playwright.sync_api import sync_playwright, expect
from api_tests import request

ROOT=Path(__file__).resolve().parent.parent
PHP='C:/xampp/php/php.exe'
HELPER=ROOT/'scripts/management-test-fixtures.php'
PRICE=ROOT/'scripts/premium-price-test-fixture.php'
def fixture(action,*args):
    return subprocess.run([PHP,str(HELPER),action,*args],check=True,capture_output=True)
def snapshot():
    return json.loads(subprocess.run([PHP,str(PRICE),'snapshot'],check=True,capture_output=True).stdout)
original=snapshot()
stamp=str(time.time_ns())
admin_email=f'management-admin-{stamp}@example.invalid'
user_email=f'management-{stamp}@example.invalid'
admin=None
created_user=False
settings=None
errors=[]
try:
    fixture('admin',admin_email)
    fixture('login-window',admin_email)
    status,data,_=request('/admin/login','POST',{'email':admin_email,'password':'ManagementTest123!'})
    assert status==200,data
    admin=data['token']
    status,settings,_=request('/admin/settings',token=admin)
    assert status==200
    assert settings['premium_purchase_type']=='ONE_TIME'
    assert 'api_key' not in settings and 'webhook_token' not in settings
    status,user,_=request('/admin/users','POST',{'name':'Teste gestão','email':user_email,'password':'PriceTest123!','is_premium':0},admin)
    assert status==201,user
    created_user=True
    status,login,_=request('/auth/login','POST',{'email':user_email,'password':'PriceTest123!'})
    assert status==200,login
    for token,expected in [('',401),(login['token'],403)]:
        assert request('/admin/settings','PUT',{**settings,'premium_price_cents':'1'},token)[0]==expected
    for invalid in ['-1','99','100000001','12.50',125.5,True,{},'1e4']:
        status,data,_=request('/admin/settings','PUT',{**settings,'premium_price_cents':invalid},admin)
        assert status==422,(invalid,status,data)
    assert request('/admin/settings','PUT',{**settings,'premium_purchase_type':'MONTHLY'},admin)[0]==422
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        panel=browser.new_page(viewport={'width':390,'height':844})
        panel.on('pageerror',lambda e:errors.append(str(e)))
        panel.goto('http://localhost/app_mamografia/admin/',wait_until='networkidle')
        panel.evaluate('(token)=>sessionStorage.setItem("mamografia_admin_token",token)',admin)
        panel.reload(wait_until='networkidle')
        panel.get_by_role('button',name='Configurações',exact=True).first.click()
        expect(panel.get_by_role('heading',name='Plano Premium',exact=True)).to_be_visible()
        price=panel.get_by_label('Preço do Premium (R$)',exact=True)
        price.fill('123,45')
        panel.get_by_role('button',name='Salvar configurações',exact=True).click()
        expect(panel.get_by_text('Configurações do site salvas.',exact=True)).to_be_visible()
        assert request('/admin/settings',token=admin)[1]['premium_price_cents']=='12345'
        assert snapshot()['effective']==12345
        panel.reload(wait_until='networkidle')
        panel.get_by_role('button',name='Configurações',exact=True).first.click()
        expect(panel.get_by_label('Preço do Premium (R$)',exact=True)).to_have_value('123,45')
        for width in [320,390,768,1440]:
            panel.set_viewport_size({'width':width,'height':900})
            assert panel.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Overflow {width}'
        panel.set_viewport_size({'width':390,'height':844})
        panel.screenshot(path=str(ROOT/'test-results/admin-preco-premium.png'),full_page=True)
        # Old panel submissions that omit the new fields must preserve the saved price.
        old={k:v for k,v in settings.items() if k not in ['premium_price_cents','premium_purchase_type']}
        assert request('/admin/settings','PUT',old,admin)[0]==200
        assert snapshot()['effective']==12345
        panel.get_by_label('Preço do Premium (R$)',exact=True).fill('0')
        panel.get_by_role('button',name='Salvar configurações',exact=True).click()
        expect(panel.get_by_label('Preço do Premium (R$)',exact=True)).to_have_value('0,00')
        assert request('/billing/offer',token=login['token'])[1]['enabled'] is False
        assert not errors,errors
        browser.close()
finally:
    if admin and settings: request('/admin/settings','PUT',settings,admin)
    subprocess.run([PHP,str(PRICE),'restore'],input=json.dumps(original).encode(),check=True,capture_output=True)
    if created_user: fixture('cleanup',user_email)
    if admin: fixture('cleanup',admin_email)
print('PASS: preço editável/persistido, pagamento único, permissões/validação, checkout lê preço salvo, zero desativa, painel antigo preserva preço; 320/390/768/1440 sem overflow.')
