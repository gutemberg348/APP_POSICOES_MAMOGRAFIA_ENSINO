<?php
function advertisingDefaults(): array {
    return ['partners_enabled'=>true,'google_enabled'=>false,'test_mode'=>true,'hide_for_premium'=>true,
        'admob_banner_id'=>'','adsense_enabled'=>false,'adsense_client'=>'','adsense_slot'=>'',
        'google_placements'=>['MEDIA'],'contact_email'=>''];
}
function advertisingSettings(): array {
    $saved = json_decode(query('SELECT value FROM settings WHERE `key`="advertising_config"')->fetchColumn() ?: '{}',true);
    return array_replace(advertisingDefaults(), is_array($saved) ? $saved : []);
}
function promotionAsset(?string $path): ?string {
    return $path ? appConfig()['base_url'] . '/api/index.php?route=/promotion-file&name=' . basename($path) : null;
}
function serializePromotion(array $row): array {
    foreach (['id','partner_id','status','order_position'] as $field) if (isset($row[$field])) $row[$field]=(int)$row[$field];
    if (array_key_exists('logo_path',$row)) { $row['logo_url']=promotionAsset($row['logo_path']); unset($row['logo_path']); }
    if (array_key_exists('image_path',$row)) { $row['image_url']=promotionAsset($row['image_path']); unset($row['image_path']); }
    if (isset($row['placements'])) $row['placements']=json_decode($row['placements'],true);
    return $row;
}
function promotionText(array $data, string $key, int $max, bool $required=false): string {
    if (isset($data[$key]) && !is_scalar($data[$key])) respond(['error'=>'Texto inválido: '.$key],422);
    $value=trim((string)($data[$key] ?? ''));
    if (($required && $value==='') || mb_strlen($value)>$max) respond(['error'=>'Revise o campo '.$key.'.'],422);
    return $value;
}
function promotionUrl(array $data,string $key,bool $required=false): string {
    $url=promotionText($data,$key,1000,$required);
    if ($url && (!filter_var($url,FILTER_VALIDATE_URL) || parse_url($url,PHP_URL_SCHEME)!=='https' || parse_url($url,PHP_URL_USER) || parse_url($url,PHP_URL_PASS))) respond(['error'=>'Informe um endereço HTTPS válido.'],422);
    return $url;
}
function promotionPlacements($value): array {
    if (is_string($value)) $value=json_decode($value,true);
    if (!is_array($value) || !$value || count($value)>4 || array_filter($value,fn($v)=>!is_string($v) || !in_array($v,['HOME','MEDIA','CONTENT','PARTNERS'],true))) respond(['error'=>'Selecione pelo menos um local de exibição válido.'],422);
    return array_values(array_unique($value));
}
function promotionDate($value): ?string {
    if (!$value) return null;
    $date=is_string($value) ? DateTimeImmutable::createFromFormat('!Y-m-d',$value) : false;
    if (!$date || $date->format('Y-m-d')!==$value) respond(['error'=>'Data de campanha inválida.'],422);
    return $value;
}
function promotionUpload(string $field): ?string {
    $file=$_FILES[$field] ?? null;
    if (!$file || $file['error']===UPLOAD_ERR_NO_FILE) return null;
    if ($file['error']!==UPLOAD_ERR_OK || $file['size']>5*1024*1024) respond(['error'=>'Envie uma imagem de até 5 MB.'],422);
    $mime=(new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $info=@getimagesize($file['tmp_name']);
    if (!in_array($mime,['image/jpeg','image/png','image/webp']) || !$info || $info[0]*$info[1]>16000000) respond(['error'=>'Use uma imagem JPG, PNG ou WebP válida, com até 16 megapixels.'],422);
    $image=@imagecreatefromstring(file_get_contents($file['tmp_name']));
    if (!$image) respond(['error'=>'Não foi possível ler a imagem.'],422);
    $scale=min(1,1600/max($info[0],$info[1]));
    if ($scale<1) { $scaled=imagescale($image,max(1,(int)($info[0]*$scale)),max(1,(int)($info[1]*$scale))); imagedestroy($image); $image=$scaled; }
    $path='uploads/promotions/'.bin2hex(random_bytes(16)).'.webp';
    $dir=dirname(__DIR__,2).'/uploads/promotions';
    if (!is_dir($dir)) mkdir($dir,0755,true);
    $saved=imagewebp($image,dirname(__DIR__,2).'/'.$path,88); imagedestroy($image);
    if (!$saved) respond(['error'=>'Não foi possível salvar a imagem.'],500);
    return $path;
}
function advertisingController(string $route,string $method): void {
    if ($route==='/promotion-file' && in_array($method,['GET','HEAD'])) {
        $name=$_GET['name'] ?? '';
        if (!is_string($name) || !preg_match('/^[a-f0-9]{32}\.webp$/D',$name)) respond(['error'=>'Imagem não encontrada.'],404);
        $path=dirname(__DIR__,2).'/uploads/promotions/'.$name;
        if (!is_file($path)) respond(['error'=>'Imagem não encontrada.'],404);
        header('Content-Type: image/webp');header('Cache-Control: public, max-age=86400');header('Content-Length: '.filesize($path));
        if ($method==='GET') readfile($path); exit;
    }
    if ($route==='/advertising' && $method==='GET') {
        $settings=advertisingSettings(); $user=currentUser();
        $premium=$user && ($user['role']==='ADMIN' || $user['is_premium']);
        $hidden=$settings['hide_for_premium'] && $premium;
        $partners=$settings['partners_enabled'] ? query('SELECT * FROM partners WHERE status=1 ORDER BY order_position,id')->fetchAll() : [];
        $banners=(!$hidden && $settings['partners_enabled']) ? query('SELECT b.*,p.name AS partner_name,p.logo_path FROM banners b JOIN partners p ON p.id=b.partner_id WHERE b.status=1 AND p.status=1 AND (b.start_on IS NULL OR b.start_on<=UTC_DATE()) AND (b.end_on IS NULL OR b.end_on>=UTC_DATE()) ORDER BY b.order_position,b.id')->fetchAll() : [];
        if ($hidden) { $settings['google_enabled']=false; $settings['adsense_enabled']=false; }
        respond(['settings'=>$settings,'partners'=>array_map('serializePromotion',$partners),'banners'=>array_map('serializePromotion',$banners)]);
    }
    if (!in_array($route,['/admin/advertising','/admin/partners','/admin/banners']) && !preg_match('#^/admin/(partners|banners)/\d+$#',$route)) return;
    $user=currentUser(true,true);
    if ($route==='/admin/advertising') {
        if ($method==='GET') respond(advertisingSettings());
        if ($method==='PUT') {
            $data=input();$config=advertisingDefaults();
            foreach (['partners_enabled','google_enabled','test_mode','hide_for_premium','adsense_enabled'] as $key) {
                if (!isset($data[$key]) || !is_bool($data[$key])) respond(['error'=>'Configuração inválida: '.$key],422);
                $config[$key]=$data[$key];
            }
            foreach (['admob_banner_id','adsense_client','adsense_slot','contact_email'] as $key) $config[$key]=promotionText($data,$key,190);
            foreach (['admob_banner_id'=>'/^ca-app-pub-\d{16}\/\d{10}$/D','adsense_client'=>'/^ca-pub-\d{16}$/D','adsense_slot'=>'/^\d{10}$/D'] as $key=>$pattern) if ($config[$key] && !preg_match($pattern,$config[$key])) respond(['error'=>'Identificador inválido: '.$key],422);
            if ($config['contact_email'] && !filter_var($config['contact_email'],FILTER_VALIDATE_EMAIL)) respond(['error'=>'E-mail comercial inválido.'],422);
            if ($config['google_enabled'] && !$config['test_mode'] && !$config['admob_banner_id']) respond(['error'=>'Informe o ID do banner AdMob para ativar anúncios reais.'],422);
            if ($config['adsense_enabled'] && (!$config['adsense_client'] || !$config['adsense_slot'])) respond(['error'=>'Informe o editor e o bloco do AdSense.'],422);
            $config['google_placements']=promotionPlacements($data['google_placements'] ?? []);
            query('INSERT INTO settings(`key`,value) VALUES("advertising_config",?) ON DUPLICATE KEY UPDATE value=VALUES(value)',[json_encode($config)]);
            query('INSERT INTO logs(user_id,action,details) VALUES(?,"ADVERTISING_UPDATED",?)',[$user['id'],json_encode(['google_enabled'=>$config['google_enabled']])]);
            respond($config);
        }
        respond(['error'=>'Método não permitido.'],405);
    }
    preg_match('#^/admin/(partners|banners)(?:/(\d+))?$#',$route,$match);
    $table=$match[1]; $id=(int)($match[2] ?? 0);
    $existing=$id ? query("SELECT * FROM $table WHERE id=? AND status<>2",[$id])->fetch() : null;
    if ($id && !$existing) respond(['error'=>'Cadastro não encontrado.'],404);
    if ($method==='GET') {
        $rows=query($table==='partners' ? 'SELECT * FROM partners WHERE status<>2 ORDER BY order_position,id DESC' : 'SELECT b.*,p.name AS partner_name,p.logo_path,p.status AS partner_status FROM banners b JOIN partners p ON p.id=b.partner_id WHERE b.status<>2 ORDER BY b.order_position,b.id DESC')->fetchAll();
        respond(array_map('serializePromotion',$rows));
    }
    if ($id && $method==='DELETE') {
        query("UPDATE $table SET status=2 WHERE id=?",[$id]);
        query('INSERT INTO logs(user_id,action,details) VALUES(?,"PROMOTION_ARCHIVED",?)',[$user['id'],json_encode(['kind'=>$table,'id'=>$id])]);
        respond(['ok'=>true]);
    }
    if (!in_array($method,['POST','PUT']) || (!$id && $method!=='POST')) respond(['error'=>'Método não permitido.'],405);
    $data=array_replace($existing ?: [],$_POST ?: input());
    $status=filter_var($data['status'] ?? 0,FILTER_VALIDATE_INT);$order=filter_var($data['order_position'] ?? 0,FILTER_VALIDATE_INT);
    if (!in_array($status,[0,1],true) || $order===false || $order<0 || $order>9999) respond(['error'=>'Status ou ordem inválidos.'],422);
    if ($table==='partners') {
        $values=['name'=>promotionText($data,'name',120,true),'description'=>promotionText($data,'description',1000),'website'=>promotionUrl($data,'website'),'status'=>$status,'order_position'=>$order];
        $values['logo_path']=promotionUpload('logo') ?? ($existing['logo_path'] ?? null);
        if (($data['remove_logo'] ?? '')==='1') $values['logo_path']=null;
    } else {
        $partner=(int)($data['partner_id'] ?? 0);
        if (!query('SELECT id FROM partners WHERE id=? AND status<>2',[$partner])->fetch()) respond(['error'=>'Selecione um parceiro cadastrado.'],422);
        $start=promotionDate($data['start_on'] ?? null);$end=promotionDate($data['end_on'] ?? null);
        if ($start && $end && $end<$start) respond(['error'=>'O término deve ser igual ou posterior ao início.'],422);
        $values=['partner_id'=>$partner,'title'=>promotionText($data,'title',120,true),'description'=>promotionText($data,'description',300),'url'=>promotionUrl($data,'url',true),'cta'=>promotionText($data,'cta',40,true),'placements'=>json_encode(promotionPlacements($data['placements'] ?? [])),'start_on'=>$start,'end_on'=>$end,'status'=>$status,'order_position'=>$order];
        $values['image_path']=promotionUpload('image') ?? ($existing['image_path'] ?? null);
        if (($data['remove_image'] ?? '')==='1') $values['image_path']=null;
    }
    if ($id) query("UPDATE $table SET ".implode(',',array_map(fn($key)=>"$key=?",array_keys($values))).' WHERE id=?',[...array_values($values),$id]);
    else { query("INSERT INTO $table (".implode(',',array_keys($values)).') VALUES('.implode(',',array_fill(0,count($values),'?')).')',array_values($values)); $id=(int)database()->lastInsertId(); }
    query('INSERT INTO logs(user_id,action,details) VALUES(?,"PROMOTION_SAVED",?)',[$user['id'],json_encode(['kind'=>$table,'id'=>$id])]);
    respond(serializePromotion(query("SELECT * FROM $table WHERE id=?",[$id])->fetch()),$existing ? 200 : 201);
}
