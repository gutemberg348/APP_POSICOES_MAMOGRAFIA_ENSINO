<?php
function googlePlayController(string $route,string $method): void {
    if (!str_starts_with($route,'/billing/google-play/') && $route!=='/webhooks/google-play') return;
    $config=playConfig();
    if ($route==='/webhooks/google-play' && $method==='POST') {
        if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0)>131072) respond(['error'=>'Evento muito grande.'],413);
        $header=$_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        $jwt=preg_match('/^Bearer (.+)$/i',$header,$m)?$m[1]:'';
        try { playVerifyNotificationIdentity($jwt,$config); }
        catch (InvalidArgumentException $e) { respond(['error'=>'Notificação não autorizada.'],401); }
        catch (RuntimeException $e) { respond(['error'=>'Notificações Google Play ainda não disponíveis.'],503); }
        if (!playEnabled($config)) respond(['error'=>'Configure o Google Play e instale a estrutura de pagamentos.'],503);
        try { playApplyNotification(input(),$config,new GooglePlayProvider($config)); }
        catch (InvalidArgumentException $e) { respond(['error'=>'Evento inválido.'],422); }
        catch (RuntimeException $e) { error_log('[Mamografia Google Play] '.$e->getMessage()); respond(['error'=>'Reenvie a notificação.'],503); }
        respond(['received'=>true]);
    }
    $user=currentUser(true);
    if ($route==='/billing/google-play/offer' && $method==='GET') {
        $enabled=(bool)playEnabled($config);
        respond(['enabled'=>$enabled,'product_id'=>$config['product_id'],'package_name'=>$config['package_name'],
            'purchase_type'=>'ONE_TIME','account_id'=>$enabled?playAccountId((int)$user['id']):null]);
    }
    if ($route==='/billing/google-play/verify' && $method==='POST') {
        if (!playEnabled($config)) respond(['error'=>'Compra pela Google Play em preparação.'],503);
        rateLimit('play-verify-'.$user['id'],60);
        $data=input();
        try {
            // Produto, pacote, conta e status são confirmados com Google, nunca com dados do cliente.
            $payment=playVerifyPurchase((int)$user['id'],playValidateToken($data['purchase_token'] ?? null),$config,new GooglePlayProvider($config));
            respond(['payment'=>$payment,'user'=>publicUser(currentUser(true))]);
        } catch (InvalidArgumentException $e) {
            $message=match($e->getMessage()) {
                'PLAY_ACCOUNT'=>'Esta compra pertence a outra conta do app. Entre na conta usada na compra.',
                'PLAY_TEST_DISABLED'=>'Compras de teste não estão habilitadas no servidor.',
                default=>'A Google Play não confirmou uma compra válida deste Premium.',
            };
            respond(['error'=>$message],422);
        } catch (RuntimeException $e) { error_log('[Mamografia Google Play] '.$e->getMessage()); respond(['error'=>'Não foi possível confirmar a compra. Tente restaurar novamente.'],503); }
    }
    respond(['error'=>'Endpoint não encontrado.'],404);
}
