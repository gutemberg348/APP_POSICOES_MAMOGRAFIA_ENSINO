<?php
// Local CLI only; can modify only the explicitly named test fixtures.
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__.'/../api/helpers/http.php';
require __DIR__.'/../api/config/database.php';
$email=$argv[2] ?? '';
if (!preg_match('/^management-[a-z0-9-]+@example\.invalid$/D',$email)) exit(1);
if (($argv[1] ?? '')==='admin') {
    query("INSERT INTO users(name,email,password_hash,role) VALUES('Teste gestão',?,?,'ADMIN')",[$email,password_hash('ManagementTest123!',PASSWORD_DEFAULT)]);
    echo database()->lastInsertId(); exit;
}
if (($argv[1] ?? '')==='login-window') {
    if (!query("SELECT id FROM users WHERE email=? AND name='Teste gestão' AND role='ADMIN'",[$email])->fetch()) exit(1);
    // Repeated browser runs can exhaust the local login window. The production
    // limiter stays unchanged; only localhost fixture runs use this helper.
    foreach (['/admin/login','/auth/login','/auth/register'] as $route) {
        foreach (['127.0.0.1','::1'] as $ip) {
            $file=__DIR__.'/../api/storage/rate-'.hash('sha256',$route.$ip).'.json';
            if (is_file($file)) unlink($file);
        }
    }
    exit;
}
if (($argv[1] ?? '')==='cleanup') {
    $row=query("SELECT id FROM users WHERE email=? AND name='Teste gestão'",[$email])->fetch();
    if (!$row) exit(1);$id=(int)$row['id'];
    query("DELETE FROM logs WHERE user_id=? OR CAST(JSON_UNQUOTE(JSON_EXTRACT(details,'$.client_id')) AS UNSIGNED)=?",[$id,$id]);
    query('DELETE FROM users WHERE id=?',[$id]);exit;
}
if (($argv[1] ?? '')==='analytics') {
    foreach (array_slice($argv,3) as $event) {
        if (!preg_match('/^[a-f0-9-]{36}$/D',$event)) exit(1);
        query('DELETE FROM analytics_events WHERE event_id=?',[$event]);
    }
    exit;
}
if (($argv[1] ?? '')==='list') {
    echo json_encode(query("SELECT email FROM users WHERE name='Teste gestão' AND email LIKE 'management-%@example.invalid'")->fetchAll(PDO::FETCH_COLUMN));exit;
}
exit(1);
