<?php
declare(strict_types=1);

function billingConfig(): array {
    $raw = appConfig()['asaas'] ?? [];
    $config=array_replace([
        'enabled'=>false, 'environment'=>'sandbox', 'api_key'=>'', 'webhook_token'=>'',
        'price_cents'=>0, 'purchase_type'=>'ONE_TIME',
        'return_url'=>rtrim(appConfig()['base_url'], '/') . '/preview/profile',
    ], is_array($raw) ? $raw : []);
    $saved=query("SELECT value FROM settings WHERE `key`='premium_price_cents'")->fetchColumn();
    if ($saved!==false) $config['price_cents']=(int)$saved;
    $config['purchase_type']='ONE_TIME';
    return $config;
}
function billingTablesReady(): bool {
    static $ready;
    if ($ready === null) {
        try { query('SELECT id FROM payments LIMIT 0'); query('SELECT event_id FROM payment_events LIMIT 0'); $ready=true; }
        catch (PDOException $e) { if (($e->errorInfo[1] ?? 0)!==1146) throw $e; $ready=false; }
    }
    return $ready;
}
function hasPaidPremium(int $userId): bool {
    return (function_exists('hasPlayPremium') && hasPlayPremium($userId)) ||
        (billingTablesReady() && (bool)query("SELECT id FROM payments WHERE user_id=? AND status='PAID' AND environment=? LIMIT 1", [$userId,billingConfig()['environment']])->fetch());
}
function billingEnabled(array $config): bool {
    return $config['enabled'] === true && in_array($config['environment'], ['sandbox','production'], true)
        && $config['purchase_type']==='ONE_TIME' && is_int($config['price_cents']) && $config['price_cents']>=100
        && $config['price_cents']<=100000000 && is_string($config['api_key']) && $config['api_key']!==''
        && is_string($config['webhook_token']) && strlen($config['webhook_token'])>=32
        && filter_var($config['return_url'], FILTER_VALIDATE_URL)
        && parse_url($config['return_url'], PHP_URL_SCHEME)==='https' && billingTablesReady();
}

