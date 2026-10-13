<?php
return [
    'dsn' => 'mysql:host=127.0.0.1;dbname=dominando_mamografia;charset=utf8mb4',
    'db_user' => 'root',
    'db_password' => '',
    'base_url' => 'http://localhost/app_mamografia',
    'allowed_origins' => ['http://localhost:8081', 'http://localhost:5173', 'http://localhost'],
    'signing_key' => 'SUBSTITUA_POR_UMA_CHAVE_ALEATORIA',
    'upload_limit' => 209715200,
    // Recuperação de senha: preencha os dados SMTP do seu provedor e ative.
    'mail' => [
        'enabled' => false,
        'host' => getenv('SMTP_HOST') ?: '',
        'port' => 587,
        'encryption' => 'tls', // tls: porta 587; ssl: porta 465.
        'username' => getenv('SMTP_USERNAME') ?: '',
        'password' => getenv('SMTP_PASSWORD') ?: '',
        'from' => getenv('SMTP_FROM') ?: '',
        'from_name' => 'Dominando a Mamografia',
    ],
    // Copie este bloco para local.php; as chaves ficam somente no servidor.
    'google_play' => [
        'enabled' => false,
        'package_name' => 'com.dominando.mamografia',
        'product_id' => 'premium_vitalicio',
        'service_account_file' => __DIR__ . '/google-play-service-account.json',
        'allow_test_purchases' => false, // true somente durante os testes com testadores licenciados.
        'notification_audience' => 'https://SEU-DOMINIO/app_mamografia/api/index.php?route=/webhooks/google-play',
        'notification_service_account_email' => '', // Conta de serviço usada no push autenticado do Pub/Sub.
    ],
    'asaas' => [
        'enabled' => false,
        'environment' => 'sandbox',
        'api_key' => getenv('ASAAS_API_KEY') ?: '',
        'webhook_token' => getenv('ASAAS_WEBHOOK_TOKEN') ?: '',
        'price_cents' => 0, // Valor inicial; preço salvo no admin tem prioridade.
        'purchase_type' => 'ONE_TIME',
        'return_url' => 'https://SEU-DOMINIO/app_mamografia/preview/profile',
    ],
];
