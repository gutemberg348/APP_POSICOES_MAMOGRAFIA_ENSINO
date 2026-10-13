-- Execute no banco existente. Preserva contas, compras e conteúdos.
CREATE TABLE IF NOT EXISTS premium_trials (
    user_id INT UNSIGNED NOT NULL PRIMARY KEY,
    started_at DATETIME NOT NULL,
    ends_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
-- Zero desativa novos testes. Um valor já configurado é preservado.
INSERT IGNORE INTO settings (`key`, value) VALUES ('premium_trial_days', '0');
