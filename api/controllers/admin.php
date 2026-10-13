<?php
function validMediaData(array $data): array {
    $title = requiredText($data, 'title');
    $topic = !empty($data['topic_id']) ? (int)$data['topic_id'] : null;
    if ($topic && !query('SELECT id FROM topics WHERE id=?', [$topic])->fetch()) respond(['error' => 'Tópico inválido.'], 422);
    $access = $data['access_type'] ?? 'PREMIUM';
    if (!in_array($access, ['FREE','PREMIUM'])) respond(['error' => 'Acesso inválido.'], 422);
    $status = (int)($data['status'] ?? 1);
    if (!in_array($status, [0,1])) respond(['error' => 'Status inválido.'], 422);
    return [$title,$topic,mb_substr((string)($data['caption'] ?? ''),0,10000),mb_substr((string)($data['alt_text'] ?? $title),0,255),$access,$status,max(0,(int)($data['order_position'] ?? 0))];
}
function saveUpload(): array {
    $file = $_FILES['file'] ?? null;
    if (!$file || $file['error'] !== UPLOAD_ERR_OK) respond(['error' => 'Falha no upload. Confira os limites do PHP e tente novamente.'], 422);
    if ($file['size'] > appConfig()['upload_limit']) respond(['error' => 'Arquivo excede o limite configurado.'], 422);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $types = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp','video/mp4'=>'mp4','video/webm'=>'webm'];
    if (!isset($types[$mime])) respond(['error' => 'Use JPG, PNG, WebP, MP4 ou WebM.'], 422);
    $isImage = str_starts_with($mime, 'image/');
    $width = null; $height = null;
    if ($isImage) {
        $info = getimagesize($file['tmp_name']);
        if (!$info || $info[0]*$info[1] > 40000000) respond(['error' => 'Imagem inválida ou muito grande.'], 422);
        [$width,$height] = $info;
    }
    $relative = 'uploads/' . ($isImage ? 'images/' : 'videos/') . bin2hex(random_bytes(16)) . '.' . $types[$mime];
    $absolute = __DIR__ . '/../../' . $relative;
    if (!is_dir(dirname($absolute))) mkdir(dirname($absolute), 0755, true);
    if (!move_uploaded_file($file['tmp_name'], $absolute)) respond(['error' => 'Não foi possível salvar o arquivo.'], 500);
    $thumb = null;
    if ($isImage) {
        $image = imagecreatefromstring(file_get_contents($absolute));
        if ($image) {
            $scale = min(1,480/$width,480/$height);
            $small = imagescale($image,max(1,(int)($width*$scale)),max(1,(int)($height*$scale)));
            $thumb = 'uploads/thumbnails/' . pathinfo($relative, PATHINFO_FILENAME) . '.jpg';
            if (!is_dir(__DIR__ . '/../../uploads/thumbnails')) mkdir(__DIR__ . '/../../uploads/thumbnails',0755,true);
            imagejpeg($small,__DIR__ . '/../../' . $thumb,82); imagedestroy($image); imagedestroy($small);
        }
    }
    return [$isImage?'IMAGE':'VIDEO_UPLOAD',$relative,basename($file['name']),$mime,(int)$file['size'],$thumb,$width,$height];
}
function adminController(string $route, string $method): void {
    if (!str_starts_with($route, '/admin/') || $route === '/admin/login') return;
    $user = currentUser(true,true);
    if ($route === '/admin/media' && $method === 'POST') {
        $data = $_POST ?: input(); $values = validMediaData($data);
        $external = null;
        if (($data['type'] ?? '') === 'VIDEO_URL') {
            $external = requiredText($data,'external_url',1000);
            if (!filter_var($external,FILTER_VALIDATE_URL) || parse_url($external,PHP_URL_SCHEME) !== 'https') respond(['error' => 'Informe uma URL HTTPS válida.'],422);
            $file = ['VIDEO_URL',null,null,null,0,null,null,null];
        } else $file = saveUpload();
        query('INSERT INTO media(title,topic_id,caption,alt_text,access_type,status,order_position,type,file_path,original_name,mime_type,size,thumbnail_path,width,height,external_url) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', array_merge($values,$file,[$external]));
        $id = (int)database()->lastInsertId();
        if ($values[1]) query('INSERT IGNORE INTO content_media(content_id,media_id) SELECT id,? FROM contents WHERE topic_id=?',[$id,$values[1]]);
        query('INSERT INTO logs(user_id,action,details) VALUES(?,"MEDIA_CREATED",?)',[$user['id'],json_encode(['media_id'=>$id])]);
        respond(serializeMedia(mediaRecord($id),$user),201);
    }
    if (preg_match('#^/admin/media/(\d+)$#',$route,$m)) {
        $id = (int)$m[1]; $existing = mediaRecord($id);
        if ($method === 'PUT') {
            $data=input(); $values=validMediaData($data);
            $url=null;
            if ($existing['type']==='VIDEO_URL') {
                $url=requiredText($data,'external_url',1000);
                if (!filter_var($url,FILTER_VALIDATE_URL) || parse_url($url,PHP_URL_SCHEME)!=='https') respond(['error'=>'URL HTTPS inválida.'],422);
            }
            database()->beginTransaction();
            query('UPDATE media SET title=?,topic_id=?,caption=?,alt_text=?,access_type=?,status=?,order_position=? WHERE id=?',array_merge($values,[$id]));
            if ($url !== null) query('UPDATE media SET external_url=? WHERE id=?',[$url,$id]);
            query('DELETE FROM content_media WHERE media_id=?',[$id]);
            if ($values[1]) query('INSERT INTO content_media(content_id,media_id) SELECT id,? FROM contents WHERE topic_id=?',[$id,$values[1]]);
            database()->commit();
            respond(serializeMedia(mediaRecord($id),$user));
        }
        if ($method === 'POST') {
            $file=saveUpload();
            query('UPDATE media SET type=?,file_path=?,original_name=?,mime_type=?,size=?,thumbnail_path=?,width=?,height=?,external_url=NULL WHERE id=?',array_merge($file,[$id]));
            respond(serializeMedia(mediaRecord($id),$user));
        }
        if ($method === 'DELETE') {
            query('UPDATE media SET status=2 WHERE id=?',[$id]);
            query('INSERT INTO logs(user_id,action,details) VALUES(?,"MEDIA_ARCHIVED",?)',[$user['id'],json_encode(['media_id'=>$id])]);
            respond(['ok'=>true]);
        }
    }
}
