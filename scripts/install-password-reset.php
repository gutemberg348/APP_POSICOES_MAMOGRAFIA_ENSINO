<?php
if (PHP_SAPI!=='cli') { http_response_code(403); exit; }
$root=dirname(__DIR__);
require $root.'/api/helpers/http.php';
require $root.'/api/config/database.php';
database()->exec(file_get_contents($root.'/database/password-reset.sql'));
echo "Estrutura de recuperação de senha instalada. Contas existentes preservadas.\n";
