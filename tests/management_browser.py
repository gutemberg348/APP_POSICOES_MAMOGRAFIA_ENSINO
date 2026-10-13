"""Fluxos reais e revisão visual do painel. Usa somente contas temporárias."""
from pathlib import Path
import subprocess, time
from playwright.sync_api import sync_playwright, expect
from api_tests import request

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
HELPER=ROOT/'scripts/management-test-fixtures.php'
email=f'management-browser-{time.time_ns()}@example.invalid'
admin_email=f'management-browser-admin-{time.time_ns()}@example.invalid'
subprocess.run(['php',str(HELPER),'admin',admin_email],check=True,capture_output=True)
subprocess.run(['php',str(HELPER),'login-window',admin_email],check=True,capture_output=True)
_,login,_=request('/admin/login','POST',{'email':admin_email,'password':'ManagementTest123!'})
token=login['token'];_,settings,_=request('/admin/settings',token=token)
client_created=False;errors=[];failed=[];events=[]
try:
    with sync_playwright() as p:
        browser=p.chromium.launch()
        panel=browser.new_page(viewport={'width':1440,'height':1100})
        panel.on('pageerror',lambda e:errors.append(str(e)))
        panel.on('response',lambda r:failed.append(f'{r.status} {r.url}') if r.status>=500 else None)
        panel.goto('http://localhost/app_mamografia/admin/',wait_until='networkidle')
        panel.get_by_label('E-mail',exact=True).fill(admin_email)
        panel.get_by_label('Senha',exact=True).fill('ManagementTest123!')
        panel.get_by_role('button',name='Entrar no painel',exact=True).click()
        expect(panel.get_by_role('heading',name='Visão geral',exact=True)).to_be_visible()
        expect(panel.get_by_role('heading',name='Movimento do site',exact=True)).to_be_visible()
        panel.screenshot(path=str(OUT/'management-dashboard-desktop.png'),full_page=True)
        for width in [320,390,768,1024,1440]:
            panel.set_viewport_size({'width':width,'height':900})
            assert panel.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Dashboard overflow {width}'
            if width==390:panel.screenshot(path=str(OUT/'management-dashboard-mobile.png'),full_page=True)
        panel.set_viewport_size({'width':1440,'height':1000})
        panel.get_by_role('button',name='Clientes',exact=True).first.click()
        panel.get_by_role('button',name='Cadastrar cliente',exact=True).click()
        panel.get_by_label('Nome completo',exact=True).fill('Teste gestão')
        panel.get_by_label('E-mail do cliente',exact=True).fill(email)
        panel.get_by_label('Nova senha',exact=True).fill('BrowserClient123!')
        panel.get_by_label('Confirmar nova senha',exact=True).fill('BrowserClient123!')
        panel.get_by_role('button',name='Criar conta do cliente',exact=True).click()
        expect(panel.get_by_text('Cliente cadastrado.',exact=True)).to_be_visible()
        client_created=True
        panel.get_by_label('Buscar clientes',exact=True).fill(email)
        panel.get_by_role('button',name='Ver cliente Teste gestão',exact=True).click()
        expect(panel.get_by_role('heading',name='Dados e acesso',exact=True)).to_be_visible()
        panel.get_by_label('Acesso gratuito',exact=True).check()
        panel.get_by_role('button',name='Salvar dados e acesso',exact=True).click()
        expect(panel.get_by_text('Dados e acesso do cliente atualizados.',exact=True)).to_be_visible()
        expect(panel.get_by_label('Premium liberado',exact=True)).to_be_checked()
        panel.screenshot(path=str(OUT/'management-client-detail-desktop.png'),full_page=True)
        for width in [320,390,768,1024,1440]:
            panel.set_viewport_size({'width':width,'height':900})
            assert panel.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Ficha overflow {width}'
            if width==390:panel.screenshot(path=str(OUT/'management-client-detail-mobile.png'),full_page=True)
        panel.set_viewport_size({'width':1440,'height':1000})
        panel.get_by_label('Nova senha',exact=True).fill('NewBrowserClient123!')
        panel.get_by_label('Confirmar nova senha',exact=True).fill('NewBrowserClient123!')
        panel.get_by_role('button',name='Salvar nova senha',exact=True).click()
        expect(panel.get_by_text('Senha redefinida. As sessões anteriores do cliente foram encerradas.',exact=True)).to_be_visible()
        assert request('/auth/login','POST',{'email':email,'password':'NewBrowserClient123!'})[0]==200
        panel.get_by_role('button',name='Voltar aos clientes',exact=True).click()
        expect(panel.get_by_role('button',name='Ver cliente Teste gestão',exact=True)).to_be_visible()
        panel.screenshot(path=str(OUT/'management-clients-desktop.png'),full_page=True)
        for width in [320,390,768,1024,1440]:
            panel.set_viewport_size({'width':width,'height':900})
            assert panel.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Clientes overflow {width}'
            if width==390:panel.screenshot(path=str(OUT/'management-clients-mobile.png'),full_page=True)
        panel.set_viewport_size({'width':1440,'height':1000})
        panel.get_by_role('button',name='Configurações',exact=True).first.click()
        expect(panel.get_by_label('Nome do aplicativo',exact=True)).to_be_visible()
        panel.screenshot(path=str(OUT/'management-settings-desktop.png'),full_page=True)
        for width in [320,390,768,1024,1440]:
            panel.set_viewport_size({'width':width,'height':900})
            assert panel.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Configurações overflow {width}: '+str(panel.evaluate('Array.from(document.querySelectorAll("body *")).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1)'))
            if width==390:panel.screenshot(path=str(OUT/'management-settings-mobile.png'),full_page=True)
        panel.set_viewport_size({'width':1440,'height':1000})
        panel.get_by_role('button',name='Salvar configurações',exact=True).click()
        expect(panel.get_by_text('Configurações do site salvas.',exact=True)).to_be_visible()
        panel.get_by_role('tab',name='Minha conta',exact=True).click()
        panel.get_by_label('Nova senha',exact=True).fill('NewBrowserAdmin123!')
        panel.get_by_label('Confirmar nova senha',exact=True).fill('NewBrowserAdmin123!')
        panel.get_by_role('button',name='Alterar minha senha',exact=True).click()
        expect(panel.get_by_text('Sua senha foi alterada. Outras sessões administrativas foram encerradas.',exact=True)).to_be_visible()
        assert request('/admin/login','POST',{'email':admin_email,'password':'NewBrowserAdmin123!'})[0]==200
        panel.screenshot(path=str(OUT/'management-account-desktop.png'),full_page=True)
        panel.get_by_role('button',name='Parcerias e anúncios',exact=True).first.click()
        expect(panel.get_by_role('heading',name='Parcerias & publicidade',exact=True)).to_be_visible()
        panel.get_by_role('tab',name='Campanhas',exact=True).click()
        panel.screenshot(path=str(OUT/'management-advertising-desktop.png'),full_page=True)
        # The static website must use settings from the panel and report actual navigations.
        _,current,_=request('/admin/login','POST',{'email':admin_email,'password':'NewBrowserAdmin123!'})
        test_settings={**settings,'footer_notice':'Aviso educacional temporário da revisão.','support_email':'suporte@example.invalid','privacy_url':'https://example.com/privacy','terms_url':'https://example.com/terms','analytics_enabled':'1'}
        assert request('/admin/settings','PUT',test_settings,current['token'])[0]==200
        site=browser.new_page(viewport={'width':390,'height':844})
        site.on('pageerror',lambda e:errors.append(str(e)))
        site.on('request',lambda r:events.append(r.post_data_json['event_id']) if '/analytics/visit' in r.url or 'route=%2Fanalytics%2Fvisit' in r.url else None)
        with site.expect_response(lambda r:'analytics' in r.url and r.request.method=='POST') as visit:
            site.goto('http://localhost/app_mamografia/preview/home',wait_until='networkidle')
        assert visit.value.json()['collected'] is True
        expect(site.get_by_text('Aviso educacional temporário da revisão.',exact=True)).to_be_visible()
        expect(site.get_by_role('link',name='Suporte',exact=True)).to_be_visible()
        expect(site.get_by_role('link',name='Privacidade',exact=True)).to_be_visible()
        expect(site.get_by_role('link',name='Termos de uso',exact=True)).to_be_visible()
        with site.expect_response(lambda r:'analytics' in r.url and r.request.method=='POST') as second_visit:
            site.get_by_role('button',name='Mídias',exact=True).click()
        assert second_visit.value.json()['collected'] is True
        assert len(events)==2,events
        assert not errors,errors
        assert not failed,failed
        browser.close()
finally:
    # The token from the setup was invalidated by the password change; use a fresh login.
    status,current,_=request('/admin/login','POST',{'email':admin_email,'password':'NewBrowserAdmin123!'})
    if status!=200:status,current,_=request('/admin/login','POST',{'email':admin_email,'password':'ManagementTest123!'})
    if status==200:request('/admin/settings','PUT',settings,current['token'])
    subprocess.run(['php',str(HELPER),'analytics',email,*events],check=True,capture_output=True)
    if client_created:subprocess.run(['php',str(HELPER),'cleanup',email],check=True,capture_output=True)
    subprocess.run(['php',str(HELPER),'cleanup',admin_email],check=True,capture_output=True)
print('OK: cadastro, busca, Premium, senha de cliente e administrador; anúncios; layouts 320/390/768/1024/1440 sem overflow ou erros JS.')
