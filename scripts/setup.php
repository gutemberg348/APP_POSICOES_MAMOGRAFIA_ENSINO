<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$root = dirname(__DIR__);
$configFile = $root . '/api/config/local.php';
if (!is_file($configFile)) {
    $config = require $root . '/api/config/example.php';
    $config['signing_key'] = bin2hex(random_bytes(32));
    file_put_contents($configFile, "<?php\nreturn " . var_export($config,true) . ";\n");
}
require $root . '/api/helpers/http.php';
require $root . '/api/config/database.php';
$config = appConfig();
$server = new PDO(preg_replace('/;dbname=[^;]+/','',$config['dsn']),$config['db_user'],$config['db_password'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$server->exec(file_get_contents($root . '/database/schema.sql'));
$pdo=database();
$pdo->exec(file_get_contents($root . '/database/advertising.sql'));
$pdo->exec(file_get_contents($root . '/database/management.sql'));
$pdo->exec(file_get_contents($root . '/database/payments.sql'));
$pdo->exec(file_get_contents($root . '/database/google-play.sql'));
$pdo->exec(file_get_contents($root . '/database/premium-trial.sql'));
$pdo->exec(file_get_contents($root . '/database/password-reset.sql'));
if (!query('SELECT id FROM users WHERE role="ADMIN" LIMIT 1')->fetch()) {
    $password = bin2hex(random_bytes(8));
    query('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,"ADMIN")',['Administrador','admin@mamografia.local',password_hash($password,PASSWORD_DEFAULT)]);
    file_put_contents($root . '/api/storage/acesso-local.txt',"Painel: http://localhost/app_mamografia/admin/\nEmail: admin@mamografia.local\nSenha: $password\n");
    echo "Administrador criado. Acesso salvo em api/storage/acesso-local.txt (não acessível pela web).\n";
}
$seed = json_decode(file_get_contents($root . '/database/materials.json'),true,512,JSON_THROW_ON_ERROR);
$pdo->beginTransaction();
foreach ($seed['categories'] as $c) query('INSERT IGNORE INTO categories(id,name,slug,description,icon,access_type,order_position) VALUES(?,?,?,?,?,?,?)',array_values($c));
foreach ($seed['topics'] as $t) {
    query('INSERT IGNORE INTO topics(id,category_id,title,slug,subtitle,access_type,order_position) VALUES(?,?,?,?,?,?,?)',[$t['id'],$t['category_id'],$t['title'],$t['slug'],$t['subtitle'],$t['access_type'],$t['id']]);
    query('INSERT IGNORE INTO contents(id,topic_id,source_pages) VALUES(?,?,?)',[$t['id'],$t['id'],$t['source_pages']]);
    if (!query('SELECT id FROM content_blocks WHERE content_id=? LIMIT 1',[$t['id']])->fetch()) foreach ($t['blocks'] as $i=>$b) query('INSERT INTO content_blocks(content_id,type,title,body,metadata,order_position) VALUES(?,?,?,?,?,?)',[$t['id'],$b['type'],$b['title'],$b['body'],isset($b['metadata'])?json_encode($b['metadata'],JSON_UNESCAPED_UNICODE):null,$i]);
}
foreach ($seed['media'] as $m) {
    query('INSERT IGNORE INTO media(topic_id,type,title,alt_text,file_path,original_name,thumbnail_path,mime_type,size,duration,width,height,order_position,access_type,source_key) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',[$m['topic_id'],$m['type'],$m['title'],$m['title'],$m['file_path'],$m['original_name'],$m['thumbnail_path'],$m['mime_type'],$m['size'],$m['duration'],$m['width'],$m['height'],$m['order_position'],$m['access_type'],$m['source_key']]);
    $id=query('SELECT id FROM media WHERE source_key=?',[$m['source_key']])->fetchColumn();
    query('INSERT IGNORE INTO content_media(content_id,media_id,order_position) VALUES(?,?,?)',[$m['topic_id'],$id,$m['order_position']]);
}
foreach ($seed['settings'] as $key=>$value) query('INSERT IGNORE INTO settings(`key`,value) VALUES(?,?)',[$key,$value]);
$pdo->commit();
echo 'Instalação concluída: ' . count($seed['media']) . " mídias importadas.\n";
