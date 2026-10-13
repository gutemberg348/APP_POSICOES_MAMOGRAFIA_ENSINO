-- Executar no banco já selecionado na hospedagem. Não recria dados existentes.
CREATE TABLE IF NOT EXISTS analytics_events (
 event_id VARCHAR(36) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 visitor_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 screen VARCHAR(20) NOT NULL,
 device VARCHAR(10) NOT NULL,
 created_at DATETIME NOT NULL,
 INDEX analytics_period (created_at),
 INDEX analytics_visitor (visitor_hash, created_at)
);
