<?php
function serveFile(int $id): void {
    $row = mediaRecord($id);
    $expires = (int)($_GET['expires'] ?? 0);
    $uid = (int)($_GET['uid'] ?? 0);
    $mode = ($_GET['mode'] ?? '') === 'thumb' ? 'thumb' : 'file';
    $expected = hash_hmac('sha256', "$id:$expires:$uid:$mode", appConfig()['signing_key']);
    if ($expires < time() || $expires > time() + 3700 || !hash_equals($expected, (string)($_GET['sig'] ?? ''))) respond(['error' => 'Link expirado. Abra a mídia novamente.'], 403);
    $user = $uid ? query('SELECT * FROM users WHERE id=? AND status=1', [$uid])->fetch() : null;
    $admin = $user && $user['role'] === 'ADMIN';
    if ((int)$row['status'] === 2 || (!$admin && (!$row['status'] || ($row['topic_status'] !== null && !$row['topic_status']) || ($row['category_status'] !== null && !$row['category_status']))) || !canAccess($row['effective_access'], $user ?: null)) respond(['error' => 'Conteúdo indisponível para esta conta.'], 403);
    $root = realpath(__DIR__ . '/../../uploads');
    $path = realpath(__DIR__ . '/../../' . ($mode === 'thumb' ? $row['thumbnail_path'] : $row['file_path']));
    if (!$path || !str_starts_with($path, $root . DIRECTORY_SEPARATOR) || !is_file($path)) respond(['error' => 'Arquivo não encontrado.'], 404);
    $size = filesize($path); $start = 0; $end = $size - 1;
    header('Content-Type: ' . ($mode === 'thumb' ? 'image/jpeg' : $row['mime_type']));
    header('Accept-Ranges: bytes');
    header('Cache-Control: private, max-age=60');
    if (isset($_SERVER['HTTP_RANGE'])) {
        if (!preg_match('/^bytes=(\d*)-(\d*)$/', $_SERVER['HTTP_RANGE'], $match) || ($match[1] === '' && $match[2] === '')) {
            header("Content-Range: bytes */$size"); http_response_code(416); exit;
        }
        if ($match[1] === '') $start = max(0, $size - (int)$match[2]);
        else { $start = (int)$match[1]; if ($match[2] !== '') $end = min($end, (int)$match[2]); }
        if ($start > $end || $start >= $size) { header("Content-Range: bytes */$size"); http_response_code(416); exit; }
        http_response_code(206); header("Content-Range: bytes $start-$end/$size");
    }
    header('Content-Length: ' . ($end - $start + 1));
    if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;
    $handle = fopen($path, 'rb'); fseek($handle, $start); $remaining = $end - $start + 1;
    while ($remaining > 0 && !feof($handle) && !connection_aborted()) {
        $chunk = fread($handle, min(65536, $remaining)); echo $chunk; $remaining -= strlen($chunk);
    }
    fclose($handle); exit;
}
