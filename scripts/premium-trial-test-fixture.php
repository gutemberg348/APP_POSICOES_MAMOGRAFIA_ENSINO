<?php
// CLI only, restricted to explicitly named temporary test clients.
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
require dirname(__DIR__).'/api/helpers/http.php';
require dirname(__DIR__).'/api/config/database.php';
$email=$argv[2] ?? '';
if (!preg_match('/^management-trial-[a-z0-9-]+@example\.invalid$/D',$email)) exit(1);
$user=query("SELECT id,is_premium FROM users WHERE email=? AND name='Teste gestão' AND role='USER'",[$email])->fetch();
if (!$user) exit(1);
if (($argv[1] ?? '')==='expire') {
    query('UPDATE premium_trials SET ends_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE user_id=?',[$user['id']]);
} elseif (($argv[1] ?? '')==='shorten') {
    query('UPDATE premium_trials SET ends_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 SECOND) WHERE user_id=?',[$user['id']]);
} elseif (($argv[1] ?? '')==='inspect') {
    echo json_encode($user + (query('SELECT started_at,ends_at FROM premium_trials WHERE user_id=?',[$user['id']])->fetch() ?: []));
} else exit(1);
