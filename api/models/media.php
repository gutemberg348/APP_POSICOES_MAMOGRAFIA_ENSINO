<?php
function mediaRecord(int $id): array {
    $row = query('SELECT m.*,t.title AS topic_title,t.category_id,t.status AS topic_status,c.status AS category_status,c.name AS category_name, IF(m.access_type="PREMIUM" OR t.access_type="PREMIUM" OR c.access_type="PREMIUM","PREMIUM","FREE") AS effective_access FROM media m LEFT JOIN topics t ON t.id=m.topic_id LEFT JOIN categories c ON c.id=t.category_id WHERE m.id=?', [$id])->fetch();
    if (!$row) respond(['error' => 'Mídia não encontrada.'], 404);
    return $row;
}
function signedFile(array $row, ?array $user, bool $thumb = false): string {
    $expires = time() + 3600;
    $uid = $user ? (int)$user['id'] : 0;
    $mode = $thumb ? 'thumb' : 'file';
    $sig = hash_hmac('sha256', $row['id'] . ":$expires:$uid:$mode", appConfig()['signing_key']);
    return appConfig()['base_url'] . '/api/index.php?route=/files/' . $row['id'] . "&expires=$expires&uid=$uid&mode=$mode&sig=$sig";
}
function serializeMedia(array $row, ?array $user): array {
    $access = $row['effective_access'] ?? $row['access_type'];
    $unlocked = canAccess($access, $user);
    $result = array_intersect_key($row, array_flip(['id','topic_id','type','title','caption','alt_text','original_name','mime_type','size','duration','width','height','order_position','status','topic_title','category_id','category_name','created_at']));
    $result['access_type'] = $access;
    $result['locked'] = !$unlocked;
    $result['url'] = $unlocked ? ($row['type'] === 'VIDEO_URL' ? $row['external_url'] : signedFile($row, $user)) : null;
    $result['thumbnail_url'] = $unlocked && $row['thumbnail_path'] ? signedFile($row, $user, true) : null;
    return $result;
}
