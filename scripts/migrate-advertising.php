<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../api/helpers/http.php';
require __DIR__ . '/../api/config/database.php';
database()->exec(file_get_contents(__DIR__ . '/../database/advertising.sql'));
echo "Tabelas de parceiros e campanhas prontas. Nenhum cadastro existente foi alterado.\n";
