<?php
function passwordResetReady(): bool {
    try { query('SELECT user_id FROM password_resets LIMIT 1'); return true; }
    catch (PDOException $e) { if (($e->errorInfo[1] ?? null)===1146) return false; throw $e; }
}
function passwordResetMailConfig(): array {
    return array_replace(['enabled'=>false,'host'=>'','port'=>587,'encryption'=>'tls','username'=>'','password'=>'',
        'from'=>'','from_name'=>'Dominando a Mamografia'],appConfig()['mail'] ?? []);
}
function passwordResetMailReady(): bool {
    $config=passwordResetMailConfig();
    return $config['enabled']===true && $config['host'] && $config['username'] && $config['password']
        && filter_var($config['from'],FILTER_VALIDATE_EMAIL) && in_array($config['encryption'],['tls','ssl'],true)
        && is_file(__DIR__.'/../vendor/autoload.php');
}
function passwordResetHash(string $email, string $code): string {
    return hash_hmac('sha256', strtolower(trim($email)).':'.$code, appConfig()['signing_key']);
}
function sendPasswordResetEmail(string $email, string $code): bool {
    if (!passwordResetMailReady()) return false;
    require_once __DIR__.'/../vendor/autoload.php';
    $config=passwordResetMailConfig();
    $mailer=new \PHPMailer\PHPMailer\PHPMailer(true);
    $mailer->isSMTP(); $mailer->Host=$config['host']; $mailer->Port=(int)$config['port'];
    $mailer->SMTPAuth=true; $mailer->Username=$config['username']; $mailer->Password=$config['password'];
    $mailer->SMTPSecure=$config['encryption']; $mailer->Timeout=8; $mailer->Timelimit=12;
    $mailer->CharSet='UTF-8'; $mailer->SMTPDebug=0;
    $mailer->setFrom($config['from'],$config['from_name']); $mailer->addAddress($email);
    $mailer->Subject='Recupere seu acesso - Dominando a Mamografia';
    $body="Olá!\n\nSeu código para redefinir a senha é: $code\n\n".
        "Volte ao aplicativo e informe este código. Ele vale por 15 minutos e só pode ser usado uma vez.\n\n".
        "Se você não solicitou a recuperação, ignore esta mensagem. Sua senha continua a mesma.\n\nDominando a Mamografia";
    $mailer->Body=$body;
    return $mailer->send();
}
// Transport is injectable for local tests; codes are never returned by the API or logged.
function requestPasswordReset(string $email, callable $send): void {
    $email=strtolower(trim($email));
    $pdo=database();
    $pdo->beginTransaction();
    try {
        $user=query('SELECT id FROM users WHERE email=? AND status=1 AND role="USER" FOR UPDATE',[$email])->fetch();
        if (!$user) { $pdo->commit(); return; }
        $existing=query('SELECT created_at>DATE_SUB(UTC_TIMESTAMP(),INTERVAL 60 SECOND) AS recent FROM password_resets WHERE user_id=?',[$user['id']])->fetch();
        if ($existing && $existing['recent']) { $pdo->commit(); return; }
        $code=(string)random_int(10000000,99999999);
        $hash=passwordResetHash($email,$code);
        query('INSERT INTO password_resets(user_id,code_hash,attempts,created_at,expires_at,used_at) VALUES(?,?,0,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 15 MINUTE),NULL)
            ON DUPLICATE KEY UPDATE code_hash=VALUES(code_hash),attempts=0,created_at=VALUES(created_at),expires_at=VALUES(expires_at),used_at=NULL',[$user['id'],$hash]);
        $pdo->commit();
        try { $sent=$send($email,$code); } catch (Throwable $e) { $sent=false; }
        if (!$sent) {
            query('DELETE FROM password_resets WHERE user_id=? AND code_hash=?',[$user['id'],$hash]);
            error_log('[Mamografia] Falha no transporte de e-mail de recuperação.');
        }
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
function resetPasswordWithCode(string $email, string $code, string $password): bool {
    if (strlen($password)<8 || strlen($password)>72 || !preg_match('/^\d{8}$/D',$code)) return false;
    $email=strtolower(trim($email));
    $pdo=database(); $pdo->beginTransaction();
    try {
        $user=query('SELECT id FROM users WHERE email=? AND status=1 AND role="USER" FOR UPDATE',[$email])->fetch();
        if (!$user) { $pdo->commit(); return false; }
        $reset=query('SELECT *,expires_at>UTC_TIMESTAMP() AS valid FROM password_resets WHERE user_id=? FOR UPDATE',[$user['id']])->fetch();
        if (!$reset || !$reset['valid'] || $reset['used_at'] || $reset['attempts']>=5) { $pdo->commit(); return false; }
        if (!hash_equals($reset['code_hash'],passwordResetHash($email,$code))) {
            query('UPDATE password_resets SET attempts=attempts+1 WHERE user_id=?',[$user['id']]);
            $pdo->commit(); return false;
        }
        query('UPDATE users SET password_hash=? WHERE id=?',[password_hash($password,PASSWORD_DEFAULT),$user['id']]);
        query('UPDATE password_resets SET used_at=UTC_TIMESTAMP() WHERE user_id=?',[$user['id']]);
        query('DELETE FROM auth_tokens WHERE user_id=?',[$user['id']]);
        managementLog((int)$user['id'],'AUTH_PASSWORD_RESET');
        $pdo->commit(); return true;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
