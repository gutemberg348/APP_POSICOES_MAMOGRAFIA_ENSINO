<?php
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
$root=dirname(__DIR__);
require $root.'/api/helpers/http.php';
require $root.'/api/config/database.php';
require $root.'/api/controllers/management.php';
require $root.'/api/services/password-reset.php';
function checkReset(bool $ok,string $label): void { if (!$ok) throw new RuntimeException($label); }
// The browser test may issue a code only to its randomly named fixture. No email is sent.
if (($argv[1] ?? '')==='issue') {
    $email=$argv[2] ?? '';
    if (!preg_match('/^gate-[a-f0-9]{16}@example\.test$/D',$email)) exit(1);
    $fixture=query('SELECT id FROM users WHERE email=? AND name="Teste entrada"',[$email])->fetch();
    if (!$fixture) exit(1);
    requestPasswordReset($email,function($to,$code) { echo json_encode(['code'=>$code]); return true; });
    exit;
}
$email='reset-'.bin2hex(random_bytes(8)).'@example.test';
query('INSERT INTO users(name,email,password_hash,is_premium) VALUES(?,?,?,1)',['Teste senha',$email,password_hash('Original123!',PASSWORD_DEFAULT)]);
$id=(int)database()->lastInsertId();
$delivered=[];
$send=function($to,$code) use (&$delivered) { $delivered[]=[$to,$code]; return true; };
try {
    requestPasswordReset($email,$send);
    checkReset(count($delivered)===1,'Code delivered once');
    $code=$delivered[0][1];
    $row=query('SELECT * FROM password_resets WHERE user_id=?',[$id])->fetch();
    checkReset($row['code_hash']!==$code && hash_equals($row['code_hash'],passwordResetHash($email,$code)),'Only keyed hash stored');
    requestPasswordReset($email,$send);
    checkReset(count($delivered)===1,'Resend cooldown');
    requestPasswordReset('missing-'.bin2hex(random_bytes(8)).'@example.test',$send);
    checkReset(count($delivered)===1,'Unknown account not mailed');
    query('INSERT INTO auth_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 1 DAY))',[$id,hash('sha256',random_bytes(32))]);
    checkReset(!resetPasswordWithCode($email,'00000000','Changed123!'),'Wrong code rejected');
    checkReset(!resetPasswordWithCode($email,$code,'short'),'Short password rejected');
    checkReset(resetPasswordWithCode(strtoupper($email),$code,'Changed123!'),'Valid code accepted');
    checkReset(!resetPasswordWithCode($email,$code,'Replay123!'),'Single use');
    checkReset((int)query('SELECT COUNT(*) FROM auth_tokens WHERE user_id=?',[$id])->fetchColumn()===0,'Sessions revoked');
    $user=query('SELECT * FROM users WHERE id=?',[$id])->fetch();
    checkReset(password_verify('Changed123!',$user['password_hash']) && $user['is_premium']==1,'Password changed, Premium preserved');
    query('UPDATE password_resets SET created_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 2 MINUTE) WHERE user_id=?',[$id]);
    requestPasswordReset($email,$send); $next=$delivered[1][1];
    query('UPDATE password_resets SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE user_id=?',[$id]);
    checkReset(!resetPasswordWithCode($email,$next,'Expired123!'),'Expired rejected');
    query('UPDATE password_resets SET expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE) WHERE user_id=?',[$id]);
    for ($n=0;$n<5;$n++) checkReset(!resetPasswordWithCode($email,'00000000','Guess123!'),'Guess rejected');
    checkReset(!resetPasswordWithCode($email,$next,'Locked123!'),'Five failed attempts block code');
    query('UPDATE password_resets SET attempts=0 WHERE user_id=?',[$id]);
    query('UPDATE users SET status=0 WHERE id=?',[$id]);
    checkReset(!resetPasswordWithCode($email,$next,'Blocked123!'),'Blocked account rejected');
    echo "PASS: recovery delivery adapter, hashes, cooldown, invalid/expired/reused codes, attempt limit, blocked account, session revocation and Premium preserved.\n";
} finally {
    query('DELETE FROM logs WHERE user_id=?',[$id]);
    query('DELETE FROM users WHERE id=?',[$id]);
}
