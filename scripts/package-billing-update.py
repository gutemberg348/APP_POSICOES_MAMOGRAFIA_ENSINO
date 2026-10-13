"""Deployment package: only payment migration, app/API and setup docs; no secrets/manual SQL."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT/'api/storage/atualizacao-login-asaas.zip'
files = []
for folder in ['api', 'preview']:
    for path in (ROOT/folder).rglob('*'):
        if not path.is_file(): continue
        name = path.relative_to(ROOT).as_posix()
        if name.startswith('api/storage/') or name == 'api/config/local.php': continue
        if folder == 'api' and path.suffix != '.php' and path.name != '.htaccess': continue
        files.append(path)
files.extend(ROOT/name for name in ['database/payments.sql', 'docs/asaas.md'])
with ZipFile(OUTPUT, 'w', ZIP_DEFLATED) as archive:
    for path in sorted(files): archive.write(path, path.relative_to(ROOT).as_posix())
with ZipFile(OUTPUT) as archive:
    names = archive.namelist()
    assert 'api/controllers/billing.php' in names and 'database/payments.sql' in names
    assert not any(name.startswith(('api/storage/', 'uploads/', 'mobile/')) or name.endswith('local.php') for name in names)
    assert [name for name in names if name.endswith('.sql')] == ['database/payments.sql']
    assert archive.testzip() is None
print(f'Pacote validado: {OUTPUT} ({OUTPUT.stat().st_size / 1048576:.1f} MB; {len(files)} arquivos).')
