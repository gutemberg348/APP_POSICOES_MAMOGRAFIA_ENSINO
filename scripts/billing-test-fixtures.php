<?php
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
require dirname(__DIR__).'/api/helpers/http.php';
require dirname(__DIR__).'/api/config/database.php';
$id=(int)($argv[2] ?? 0);
$row=query('SELECT name,email FROM users WHERE id=?',[$id])->fetch();
if (($argv[1] ?? '')!=='cleanup-user' || !$row || $row['name']!=='Teste entrada'
    || !preg_match('/^gate-[a-f0-9]{16}@example\.test$/',$row['email'])) {
    fwrite(STDERR,"Fixture não reconhecida.\n"); exit(1);
}
query('DELETE FROM logs WHERE user_id=?',[$id]);
query('DELETE FROM users WHERE id=?',[$id]);
echo "Fixture removida.\n";
