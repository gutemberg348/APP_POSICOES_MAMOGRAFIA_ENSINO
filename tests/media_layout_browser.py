"""Verify public positioning order, layout, filters, gallery and Premium access."""
from pathlib import Path
import json
import urllib.request
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
API = 'http://localhost/app_mamografia/api/index.php?route='
def get(route):
    return json.load(urllib.request.urlopen(API+route))

topics = {x['id']: x for x in get('/topics')}
all_media = get('/media&limit=100')['data']
key = lambda m: (m['topic_id'] is None, topics.get(m['topic_id'], {}).get('order_position', 0), m['topic_id'] or 0, m['order_position'], m['id'])
assert list(map(key, all_media)) == sorted(map(key, all_media))
pages = [m for page in range(1, 12) for m in get('/media&limit=7&page='+str(page))['data']]
assert [m['id'] for m in pages] == [m['id'] for m in all_media]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto('http://localhost/app_mamografia/preview/media', wait_until='networkidle')
    groups = page.locator('[data-testid^="positioning-group-"]')
    expected = list(dict.fromkeys(m['topic_id'] for m in all_media))
    expect(groups).to_have_count(len(expected), timeout=20000)
    assert groups.evaluate_all('(nodes)=>nodes.map(n=>Number(n.dataset.testid.split("-").pop()))') == expected
    expect(page.get_by_role('heading', name='Craniocaudal (CC)', exact=True)).to_be_visible()
    images = page.get_by_test_id('positioning-images-1')
    videos = page.get_by_test_id('positioning-videos-1')
    expect(images.locator('[data-testid^="image-tile-"]')).to_have_count(8)
    for width in [320, 390, 600, 768, 1000, 1440]:
        page.set_viewport_size({'width': width, 'height': 844})
        grid_width = min(width-304, 1100) if width >= 1000 else width-40
        columns = 3 if width < 600 else 4 if width < 1000 else 6
        tile_width = int((grid_width-(columns-1)*16)/columns)
        expect(images.locator('[data-testid^="image-tile-"]').first).to_have_css('width', str(tile_width)+'px')
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), width
        positions = page.evaluate('''() => {
            const images = document.querySelector('[data-testid="positioning-images-1"]').getBoundingClientRect();
            const videos = document.querySelector('[data-testid="positioning-videos-1"]').getBoundingClientRect();
            return {imageBottom: images.bottom, videoTop: videos.top};
        }''')
        assert positions['videoTop'] >= positions['imageBottom'], (width, positions)
        if width < 600:
            rect = videos.get_by_role('button', name='Abrir Craniocaudal (CC) · Vídeo', exact=True).bounding_box()
            # Two pixels belong to the containing card's borders.
            assert abs(rect['width']-(width-42)) < 1, (width, rect)
    page.set_viewport_size({'width': 390, 'height': 844})
    page.get_by_role('heading', name='Craniocaudal (CC)', exact=True).scroll_into_view_if_needed()
    page.wait_for_function('Array.from(document.querySelectorAll("[data-testid=positioning-images-1] img")).every(e=>e.complete && e.naturalWidth>0)')
    page.screenshot(path=str(ROOT/'test-results/midias-por-posicionamento-mobile.png'))
    page.get_by_role('button', name='Abrir Craniocaudal (CC) · Imagem 1', exact=True).click()
    expect(page.get_by_text('1 / 8', exact=True)).to_be_visible()
    page.get_by_role('button', name='Fechar mídia', exact=True).click()
    page.get_by_role('button', name='Abrir Perfil Médio-Lateral (ML) · Imagem 1', exact=True).click()
    expect(page.get_by_text('DOMINANDO A MAMOGRAFIA PREMIUM', exact=True)).to_be_visible()
    page.get_by_label('Fechar Premium', exact=True).click()
    page.get_by_role('tab', name='Vídeos', exact=True).click()
    expect(page.get_by_text('15 mídias', exact=True)).to_be_visible()
    expect(groups).to_have_count(0)
    page.get_by_role('tab', name='Todas as mídias', exact=True).click()
    expect(groups).to_have_count(len(expected))
    page.get_by_role('button', name='Incidências de Rotina', exact=True).click()
    expect(groups).to_have_count(2)
    page.get_by_label('Buscar mídias', exact=True).fill('Craniocaudal')
    expect(groups).to_have_count(1)
    assert groups.first.get_attribute('data-testid') == 'positioning-group-1'
    assert not errors, errors
    browser.close()
print('OK: posicionamentos em ordem, paginação consistente, grupos separados, vídeo largo, imagens carregadas, filtros, galeria, Premium e seis larguras sem overflow ou erro JavaScript.')
