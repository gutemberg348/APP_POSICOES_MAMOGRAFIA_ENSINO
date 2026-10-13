"""Confere a grade responsiva e a abertura das fotos com um toque."""
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'test-results'
OUT.mkdir(exist_ok=True)
BASE = 'http://localhost/app_mamografia/preview'


def check_grid(page, columns):
    tiles = page.locator('[data-testid^="image-tile-"]')
    expect(tiles.first).to_be_visible()
    boxes = [tiles.nth(i).bounding_box() for i in range(columns + 1)]
    assert all(abs(box['width'] - box['height']) < 1 for box in boxes), boxes
    assert all(abs(box['y'] - boxes[0]['y']) < 1 for box in boxes[:columns]), boxes
    assert all(boxes[i]['x'] + boxes[i]['width'] < boxes[i + 1]['x'] for i in range(columns - 1)), boxes
    assert boxes[columns]['y'] >= boxes[0]['y'] + boxes[0]['height'], boxes
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')


with sync_playwright() as p:
    browser = p.chromium.launch()
    errors = []
    for width, columns in [(320, 3), (390, 3), (768, 4), (1000, 6), (1440, 6)]:
        page = browser.new_page(viewport={'width': width, 'height': 844}, has_touch=True)
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(f'{BASE}/topic?id=1', wait_until='networkidle')
        page.get_by_text('Imagens', exact=True).click()
        expect(page.get_by_text('8 mídias', exact=True)).to_be_visible()
        check_grid(page, columns)
        if width == 390:
            page.wait_for_function("Array.from(document.querySelectorAll('[data-testid^=image-tile-] img')).every(i => i.complete && i.naturalWidth > 0)")
            page.screenshot(path=str(OUT / 'gallery-topic-mobile.png'))
        photo = page.get_by_role('button', name='Abrir Craniocaudal (CC) · Imagem 1', exact=True)
        if width == 1440:
            photo.focus()
            photo.press('Enter')
        else:
            photo.tap()
        expect(page.get_by_role('button', name='Fechar mídia', exact=True)).to_be_visible()
        expect(page.get_by_text('1 / 8', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Salvar nos favoritos', exact=True)).to_be_visible()
        page.get_by_role('button', name='Ampliar imagem', exact=True).click()
        expect(page.get_by_text('150%', exact=True)).to_be_visible()
        page.get_by_role('button', name='Próxima', exact=True).click()
        expect(page.get_by_text('2 / 8', exact=True)).to_be_visible()
        page.get_by_role('button', name='Fechar mídia', exact=True).click()
        page.goto(f'{BASE}/media', wait_until='networkidle')
        page.get_by_role('tab', name='Imagens', exact=True).click()
        expect(page.get_by_text('62 mídias', exact=True)).to_be_visible()
        check_grid(page, columns)
        locked = page.locator('[data-testid^="image-tile-"]').filter(has_text='Premium').first
        expect(locked.locator('img')).to_have_count(0)
        locked.click()
        expect(page.get_by_text('DOMINANDO A MAMOGRAFIA PREMIUM', exact=True)).to_be_visible()
        expect(page.get_by_role('button', name='Fechar mídia', exact=True)).to_have_count(0)
        page.get_by_label('Fechar Premium', exact=True).click()
        page.close()
    assert not errors, errors
    browser.close()
print('OK: miniaturas quadradas, três colunas no celular, toque/teclado, zoom, navegação, favoritos e bloqueio Premium em cinco larguras.')
