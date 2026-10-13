"""Empacota apenas os arquivos publicáveis desta atualização, sem credenciais."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'api/storage/atualizacao-painel.zip'
files = []
for directory in ['api', 'admin/dist', 'preview']:
    for path in (ROOT / directory).rglob('*'):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative.startswith('api/storage/') or relative == 'api/config/local.php':
            continue
        if directory == 'api' and path.suffix != '.php' and path.name != '.htaccess':
            continue
        files.append(path)
files.extend(ROOT / path for path in ['admin/index.php', 'database/management.sql', 'database/manual-correction.sql', 'docs/painel-gestao.md', 'docs/atualizacao-textos-pdf.md', 'docs/conferencia-textos-pdf.md', 'docs/textos-painel.md'])
assert (ROOT / 'admin/dist/index.html').is_file() and (ROOT / 'preview/index.html').is_file()
with ZipFile(OUTPUT, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path, path.relative_to(ROOT).as_posix())
with ZipFile(OUTPUT) as archive:
    names = archive.namelist()
    assert 'api/config/local.php' not in names
    assert not any(name.startswith('api/storage/') or name.startswith('uploads/') for name in names)
    assert archive.testzip() is None
print(f'Pacote validado: {OUTPUT} ({OUTPUT.stat().st_size / 1048576:.1f} MB; {len(files)} arquivos).')
