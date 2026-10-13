"""Real admin/signup/access tests plus browser trial expiry. Fixtures/settings restored."""
import subprocess
import time
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from api_tests import request

ROOT = Path(__file__).resolve().parent.parent
PHP = 'C:/xampp/php/php.exe'
stamp = str(time.time_ns())
admin_email = f'management-admin-trial-{stamp}@example.invalid'
email = f'management-trial-{stamp}@example.invalid'
disabled_email = f'management-trial-disabled-{stamp}@example.invalid'
panel_email = f'management-trial-panel-{stamp}@example.invalid'
admin = ''
original = None
clients = []

def fixture(action, target):
    return subprocess.run([PHP, str(ROOT/'scripts/management-test-fixtures.php'), action, target], check=True, capture_output=True)

def trial_fixture(action, target=email):
    return subprocess.run([PHP, str(ROOT/'scripts/premium-trial-test-fixture.php'), action, target], check=True, capture_output=True).stdout

def signed_status(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, method='HEAD'), timeout=20) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code

try:
    fixture('admin', admin_email)
    fixture('login-window', admin_email)
    code, login, _ = request('/admin/login', 'POST', {'email':admin_email, 'password':'ManagementTest123!'})
    assert code == 200, login
    admin = login['token']
    _, original, _ = request('/admin/settings', token=admin)
    assert request('/admin/settings','PUT',{**original,'premium_trial_days':'7'})[0] == 401
    for invalid in ['-1', '366', '1.5', '01', True, {}, 7.5]:
        assert request('/admin/settings','PUT',{**original,'premium_trial_days':invalid}, admin)[0] == 422, invalid
    assert request('/admin/settings','PUT',{**original,'premium_trial_days':'7'}, admin)[0] == 200
    _, signup, _ = request('/auth/register','POST',{'name':'Teste gestão','email':email,'password':'TrialTest123!'})
    clients.append(email)
    token = signup['token']
    user = signup['user']
    assert user['is_premium'] == 0 and not user['trial_active'] and user['trial_available']
    assert user['trial_started_at'] is None and user['trial_ends_at'] is None
    assert request('/contents/3',token=token)[0] == 403, 'Registration automatically granted Premium'
    assert request('/premium/trial/start','POST')[0] == 401
    assert request('/premium/trial/start','POST',token=admin)[0] == 409
    with ThreadPoolExecutor(max_workers=2) as pool:
        attempts=list(pool.map(lambda _:request('/premium/trial/start','POST',{'days':365,'user_id':0},token),range(2)))
    assert all(result[0]==200 for result in attempts), [(r[0],r[1].get('error')) for r in attempts]
    user=attempts[0][1]
    assert user['is_premium']==1 and user['trial_active'] and not user['trial_available'] and not user['premium_permanent']
    assert attempts[1][1]['trial_ends_at']==user['trial_ends_at'], 'Concurrent start renewed trial'
    duration=datetime.fromisoformat(user['trial_ends_at'])-datetime.fromisoformat(user['trial_started_at'])
    assert duration.days==7, 'Client changed trial duration'
    assert json.loads(trial_fixture('inspect'))['is_premium'] == 0, 'Trial changed manual entitlement'
    assert request('/admin/settings','PUT',{**original,'premium_trial_days':'8'},token)[0] == 403
    assert request('/contents/3',token=token)[0] == 200
    _, media, _ = request('/media?access=PREMIUM&type=IMAGE&limit=1',token=token)
    item = media['data'][0]
    assert not item['locked'] and item['url']
    signed_url = item['url']
    assert signed_status(signed_url) == 200
    assert request('/admin/settings','PUT',{**original,'premium_trial_days':'14'},admin)[0] == 200
    _, logged, _ = request('/auth/login','POST',{'email':email,'password':'TrialTest123!'})
    assert logged['user']['trial_ends_at'] == user['trial_ends_at'], 'Login/admin edit restarted trial'
    legacy = {k:v for k,v in original.items() if k != 'premium_trial_days'}
    assert request('/admin/settings','PUT',legacy,admin)[0] == 200
    assert request('/admin/settings',token=admin)[1]['premium_trial_days'] == '14'
    assert request('/admin/settings','PUT',{**original,'premium_trial_days':'0'},admin)[0] == 200
    assert request('/profile',token=token)[1]['trial_active'], 'Disabling new trials canceled an ongoing trial'
    assert request('/premium/trial/start','POST',token=token)[1]['trial_ends_at']==user['trial_ends_at']
    _, disabled, _ = request('/auth/register','POST',{'name':'Teste gestão','email':disabled_email,'password':'TrialTest123!'})
    clients.append(disabled_email)
    assert not disabled['user']['is_premium'] and disabled['user']['trial_ends_at'] is None
    assert not disabled['user']['trial_available']
    assert request('/premium/trial/start','POST',token=disabled['token'])[0]==409
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        page=browser.new_page(viewport={'width':390,'height':844})
        errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto('http://localhost/app_mamografia/admin/',wait_until='networkidle')
        page.evaluate('(token)=>sessionStorage.setItem("mamografia_admin_token",token)',admin)
        page.reload(wait_until='networkidle')
        page.get_by_role('button',name='Configurações',exact=True).first.click()
        days=page.get_by_label('Período de teste (dias)',exact=True)
        days.fill('9')
        page.get_by_role('button',name='Salvar configurações',exact=True).click()
        expect(page.get_by_text('Configurações do site salvas.',exact=True)).to_be_visible()
        assert request('/admin/settings',token=admin)[1]['premium_trial_days'] == '9'
        page.reload(wait_until='networkidle')
        page.get_by_role('button',name='Configurações',exact=True).first.click()
        expect(page.get_by_label('Período de teste (dias)',exact=True)).to_have_value('9')
        for width in [320,390,768,1440]:
            page.set_viewport_size({'width':width,'height':900})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'), width
        app=browser.new_page(viewport={'width':390,'height':844})
        app.on('pageerror',lambda e:errors.append(str(e)))
        app.goto('http://localhost/app_mamografia/preview/profile',wait_until='networkidle')
        app.evaluate('(token)=>sessionStorage.setItem("mamografia_token",token)',disabled['token'])
        app.reload(wait_until='networkidle')
        expect(app.get_by_role('button',name='Iniciar teste',exact=True)).to_be_visible()
        expect(app.get_by_text('Experimente o Premium grátis por 9 dias.',exact=False)).to_be_visible()
        app.get_by_role('button',name='Iniciar teste',exact=True).click()
        expect(app.get_by_text('Premium em teste até',exact=False)).to_be_visible()
        expect(app.get_by_role('button',name='Iniciar teste',exact=True)).to_have_count(0)
        assert request('/profile',token=disabled['token'])[1]['trial_active']
        trial_fixture('shorten',disabled_email)
        app.reload(wait_until='networkidle')
        expect(app.get_by_text('Seu período de teste terminou.',exact=False)).to_be_visible(timeout=15000)
        assert request('/profile',token=disabled['token'])[1]['is_premium'] == 0
        assert request('/premium/trial/start','POST',token=disabled['token'])[0] == 409, 'Expired trial restarted'
        trial_fixture('expire')
        assert request('/contents/3',token=token)[0] == 403
        assert signed_status(signed_url) == 403, 'Previously issued link survived expired trial'
        assert request('/contents/1',token=token)[0] == 200
        assert request('/auth/login','POST',{'email':email,'password':'TrialTest123!'})[1]['user']['is_premium'] == 0
        # A client created in the admin is also inactive until clicking the button.
        code, panel_client, _ = request('/admin/users','POST',{'name':'Teste gestão','email':panel_email,'password':'TrialTest123!','is_premium':0},admin)
        assert code==201
        clients.append(panel_email)
        assert panel_client['trial_ends_at'] is None
        _, panel_login, _ = request('/auth/login','POST',{'email':panel_email,'password':'TrialTest123!'})
        assert not panel_login['user']['is_premium'] and panel_login['user']['trial_available']
        app.evaluate('(token)=>sessionStorage.setItem("mamografia_token",token)',panel_login['token'])
        app.reload(wait_until='networkidle')
        app.get_by_role('button',name='Conhecer Premium',exact=True).click()
        dialog=app.get_by_role('dialog')
        expect(dialog.get_by_role('button',name='Iniciar teste',exact=True)).to_be_visible()
        dialog.get_by_role('button',name='Iniciar teste',exact=True).click()
        expect(dialog).to_have_count(0)
        expect(app.get_by_text('Premium em teste até',exact=False)).to_be_visible()
        assert request('/profile',token=panel_login['token'])[1]['trial_active']
        assert not errors, errors
        browser.close()
    print('PASS: signup/admin creation without activation, explicit start, concurrency, server duration, permissions, zero, profile/modal buttons, fixed deadline, expiry/texts/signed files and no renewal; settings restored.')
finally:
    if original is not None and admin:
        assert request('/admin/settings','PUT',original,admin)[0] == 200, 'Settings restore failed'
    for target in clients:
        fixture('cleanup',target)
    if admin:
        fixture('cleanup',admin_email)
