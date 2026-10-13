<?php
if (PHP_SAPI !== 'cli') exit;
require dirname(__DIR__) . '/api/helpers/http.php';
require dirname(__DIR__) . '/api/config/database.php';
$uid=(int)($argv[1]??0);
if (!query('SELECT id FROM users WHERE id=? AND name="Teste automatizado" AND email LIKE "integration-%@example.invalid"',[$uid])->fetch()) exit(1);
foreach(array_slice($argv,2) as $value) {
 $id=(int)$value;
 $row=query('SELECT * FROM media WHERE id=? AND source_key IS NULL AND original_name="integration-test.png" AND title LIKE "Teste de integração%"',[$id])->fetch();
 if (!$row) continue;
 query('DELETE FROM media WHERE id=?',[$id]);
 foreach(['file_path','thumbnail_path'] as $key) {
  $root=realpath(dirname(__DIR__).'/uploads');
  $file=realpath(dirname(__DIR__).'/'.$row[$key]);
  if ($file && str_starts_with($file,$root.DIRECTORY_SEPARATOR) && is_file($file)) unlink($file);
 }
}
query('DELETE FROM users WHERE id=?',[$uid]);
