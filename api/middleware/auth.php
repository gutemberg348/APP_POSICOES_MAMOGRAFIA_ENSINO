<?php
require_once __DIR__.'/../services/premium-trial.php';
function currentUser(bool $required = false, bool $admin = false): ?array {
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    $token = preg_match('/^Bearer (.+)$/i', $header, $m) ? $m[1] : '';
    $user = $token ? query('SELECT u.* FROM users u JOIN auth_tokens t ON t.user_id=u.id WHERE t.token_hash=? AND t.expires_at>NOW() AND u.status=1', [hash('sha256', $token)])->fetch() : null;
    if ($required && !$user) respond(['error' => 'Entre na sua conta para continuar.'], 401);
    if ($admin && (!$user || $user['role'] !== 'ADMIN')) respond(['error' => 'Acesso administrativo necessário.'], 403);
    return $user ? withPremiumAccess($user) : null;
}
function canAccess(string $type, ?array $user): bool {
    if ($type==='FREE') return true;
    if (!$user || (isset($user['status']) && !$user['status'])) return false;
    // currentUser já consultou os acessos nesta requisição. Evita repetir consultas por mídia.
    if (array_key_exists('_manual_premium',$user)) return $user['premium_permanent']
        || ($user['trial_active'] && strtotime($user['trial_ends_at'])>time());
    return (bool)withPremiumAccess($user)['is_premium'];
}
function publicUser(array $user): array {
    $user=withPremiumAccess($user);
    $user['trial_days']=premiumTrialDays();
    $user['trial_available']=!$user['is_premium'] && $user['trial_ends_at']===null && $user['trial_days']>0
        && (!isset($user['status']) || (bool)$user['status']) && premiumTrialReady();
    return array_intersect_key($user, array_flip(['id', 'name', 'email', 'role', 'is_premium', 'created_at', 'premium_permanent', 'trial_active', 'trial_started_at', 'trial_ends_at', 'trial_days', 'trial_available']));
}
