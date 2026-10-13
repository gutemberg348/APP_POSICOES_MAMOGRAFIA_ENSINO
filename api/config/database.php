<?php
function database(): PDO {
    static $pdo;
    if (!$pdo) {
        $config = appConfig();
        $pdo = new PDO($config['dsn'], $config['db_user'], $config['db_password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    return $pdo;
}
function query(string $sql, array $params = []): PDOStatement {
    $stmt = database()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}
