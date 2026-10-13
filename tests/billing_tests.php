<?php
// Integração com o banco local e transporte Asaas simulado, sem criar cobranças reais.
require dirname(__DIR__).'/api/helpers/http.php';
require dirname(__DIR__).'/api/config/database.php';
require dirname(__DIR__).'/api/services/asaas.php';
require dirname(__DIR__).'/api/controllers/management.php';
require dirname(__DIR__).'/api/middleware/auth.php';
require dirname(__DIR__).'/api/models/media.php';
function check(bool $condition,string $message): void { if (!$condition) throw new RuntimeException($message); }
function fileStatus(string $url): int {
    check(in_array(parse_url($url,PHP_URL_HOST),['localhost','127.0.0.1'],true),'Teste de arquivo exige servidor local.');
    $curl=curl_init($url);
    curl_setopt_array($curl,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_TIMEOUT=>5,CURLOPT_HTTPHEADER=>['Range: bytes=0-1']]);
    curl_exec($curl); $status=curl_getinfo($curl,CURLINFO_HTTP_CODE); curl_close($curl); return $status;
}
$ids=[];
try {
    foreach ([0,1] as $manual) {
        query('INSERT INTO users(name,email,password_hash,is_premium) VALUES(?,?,?,?)',
            ['Teste Asaas','billing-'.bin2hex(random_bytes(8)).'@example.test',password_hash(bin2hex(random_bytes(12)),PASSWORD_DEFAULT),$manual]);
        $ids[]=(int)database()->lastInsertId();
    }
    $config=billingConfig();
    $config['price_cents']=12990;
    $mode=$config['environment'];
    $reference=''; $calls=0;
    $provider=new AsaasProvider($config,function($method,$path,$body) use (&$reference,&$calls) {
        if ($method==='POST') {
            $calls++; $reference=$body['externalReference'];
            check($body['items'][0]['value']===129.9,'Preço enviado incorreto.');
            check($body['chargeTypes']===['DETACHED'],'Tipo de compra incorreto.');
            return ['id'=>'test-checkout-'.bin2hex(random_bytes(8))];
        }
        check(str_contains($path,'checkoutSession='),'Confirmação deve consultar o checkout.');
        return ['data'=>[['id'=>'test-pay-'.substr($reference,0,12),'value'=>129.9,'status'=>'CONFIRMED']]];
    });
    $order=billingCreateCheckout($ids[0],$config,$provider);
    $config['price_cents']=19990;
    $same=billingCreateCheckout($ids[0],$config,$provider);
    check($calls===1 && $order['id']===$same['id'],'Checkout duplicado criado.');
    check($same['amount_cents']===12990,'Mudança de preço alterou checkout já aberto.');
    check(!hasPaidPremium($ids[0]),'Criar checkout liberou Premium.');
    $row=query('SELECT * FROM payments WHERE id=?',[$order['id']])->fetch();
    $event=['id'=>'test-'.bin2hex(random_bytes(12)),'event'=>'CHECKOUT_PAID','checkout'=>['id'=>$row['checkout_id'],'externalReference'=>$row['reference']]];
    $wrongProvider=new AsaasProvider($config,fn()=>['data'=>[['id'=>'wrong','value'=>1,'status'=>'CONFIRMED']]]);
    try { billingApplyEvent($event,$config,$wrongProvider); throw new LogicException('Valor incorreto aceito.'); }
    catch (RuntimeException $e) { check($e->getMessage()==='BILLING_NOT_CONFIRMED','Falha inesperada.'); }
    check(!hasPaidPremium($ids[0]),'Valor incorreto liberou Premium.');
    billingApplyEvent($event,$config,$provider);
    billingApplyEvent($event,$config,$provider);
    check(hasPaidPremium($ids[0]),'Pagamento confirmado não liberou Premium.');
    $paidUser=query('SELECT * FROM users WHERE id=?',[$ids[0]])->fetch();
    check(canAccess('PREMIUM',$paidUser),'Acesso ao arquivo não reconhece compra paga.');
    $mediaId=(int)query("SELECT m.id FROM media m JOIN topics t ON t.id=m.topic_id WHERE t.access_type='PREMIUM' AND m.type='IMAGE' AND m.status=1 LIMIT 1")->fetchColumn();
    $fileUrl=signedFile(mediaRecord($mediaId),$paidUser);
    check(fileStatus($fileUrl)===206,'Arquivo Premium pago não foi entregue.');
    check((int)query('SELECT COUNT(*) FROM payment_events WHERE event_id=?',[$event['id']])->fetchColumn()===1,'Evento repetido.');
    check((int)query('SELECT is_premium FROM users WHERE id=?',[$ids[0]])->fetchColumn()===0,'Pagamento alterou o Premium manual.');
    $cancel=$event; $cancel['id']='test-'.bin2hex(random_bytes(12)); $cancel['event']='CHECKOUT_EXPIRED';
    billingApplyEvent($cancel,$config,$provider);
    check(hasPaidPremium($ids[0]),'Evento atrasado expirou compra paga.');
    $row=query('SELECT * FROM payments WHERE id=?',[$order['id']])->fetch();
    $refund=['id'=>'test-'.bin2hex(random_bytes(12)),'event'=>'PAYMENT_REFUNDED','payment'=>['id'=>$row['provider_payment_id']]];
    billingApplyEvent($refund,$config,$provider);
    check(!hasPaidPremium($ids[0]),'Estorno manteve o Premium financeiro.');
    check(fileStatus($fileUrl)===403,'Link de arquivo continuou válido após estorno.');
    $event['id']='test-'.bin2hex(random_bytes(12));
    billingApplyEvent($event,$config,$provider);
    check(!hasPaidPremium($ids[0]),'Pagamento atrasado reativou compra estornada.');
    try { billingCreateCheckout($ids[1],$config,$provider); throw new LogicException('Cobrou conta com Premium manual.'); }
    catch (RuntimeException $e) { check($e->getMessage()==='BILLING_PREMIUM','Falha inesperada no Premium manual.'); }
    check((int)query('SELECT is_premium FROM users WHERE id=?',[$ids[1]])->fetchColumn()===1,'Premium manual alterado.');
    echo "PASS: checkout reutilizado, valor confirmado, idempotência, ordem de eventos, estorno e Premium manual.\n";
} finally {
    foreach ($ids as $id) {
        query('DELETE FROM payment_events WHERE payment_id IN (SELECT id FROM payments WHERE user_id=?)',[$id]);
        query('DELETE FROM logs WHERE user_id=?',[$id]);
        query('DELETE FROM users WHERE id=?',[$id]);
    }
}
