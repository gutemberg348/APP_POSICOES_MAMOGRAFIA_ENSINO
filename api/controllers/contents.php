<?php
// Manual text editing uses the same rows read by the public /contents endpoint.
function managedContent(int $id, bool $lock = false): array {
    $row = query('SELECT co.*,t.title,c.name AS category_name FROM contents co JOIN topics t ON t.id=co.topic_id JOIN categories c ON c.id=t.category_id WHERE co.id=?' . ($lock ? ' FOR UPDATE' : ''), [$id])->fetch();
    if (!$row) respond(['error'=>'Conteúdo não encontrado.'],404);
    $row['blocks'] = query('SELECT id,type,title,body,metadata,order_position,status FROM content_blocks WHERE content_id=? ORDER BY order_position,id' . ($lock ? ' FOR UPDATE' : ''), [$id])->fetchAll();
    foreach (['id','topic_id','status'] as $key) $row[$key] = (int)$row[$key];
    foreach ($row['blocks'] as &$block) {
        foreach (['id','order_position','status'] as $key) $block[$key] = (int)$block[$key];
        $block['metadata'] = $block['metadata'] ? json_decode($block['metadata'],true) : null;
    }
    unset($block);
    $row['revision'] = hash('sha256',json_encode($row,JSON_UNESCAPED_UNICODE));
    return $row;
}

function manualText($value, int $max, string $label, bool $required = false): string {
    if (!is_string($value) || mb_strlen($value)>$max || ($required && trim($value)==='')) respond(['error'=>'Preencha corretamente: '.$label.'.'],422);
    return $value;
}

function editedManualMetadata(?array $metadata, string $body, string $type, int $actor): string {
    $metadata = $metadata ?: [];
    // Source pages/hash remain origin information; changed paragraphs are rebuilt
    // so old PDF runs can never override the administrator's new text.
    $metadata['edited_at'] = gmdate('c');
    $metadata['edited_by'] = $actor;
    $list = in_array($type,['numbered_list','quality_criteria','common_errors'],true);
    $parts = preg_split($list ? '/\r?\n+/' : '/\r?\n\s*\r?\n/', $body);
    $metadata['paragraphs'] = [];
    foreach ($parts as $text) {
        if (trim($text)==='') continue;
        $kind = preg_match('/^\s*\d+[.)]\s/u',$text) ? 'numbered' : (in_array($type,['quality_criteria','common_errors'],true) ? 'bullet' : 'paragraph');
        $metadata['paragraphs'][] = ['kind'=>$kind,'runs'=>[['text'=>$text,'bold'=>false,'italic'=>$type==='tip']],'source_pages'=>''];
    }
    return json_encode($metadata,JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

function contentsAdminController(string $route, string $method): void {
    if (!preg_match('#^/admin/contents(?:/(\d+))?$#',$route,$match)) return;
    $actor = currentUser(true,true);
    if (!isset($match[1]) && $method==='GET') {
        $rows = query('SELECT co.id,co.topic_id,t.title,c.name AS category_name,co.source_pages,co.status,(SELECT COUNT(*) FROM content_blocks b WHERE b.content_id=co.id) AS block_count FROM contents co JOIN topics t ON t.id=co.topic_id JOIN categories c ON c.id=t.category_id ORDER BY c.order_position,t.order_position,t.id')->fetchAll();
        foreach ($rows as &$row) foreach (['id','topic_id','status','block_count'] as $key) $row[$key]=(int)$row[$key];
        respond($rows);
    }
    if (!isset($match[1])) respond(['error'=>'Método não permitido.'],405);
    $id = (int)$match[1];
    if ($method==='GET') respond(managedContent($id));
    if ($method!=='PUT') respond(['error'=>'Método não permitido.'],405);
    $data = input();
    $title = trim(manualText($data['title'] ?? null,190,'título do conteúdo',true));
    $revision = manualText($data['revision'] ?? null,64,'versão do conteúdo',true);
    $blocks = $data['blocks'] ?? null;
    if (!is_array($blocks) || !array_is_list($blocks) || count($blocks)<1 || count($blocks)>100) respond(['error'=>'Informe de 1 a 100 seções de texto.'],422);
    $types = ['paragraph','numbered_list','quality_criteria','common_errors','tip','important'];
    $seen = [];
    foreach ($blocks as &$block) {
        if (!is_array($block)) respond(['error'=>'Seção inválida.'],422);
        $blockId = $block['id'] ?? null;
        if ($blockId!==null && (!is_int($blockId) || $blockId<1 || isset($seen[$blockId]))) respond(['error'=>'Identificador de seção inválido ou repetido.'],422);
        if ($blockId!==null) $seen[$blockId]=true;
        if (!isset($block['type']) || !in_array($block['type'],$types,true)) respond(['error'=>'Tipo de seção inválido.'],422);
        $block['id'] = $blockId;
        $block['title'] = trim(manualText($block['title'] ?? '',190,'título da seção'));
        $block['body'] = manualText($block['body'] ?? null,50000,'texto da seção',true);
    }
    unset($block);
    database()->beginTransaction();
    try {
        $before = managedContent($id,true);
        if (!hash_equals($before['revision'],$revision)) {
            database()->rollBack();
            respond(['error'=>'Este conteúdo foi atualizado por outra edição. Volte à lista e abra novamente antes de salvar.'],409);
        }
        $existing = array_column($before['blocks'],null,'id');
        foreach ($blocks as $block) {
            if ($block['id']!==null && !isset($existing[$block['id']])) {
                database()->rollBack();
                respond(['error'=>'A seção informada não pertence a este conteúdo.'],422);
            }
        }
        query('UPDATE topics SET title=? WHERE id=?',[$title,$before['topic_id']]);
        foreach ($blocks as $position=>$block) {
            $old = $block['id']!==null ? $existing[$block['id']] : null;
            $metadata = $old && $old['body']===$block['body'] && $old['type']===$block['type']
                ? ($old['metadata']===null ? null : json_encode($old['metadata'],JSON_UNESCAPED_UNICODE))
                : editedManualMetadata($old['metadata'] ?? null,$block['body'],$block['type'],(int)$actor['id']);
            $values = [$block['type'],$block['title']==='' ? null : $block['title'],$block['body'],$metadata,$position];
            if ($old) query('UPDATE content_blocks SET type=?,title=?,body=?,metadata=?,order_position=? WHERE id=? AND content_id=?',[...$values,$block['id'],$id]);
            else query('INSERT INTO content_blocks(type,title,body,metadata,order_position,content_id) VALUES(?,?,?,?,?,?)',[...$values,$id]);
        }
        foreach ($existing as $blockId=>$old) if (!isset($seen[$blockId])) query('DELETE FROM content_blocks WHERE id=? AND content_id=?',[$blockId,$id]);
        // Retain the previous text in the audit log for administrative recovery.
        managementLog((int)$actor['id'],'CONTENT_UPDATED',['content_id'=>$id,'before'=>$before]);
        $after = managedContent($id);
        database()->commit();
        respond($after);
    } catch (Throwable $error) {
        if (database()->inTransaction()) database()->rollBack();
        throw $error;
    }
}
