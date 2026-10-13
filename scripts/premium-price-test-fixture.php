<?php
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
require dirname(__DIR__).'/api/helpers/http.php';
require dirname(__DIR__).'/api/config/database.php';
require dirname(__DIR__).'/api/services/asaas.php';
if (($argv[1] ?? '')==='snapshot') {
    $value=query("SELECT value FROM settings WHERE `key`='premium_price_cents'")->fetchColumn();
    echo json_encode(['saved'=>$value===false?null:$value,'effective'=>billingConfig()['price_cents']]); exit;
}
if (($argv[1] ?? '')==='restore') {
    $data=json_decode(stream_get_contents(STDIN),true);
    if (!is_array($data) || !array_key_exists('saved',$data)
        || ($data['saved']!==null && (!is_string($data['saved']) || !preg_match('/^[0-9]{1,9}$/D',$data['saved'])))) exit(1);
    if ($data['saved']===null) query("DELETE FROM settings WHERE `key`='premium_price_cents'");
    else query("INSERT INTO settings(`key`,value) VALUES('premium_price_cents',?) ON DUPLICATE KEY UPDATE value=VALUES(value)",[$data['saved']]);
    exit;
}
exit(1);
