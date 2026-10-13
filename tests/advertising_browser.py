"""Cadastro real pelo painel e exibição no app; remove os registros de teste no final."""
from pathlib import Path
import json, subprocess, time
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright, expect
from advertising_tests import admin_login, request

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
token=admin_login();_,original,_=request('/admin/advertising',token=token)
ids=[];errors=[];ad_requests=[]
name=f'Teste publicidade Studio {time.time_ns()}'
campaign='Conexões para o seu próximo passo'
credentials=dict(line.split(': ',1) for line in (ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8').splitlines() if ': ' in line)
asset=OUT/'promotion-test-banner.png'
art=Image.new('RGB',(1200,480),'#e6f0eb');draw=ImageDraw.Draw(art)
draw.ellipse((820,-150,1390,420),outline='#c3d9cc',width=3);draw.ellipse((900,-70,1310,340),outline='#c3d9cc',width=3)
font=ImageFont.truetype(str(ROOT/'mobile/assets/fonts/Manrope-800.ttf'),55)
small=ImageFont.truetype(str(ROOT/'mobile/assets/fonts/DMSans-500.ttf'),23)
draw.text((65,65),'CAMPANHA DE TESTE',font=small,fill='#547461');draw.text((60,140),'Boas conexões.',font=font,fill='#284b3b');draw.text((60,208),'Novas possibilidades.',font=font,fill='#284b3b');draw.text((65,370),'Prévia de uma parceria cadastrada no painel',font=small,fill='#547461');art.save(asset)
try:
    request('/admin/advertising','PUT',{**original,'partners_enabled':True,'hide_for_premium':True,'contact_email':'parcerias@example.invalid','google_enabled':True,'test_mode':True,'adsense_enabled':True,'adsense_client':'ca-pub-1111111111111111','adsense_slot':'1111111111'},token)
    with sync_playwright() as p:
        browser=p.chromium.launch()
        admin=browser.new_page(viewport={'width':1440,'height':1000})
        admin.on('pageerror',lambda e:errors.append(str(e)))
        admin.goto('http://localhost/app_mamografia/admin/',wait_until='networkidle')
        admin.get_by_label('E-mail',exact=True).fill(credentials['Email']);admin.get_by_label('Senha',exact=True).fill(credentials['Senha']);admin.get_by_role('button',name='Entrar no painel').click()
        admin.get_by_role('button',name='Parcerias e anúncios',exact=True).first.click()
        expect(admin.get_by_role('heading',name='Parcerias & publicidade')).to_be_visible()
        admin.screenshot(path=str(OUT/'partnerships-admin-empty.png'))
        admin.get_by_role('button',name='Novo parceiro',exact=True).click()
        dialog=admin.get_by_role('dialog',name='Cadastro de parceiro')
        dialog.get_by_label('Nome do parceiro',exact=True).fill(name)
        dialog.get_by_label('Apresentação',exact=True).fill('Marca temporária para conferir o cadastro, o banner e a experiência de parceria.')
        dialog.get_by_label('Site do parceiro',exact=True).fill('https://example.com')
        dialog.get_by_label('Logo do parceiro',exact=True).set_input_files(asset)
        dialog.get_by_role('button',name='Salvar parceiro',exact=True).click()
        expect(dialog).not_to_be_visible()
        _,partners,_=request('/admin/partners',token=token);partner=next(item for item in partners if item['name']==name);ids.append(partner['id'])
        admin.get_by_role('tab',name='Campanhas',exact=True).click()
        admin.get_by_role('button',name='Nova campanha',exact=True).click()
        editor=admin.get_by_role('dialog',name='Cadastro de campanha')
        editor.get_by_label('Parceiro',exact=True).select_option(str(partner['id']))
        editor.get_by_label('Título da campanha',exact=True).fill(campaign)
        editor.get_by_label('Descrição',exact=True).fill('Conheça a apresentação de uma marca neste espaço de parceria comercial.')
        editor.get_by_label('Link de destino',exact=True).fill('https://example.com/campanha')
        editor.get_by_label('Texto do botão',exact=True).fill('Conhecer a marca')
        editor.get_by_label('Imagem da campanha',exact=True).set_input_files(asset)
        for place in ['Início','Final do conteúdo','Área de parceiros']:editor.get_by_label(place,exact=True).check()
        editor.get_by_label('Status',exact=True).select_option('1')
        admin.screenshot(path=str(OUT/'partnerships-campaign-editor.png'))
        for width in [320,390,768,1024,1440]:
            admin.set_viewport_size({'width':width,'height':900})
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Editor excede {width}px'
        editor.get_by_role('button',name='Salvar campanha',exact=True).click();expect(editor).not_to_be_visible()
        expect(admin.get_by_role('heading',name=campaign,exact=True)).to_be_visible()
        admin.screenshot(path=str(OUT/'partnerships-admin-campaigns.png'))
        admin.get_by_role('tab',name='Google Ads & ajustes',exact=True).click()
        expect(admin.get_by_label('Ativar banners AdMob',exact=False)).to_be_checked()
        admin.get_by_role('button',name='Salvar configurações',exact=True).click()
        expect(admin.get_by_text('Configurações de publicidade salvas.',exact=True)).to_be_visible()
        admin.screenshot(path=str(OUT/'partnerships-settings.png'))
        for width in [320,390,768,1024,1440]:
            admin.set_viewport_size({'width':width,'height':900})
            assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Ajustes excedem {width}px'
            if width==390:admin.screenshot(path=str(OUT/'partnerships-admin-mobile.png'))
        app=browser.new_page(viewport={'width':1440,'height':1000})
        app.on('pageerror',lambda e:errors.append(str(e)))
        app.on('request',lambda r:ad_requests.append(r.url) if 'googlesyndication.com' in r.url or 'doubleclick.net' in r.url else None)
        app.goto('http://localhost/app_mamografia/preview/',wait_until='networkidle')
        expect(app.get_by_text('Por onde vamos começar?',exact=True)).to_be_visible()
        app.screenshot(path=str(OUT/'app-home-refined-desktop.png'))
        expect(app.get_by_text(campaign,exact=True)).to_be_attached()
        for width in [320,390,768,1024,1440]:
            app.set_viewport_size({'width':width,'height':844 if width<800 else 1000})
            app.wait_for_timeout(150) # useWindowDimensions aplica a nova largura no próximo render.
            assert app.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Home excede {width}px'
            if width==390:app.screenshot(path=str(OUT/'app-home-refined-mobile.png'))
        app.get_by_role('button',name='Parceiros',exact=True).click()
        expect(app.get_by_text(campaign,exact=True)).to_be_visible()
        expect(app.get_by_role('link',name=f'Conhecer a marca — {name}',exact=True)).to_be_visible()
        app.get_by_text(campaign,exact=True).scroll_into_view_if_needed();app.screenshot(path=str(OUT/'app-partners-campaign.png'))
        expect(app.get_by_role('button',name='Seja parceiro',exact=True)).to_be_attached()
        for width in [320,390,768,1024,1440]:
            app.set_viewport_size({'width':width,'height':844 if width<800 else 1000})
            app.wait_for_timeout(150)
            assert app.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Parceiros excedem {width}px'
            if width==390:
                app.get_by_text(campaign,exact=True).scroll_into_view_if_needed();app.screenshot(path=str(OUT/'app-partners-mobile-campaign.png'))
        app.get_by_role('button',name='Mídias',exact=True).click()
        expect(app.get_by_text(campaign,exact=True)).to_be_attached()
        app.set_viewport_size({'width':390,'height':844})
        app.get_by_role('link',name=f'Conhecer a marca — {name}',exact=True).scroll_into_view_if_needed()
        app.screenshot(path=str(OUT/'app-library-ad-placement.png'))
        assert not ad_requests,ad_requests
        # Pausar no painel deve retirar o anúncio na próxima consulta do app.
        admin.get_by_role('tab',name='Campanhas',exact=True).click()
        admin.get_by_role('switch',name=f'Pausar campanha {campaign}',exact=True).click()
        expect(admin.get_by_role('switch',name=f'Ativar campanha {campaign}',exact=True)).to_be_visible()
        app.reload(wait_until='networkidle');expect(app.get_by_text('77 mídias',exact=True)).to_be_visible();expect(app.get_by_text(campaign,exact=True)).to_have_count(0)
        assert not errors,errors
        browser.close()
finally:
    request('/admin/advertising','PUT',original,token)
    # Localiza também um cadastro criado antes de uma eventual falha no teste.
    _,partners,_=request('/admin/partners',token=token)
    ids=list(set(ids+[item['id'] for item in partners if item['name']==name]))
    subprocess.run(['php',str(ROOT/'scripts/cleanup-advertising-tests.php'),'0',*map(str,ids)],check=True,capture_output=True)
    request('/auth/logout','POST',token=token)
print('OK: cadastro de parceiro e campanha pelo painel, upload, prévia, exibição no app, pausa, configurações Google, cinco larguras e zero requisições de anúncios no localhost. Fixtures removidas.')
