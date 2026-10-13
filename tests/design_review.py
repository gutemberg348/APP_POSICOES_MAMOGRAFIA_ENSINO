"""Capturas e revisão responsiva sem alterar dados de conteúdo."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
credentials={line.split(': ',1)[0]:line.split(': ',1)[1] for line in (ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8').splitlines() if ': ' in line}
with sync_playwright() as p:
    browser=p.chromium.launch()
    errors=[]
    app=browser.new_page(viewport={'width':1440,'height':1000})
    app.on('pageerror',lambda e:errors.append(str(e)))
    app.goto('http://localhost/app_mamografia/preview/media',wait_until='networkidle')
    expect(app.get_by_text('77 mídias',exact=True)).to_be_visible()
    app.evaluate('document.fonts.ready')
    assert app.evaluate('document.fonts.check("16px Manrope800") && document.fonts.check("16px DMSans400")'),'Fontes ausentes no app'
    app.wait_for_function("Array.from(document.querySelectorAll('img')).filter(e=>e.src.includes('mode=thumb')).slice(0,4).every(e=>e.complete&&e.naturalWidth>0)")
    app.screenshot(path=str(OUT/'design-after-desktop.png'))
    app.get_by_role('button',name='Perfil',exact=True).click()
    app.get_by_label('Senha',exact=True).fill('design-check')
    app.get_by_role('button',name='Mostrar senha',exact=True).click()
    assert app.get_by_label('Senha',exact=True).evaluate('(input)=>input.type')=='text'
    app.get_by_role('button',name='Ocultar senha',exact=True).click()
    expect(app.get_by_label('Senha',exact=True)).to_have_attribute('type','password')
    app.get_by_label('Senha',exact=True).fill('')
    app.screenshot(path=str(OUT/'design-after-profile.png'))
    app.get_by_role('button',name='Mídias',exact=True).click()
    for width in [320,390,768,1024,1440]:
        app.set_viewport_size({'width':width,'height':844 if width<800 else 1000})
        assert app.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'App overflow em {width}px'
        if width==320:app.screenshot(path=str(OUT/'design-after-mobile-small.png'))
        if width==390:
            app.wait_for_function("Array.from(document.querySelectorAll('img')).filter(e=>e.src.includes('mode=thumb')).slice(0,3).every(e=>e.complete&&e.naturalWidth>0)")
            app.screenshot(path=str(OUT/'design-after-mobile.png'))
            app.get_by_role('button',name='Ver imagem: Craniocaudal (CC) · Imagem 1',exact=True).scroll_into_view_if_needed()
            app.screenshot(path=str(OUT/'design-after-mobile-cards.png'))
    app.set_viewport_size({'width':390,'height':844})
    app.get_by_role('tab',name='Vídeos',exact=True).click()
    app.get_by_text('15 mídias',exact=True).wait_for()
    app.get_by_role('button',name='Abrir Perfil Médio-Lateral (ML) · Vídeo',exact=True).click()
    app.get_by_text('DOMINANDO A MAMOGRAFIA PREMIUM',exact=True).wait_for()
    app.wait_for_timeout(400) # Aguarda a transição visual do modal antes da captura.
    app.screenshot(path=str(OUT/'design-after-premium.png'))
    app.get_by_label('Fechar Premium',exact=True).click()
    admin=browser.new_page(viewport={'width':1440,'height':1000})
    admin.on('pageerror',lambda e:errors.append(str(e)))
    failed=[]
    admin.on('response',lambda r:failed.append(r.url) if r.status>=400 and '.ttf' in r.url else None)
    admin.goto('http://localhost/app_mamografia/admin/',wait_until='networkidle')
    admin.screenshot(path=str(OUT/'design-after-login.png'))
    admin.get_by_label('E-mail',exact=True).fill(credentials['Email'])
    admin.get_by_label('Senha',exact=True).fill(credentials['Senha'])
    admin.get_by_role('button',name='Entrar no painel').click()
    admin.get_by_role('button',name='Biblioteca de mídias',exact=True).click()
    expect(admin.get_by_role('heading',name='Biblioteca de mídias',exact=True)).to_be_visible()
    admin.wait_for_function("Array.from(document.querySelectorAll('.card-image img')).slice(0,4).every(e=>e.complete&&e.naturalWidth>0)")
    admin.evaluate('document.fonts.ready')
    assert admin.evaluate('document.fonts.check("800 16px Manrope")'),'Manrope ausente no painel'
    admin.screenshot(path=str(OUT/'design-after-admin.png'))
    admin.get_by_role('button',name='Adicionar mídia',exact=True).click()
    admin.screenshot(path=str(OUT/'design-after-editor.png'))
    admin.get_by_label('Fechar editor',exact=True).click()
    for width in [320,390,768,1024,1440]:
        admin.set_viewport_size({'width':width,'height':844 if width<800 else 1000})
        assert admin.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'Painel overflow em {width}px: '+str(admin.evaluate('Array.from(document.querySelectorAll("body *")).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth)'))
        if width==390:admin.screenshot(path=str(OUT/'design-after-admin-mobile.png'))
    assert not failed,failed
    assert not errors,errors
    browser.close()
print('OK: revisão visual de app/painel em 320, 390, 768, 1024 e 1440 px; fontes locais; mostrar/ocultar senha; capturas sem erros JavaScript.')
