"""Pacote limitado à correção dos conteúdos e à versão web correspondente."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED

ROOT=Path(__file__).resolve().parent.parent
OUTPUT=ROOT/'api/storage/atualizacao-conteudos-pdf.zip'
files=[ROOT/path for path in ['api/controllers/library.php','database/manual-correction.sql','docs/conferencia-textos-pdf.md','docs/atualizacao-textos-pdf.md']]
files.extend(path for path in (ROOT/'preview').rglob('*') if path.is_file())
with ZipFile(OUTPUT,'w',ZIP_DEFLATED) as archive:
    for path in sorted(files):archive.write(path,path.relative_to(ROOT).as_posix())
with ZipFile(OUTPUT) as archive:
    assert archive.testzip() is None
    assert not any('local.php' in name or name.startswith('api/storage/') for name in archive.namelist())
print(f'Pacote de textos validado: {OUTPUT} ({OUTPUT.stat().st_size/1048576:.1f} MB; {len(files)} arquivos).')
