<?php
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__).'/api/helpers/http.php';
require dirname(__DIR__).'/api/config/database.php';
$uid=(int)($argv[1]??0);
foreach(array_slice($argv,2) as $value) {
    $id=(int)$value;
    $partner=query('SELECT * FROM partners WHERE id=? AND name LIKE "Teste publicidade%"',[$id])->fetch();
    if(!$partner)continue;
    $files=query('SELECT image_path FROM banners WHERE partner_id=?',[$id])->fetchAll(PDO::FETCH_COLUMN);
    $files[]=$partner['logo_path'];
    query('DELETE FROM banners WHERE partner_id=?',[$id]);
    query('DELETE FROM partners WHERE id=?',[$id]);
    $root=realpath(dirname(__DIR__).'/uploads/promotions');
    foreach($files as $path){
        if(!$path||!$root)continue;
        $absolute=realpath(dirname(__DIR__).'/'.$path);
        if($absolute&&str_starts_with($absolute,$root.DIRECTORY_SEPARATOR)&&is_file($absolute))unlink($absolute);
    }
}
if($uid)query('DELETE FROM users WHERE id=? AND name="Teste publicidade" AND email LIKE "adreview-%@example.invalid"',[$uid]);
echo "Fixtures de publicidade removidas.\n";
