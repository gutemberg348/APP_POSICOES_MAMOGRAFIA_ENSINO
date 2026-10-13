<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__.'/../api/helpers/http.php';
require __DIR__.'/../api/config/database.php';
$payload=json_decode(file_get_contents(__DIR__.'/../database/manual-correction.json'),true,512,JSON_THROW_ON_ERROR);
$pdo=database();$ids=array_column($payload['topics'],'id');
if (count($ids)!==28 || $ids!==range(1,28)) throw new RuntimeException('Mapa de tópicos inesperado.');
$topics=query('SELECT * FROM topics WHERE id BETWEEN 1 AND 28 ORDER BY id')->fetchAll();
$contents=query('SELECT * FROM contents WHERE id BETWEEN 1 AND 28 ORDER BY id')->fetchAll();
if (count($topics)!==28 || count($contents)!==28) throw new RuntimeException('Instale os tópicos originais antes da correção.');
$backup=['topics'=>$topics,'contents'=>$contents,'blocks'=>query('SELECT * FROM content_blocks WHERE content_id BETWEEN 1 AND 28 ORDER BY content_id,order_position,id')->fetchAll(),'footer_notice'=>query("SELECT value FROM settings WHERE `key`='footer_notice'")->fetchColumn()];
$file=__DIR__.'/../api/storage/manual-backup-'.date('Ymd-His').'-'.bin2hex(random_bytes(3)).'.json';
if (file_put_contents($file,json_encode($backup,JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT),LOCK_EX)===false) throw new RuntimeException('Não foi possível guardar o backup.');
$pdo->beginTransaction();
try {
    foreach ($payload['topics'] as $t) {
        $id=(int)$t['id'];
        query('UPDATE topics SET title=?,category_id=?,access_type=? WHERE id=?',[$t['title'],$t['category_id'],$t['access_type'],$id]);
        query('UPDATE contents SET topic_id=?,source_pages=? WHERE id=?',[$id,$t['source_pages'],$id]);
        query('DELETE FROM content_blocks WHERE content_id=?',[$id]);
        foreach ($t['blocks'] as $order=>$b) query('INSERT INTO content_blocks(content_id,type,title,body,metadata,order_position) VALUES(?,?,?,?,?,?)',[$id,$b['type'],$b['title'],$b['body'],json_encode($b['metadata'],JSON_UNESCAPED_UNICODE),$order]);
    }
    query("INSERT INTO settings(`key`,value) VALUES('footer_notice',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",[$payload['footer_notice']]);
    $pdo->commit();
} catch (Throwable $e) { $pdo->rollBack();throw $e; }
echo "28 conteúdos corrigidos a partir do PDF. Backup privado: ".basename($file)."\n";
