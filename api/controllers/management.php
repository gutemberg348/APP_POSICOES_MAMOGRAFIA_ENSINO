<?php
function managementLog(int $actor, string $action, array $details = []): void {
    query('INSERT INTO logs(user_id,action,details) VALUES(?,?,?)', [$actor,$action,json_encode($details,JSON_UNESCAPED_UNICODE)]);
}
function managementPassword(array $data): string {
    $password=$data['password'] ?? '';
    if (!is_string($password) || strlen($password)<8 || strlen($password)>72) respond(['error'=>'Use uma senha entre 8 e 72 bytes.'],422);
    return password_hash($password,PASSWORD_DEFAULT);
}
function managementIdentity(array $data): array {
    $name=promotionText($data,'name',120,true);
    $email=strtolower(promotionText($data,'email',190,true));
    if (!filter_var($email,FILTER_VALIDATE_EMAIL)) respond(['error'=>'Informe um e-mail válido.'],422);
    return [$name,$email];
}
function managementFlag(array $data,string $key): int {
    if (!isset($data[$key]) || !in_array($data[$key],[0,1],true)) respond(['error'=>'Opção inválida: '.$key],422);
    return $data[$key];
}
function managedUser(int $id): array {
    $row=query("SELECT u.id,u.name,u.email,u.role,u.is_premium,u.premium_since,u.status,u.created_at,u.updated_at,
        (SELECT COUNT(*) FROM favorites f WHERE f.user_id=u.id) AS favorites_count,
        (SELECT COUNT(*) FROM auth_tokens a WHERE a.user_id=u.id AND a.expires_at>NOW()) AS sessions_count,
        (SELECT MAX(l.created_at) FROM logs l WHERE l.user_id=u.id AND l.action='AUTH_LOGIN') AS last_login
        FROM users u WHERE u.id=?",[$id])->fetch();
    if (!$row) respond(['error'=>'Cliente não encontrado.'],404);
    foreach (['id','is_premium','status','favorites_count','sessions_count'] as $key) $row[$key]=(int)$row[$key];
    return $row + premiumTrial($id);
}
function analyticsReady(): bool {
    return (bool)query("SHOW TABLES LIKE 'analytics_events'")->fetchColumn();
}
function siteSettings(): array {
    $keys=['app_name','footer_notice','premium_title','premium_description','support_email','privacy_url','terms_url','analytics_enabled'];
    $saved=array_column(query('SELECT `key`,value FROM settings')->fetchAll(),'value','key');
    return array_replace(array_fill_keys($keys,''),array_intersect_key($saved,array_flip($keys)),[
        'analytics_enabled'=>$saved['analytics_enabled'] ?? '1',
        'premium_price_cents'=>(string)billingConfig()['price_cents'],
        'premium_purchase_type'=>'ONE_TIME',
        'premium_trial_days'=>(string)premiumTrialDays(),
    ]);
}
function managementController(string $route,string $method): void {
    if ($route==='/analytics/visit' && $method==='POST') {
        if ((currentUser()['role'] ?? '')==='ADMIN' || siteSettings()['analytics_enabled']!=='1' || !analyticsReady()) respond(['collected'=>false],202);
        rateLimit('/analytics/visit',180);
        $data=input();
        $screen=$data['screen'] ?? ''; $device=$data['device'] ?? '';
        if (!in_array($screen,['home','media','favorites','profile','topic','category','partners'],true) || !in_array($device,['mobile','desktop'],true)) respond(['error'=>'Visita inválida.'],422);
        foreach (['visitor','event_id'] as $key) if (!is_string($data[$key] ?? null) || !preg_match('/^[a-f0-9-]{32,36}$/D',$data[$key])) respond(['error'=>'Identificador inválido.'],422);
        $hash=hash_hmac('sha256',$data['visitor'],appConfig()['signing_key']);
        query('INSERT IGNORE INTO analytics_events(event_id,visitor_hash,screen,device,created_at) VALUES(?,?,?,?,UTC_TIMESTAMP())',[$data['event_id'],$hash,$screen,$device]);
        respond(['collected'=>true],202);
    }
    if (!in_array($route,['/admin/dashboard','/admin/users','/admin/settings','/admin/account'],true) && !preg_match('#^/admin/users/\d+(?:/password)?$#',$route)) return;
    $actor=currentUser(true,true);
    if ($route==='/admin/dashboard' && $method==='GET') {
        $days=(int)($_GET['days'] ?? 30); if (!in_array($days,[7,30,90],true)) $days=30;
        $since=gmdate('Y-m-d',strtotime('-'.($days-1).' days'));
        $customers=query("SELECT COUNT(*) AS total,COALESCE(SUM(status=1),0) AS active,COALESCE(SUM(status=0),0) AS blocked,COALESCE(SUM(status=1 AND is_premium=1),0) AS premium FROM users WHERE role='USER'")->fetch();
        $new=(int)query("SELECT COUNT(*) FROM users WHERE role='USER' AND created_at>=?",[$since])->fetchColumn();
        $catalog=query("SELECT COUNT(*) AS total,COALESCE(SUM(type='IMAGE'),0) AS images,COALESCE(SUM(type<>'IMAGE'),0) AS videos FROM media WHERE status=1")->fetch();
        $promotions=query("SELECT (SELECT COUNT(*) FROM partners WHERE status=1) AS partners,COUNT(*) AS campaigns FROM banners b JOIN partners p ON p.id=b.partner_id WHERE b.status=1 AND p.status=1 AND (b.start_on IS NULL OR b.start_on<=UTC_DATE()) AND (b.end_on IS NULL OR b.end_on>=UTC_DATE())")->fetch();
        $ready=analyticsReady(); $traffic=['views'=>0,'visitors'=>0]; $daily=[];$popular=[];$devices=[];
        if ($ready) {
            $traffic=query('SELECT COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM analytics_events WHERE created_at>=?',[$since])->fetch();
            $daily=query('SELECT DATE(created_at) AS day,COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM analytics_events WHERE created_at>=? GROUP BY DATE(created_at) ORDER BY day',[$since])->fetchAll();
            $popular=query('SELECT screen,COUNT(*) AS views FROM analytics_events WHERE created_at>=? GROUP BY screen ORDER BY views DESC',[$since])->fetchAll();
            $devices=query('SELECT device,COUNT(*) AS views FROM analytics_events WHERE created_at>=? GROUP BY device',[$since])->fetchAll();
        }
        $activity=query("SELECT l.id,l.action,l.created_at,u.name AS actor_name FROM logs l LEFT JOIN users u ON u.id=l.user_id WHERE l.action NOT IN ('AUTH_LOGIN','AUTH_REGISTER') ORDER BY l.id DESC LIMIT 8")->fetchAll();
        respond(compact('days','since','customers','new','catalog','promotions','traffic','daily','popular','devices','activity')+['analytics_ready'=>$ready,'analytics_enabled'=>siteSettings()['analytics_enabled']==='1']);
    }
    if ($route==='/admin/users' && $method==='GET') {
        $where=[];$params=[];
        $role=$_GET['role'] ?? 'USER';
        if (in_array($role,['USER','ADMIN'],true)) { $where[]='u.role=?';$params[]=$role; }
        elseif ($role!=='ALL') respond(['error'=>'Perfil inválido.'],422);
        if (isset($_GET['status']) && in_array($_GET['status'],['0','1'],true)) {$where[]='u.status=?';$params[]=(int)$_GET['status'];}
        if (in_array($_GET['access'] ?? '',['FREE','PREMIUM'],true)) {$where[]='u.is_premium=?';$params[]=$_GET['access']==='PREMIUM'?1:0;}
        $q=trim((string)($_GET['q'] ?? ''));
        if ($q!=='') {$where[]='(u.name LIKE ? OR u.email LIKE ?)';$params[]='%'.mb_substr($q,0,190).'%';$params[]='%'.mb_substr($q,0,190).'%';}
        $filter=$where?' WHERE '.implode(' AND ',$where):'';
        $page=max(1,(int)($_GET['page'] ?? 1));$limit=20;$offset=($page-1)*$limit;
        $total=(int)query('SELECT COUNT(*) FROM users u'.$filter,$params)->fetchColumn();
        $rows=query("SELECT u.id,u.name,u.email,u.role,u.is_premium,u.status,u.created_at,(SELECT MAX(l.created_at) FROM logs l WHERE l.user_id=u.id AND l.action='AUTH_LOGIN') AS last_login FROM users u".$filter." ORDER BY u.created_at DESC,u.id DESC LIMIT $limit OFFSET $offset",$params)->fetchAll();
        respond(['data'=>$rows,'total'=>$total,'page'=>$page,'pages'=>(int)ceil($total/$limit)]);
    }
    if ($route==='/admin/users' && $method==='POST') {
        $data=input();[$name,$email]=managementIdentity($data);$hash=managementPassword($data);
        $premium=managementFlag($data,'is_premium');
        if (query('SELECT id FROM users WHERE email=?',[$email])->fetch()) respond(['error'=>'Este e-mail já está cadastrado.'],409);
        database()->beginTransaction();
        query('INSERT INTO users(name,email,password_hash,is_premium,premium_since) VALUES(?,?,?,?,IF(?=1,NOW(),NULL))',[$name,$email,$hash,$premium,$premium]);
        $id=(int)database()->lastInsertId();
        managementLog((int)$actor['id'],'CLIENT_CREATED',['client_id'=>$id]);database()->commit();
        respond(managedUser($id),201);
    }
    if (preg_match('#^/admin/users/(\d+)(/password)?$#',$route,$m)) {
        $id=(int)$m[1];$row=managedUser($id);
        if ($method==='GET' && empty($m[2])) {
            $row['favorites']=query('SELECT m.id,m.title,m.type FROM favorites f JOIN media m ON m.id=f.media_id WHERE f.user_id=? ORDER BY f.created_at DESC LIMIT 8',[$id])->fetchAll();
            $row['history']=query("SELECT l.action,l.created_at,u.name AS actor_name FROM logs l LEFT JOIN users u ON u.id=l.user_id WHERE (l.user_id=? AND l.action IN ('AUTH_LOGIN','AUTH_REGISTER','PREMIUM_TRIAL_STARTED')) OR CAST(JSON_UNQUOTE(JSON_EXTRACT(l.details,'$.client_id')) AS UNSIGNED)=? ORDER BY l.id DESC LIMIT 15",[$id,$id])->fetchAll();
            respond($row);
        }
        if ($row['role']==='ADMIN') respond(['error'=>'Use Minha conta nas configurações para editar seu administrador.'],403);
        if ($method==='PUT' && empty($m[2])) {
            $data=input();[$name,$email]=managementIdentity($data);$premium=managementFlag($data,'is_premium');$status=managementFlag($data,'status');
            if (query('SELECT id FROM users WHERE email=? AND id<>?',[$email,$id])->fetch()) respond(['error'=>'Este e-mail já está cadastrado.'],409);
            database()->beginTransaction();
            query('UPDATE users SET name=?,email=?,premium_since=IF(?=1,COALESCE(premium_since,NOW()),NULL),is_premium=?,status=? WHERE id=?',[$name,$email,$premium,$premium,$status,$id]);
            if ($status===0 || $row['email']!==$email) query('DELETE FROM auth_tokens WHERE user_id=?',[$id]);
            managementLog((int)$actor['id'],'CLIENT_UPDATED',['client_id'=>$id]);
            if ($premium!==$row['is_premium']) managementLog((int)$actor['id'],$premium?'PREMIUM_GRANTED':'PREMIUM_REVOKED',['client_id'=>$id]);
            if ($status!==$row['status']) managementLog((int)$actor['id'],$status?'CLIENT_ACTIVATED':'CLIENT_BLOCKED',['client_id'=>$id]);
            database()->commit();respond(managedUser($id));
        }
        if ($method==='PUT' && !empty($m[2])) {
            $hash=managementPassword(input());database()->beginTransaction();
            query('UPDATE users SET password_hash=? WHERE id=?',[$hash,$id]);query('DELETE FROM auth_tokens WHERE user_id=?',[$id]);
            managementLog((int)$actor['id'],'CLIENT_PASSWORD_CHANGED',['client_id'=>$id]);database()->commit();respond(['ok'=>true]);
        }
    }
    if ($route==='/admin/settings') {
        if ($method==='GET') respond(siteSettings());
        if ($method==='PUT') {
            $data=input();$settings=[];
            foreach (['app_name'=>120,'footer_notice'=>4000,'premium_title'=>190,'premium_description'=>4000,'support_email'=>190] as $key=>$max) $settings[$key]=promotionText($data,$key,$max,in_array($key,['app_name','footer_notice'],true));
            if ($settings['support_email'] && !filter_var($settings['support_email'],FILTER_VALIDATE_EMAIL)) respond(['error'=>'E-mail de suporte inválido.'],422);
            foreach (['privacy_url','terms_url'] as $key) $settings[$key]=promotionUrl($data,$key);
            if (!in_array($data['analytics_enabled'] ?? null,['0','1'],true)) respond(['error'=>'Opção de métricas inválida.'],422);
            $settings['analytics_enabled']=$data['analytics_enabled'];
            if (isset($data['premium_purchase_type']) && $data['premium_purchase_type']!=='ONE_TIME')
                respond(['error'=>'O Premium possui somente pagamento único.'],422);
            if (array_key_exists('premium_price_cents',$data)) {
                $price=$data['premium_price_cents'];
                if ((!is_string($price) && !is_int($price)) || !preg_match('/^(0|[1-9][0-9]{0,8})$/D',(string)$price)
                    || (int)$price>100000000 || ((int)$price>0 && (int)$price<100))
                    respond(['error'=>'Informe um preço entre R$ 1,00 e R$ 1.000.000,00, ou zero para deixar a compra indisponível.'],422);
                $settings['premium_price_cents']=(string)$price;
            }
            if (array_key_exists('premium_trial_days',$data)) {
                $days=$data['premium_trial_days'];
                if ((!is_string($days) && !is_int($days)) || !preg_match('/^(0|[1-9][0-9]{0,2})$/D',(string)$days) || (int)$days>365)
                    respond(['error'=>'Informe entre 0 e 365 dias de teste. Zero desativa novos testes.'],422);
                if ((int)$days>0 && !premiumTrialReady()) respond(['error'=>'Execute database/premium-trial.sql antes de habilitar o teste.'],503);
                $settings['premium_trial_days']=(string)$days;
            }
            database()->beginTransaction();
            foreach ($settings as $key=>$value) query('INSERT INTO settings(`key`,value) VALUES(?,?) ON DUPLICATE KEY UPDATE value=VALUES(value)',[$key,$value]);
            managementLog((int)$actor['id'],'SITE_SETTINGS_UPDATED',array_intersect_key($settings,array_flip(['premium_price_cents','premium_trial_days']))+['purchase_type'=>'ONE_TIME']);
            database()->commit();respond(siteSettings());
        }
    }
    if ($route==='/admin/account') {
        if ($method==='GET') respond(publicUser($actor));
        if ($method==='PUT') {
            $data=input();[$name,$email]=managementIdentity($data);
            if (query('SELECT id FROM users WHERE email=? AND id<>?',[$email,$actor['id']])->fetch()) respond(['error'=>'Este e-mail já está cadastrado.'],409);
            $hash=isset($data['password']) && $data['password']!=='' ? managementPassword($data) : null;
            database()->beginTransaction();query('UPDATE users SET name=?,email=? WHERE id=?',[$name,$email,$actor['id']]);
            if ($hash) {
                query('UPDATE users SET password_hash=? WHERE id=?',[$hash,$actor['id']]);
                $header=$_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';preg_match('/^Bearer (.+)$/i',$header,$match);
                query('DELETE FROM auth_tokens WHERE user_id=? AND token_hash<>?',[$actor['id'],hash('sha256',$match[1])]);
                managementLog((int)$actor['id'],'ADMIN_PASSWORD_CHANGED');
            }
            managementLog((int)$actor['id'],'ADMIN_ACCOUNT_UPDATED');database()->commit();respond(publicUser(query('SELECT * FROM users WHERE id=?',[$actor['id']])->fetch()));
        }
    }
    respond(['error'=>'Método não permitido.'],405);
}
