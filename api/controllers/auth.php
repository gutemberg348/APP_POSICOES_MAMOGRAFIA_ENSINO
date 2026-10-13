<?php
function authController(string $route, string $method): void {
    if ($method==='POST' && in_array($route,['/auth/forgot-password','/auth/reset-password'],true)) {
        rateLimit($route, $route==='/auth/forgot-password' ? 5 : 15);
        $data=input(); $email=strtolower(requiredText($data,'email',190));
        if (!filter_var($email,FILTER_VALIDATE_EMAIL)) respond(['error'=>'Informe um e-mail válido.'],422);
        if (!passwordResetReady()) respond(['error'=>'A recuperação de senha está indisponível no momento. Tente novamente mais tarde.'],503);
        if ($route==='/auth/forgot-password') {
            if (!passwordResetMailReady()) respond(['error'=>'A recuperação por e-mail ainda não está disponível. Entre em contato com o suporte.'],503);
            requestPasswordReset($email,'sendPasswordResetEmail');
            respond(['message'=>'Se este e-mail estiver cadastrado, você receberá um código válido por 15 minutos. Confira também a caixa de spam.']);
        }
        $password=(string)($data['password'] ?? '');
        if (strlen($password)<8) respond(['error'=>'Use uma senha com pelo menos 8 caracteres.'],422);
        if (strlen($password)>72) respond(['error'=>'Senha muito longa. Use uma senha mais curta.'],422);
        if (!resetPasswordWithCode($email,trim((string)($data['code'] ?? '')),$password))
            respond(['error'=>'Código inválido ou expirado. Confira os números ou solicite um novo código.'],422);
        respond(['message'=>'Senha atualizada. Entre com sua nova senha.']);
    }
    if ($method === 'POST' && in_array($route, ['/auth/login', '/auth/register', '/admin/login'])) {
        rateLimit($route);
        $data = input();
        $email = strtolower(requiredText($data, 'email', 190));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(['error' => 'Informe um e-mail válido.'], 422);
        $password = (string)($data['password'] ?? '');
        if (strlen($password) > 72) respond(['error' => 'Senha muito longa.'], 422);
        if ($route === '/auth/register') {
            if (strlen($password) < 8) respond(['error' => 'A senha deve ter pelo menos 8 caracteres.'], 422);
            $name = requiredText($data, 'name', 120);
            if (query('SELECT id FROM users WHERE email=?', [$email])->fetch()) respond(['error' => 'Este e-mail já está cadastrado.'], 409);
            database()->beginTransaction();
            query('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)', [$name, $email, password_hash($password, PASSWORD_DEFAULT)]);
            $id=(int)database()->lastInsertId();
            managementLog($id,'AUTH_REGISTER');
            database()->commit();
        }
        $user = query('SELECT * FROM users WHERE email=? AND status=1', [$email])->fetch();
        if (!$user || !password_verify($password, $user['password_hash']) || ($route === '/admin/login' && $user['role'] !== 'ADMIN')) respond(['error' => 'E-mail ou senha incorretos.'], 401);
        $token = bin2hex(random_bytes(32));
        query('INSERT INTO auth_tokens(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 7 DAY))', [$user['id'], hash('sha256', $token)]);
        managementLog((int)$user['id'],'AUTH_LOGIN');
        respond(['token' => $token, 'user' => publicUser($user)]);
    }
    if ($route === '/profile' && $method === 'GET') respond(publicUser(currentUser(true)));
    if ($route === '/premium/trial/start' && $method === 'POST') {
        $user=currentUser(true);
        rateLimit('premium-trial-'.$user['id'],20);
        try { respond(startPremiumTrial((int)$user['id'])); }
        catch (RuntimeException $e) {
            $errors=[
                'TRIAL_UNAVAILABLE'=>['Período de teste ainda indisponível. Tente novamente mais tarde.',503],
                'TRIAL_ACCOUNT'=>['Entre na sua conta para continuar.',401],
                'TRIAL_PREMIUM'=>['Sua conta já possui Premium definitivo.',409],
                'TRIAL_USED'=>['Esta conta já utilizou o período de teste.',409],
                'TRIAL_DISABLED'=>['Novos períodos de teste estão desativados.',409],
            ];
            if (!isset($errors[$e->getMessage()])) throw $e;
            [$message,$status]=$errors[$e->getMessage()];
            respond(['error'=>$message],$status);
        }
    }
    if ($route === '/auth/logout' && $method === 'POST') {
        currentUser(true);
        preg_match('/^Bearer (.+)$/i', $_SERVER['HTTP_AUTHORIZATION'], $m);
        query('DELETE FROM auth_tokens WHERE token_hash=?', [hash('sha256', $m[1])]);
        respond(['ok' => true]);
    }
}
