<?php
function libraryController(string $route, string $method): void {
    $user = currentUser();
    if ($method === 'GET' && $route === '/settings') {
        $settings = query('SELECT * FROM settings WHERE `key`<>"advertising_config"')->fetchAll();
        respond(array_column($settings, 'value', 'key'));
    }
    if ($method === 'GET' && $route === '/categories') respond(query('SELECT c.*, (SELECT COUNT(*) FROM topics t WHERE t.category_id=c.id AND t.status=1) AS topic_count FROM categories c WHERE c.status=1 ORDER BY c.order_position')->fetchAll());
    if ($method === 'GET' && $route === '/topics') respond(query('SELECT t.*,c.name AS category_name FROM topics t JOIN categories c ON c.id=t.category_id WHERE t.status=1 AND c.status=1 ORDER BY t.order_position')->fetchAll());
    if ($method === 'GET' && $route === '/stats') respond(query('SELECT COUNT(*) AS total, SUM(type="IMAGE") AS images, SUM(type<>"IMAGE") AS videos, COUNT(DISTINCT topic_id) AS topics FROM media WHERE status=1')->fetch());
    if ($method === 'GET' && in_array($route, ['/media', '/admin/media', '/favorites'])) {
        $admin = $route === '/admin/media';
        if ($admin) $user = currentUser(true, true);
        if ($route === '/favorites') $user = currentUser(true);
        $where = [$admin ? 'm.status<>2' : 'm.status=1 AND (t.id IS NULL OR t.status=1) AND (c.id IS NULL OR c.status=1)']; $params = [];
        if ($route === '/favorites') { $where[] = 'm.id IN (SELECT media_id FROM favorites WHERE user_id=?)'; $params[] = $user['id']; }
        if (!empty($_GET['q'])) {
            $where[] = '(m.title LIKE ? OR t.title LIKE ? OR c.name LIKE ? OR m.caption LIKE ?)';
            for ($i=0;$i<4;$i++) $params[] = '%' . mb_substr($_GET['q'], 0, 190) . '%';
        }
        if (!empty($_GET['type'])) {
            $where[] = $_GET['type'] === 'IMAGE' ? 'm.type="IMAGE"' : 'm.type<>"IMAGE"';
        }
        if (!empty($_GET['category_id'])) { $where[] = 't.category_id=?'; $params[] = (int)$_GET['category_id']; }
        if (!empty($_GET['topic_id'])) { $where[] = 'm.topic_id=?'; $params[] = (int)$_GET['topic_id']; }
        // Filter the underlying access flags instead of comparing an IF string
        // with a bound parameter: MySQL installations can resolve different
        // collations for the computed string and the PDO parameter.
        if (in_array($_GET['access'] ?? '', ['FREE','PREMIUM'], true)) {
            $premium = "(m.access_type='PREMIUM' OR COALESCE(t.access_type='PREMIUM',0) OR COALESCE(c.access_type='PREMIUM',0))";
            $where[] = $_GET['access'] === 'PREMIUM' ? $premium : "NOT $premium";
        }
        $page = max(1, (int)($_GET['page'] ?? 1)); $limit = min(100, max(1, (int)($_GET['limit'] ?? 24))); $offset = ($page-1)*$limit;
        $from = ' FROM media m LEFT JOIN topics t ON t.id=m.topic_id LEFT JOIN categories c ON c.id=t.category_id WHERE ' . implode(' AND ', $where);
        $total = (int)query('SELECT COUNT(*)' . $from, $params)->fetchColumn();
        // Public lists follow the configured positioning order, across pages.
        // Unassigned media come last; file order stays stable within each topic.
        $order = $admin ? 'm.topic_id,m.order_position,m.id' : 't.id IS NULL,t.order_position,t.id,m.order_position,m.id';
        $rows = query('SELECT m.*,t.title AS topic_title,t.category_id,c.name AS category_name, IF(m.access_type="PREMIUM" OR t.access_type="PREMIUM" OR c.access_type="PREMIUM","PREMIUM","FREE") AS effective_access' . $from . " ORDER BY $order LIMIT $limit OFFSET $offset", $params)->fetchAll();
        respond(['data' => array_map(fn($row) => serializeMedia($row, $user), $rows), 'total' => $total, 'page' => $page, 'pages' => (int)ceil($total/$limit)]);
    }
    if (preg_match('#^/media/(\d+)$#', $route, $m) && $method === 'GET') {
        $row = mediaRecord((int)$m[1]);
        if ($row['status'] != 1 || ($row['topic_status'] !== null && !$row['topic_status']) || ($row['category_status'] !== null && !$row['category_status'])) respond(['error' => 'Mídia indisponível.'], 404);
        respond(serializeMedia($row, $user));
    }
    if (preg_match('#^/contents/(\d+)$#', $route, $m) && $method === 'GET') {
        $content = query('SELECT co.*,t.title,t.access_type,c.name AS category_name,c.access_type AS category_access FROM contents co JOIN topics t ON t.id=co.topic_id JOIN categories c ON c.id=t.category_id WHERE co.id=? AND co.status=1 AND t.status=1 AND c.status=1', [(int)$m[1]])->fetch();
        if (!$content) respond(['error' => 'Conteúdo não encontrado.'], 404);
        if (!canAccess($content['access_type'], $user) || !canAccess($content['category_access'], $user)) respond(['error' => 'Este conteúdo faz parte do Premium.', 'locked' => true], 403);
        $content['blocks'] = query('SELECT id,type,title,body,metadata FROM content_blocks WHERE content_id=? AND status=1 ORDER BY order_position,id', [$content['id']])->fetchAll();
        foreach ($content['blocks'] as &$block) $block['metadata']=$block['metadata'] ? json_decode($block['metadata'],true) : null;
        unset($block);
        respond($content);
    }
    if ($route === '/favorites/ids' && $method === 'GET') {
        $user = currentUser(true);
        respond(array_map('intval', query('SELECT media_id FROM favorites WHERE user_id=?', [$user['id']])->fetchAll(PDO::FETCH_COLUMN)));
    }
    if (preg_match('#^/favorites/(\d+)$#', $route, $m) && in_array($method, ['POST','DELETE'])) {
        $user = currentUser(true); $row = mediaRecord((int)$m[1]);
        if ($row['status'] != 1) respond(['error' => 'Mídia indisponível.'], 404);
        if ($method === 'POST') query('INSERT IGNORE INTO favorites(user_id,media_id) VALUES(?,?)', [$user['id'], $row['id']]);
        else query('DELETE FROM favorites WHERE user_id=? AND media_id=?', [$user['id'], $row['id']]);
        respond(['ok' => true]);
    }
}
