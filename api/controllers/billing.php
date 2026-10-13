<?php
function billingController(string $route, string $method): void {
    if (!str_starts_with($route,'/billing/') && $route!=='/webhooks/asaas') return;
    $config=billingConfig();
    if ($route==='/webhooks/asaas' && $method==='POST') {
        $secret=$config['webhook_token'];
        if (!is_string($secret) || strlen($secret)<32 || !hash_equals($secret,$_SERVER['HTTP_ASAAS_ACCESS_TOKEN'] ?? ''))
            respond(['error'=>'Webhook não autorizado.'],401);
        if (!billingTablesReady()) respond(['error'=>'Instale a estrutura de pagamentos.'],503);
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>262144) respond(['error'=>'Evento muito grande.'],413);
        try { billingApplyEvent(input(),$config,new AsaasProvider($config)); }
        catch (InvalidArgumentException $e) { respond(['error'=>'Evento inválido.'],422); }
        catch (RuntimeException $e) { error_log('[Mamografia billing] '.$e->getMessage()); respond(['error'=>'Aguarde e reenvie o evento.'],503); }
        respond(['received'=>true]);
    }
    $user=currentUser(true);
    if ($route==='/billing/offer' && $method==='GET') {
        $enabled=billingEnabled($config);
        respond(['enabled'=>$enabled,'amount_cents'=>$enabled?$config['price_cents']:null,'purchase_type'=>'ONE_TIME',
            'test_mode'=>$config['environment']==='sandbox','is_premium'=>$user['premium_permanent']]);
    }
    if ($route==='/billing/checkout' && $method==='POST') {
        if (!billingEnabled($config)) respond(['error'=>'Pagamento ainda não disponível. Entre em contato com o suporte.'],503);
        rateLimit('billing-checkout-'.$user['id'],10);
        // Valor e conta são sempre definidos pelo servidor; campos enviados pelo app são ignorados.
        try { respond(billingCreateCheckout((int)$user['id'],$config,new AsaasProvider($config))); }
        catch (RuntimeException $e) {
            if ($e->getMessage()==='BILLING_PREMIUM') respond(['error'=>'Sua conta já tem Premium.'],409);
            if ($e->getMessage()==='BILLING_RECONCILE') respond(['error'=>'Seu checkout está em confirmação. Aguarde ou entre em contato com o suporte.'],409);
            error_log('[Mamografia billing] '.$e->getMessage());
            respond(['error'=>'Não foi possível abrir o pagamento. Tente novamente mais tarde.'],502);
        }
    }
    if ($route==='/billing/status' && $method==='GET') {
        $row=billingTablesReady()?query('SELECT * FROM payments WHERE user_id=? ORDER BY id DESC LIMIT 1',[$user['id']])->fetch():false;
        respond(['user'=>publicUser($user),'payment'=>$row?billingPublicPayment($row):null]);
    }
}
