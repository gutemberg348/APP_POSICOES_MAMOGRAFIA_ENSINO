<?php
declare(strict_types=1);

function playConfig(): array {
    $raw=appConfig()['google_play'] ?? [];
    return array_replace([
        'enabled'=>false, 'package_name'=>'com.dominando.mamografia', 'product_id'=>'premium_vitalicio',
        'service_account_file'=>__DIR__.'/../config/google-play-service-account.json',
        'allow_test_purchases'=>false, 'notification_audience'=>'', 'notification_service_account_email'=>'',
    ],is_array($raw)?$raw:[]);
}
function playTablesReady(): bool {
    static $ready;
    if ($ready===null) {
        try { query('SELECT user_id FROM google_play_accounts LIMIT 0'); query('SELECT id FROM google_play_purchases LIMIT 0'); query('SELECT token_hash FROM google_play_revocations LIMIT 0'); $ready=true; }
        catch (PDOException $e) { if (($e->errorInfo[1] ?? 0)!==1146) throw $e; $ready=false; }
    }
    return $ready;
}
function playEnabled(array $config): bool {
    return $config['enabled']===true && is_string($config['package_name'])
        && preg_match('/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/',$config['package_name'])
        && is_string($config['product_id']) && preg_match('/^[a-z0-9][a-z0-9._]{0,189}$/',$config['product_id'])
        && is_string($config['service_account_file']) && is_readable($config['service_account_file']) && playTablesReady();
}
function hasPlayPremium(int $userId): bool {
    if (!playTablesReady()) return false;
    $config=playConfig();
    return (bool)query("SELECT p.id FROM google_play_purchases p WHERE p.user_id=? AND p.status='PAID' AND p.acknowledged=1 AND p.package_name=? AND p.product_id=? AND (p.is_test=0 OR ?=1)
        AND NOT EXISTS (SELECT 1 FROM google_play_revocations r WHERE r.token_hash=p.token_hash AND r.package_name=p.package_name) LIMIT 1",
        [$userId,$config['package_name'],$config['product_id'],$config['allow_test_purchases']===true?1:0])->fetch();
}
function playAccountId(int $userId): string {
    query('INSERT IGNORE INTO google_play_accounts(user_id,account_id) VALUES(?,?)',[$userId,bin2hex(random_bytes(32))]);
    return (string)query('SELECT account_id FROM google_play_accounts WHERE user_id=?',[$userId])->fetchColumn();
}
function playBase64(string $value): string { return rtrim(strtr(base64_encode($value),'+/','-_'),'='); }
function playDecode(string $value): string {
    $decoded=base64_decode(strtr($value,'-_','+/'),true);
    if ($decoded===false) throw new InvalidArgumentException('PLAY_INVALID');
    return $decoded;
}
// Transporte restrito aos servidores Google; nenhuma URL ou credencial vem do app.
function playHttp(string $method,string $url,array $headers=[],?string $body=null): array {
    $ch=curl_init($url);
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,
        CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>12,CURLOPT_FOLLOWLOCATION=>false,
        CURLOPT_HTTPHEADER=>array_merge(['Accept: application/json'],$headers)]);
    if ($body!==null) curl_setopt($ch,CURLOPT_POSTFIELDS,$body);
    $raw=curl_exec($ch); $status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    // Não inclua URLs, purchase tokens ou respostas do provedor nos logs.
    if ($raw===false || $status===0 || $status>=500 || $status===429) throw new RuntimeException('PLAY_UNAVAILABLE');
    if ($status===400 || $status===404 || $status===410) throw new InvalidArgumentException('PLAY_INVALID');
    if ($status<200 || $status>=300) throw new RuntimeException('PLAY_CONFIGURATION');
    if ($raw==='') return [];
    $data=json_decode($raw,true);
    if (!is_array($data)) throw new RuntimeException('PLAY_UNAVAILABLE');
    return $data;
}
class GooglePlayProvider {
    private array $config;
    private $transport;
    public function __construct(array $config,?callable $transport=null) { $this->config=$config; $this->transport=$transport; }
    public function accessToken(): string {
        // Cache privado compartilhado entre requests PHP; nunca servido publicamente.
        $key=hash('sha256',(string)$this->config['service_account_file']);
        $file=__DIR__.'/../storage/play-oauth-'.$key.'.json';
        $handle=fopen($file,'c+');
        if (!$handle || !flock($handle,LOCK_EX)) throw new RuntimeException('PLAY_CONFIGURATION');
        try {
            $saved=json_decode(stream_get_contents($handle),true);
            if (is_array($saved) && (int)($saved['expires_at'] ?? 0)>time()+60 && is_string($saved['token'] ?? null)) return $saved['token'];
            $account=json_decode((string)file_get_contents($this->config['service_account_file']),true);
            if (!is_array($account) || ($account['type'] ?? '')!=='service_account' || !filter_var($account['client_email'] ?? '',FILTER_VALIDATE_EMAIL)
                || !is_string($account['private_key'] ?? null)) throw new RuntimeException('PLAY_CONFIGURATION');
            $now=time();
            $header=playBase64(json_encode(['alg'=>'RS256','typ'=>'JWT']));
            $claims=playBase64(json_encode(['iss'=>$account['client_email'],'scope'=>'https://www.googleapis.com/auth/androidpublisher',
                'aud'=>'https://oauth2.googleapis.com/token','iat'=>$now,'exp'=>$now+3600]));
            $signature='';
            if (!openssl_sign($header.'.'.$claims,$signature,$account['private_key'],OPENSSL_ALGO_SHA256)) throw new RuntimeException('PLAY_CONFIGURATION');
            $result=playHttp('POST','https://oauth2.googleapis.com/token',['Content-Type: application/x-www-form-urlencoded'],
                http_build_query(['grant_type'=>'urn:ietf:params:oauth:grant-type:jwt-bearer','assertion'=>$header.'.'.$claims.'.'.playBase64($signature)]));
            if (!is_string($result['access_token'] ?? null) || !is_numeric($result['expires_in'] ?? null)) throw new RuntimeException('PLAY_CONFIGURATION');
            rewind($handle); ftruncate($handle,0);
            fwrite($handle,json_encode(['token'=>$result['access_token'],'expires_at'=>$now+(int)$result['expires_in']]));
            return $result['access_token'];
        } finally { flock($handle,LOCK_UN); fclose($handle); }
    }
    public function request(string $method,string $path,?array $body=null): array {
        if ($this->transport) return ($this->transport)($method,$path,$body);
        return playHttp($method,'https://androidpublisher.googleapis.com/androidpublisher/v3/'.$path,
            ['Authorization: Bearer '.$this->accessToken(),'Content-Type: application/json'],
            $body===null?null:($body===[]?'{}':json_encode($body,JSON_THROW_ON_ERROR)));
    }
    public function purchase(string $token): array {
        return $this->request('GET','applications/'.rawurlencode($this->config['package_name']).'/purchases/productsv2/tokens/'.rawurlencode($token));
    }
    public function acknowledge(string $token): void {
        $this->request('POST','applications/'.rawurlencode($this->config['package_name']).'/purchases/products/'.rawurlencode($this->config['product_id']).'/tokens/'.rawurlencode($token).':acknowledge',[]);
    }
}
function playValidateToken($token): string {
    if (!is_string($token) || strlen($token)<8 || strlen($token)>4096 || preg_match('/[\x00-\x20\x7f]/',$token)) throw new InvalidArgumentException('PLAY_INVALID');
    return $token;
}
function playVerifyPurchase(int $userId,string $token,array $config,GooglePlayProvider $provider): array {
    playValidateToken($token);
    $hash=hash('sha256',$token); $db=database(); $db->beginTransaction();
    try {
        $user=query('SELECT * FROM users WHERE id=? FOR UPDATE',[$userId])->fetch();
        if (!$user || !$user['status']) throw new InvalidArgumentException('PLAY_ACCOUNT');
        $row=query('SELECT * FROM google_play_purchases WHERE token_hash=? FOR UPDATE',[$hash])->fetch();
        if ($row && (int)$row['user_id']!==$userId) throw new InvalidArgumentException('PLAY_ACCOUNT');
        if ($row && ($row['package_name']!==$config['package_name'] || $row['product_id']!==$config['product_id'])) throw new InvalidArgumentException('PLAY_PRODUCT');
        $purchase=$provider->purchase($token);
        $account=query('SELECT account_id FROM google_play_accounts WHERE user_id=?',[$userId])->fetchColumn();
        if (!$account || !is_string($purchase['obfuscatedExternalAccountId'] ?? null)
            || !hash_equals($account,$purchase['obfuscatedExternalAccountId'])) throw new InvalidArgumentException('PLAY_ACCOUNT');
        $lines=$purchase['productLineItem'] ?? [];
        if (!is_array($lines) || count($lines)!==1 || ($lines[0]['productId'] ?? '')!==$config['product_id']) throw new InvalidArgumentException('PLAY_PRODUCT');
        $details=$lines[0]['productOfferDetails'] ?? [];
        // O Premium é compra definitiva, não aluguel, pré-venda ou consumível.
        if (isset($details['rentOfferDetails']) || isset($details['preorderOfferDetails'])
            || (isset($details['quantity']) && $details['quantity']!==1)
            || ($details['consumptionState'] ?? '')==='CONSUMPTION_STATE_CONSUMED') throw new InvalidArgumentException('PLAY_PRODUCT');
        $state=$purchase['purchaseStateContext']['purchaseState'] ?? '';
        if (!in_array($state,['PURCHASED','PENDING','CANCELLED'],true)) throw new InvalidArgumentException('PLAY_INVALID');
        $isTest=isset($purchase['testPurchaseContext']);
        if ($isTest && $config['allow_test_purchases']!==true) throw new InvalidArgumentException('PLAY_TEST_DISABLED');
        $status=['PURCHASED'=>'PAID','PENDING'=>'PENDING','CANCELLED'=>'CANCELED'][$state];
        if (query('SELECT token_hash FROM google_play_revocations WHERE token_hash=? AND package_name=?',[$hash,$config['package_name']])->fetch()) $status='VOIDED';
        if ($state==='PURCHASED' && isset($details['refundableQuantity']) && (int)$details['refundableQuantity']===0) $status='VOIDED';
        if ($row && in_array($row['status'],['VOIDED','CANCELED'],true)) $status=$row['status'];
        $ack=($purchase['acknowledgementState'] ?? '')==='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED';
        if ($status==='PAID' && !$ack) { $provider->acknowledge($token); $ack=true; }
        $order=$purchase['orderId'] ?? null;
        if ($order!==null && (!is_string($order) || strlen($order)>190)) throw new InvalidArgumentException('PLAY_INVALID');
        query('INSERT INTO google_play_purchases(user_id,token_hash,purchase_token,package_name,product_id,order_id,status,is_test,acknowledged) VALUES(?,?,?,?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE order_id=VALUES(order_id),status=VALUES(status),is_test=VALUES(is_test),acknowledged=VALUES(acknowledged),verified_at=NOW()',
            [$userId,$hash,$token,$config['package_name'],$config['product_id'],$order,$status,$isTest?1:0,$ack?1:0]);
        if (!$row || $row['status']!==$status) managementLog($userId,'GOOGLE_PLAY_PURCHASE',['status'=>$status,'product_id'=>$config['product_id'],'is_test'=>$isTest]);
        $db->commit();
        return ['status'=>$status,'acknowledged'=>$ack,'is_test'=>$isTest];
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}

// Pub/Sub assina o JWT. Checamos assinatura, emissor, audience e conta exata da assinatura push.
function playVerifyNotificationIdentity(string $jwt,array $config,?array $certificates=null): void {
    if (!$config['notification_audience'] || !$config['notification_service_account_email']) throw new RuntimeException('PLAY_NOTIFICATION_CONFIGURATION');
    $parts=explode('.',$jwt);
    if (count($parts)!==3 || strlen($jwt)>16384) throw new InvalidArgumentException('PLAY_NOTIFICATION_AUTH');
    $header=json_decode(playDecode($parts[0]),true); $claims=json_decode(playDecode($parts[1]),true);
    if (!is_array($header) || !is_array($claims) || ($header['alg'] ?? '')!=='RS256' || !is_string($header['kid'] ?? null)) throw new InvalidArgumentException('PLAY_NOTIFICATION_AUTH');
    if ($certificates===null) {
        $file=__DIR__.'/../storage/play-google-certificates.json';
        $saved=is_file($file)?json_decode((string)file_get_contents($file),true):null;
        $certificates=is_array($saved) && (int)($saved['expires_at'] ?? 0)>time()?($saved['certificates'] ?? []):[];
        if (!isset($certificates[$header['kid']])) {
            $certificates=playHttp('GET','https://www.googleapis.com/oauth2/v1/certs');
            file_put_contents($file,json_encode(['expires_at'=>time()+3600,'certificates'=>$certificates]),LOCK_EX);
        }
    }
    if (!isset($certificates[$header['kid']]) || openssl_verify($parts[0].'.'.$parts[1],playDecode($parts[2]),$certificates[$header['kid']],OPENSSL_ALGO_SHA256)!==1
        || !in_array($claims['iss'] ?? '',['accounts.google.com','https://accounts.google.com'],true)
        || ($claims['aud'] ?? '')!==$config['notification_audience'] || ($claims['email'] ?? '')!==$config['notification_service_account_email']
        || ($claims['email_verified'] ?? false)!==true || !is_numeric($claims['exp'] ?? null) || (int)$claims['exp']<=time()
        || !is_numeric($claims['iat'] ?? null) || (int)$claims['iat']>time()+60) throw new InvalidArgumentException('PLAY_NOTIFICATION_AUTH');
}
function playApplyNotification(array $envelope,array $config,GooglePlayProvider $provider): void {
    $encoded=$envelope['message']['data'] ?? null;
    if (!is_string($encoded) || strlen($encoded)>65536) throw new InvalidArgumentException('PLAY_INVALID');
    $data=json_decode(playDecode($encoded),true);
    if (!is_array($data) || ($data['packageName'] ?? '')!==$config['package_name']) throw new InvalidArgumentException('PLAY_PRODUCT');
    if (isset($data['testNotification'])) return;
    $notification=$data['oneTimeProductNotification'] ?? $data['voidedPurchaseNotification'] ?? null;
    if (!is_array($notification)) return; // Não usamos assinaturas.
    $token=playValidateToken($notification['purchaseToken'] ?? null);
    $row=query('SELECT * FROM google_play_purchases WHERE token_hash=?',[hash('sha256',$token)])->fetch();
    if (isset($data['voidedPurchaseNotification'])) {
        if (($notification['productType'] ?? null)!==2) return;
        query('INSERT IGNORE INTO google_play_revocations(token_hash,package_name) VALUES(?,?)',[hash('sha256',$token),$config['package_name']]);
        if ($row && $row['package_name']===$config['package_name']) {
            query("UPDATE google_play_purchases SET status='VOIDED',verified_at=NOW() WHERE id=?",[$row['id']]);
            managementLog((int)$row['user_id'],'GOOGLE_PLAY_VOIDED',['purchase_id'=>(int)$row['id']]);
        }
        return;
    }
    if (($notification['sku'] ?? '')!==$config['product_id']) return;
    if ($row) $userId=(int)$row['user_id'];
    else {
        // Uma compra pode chegar ao servidor mesmo se o app perder a conexão depois do pagamento.
        $purchase=$provider->purchase($token);
        $userId=(int)query('SELECT user_id FROM google_play_accounts WHERE account_id=?',[$purchase['obfuscatedExternalAccountId'] ?? ''])->fetchColumn();
        if (!$userId) return;
    }
    playVerifyPurchase($userId,$token,$config,$provider);
}
