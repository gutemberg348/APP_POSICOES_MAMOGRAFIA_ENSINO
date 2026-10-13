<?php
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
$root=dirname(__DIR__);
require $root.'/api/helpers/http.php';
require $root.'/api/config/database.php';
database()->exec(file_get_contents($root.'/database/payments.sql'));
echo "Estrutura de pagamentos instalada. Nenhuma conta ou conteúdo foi alterado.\n";
