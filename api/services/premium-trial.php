<?php
declare(strict_types=1);

function premiumTrialReady(): bool {
    static $ready;
    if ($ready === null) {
        try { query('SELECT user_id FROM premium_trials LIMIT 0'); $ready=true; }
        catch (PDOException $e) { if (($e->errorInfo[1] ?? 0)!==1146) throw $e; $ready=false; }
    }
    return $ready;
}
function premiumTrialDays(): int {
    $value=query("SELECT value FROM settings WHERE `key`='premium_trial_days'")->fetchColumn();
    return is_string($value) && preg_match('/^(0|[1-9][0-9]{0,2})$/D',$value) && (int)$value<=365 ? (int)$value : 0;
}
// Uma única ativação explícita por conta; requisições simultâneas não renovam o prazo.
function startPremiumTrial(int $userId): array {
    if (!premiumTrialReady()) throw new RuntimeException('TRIAL_UNAVAILABLE');
    $db=database();
    $db->beginTransaction();
    try {
        $user=query('SELECT * FROM users WHERE id=? FOR UPDATE',[$userId])->fetch();
        if (!$user || !$user['status']) throw new RuntimeException('TRIAL_ACCOUNT');
        if ($user['role']==='ADMIN' || $user['is_premium'] || hasPaidPremium($userId)) throw new RuntimeException('TRIAL_PREMIUM');
        $existing=query('SELECT user_id,(ends_at>UTC_TIMESTAMP() AND started_at<=UTC_TIMESTAMP()) AS active FROM premium_trials WHERE user_id=? FOR UPDATE',[$userId])->fetch();
        if ($existing && !$existing['active']) throw new RuntimeException('TRIAL_USED');
        if (!$existing) {
            $days=premiumTrialDays();
            if ($days===0) throw new RuntimeException('TRIAL_DISABLED');
            query('INSERT INTO premium_trials(user_id,started_at,ends_at) VALUES(?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL ? DAY))',[$userId,$days]);
            managementLog($userId,'PREMIUM_TRIAL_STARTED',['days'=>$days]);
        }
        $db->commit();
        return publicUser($user);
    } catch (Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
}
function premiumTrial(int $userId): array {
    if (!premiumTrialReady()) return ['trial_active'=>false,'trial_started_at'=>null,'trial_ends_at'=>null];
    $row=query('SELECT started_at,ends_at,(started_at<=UTC_TIMESTAMP() AND ends_at>UTC_TIMESTAMP()) AS active FROM premium_trials WHERE user_id=?',[$userId])->fetch();
    return ['trial_active'=>$row && (bool)$row['active'],
        'trial_started_at'=>$row ? str_replace(' ','T',$row['started_at']).'Z' : null,
        'trial_ends_at'=>$row ? str_replace(' ','T',$row['ends_at']).'Z' : null];
}
function withPremiumAccess(array $user): array {
    $manual=(bool)($user['_manual_premium'] ?? $user['is_premium']);
    $user['_manual_premium']=$manual;
    $trial=premiumTrial((int)$user['id']);
    $permanent=$user['role']==='ADMIN' || $manual || hasPaidPremium((int)$user['id']);
    $active=!isset($user['status']) || (bool)$user['status'];
    return array_replace($user,$trial,[
        'premium_permanent'=>$active && $permanent,
        'trial_active'=>$active && !$permanent && $trial['trial_active'],
        'is_premium'=>(int)($active && ($permanent || $trial['trial_active'])),
    ]);
}
