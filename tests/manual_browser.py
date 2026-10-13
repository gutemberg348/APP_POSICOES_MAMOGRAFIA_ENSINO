"""Confere os textos realmente renderizados, navegação e troca com rede lenta."""
from pathlib import Path
import json,time,urllib.parse
from playwright.sync_api import sync_playwright,expect
from api_tests import request

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'test-results';OUT.mkdir(exist_ok=True)
credentials=dict(line.split(': ',1) for line in (ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8').splitlines() if ': ' in line)
status,login,_=request('/admin/login','POST',{'email':credentials['Email'],'password':credentials['Senha']})
assert status==200,login
token=login['token']
_,topics,_=request('/topics');errors=[]
normal=lambda text:' '.join(text.replace('•','').split())
def check_items(page, block, count):
    items=page.locator(f'[data-testid^="manual-item-{block["id"]}-"]')
    expect(items).to_have_count(count)
    boxes=[items.nth(i).bounding_box() for i in range(count)]
    assert all(boxes[i]['y']+boxes[i]['height']<=boxes[i+1]['y'] for i in range(count-1))
    assert normal(page.get_by_test_id(f"manual-body-{block['id']}").inner_text())==normal(block['body'])
try:
    with sync_playwright() as p:
        browser=p.chromium.launch()
        page=browser.new_page(viewport={'width':390,'height':844})
        page.add_init_script('sessionStorage.setItem("mamografia_token",'+json.dumps(token)+')')
        page.on('pageerror',lambda error:errors.append(str(error)))
        for topic in topics:
            _,expected,_=request(f"/contents/{topic['id']}",token=token)
            page.goto(f"http://localhost/app_mamografia/preview/topic?id={topic['id']}",wait_until='networkidle')
            expect(page.get_by_test_id(f"manual-content-{topic['id']}")).to_be_visible()
            expect(page.get_by_text(topic['title'],exact=True).first).to_be_visible()
            for block in expected['blocks']:
                actual=page.get_by_test_id(f"manual-body-{block['id']}").inner_text()
                assert normal(actual)==normal(block['body']),(topic['title'],block['title'])
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),topic['title']
            if topic['id'] in [3,13,24,27]:
                page.screenshot(path=str(OUT/f"manual-topic-{topic['id']}-mobile.png"),full_page=True)
        page.goto('http://localhost/app_mamografia/preview/home',wait_until='networkidle')
        expect(page.locator('html')).to_have_attribute('lang','pt-BR')
        expect(page.locator('html')).to_have_attribute('translate','no')
        expect(page.locator('meta[name="google"]')).to_have_attribute('content','notranslate')
        expect(page.get_by_text('Início',exact=True)).to_be_visible()
        page.get_by_text('Incidências de Rotina',exact=True).click()
        page.get_by_text('Craniocaudal (CC)',exact=True).click()
        expect(page.get_by_test_id('manual-content-1')).to_be_visible()
        _,cc,_=request('/contents/1',token=token)
        for kind,count in [('numbered_list',9),('quality_criteria',6),('common_errors',5)]:
            block=next(b for b in cc['blocks'] if b['type']==kind)
            check_items(page,block,count)
            page.get_by_test_id(f"manual-body-{block['id']}").screenshot(path=str(OUT/f'manual-cc-{kind}.png'))
        expect(page.get_by_text('Erros comuns',exact=True)).to_be_visible()
        expect(page.get_by_text('Fonte:',exact=False)).to_have_count(0)
        # The same layout must work before the hosting API has rich metadata.
        legacy=json.loads(json.dumps(cc))
        for block in legacy['blocks']:
            block['metadata']=None
            if block['type'] in ['numbered_list','quality_criteria','common_errors']:
                block['body']=normal(block['body'])
        def legacy_content(route):
            parsed=urllib.parse.parse_qs(urllib.parse.urlsplit(route.request.url).query)
            if parsed.get('route')==['/contents/1']:
                route.fulfill(status=200,content_type='application/json',body=json.dumps(legacy))
            else:route.continue_()
        page.route('**/api/index.php*',legacy_content)
        page.reload(wait_until='networkidle')
        expect(page.get_by_test_id('manual-content-1')).to_be_visible()
        for kind,count in [('numbered_list',9),('quality_criteria',6),('common_errors',5)]:
            check_items(page,next(b for b in legacy['blocks'] if b['type']==kind),count)
        page.unroute('**/api/index.php*',legacy_content)
        page.goto('http://localhost/app_mamografia/preview/home',wait_until='networkidle')
        page.get_by_text('Incidências de Rotina',exact=True).click()
        page.get_by_text('Craniocaudal (CC)',exact=True).click()
        expect(page.get_by_test_id('manual-content-1')).to_be_visible()
        page.get_by_label('Voltar',exact=True).click()
        expect(page.get_by_text('Médio-Lateral Oblíqua (MLO)',exact=True)).to_be_visible()
        def delay_second(route):
            parsed=urllib.parse.parse_qs(urllib.parse.urlsplit(route.request.url).query)
            if parsed.get('route')==['/contents/2']:time.sleep(.7)
            route.continue_()
        page.route('**/api/index.php*',delay_second)
        page.get_by_text('Médio-Lateral Oblíqua (MLO)',exact=True).click()
        expect(page.get_by_test_id('manual-content-1')).not_to_be_visible()
        expect(page.get_by_test_id('manual-content-2')).to_be_visible()
        _,expected,_=request('/contents/2',token=token)
        for block in expected['blocks']:
            assert normal(page.get_by_test_id(f"manual-body-{block['id']}").inner_text())==normal(block['body'])
        page.go_back()
        expect(page.get_by_text('Craniocaudal (CC)',exact=True)).to_be_visible()
        page.get_by_text('Craniocaudal (CC)',exact=True).click()
        expect(page.get_by_test_id('manual-content-1')).to_be_visible()
        page.set_viewport_size({'width':1440,'height':1000})
        page.goto('http://localhost/app_mamografia/preview/topic?id=13',wait_until='networkidle')
        expect(page.get_by_text('Rotação Medial',exact=True)).to_be_visible()
        expect(page.get_by_text('Rotação Lateral',exact=True)).to_be_visible()
        page.screenshot(path=str(OUT/'manual-rotation-desktop.png'),full_page=True)
        assert not errors,errors
        browser.close()
finally:request('/auth/logout','POST',token=token)
print('OK: 28 tópicos fiéis; etapas e critérios separados inclusive sem metadata; Início/Erros comuns corretos, fonte removida e tradução desativada. Navegação, rede lenta e duas rotações sem erros JS ou overflow.')
