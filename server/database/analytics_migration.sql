-- Additive VAVH AI analytics storage.
-- Safe to run repeatedly and does not modify existing business tables.
CREATE TABLE IF NOT EXISTS analytics_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    session_id VARCHAR(80) NOT NULL,
    event_type VARCHAR(40) NOT NULL,
    product_id INT NULL,
    category_id INT NULL,
    source VARCHAR(60) NOT NULL DEFAULT 'website',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_analytics_events_type_date (event_type, created_at),
    INDEX idx_analytics_events_product_type (product_id, event_type),
    INDEX idx_analytics_events_session (session_id),
    CONSTRAINT fk_analytics_events_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    CONSTRAINT fk_analytics_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
