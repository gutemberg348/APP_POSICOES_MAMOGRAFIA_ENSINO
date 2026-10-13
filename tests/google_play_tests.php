<?php
// Banco local + Google simulado. Nunca cria compras reais.
require dirname(__DIR__).'/api/helpers/http.php';
require dirname(__DIR__).'/api/config/database.php';
require dirname(__DIR__).'/api/services/asaas.php';
require dirname(__DIR__).'/api/services/google-play.php';
require dirname(__DIR__).'/api/controllers/management.php';
require dirname(__DIR__).'/api/middleware/auth.php';
require dirname(__DIR__).'/api/models/media.php';
function expect(bool $value,string $message): void { if (!$value) throw new LogicException($message); }
function rejects(callable $fn,string $code): void {
    try { $fn(); } catch (InvalidArgumentException|RuntimeException $e) { expect($e->getMessage()===$code,'Unexpected rejection: '.$e->getMessage()); return; }
    throw new LogicException('Accepted invalid case: '.$code);
}
$ids=[]; $revoked=[];
try {
    for ($i=0;$i<4;$i++) {
        query('INSERT INTO users(name,email,password_hash,is_premium) VALUES(?,?,?,?)',
            ['Teste Google Play','play-'.bin2hex(random_bytes(8)).'@example.test',password_hash(bin2hex(random_bytes(12)),PASSWORD_DEFAULT),$i===2?1:0]);
        $ids[]=(int)database()->lastInsertId();
    }
    $config=playConfig(); $config['allow_test_purchases']=false;
    $accounts=array_map('playAccountId',$ids);
    expect(playAccountId($ids[0])===$accounts[0],'Account id must survive login/device changes');
    expect(count(array_unique($accounts))===4,'Accounts not isolated');
    $token='test-'.bin2hex(random_bytes(64)); $ack=0; $failAck=false;
    $purchase=['productLineItem'=>[['productId'=>$config['product_id'],'productOfferDetails'=>['quantity'=>1,'refundableQuantity'=>1]]],
        'obfuscatedExternalAccountId'=>$accounts[0],'purchaseStateContext'=>['purchaseState'=>'PENDING'],
        'acknowledgementState'=>'ACKNOWLEDGEMENT_STATE_PENDING','orderId'=>'GPA.test'];
    $provider=new GooglePlayProvider($config,function($method,$path,$body) use (&$purchase,&$ack,&$failAck,$config) {
        expect(str_starts_with($path,'applications/'.$config['package_name'].'/'),'Package must come from server');
        if ($method==='POST') {
            expect(str_ends_with($path,':acknowledge'),'Must acknowledge, never consume');
            if ($failAck) throw new RuntimeException('PLAY_UNAVAILABLE');
            $ack++; $purchase['acknowledgementState']='ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED'; return [];
        }
        expect(str_contains($path,'/purchases/productsv2/tokens/'),'Must verify with Google V2');
        return $purchase;
    });
    $result=playVerifyPurchase($ids[0],$token,$config,$provider);
    expect($result['status']==='PENDING' && $ack===0 && !hasPaidPremium($ids[0]),'Pending purchase granted access');
    $purchase['purchaseStateContext']['purchaseState']='PURCHASED';
    $purchase['productLineItem'][0]['productId']='wrong.product';
    rejects(fn()=>playVerifyPurchase($ids[0],$token,$config,$provider),'PLAY_PRODUCT');
    $purchase['productLineItem'][0]['productId']=$config['product_id'];
    rejects(fn()=>playVerifyPurchase($ids[1],$token,$config,$provider),'PLAY_ACCOUNT');
    $failAck=true;
    rejects(fn()=>playVerifyPurchase($ids[0],$token,$config,$provider),'PLAY_UNAVAILABLE');
    expect(!hasPaidPremium($ids[0]),'Failed acknowledgement granted access');
    $failAck=false;
    $result=playVerifyPurchase($ids[0],$token,$config,$provider);
    expect($result['status']==='PAID' && $ack===1 && hasPaidPremium($ids[0]),'Verified purchase did not grant access');
    playVerifyPurchase($ids[0],$token,$config,$provider);
    expect($ack===1 && (int)query('SELECT COUNT(*) FROM google_play_purchases WHERE token_hash=?',[hash('sha256',$token)])->fetchColumn()===1,'Restore duplicated purchase');
    $rawUser=query('SELECT * FROM users WHERE id=?',[$ids[0]])->fetch();
    expect(canAccess('PREMIUM',$rawUser),'Raw signed-file gate ignores Play purchase');
    expect((int)$rawUser['is_premium']===0,'Purchase changed manual entitlement');

    $notification=['packageName'=>$config['package_name'],'voidedPurchaseNotification'=>['purchaseToken'=>$token,'productType'=>2,'refundType'=>1]];
    $envelope=['message'=>['data'=>base64_encode(json_encode($notification))]];
    $revoked[]=hash('sha256',$token);
    playApplyNotification($envelope,$config,$provider); playApplyNotification($envelope,$config,$provider);
    expect(!hasPaidPremium($ids[0]) && !canAccess('PREMIUM',$rawUser),'Refund did not revoke access');
    playVerifyPurchase($ids[0],$token,$config,$provider);
    expect(!hasPaidPremium($ids[0]),'Late purchase replay reactivated refunded token');

    $purchase['obfuscatedExternalAccountId']=$accounts[1];
    $purchase['testPurchaseContext']=['fopType'=>'TEST'];
    $testToken='test-'.bin2hex(random_bytes(64));
    rejects(fn()=>playVerifyPurchase($ids[1],$testToken,$config,$provider),'PLAY_TEST_DISABLED');
    $testing=$config; $testing['allow_test_purchases']=true;
    playVerifyPurchase($ids[1],$testToken,$testing,$provider);
    expect(!hasPaidPremium($ids[1]),'Production admits a test purchase');
    unset($purchase['testPurchaseContext']);
    $purchase['obfuscatedExternalAccountId']=$accounts[2];
    $manualToken='test-'.bin2hex(random_bytes(64));
    playVerifyPurchase($ids[2],$manualToken,$config,$provider);
    $notification['voidedPurchaseNotification']['purchaseToken']=$manualToken;
    $revoked[]=hash('sha256',$manualToken);
    playApplyNotification(['message'=>['data'=>base64_encode(json_encode($notification))]],$config,$provider);
    expect(canAccess('PREMIUM',query('SELECT * FROM users WHERE id=?',[$ids[2]])->fetch()),'Refund removed manual Premium');

    // RTDN can complete a purchase after the app disconnects, before client verification.
    $purchase['obfuscatedExternalAccountId']=$accounts[0];
    $notification=['packageName'=>$config['package_name'],'oneTimeProductNotification'=>['sku'=>$config['product_id'],'purchaseToken'=>'test-'.bin2hex(random_bytes(64)),'notificationType'=>1]];
    $envelope=['message'=>['data'=>base64_encode(json_encode($notification))]];
    playApplyNotification($envelope,$config,$provider);
    expect(hasPaidPremium($ids[0]),'Server notification did not recover disconnected purchase');
    $earlyToken='test-'.bin2hex(random_bytes(64));
    $revoked[]=hash('sha256',$earlyToken);
    playApplyNotification(['message'=>['data'=>base64_encode(json_encode(['packageName'=>$config['package_name'],
        'voidedPurchaseNotification'=>['purchaseToken'=>$earlyToken,'productType'=>2,'refundType'=>1]]))]],$config,$provider);
    $early=playVerifyPurchase($ids[0],$earlyToken,$config,$provider);
    expect($early['status']==='VOIDED','Early refund before client confirmation was ignored');
    $notification['packageName']='foreign.app';
    rejects(fn()=>playApplyNotification(['message'=>['data'=>base64_encode(json_encode($notification))]],$config,$provider),'PLAY_PRODUCT');

    // A client can buy during a free trial, without restarting its deadline.
    query('INSERT INTO premium_trials(user_id,started_at,ends_at) VALUES(?,UTC_TIMESTAMP(),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 7 DAY))',[$ids[3]]);
    $trialUser=query('SELECT * FROM users WHERE id=?',[$ids[3]])->fetch();
    $before=publicUser($trialUser);
    expect($before['is_premium']===1 && $before['trial_active'] && !$before['premium_permanent'],'Trial did not grant temporary access');
    $purchase['obfuscatedExternalAccountId']=$accounts[3];
    $trialToken='test-'.bin2hex(random_bytes(64));
    $purchase['purchaseStateContext']['purchaseState']='PENDING';
    playVerifyPurchase($ids[3],$trialToken,$config,$provider);
    expect(!publicUser($trialUser)['premium_permanent'],'Pending purchase converted trial to permanent');
    $purchase['purchaseStateContext']['purchaseState']='PURCHASED';
    playVerifyPurchase($ids[3],$trialToken,$config,$provider);
    $bought=publicUser($trialUser);
    expect($bought['is_premium']===1 && $bought['premium_permanent'] && !$bought['trial_active'],'Purchase during trial not permanent');
    expect($bought['trial_ends_at']===$before['trial_ends_at'],'Purchase restarted trial');
    $revoked[]=hash('sha256',$trialToken);
    playApplyNotification(['message'=>['data'=>base64_encode(json_encode(['packageName'=>$config['package_name'],
        'voidedPurchaseNotification'=>['purchaseToken'=>$trialToken,'productType'=>2,'refundType'=>1]]))]],$config,$provider);
    expect(publicUser($trialUser)['trial_active'] && !publicUser($trialUser)['premium_permanent'],'Refund removed unexpired trial');
    query('UPDATE premium_trials SET ends_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE user_id=?',[$ids[3]]);
    expect(!publicUser($trialUser)['is_premium'] && !canAccess('PREMIUM',$trialUser),'Expired trial still grants access');
    query('UPDATE users SET is_premium=1 WHERE id=?',[$ids[3]]);
    expect(publicUser(query('SELECT * FROM users WHERE id=?',[$ids[3]])->fetch())['premium_permanent'],'Trial expiration revoked manual grant');

    // Real RSA signatures, with local keys only. No call to Google.
    $options=['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA];
    if (is_file('C:/xampp/php/extras/ssl/openssl.cnf')) $options['config']='C:/xampp/php/extras/ssl/openssl.cnf';
    $key=openssl_pkey_new($options);
    expect($key!==false,'RSA key generation failed');
    $public=openssl_pkey_get_details($key)['key'];
    $identity=$config; $identity['notification_audience']='https://example.test/play';
    $identity['notification_service_account_email']='push@example.test';
    $claims=['iss'=>'https://accounts.google.com','aud'=>$identity['notification_audience'],'email'=>'push@example.test','email_verified'=>true,'iat'=>time(),'exp'=>time()+600];
    $sign=function(array $claims,array $header=['alg'=>'RS256','kid'=>'test-key']) use ($key): string {
        $body=playBase64(json_encode($header)).'.'.playBase64(json_encode($claims));
        openssl_sign($body,$signature,$key,OPENSSL_ALGO_SHA256); return $body.'.'.playBase64($signature);
    };
    playVerifyNotificationIdentity($sign($claims),$identity,['test-key'=>$public]);
    foreach (['aud'=>'wrong','email'=>'other@example.test','iss'=>'evil','email_verified'=>false,'exp'=>time()-1,'iat'=>time()+120] as $field=>$bad) {
        $wrong=$claims; $wrong[$field]=$bad;
        rejects(fn()=>playVerifyNotificationIdentity($sign($wrong),$identity,['test-key'=>$public]),'PLAY_NOTIFICATION_AUTH');
    }
    rejects(fn()=>playVerifyNotificationIdentity($sign($claims,['alg'=>'HS256','kid'=>'test-key']),$identity,['test-key'=>$public]),'PLAY_NOTIFICATION_AUTH');
    rejects(fn()=>playVerifyNotificationIdentity('not-a-jwt',$identity,['test-key'=>$public]),'PLAY_NOTIFICATION_AUTH');
    echo "PASS: Google verification, pending/ack failures, account binding, restore, refunds, delayed events, test isolation, manual Premium and signed Pub/Sub identity.\n";
} finally {
    foreach ($revoked as $hash) query('DELETE FROM google_play_revocations WHERE token_hash=?',[$hash]);
    foreach ($ids as $id) {
        query('DELETE FROM logs WHERE user_id=?',[$id]);
        query('DELETE FROM users WHERE id=?',[$id]);
    }
}
