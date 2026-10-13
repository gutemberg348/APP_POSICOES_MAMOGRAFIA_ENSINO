<?php
// Local CLI fixtures only; original manual topics are never modified.
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
require __DIR__.'/../api/helpers/http.php';
require __DIR__.'/../api/config/database.php';
$command=$argv[1] ?? '';
if ($command==='cleanup-user') {
    $id=(int)($argv[2] ?? 0);
    if (!query("SELECT id FROM users WHERE id=? AND name='Teste textos' AND email LIKE 'integration-texts-%@example.invalid'",[$id])->fetch()) exit(1);
    query('DELETE FROM logs WHERE user_id=?',[$id]);
    query('DELETE FROM users WHERE id=?',[$id]); exit;
}
if ($command==='create') {
    $id=random_int(900000000,999999999);
    database()->beginTransaction();
    query("INSERT INTO topics(id,category_id,title,slug,access_type,order_position) VALUES(?,2,?,?,'FREE',999)",[$id,'Teste de edição do manual '.$id,'fixture-manual-'.$id]);
    query('INSERT INTO contents(id,topic_id,source_pages) VALUES(?,?,?)',[$id,$id,'4']);
    $metadata=['source_pdf_sha256'=>'fixture-origin','source_pages'=>'4','paragraphs'=>[['kind'=>'paragraph','runs'=>[['text'=>'Texto original de teste.','bold'=>true,'italic'=>false]],'source_pages'=>'4']]];
    query("INSERT INTO content_blocks(content_id,type,title,body,metadata,order_position) VALUES(?,'paragraph','Finalidade','Texto original de teste.',?,0)",[$id,json_encode($metadata)]);
    query("INSERT INTO content_blocks(content_id,type,title,body,order_position) VALUES(?,'numbered_list','Etapas','1. Primeira etapa.\n\n2. Segunda etapa.',1)",[$id]);
    database()->commit();
    echo json_encode(['id'=>$id,'title'=>'Teste de edição do manual '.$id]); exit;
}
if ($command==='cleanup') {
    $id=(int)($argv[2] ?? 0);
    if (!query('SELECT id FROM topics WHERE id=? AND slug=?',[$id,'fixture-manual-'.$id])->fetch()) exit(1);
    database()->beginTransaction();
    query("DELETE FROM logs WHERE action='CONTENT_UPDATED' AND CAST(JSON_UNQUOTE(JSON_EXTRACT(details,'$.content_id')) AS UNSIGNED)=?",[$id]);
    query('DELETE FROM contents WHERE id=?',[$id]);
    query('DELETE FROM topics WHERE id=?',[$id]);
    database()->commit(); exit;
}
exit(1);
