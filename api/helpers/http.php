<?php
function appConfig(): array {
    static $config;
    if (!$config) {
        $path = __DIR__ . '/../config/local.php';
        if (!is_file($path)) respond(['error' => 'Execute a instalação local descrita no README.'], 503);
        $config = require $path;
    }
    return $config;
}
function respond($data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function input(): array {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!is_array($data)) respond(['error' => 'JSON inválido.'], 422);
    return $data;
}
function requiredText(array $data, string $key, int $max = 255): string {
    $value = trim((string) ($data[$key] ?? ''));
    if (!$value || mb_strlen($value) > $max) respond(['error' => "Campo inválido: $key."], 422);
    return $value;
}
function rateLimit(string $action, int $limit = 15): void {
    $key = hash('sha256', $action . ($_SERVER['REMOTE_ADDR'] ?? 'cli'));
    $file = __DIR__ . '/../storage/rate-' . $key . '.json';
    $handle = fopen($file, 'c+');
    if (!$handle) respond(['error' => 'Serviço temporariamente indisponível.'], 503);
    flock($handle, LOCK_EX);
    $entry = json_decode(stream_get_contents($handle), true) ?: ['start' => time(), 'count' => 0];
    if (time() - $entry['start'] >= 900) $entry = ['start' => time(), 'count' => 0];
    $entry['count']++;
    rewind($handle); ftruncate($handle, 0); fwrite($handle, json_encode($entry));
    flock($handle, LOCK_UN); fclose($handle);
    if ($entry['count'] > $limit) respond(['error' => 'Muitas tentativas. Aguarde 15 minutos.'], 429);
}