class AsaasProvider {
    private array $config;
    private $transport;
    public function __construct(array $config, ?callable $transport=null) { $this->config=$config; $this->transport=$transport; }
    public function request(string $method, string $path, ?array $body=null): array {
        if ($this->transport) return ($this->transport)($method,$path,$body);
        $base=$this->config['environment']==='production'?'https://api.asaas.com/v3':'https://api-sandbox.asaas.com/v3';
        $ch=curl_init($base.$path);
        curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_CUSTOMREQUEST=>$method,
            CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>15,CURLOPT_FOLLOWLOCATION=>false,
            CURLOPT_HTTPHEADER=>['Content-Type: application/json','Accept: application/json',
                'User-Agent: DominandoMamografia/1.0','access_token: '.$this->config['api_key']]]);
        if ($body!==null) curl_setopt($ch,CURLOPT_POSTFIELDS,json_encode($body,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR));
        $raw=curl_exec($ch); $status=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
        if ($raw===false || $status>=500 || $status===0) throw new RuntimeException('ASAAS_UNCERTAIN');
        if ($status<200 || $status>=300) throw new RuntimeException('ASAAS_REJECTED');
        $data=json_decode($raw,true);
        if (!is_array($data)) throw new RuntimeException('ASAAS_UNCERTAIN');
        return $data;
    }
    public function checkout(array $payment): array {
        $url=$this->config['return_url'];
        return $this->request('POST','/checkouts',[
            'billingTypes'=>['PIX','CREDIT_CARD'],'chargeTypes'=>['DETACHED'],'minutesToExpire'=>60,
            'externalReference'=>$payment['reference'],
            'callback'=>['successUrl'=>$url,'cancelUrl'=>$url,'expiredUrl'=>$url],
            'items'=>[['name'=>'Dominando a Mamografia Premium','quantity'=>1,'value'=>$payment['amount_cents']/100]],
        ]);
    }
    public function confirmedPayment(string $checkoutId, int $amount): ?array {
        $list=$this->request('GET','/payments?checkoutSession='.rawurlencode($checkoutId).'&limit=100');
        foreach ($list['data'] ?? [] as $p) {
            if (in_array($p['status'] ?? '',['CONFIRMED','RECEIVED'],true)
                && (int)round((float)($p['value'] ?? 0)*100)===$amount && !empty($p['id'])) return $p;
        }
        return null;
    }
}
function billingPublicPayment(array $row): array {
    return ['id'=>(int)$row['id'],'status'=>$row['status'],'amount_cents'=>(int)$row['amount_cents'],
        'checkout_url'=>$row['status']==='PENDING'?$row['checkout_url']:null];
}
function billingCreateCheckout(int $userId, array $config, AsaasProvider $provider): array {
    $db=database();
    $db->beginTransaction();
    try {
        $user=query('SELECT * FROM users WHERE id=? FOR UPDATE',[$userId])->fetch();
        if (!$user || !$user['status']) throw new RuntimeException('BILLING_UNAUTHORIZED');
        if ($user['role']==='ADMIN' || $user['is_premium'] || hasPaidPremium($userId)) throw new RuntimeException('BILLING_PREMIUM');
        query("UPDATE payments SET status='EXPIRED' WHERE user_id=? AND status='PENDING' AND expires_at<NOW()",[$userId]);
        $pending=query("SELECT * FROM payments WHERE user_id=? AND status IN ('CREATING','PENDING') ORDER BY id DESC LIMIT 1",[$userId])->fetch();
        if ($pending) {
            $db->commit();
            if ($pending['status']==='CREATING') throw new RuntimeException('BILLING_RECONCILE');
            return billingPublicPayment($pending);
        }
        $reference=bin2hex(random_bytes(24));
        query('INSERT INTO payments(user_id,reference,environment,amount_cents,expires_at) VALUES(?,?,?,?,DATE_ADD(NOW(),INTERVAL 60 MINUTE))',
            [$userId,$reference,$config['environment'],$config['price_cents']]);
        $id=(int)$db->lastInsertId();
        $row=query('SELECT * FROM payments WHERE id=?',[$id])->fetch();
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
    try {
        $checkout=$provider->checkout($row);
        $checkoutId=$checkout['id'] ?? '';
        if (!is_string($checkoutId) || !preg_match('/^[a-zA-Z0-9_-]{1,100}$/',$checkoutId)) throw new RuntimeException('ASAAS_UNCERTAIN');
        $host=$config['environment']==='production'?'asaas.com':'sandbox.asaas.com';
        $url=$checkout['link'] ?? "https://$host/checkoutSession/show?id=".rawurlencode($checkoutId);
        if (!is_string($url) || strlen($url)>500 || parse_url($url,PHP_URL_SCHEME)!=='https'
            || !in_array(parse_url($url,PHP_URL_HOST),[$host,'www.'.$host],true)) throw new RuntimeException('ASAAS_UNCERTAIN');
        query("UPDATE payments SET checkout_id=?,checkout_url=?,status=IF(status='CREATING','PENDING',status) WHERE id=?",[$checkoutId,$url,$id]);
        return billingPublicPayment(query('SELECT * FROM payments WHERE id=?',[$id])->fetch());
    } catch (Throwable $e) {
        // Timeout pode ter criado o checkout remotamente. Não crie outro até conciliar.
        if ($e->getMessage()==='ASAAS_REJECTED') query("UPDATE payments SET status='FAILED' WHERE id=? AND status='CREATING'",[$id]);
        throw $e;
    }
}
function billingApplyEvent(array $data, array $config, AsaasProvider $provider): void {
    $eventId=$data['id'] ?? ''; $event=$data['event'] ?? '';
    if (!is_string($eventId) || strlen($eventId)>190 || $eventId==='' || !is_string($event) || strlen($event)>100)
        throw new InvalidArgumentException('Evento inválido.');
    $checkout=$data['checkout'] ?? [];
    $payment=$data['payment'] ?? [];
    $known=['CHECKOUT_CREATED','CHECKOUT_PAID','CHECKOUT_CANCELED','CHECKOUT_EXPIRED','PAYMENT_REFUNDED','PAYMENT_CHARGEBACK_REQUESTED','PAYMENT_CHARGEBACK_DISPUTE'];
    if (!in_array($event,$known,true)) return;
    if (query('SELECT event_id FROM payment_events WHERE event_id=?',[$eventId])->fetch()) return;
    $isCheckout=str_starts_with($event,'CHECKOUT_');
    if ($isCheckout) {
        $row=query('SELECT * FROM payments WHERE checkout_id=? OR reference=? LIMIT 1',[$checkout['id'] ?? '',$checkout['externalReference'] ?? ''])->fetch();
    } else $row=query('SELECT * FROM payments WHERE provider_payment_id=? LIMIT 1',[$payment['id'] ?? ''])->fetch();
    // Eventos de outros produtos desta conta não pertencem ao app.
    if (!$row) return;
    if ($row['environment']!==$config['environment']) throw new InvalidArgumentException('Ambiente inválido.');
    if ($isCheckout && (!is_string($checkout['id'] ?? null) || !preg_match('/^[a-zA-Z0-9_-]{1,100}$/',$checkout['id'])
        || ($row['checkout_id'] && $row['checkout_id']!==$checkout['id'])
        || (!empty($checkout['externalReference']) && $checkout['externalReference']!==$row['reference'])))
        throw new InvalidArgumentException('Checkout inválido.');
    $confirmed=null;
    if ($event==='CHECKOUT_PAID') {
        $confirmed=$provider->confirmedPayment($checkout['id'],(int)$row['amount_cents']);
        if (!$confirmed) throw new RuntimeException('BILLING_NOT_CONFIRMED');
    }
    $db=database(); $db->beginTransaction();
    try {
        // Serializa também com criação de checkout para evitar compras duplicadas.
        query('SELECT id FROM users WHERE id=? FOR UPDATE',[$row['user_id']]);
        $row=query('SELECT * FROM payments WHERE id=? FOR UPDATE',[$row['id']])->fetch();
        if (query('SELECT event_id FROM payment_events WHERE event_id=?',[$eventId])->fetch()) { $db->commit(); return; }
        $next=$row['status'];
        if ($event==='CHECKOUT_PAID' && !in_array($next,['REFUNDED','CHARGEBACK'],true)) $next='PAID';
        if ($event==='CHECKOUT_CANCELED' && in_array($next,['CREATING','PENDING'],true)) $next='CANCELED';
        if ($event==='CHECKOUT_EXPIRED' && in_array($next,['CREATING','PENDING'],true)) $next='EXPIRED';
        if ($event==='PAYMENT_REFUNDED') $next='REFUNDED';
        if (str_starts_with($event,'PAYMENT_CHARGEBACK_')) $next='CHARGEBACK';
        query("UPDATE payments SET checkout_id=COALESCE(checkout_id,?),provider_payment_id=COALESCE(provider_payment_id,?),status=?,paid_at=IF(?='PAID',COALESCE(paid_at,NOW()),paid_at) WHERE id=?",
            [$isCheckout?$checkout['id']:null,$confirmed['id'] ?? null,$next,$next,$row['id']]);
        query('INSERT INTO payment_events(event_id,payment_id,event_type) VALUES(?,?,?)',[$eventId,$row['id'],$event]);
        managementLog((int)$row['user_id'],'PAYMENT_EVENT',['payment_id'=>(int)$row['id'],'event'=>$event,'status'=>$next]);
        $db->commit();
    } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }
}
