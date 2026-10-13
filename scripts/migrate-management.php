<?php
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
require __DIR__ . '/../api/helpers/http.php';
require __DIR__ . '/../api/config/database.php';
database()->exec(file_get_contents(__DIR__ . '/../database/management.sql'));
echo "Métricas e gestão prontas. Clientes existentes preservados.\n";
