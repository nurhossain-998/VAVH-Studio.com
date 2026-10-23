-- =============================================================
-- VAVH Platform — Migration Script
-- Adds missing columns and tables to align DB with controllers
-- Safe to run multiple times (uses IF NOT EXISTS / IGNORE)
-- =============================================================

USE vavh_main;

-- ── 0. persistent application sessions ──────────────────────
CREATE TABLE IF NOT EXISTS session_store (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires DATETIME NOT NULL,
  data MEDIUMTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 1. categories — add missing columns ──────────────────────
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS is_active   TINYINT(1)  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS sort_order  INT         NOT NULL DEFAULT 0;

-- ── 2. products — add missing columns ────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url   VARCHAR(500) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_active   TINYINT(1)   NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_featured TINYINT(1)   NOT NULL DEFAULT 0;

-- ── 3. orders — align with storefront orderController ────────
-- Storefront ownership is represented by orders.customer_id -> customers.user_id.
-- Schema has:         customer_id, total_amount, status ENUM(...)
-- Keep the legacy reporting total column, but do not reintroduce a second
-- user ownership column that could diverge from customer ownership.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total   DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ── 4. order_items — align price column name ─────────────────
-- Controller inserts: order_id, product_id, quantity, price, comment
-- Schema has:         order_id, product_id, quantity, unit_price
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS price   DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS comment TEXT          NULL;

-- ── 5. user-owned storefront tables ──────────────────────────
CREATE TABLE IF NOT EXISTS cart (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  comment VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_cart_user_product (user_id, product_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS wishlist (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_wishlist_user_product (user_id, product_id),
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. services — create table ────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200)  NOT NULL,
  description TEXT,
  icon        VARCHAR(100)  DEFAULT NULL,
  is_active   TINYINT(1)    NOT NULL DEFAULT 1,
  sort_order  INT           NOT NULL DEFAULT 0,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

-- ── 6. about_content — create table ──────────────────────────
CREATE TABLE IF NOT EXISTS about_content (
  id          INT           AUTO_INCREMENT PRIMARY KEY,
  description TEXT,
  partners    TEXT,
  updated_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Seed a default row so GET /api/about always returns data
INSERT IGNORE INTO about_content (id, description, partners)
VALUES (1,
  'A curated collection of premium home décor, artisan planters, and statement pieces for modern living spaces. Crafted with intention, delivered with care.',
  ''
);

-- ── 7. social_links — create table ────────────────────────────
CREATE TABLE IF NOT EXISTS social_links (
  id       INT          AUTO_INCREMENT PRIMARY KEY,
  platform VARCHAR(50)  NOT NULL,
  url      VARCHAR(500) NOT NULL
);

-- Seed default social links
INSERT IGNORE INTO social_links (platform, url) VALUES
  ('instagram', 'https://www.instagram.com/vavh.studio/'),
  ('facebook',  'https://www.facebook.com/vavhstudio');

-- ── Done ──────────────────────────────────────────────────────
SELECT 'Migration complete.' AS status;
