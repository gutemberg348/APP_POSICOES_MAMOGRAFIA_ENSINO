<?php
// Agende via cron da hospedagem. Nunca crie um endpoint público para este comando.
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
$root=dirname(__DIR__);
require $root.'/api/helpers/http.php';
require $root.'/api/config/database.php';
require $root.'/api/services/google-play.php';
require $root.'/api/controllers/management.php';
$config=playConfig();
if (!playEnabled($config)) { fwrite(STDERR,"Configure Google Play antes de sincronizar.\n"); exit(1); }
$provider=new GooglePlayProvider($config); $ok=0; $failed=0;
// Pendentes e compras pagas mais antigas primeiro; no máximo 100 por execução.
$rows=query("SELECT * FROM google_play_purchases WHERE status IN ('PENDING','PAID') AND package_name=? AND product_id=? AND (is_test=0 OR ?=1) AND verified_at<DATE_SUB(NOW(),INTERVAL 15 MINUTE) ORDER BY verified_at,id LIMIT 100",
    [$config['package_name'],$config['product_id'],$config['allow_test_purchases']===true?1:0])->fetchAll();
foreach ($rows as $row) {
    try { playVerifyPurchase((int)$row['user_id'],$row['purchase_token'],$config,$provider); $ok++; }
    catch (Throwable $e) { $failed++; error_log('[Mamografia Google Play sync] purchase_id='.(int)$row['id'].' code='.$e->getMessage()); }
}
echo "Compras verificadas: $ok; pendentes de nova tentativa: $failed.\n";
exit($failed?1:0);
