-- Execute no banco existente. Não altera contas, textos, imagens ou pagamentos Asaas.
CREATE TABLE IF NOT EXISTS google_play_accounts (
    user_id INT UNSIGNED NOT NULL PRIMARY KEY,
    account_id CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Registra estornos que chegam antes da confirmação do app.
CREATE TABLE IF NOT EXISTS google_play_revocations (
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    package_name VARCHAR(190) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS google_play_purchases (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
    purchase_token TEXT NOT NULL,
    package_name VARCHAR(190) NOT NULL,
    product_id VARCHAR(190) NOT NULL,
    order_id VARCHAR(190) NULL,
    status ENUM('PENDING','PAID','CANCELED','VOIDED') NOT NULL,
    is_test TINYINT(1) NOT NULL DEFAULT 0,
    acknowledged TINYINT(1) NOT NULL DEFAULT 0,
    verified_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX play_access (user_id, status),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
