<?php
declare(strict_types=1);
require __DIR__ . '/helpers/http.php';
require __DIR__ . '/config/database.php';
require __DIR__ . '/middleware/auth.php';
require __DIR__ . '/models/media.php';
require __DIR__ . '/services/asaas.php';
require __DIR__ . '/services/google-play.php';
require __DIR__ . '/services/files.php';
require __DIR__ . '/services/password-reset.php';
require __DIR__ . '/controllers/auth.php';
require __DIR__ . '/controllers/library.php';
require __DIR__ . '/controllers/admin.php';
require __DIR__ . '/controllers/advertising.php';
require __DIR__ . '/controllers/management.php';
require __DIR__ . '/controllers/contents.php';
require __DIR__ . '/controllers/billing.php';
require __DIR__ . '/controllers/google-play.php';
header('X-Content-Type-Options: nosniff');
try {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin && in_array($origin, appConfig()['allowed_origins'], true)) { header('Access-Control-Allow-Origin: ' . $origin); header('Vary: Origin'); }
    header('Access-Control-Allow-Headers: Authorization, Content-Type, Range');
    header('Access-Control-Allow-Methods: GET, HEAD, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Expose-Headers: Content-Range, Accept-Ranges, Content-Length');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
    $route = '/' . trim((string)($_GET['route'] ?? ''), '/');
    $method = $_SERVER['REQUEST_METHOD'];
    if ($route === '/health') { database(); respond(['status'=>'ok','app'=>'Dominando a Mamografia']); }
    if (preg_match('#^/files/(\d+)$#',$route,$m) && in_array($method,['GET','HEAD'])) serveFile((int)$m[1]);
    authController($route,$method);
    googlePlayController($route,$method);
    billingController($route,$method);
    managementController($route,$method);
    contentsAdminController($route,$method);
    advertisingController($route,$method);
    libraryController($route,$method);
    adminController($route,$method);
    respond(['error'=>'Endpoint não encontrado.'],404);
} catch (Throwable $e) {
    error_log('[Mamografia] ' . $e->getMessage());
    respond(['error'=>'Não foi possível concluir a operação. Verifique a configuração do servidor.'],500);
}
