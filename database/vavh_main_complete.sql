-- VAVH Platform Complete Database
-- Combined from schema_vavh_platform.sql and migrate.sql

CREATE DATABASE IF NOT EXISTS `vavh_main` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `vavh_main`;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';

-- ===== schema_vavh_platform.sql =====

-- Unified VAVH Platform Schema

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

INSERT IGNORE INTO roles (name) VALUES 
('Super Admin'), ('Admin'), ('Manager'), ('Staff'), ('Customer');

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_id INT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    category_id INT,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS product_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    phone VARCHAR(20),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    street VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status ENUM('Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled') DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    status ENUM('Pending', 'Completed', 'Failed', 'Refunded') DEFAULT 'Pending',
    finance_name_due VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    action VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ===== migrate.sql =====

CREATE TABLE IF NOT EXISTS session_store (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires DATETIME NOT NULL,
  data MEDIUMTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- =============================================================
-- VAVH Platform — Migration Script
-- Adds missing columns and tables to align DB with controllers
-- Safe to run multiple times (uses IF NOT EXISTS / IGNORE)
-- =============================================================

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
-- Keep the legacy reporting total column, but retain a single ownership path.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS total   DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- ── 4. order_items — align price column name ─────────────────
-- Controller inserts: order_id, product_id, quantity, price, comment
-- Schema has:         order_id, product_id, quantity, unit_price
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS price   DECIMAL(10,2) NULL,
  ADD COLUMN IF NOT EXISTS comment TEXT          NULL;

-- ── 5. services — create table ────────────────────────────────
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

-- ── 8. Legacy/controller compatibility columns ───────────────
-- These columns are used by the existing admin and storefront controllers.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS name VARCHAR(200) NULL AFTER last_name,
  ADD COLUMN IF NOT EXISTS username VARCHAR(100) NULL AFTER email,
  ADD COLUMN IF NOT EXISTS role VARCHAR(50) NULL AFTER role_id,
  ADD COLUMN IF NOT EXISTS designation VARCHAR(150) NULL AFTER role,
  ADD COLUMN IF NOT EXISTS avatar VARCHAR(500) NULL AFTER designation;

-- Drop the legacy plaintext password column if it exists from older imports.
SET @legacy_password_exists = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'users'
    AND column_name = 'password'
);
SET @legacy_password_sql = IF(@legacy_password_exists > 0,
  'ALTER TABLE users DROP COLUMN password',
  'SELECT 1'
);
PREPARE legacy_password_stmt FROM @legacy_password_sql;
EXECUTE legacy_password_stmt;
DEALLOCATE PREPARE legacy_password_stmt;

ALTER TABLE users
  MODIFY COLUMN role_id INT NULL DEFAULT 4;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS name VARCHAR(200) NULL AFTER user_id,
  ADD COLUMN IF NOT EXISTS contact VARCHAR(100) NULL AFTER name,
  ADD COLUMN IF NOT EXISTS email VARCHAR(150) NULL AFTER contact,
  ADD COLUMN IF NOT EXISTS address TEXT NULL AFTER email,
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(100) NULL AFTER address,
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(100) NULL AFTER first_name,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS suppliers (
  id VARCHAR(100) PRIMARY KEY,
  company VARCHAR(200) NOT NULL,
  name VARCHAR(200) NOT NULL DEFAULT '',
  number VARCHAR(100) NOT NULL DEFAULT '',
  email VARCHAR(150) NOT NULL DEFAULT '',
  address TEXT,
  notes TEXT,
  supplier_code VARCHAR(100) NOT NULL DEFAULT '',
  website VARCHAR(500) NOT NULL DEFAULT '',
  tax_number VARCHAR(100) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_suppliers_created_at (created_at),
  INDEX idx_suppliers_company (company)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_reference VARCHAR(50) NULL UNIQUE AFTER status,
  ADD COLUMN IF NOT EXISTS customer_name VARCHAR(200) NULL AFTER customer_id,
  ADD COLUMN IF NOT EXISTS product_id INT NULL AFTER customer_name,
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(200) NULL AFTER product_id,
  ADD COLUMN IF NOT EXISTS qty INT NULL AFTER product_name,
  ADD COLUMN IF NOT EXISTS total DECIMAL(10,2) NULL AFTER qty,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL AFTER updated_at,
  ADD COLUMN IF NOT EXISTS finance_name_due VARCHAR(100) NULL AFTER total,
  ADD COLUMN IF NOT EXISTS due_total DECIMAL(10,2) NULL AFTER finance_name_due,
  ADD COLUMN IF NOT EXISTS due_paid DECIMAL(10,2) NULL AFTER due_total,
  ADD COLUMN IF NOT EXISTS due_remaining DECIMAL(10,2) NULL AFTER due_paid,
  ADD COLUMN IF NOT EXISTS notes TEXT NULL AFTER due_remaining,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) NULL AFTER unit_price,
  ADD COLUMN IF NOT EXISTS comment TEXT NULL AFTER price;

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

-- ── 9. Finance tables ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS investments (
  id VARCHAR(100) PRIMARY KEY,
  investor_name VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE NULL,
  method VARCHAR(80) NOT NULL DEFAULT 'Cash',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_investments_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS expenses (
  id VARCHAR(100) PRIMARY KEY,
  employee_name VARCHAR(200) NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE NULL,
  reason TEXT,
  attachment VARCHAR(500) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expenses_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_costs (
  id VARCHAR(100) PRIMARY KEY,
  product_name VARCHAR(200) NOT NULL,
  item_name VARCHAR(200) NOT NULL DEFAULT '',
  supplier VARCHAR(200) NOT NULL DEFAULT '',
  quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_product_costs_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS marketing (
  id VARCHAR(100) PRIMARY KEY,
  platform VARCHAR(100) NOT NULL,
  campaign_name VARCHAR(200) NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE NULL,
  transaction_id VARCHAR(150) NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_marketing_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS dealer_supplier (
  id VARCHAR(100) PRIMARY KEY,
  supplier_name VARCHAR(200) NOT NULL,
  product VARCHAR(200) NOT NULL DEFAULT '',
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  date DATE NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_dealer_supplier_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS balance_manual (
  id INT AUTO_INCREMENT PRIMARY KEY,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id VARCHAR(100) PRIMARY KEY,
  product_id INT NOT NULL,
  product_name VARCHAR(200) NOT NULL DEFAULT '',
  adj_type VARCHAR(60) NOT NULL DEFAULT 'adjustment_add',
  qty INT NOT NULL DEFAULT 0,
  reference VARCHAR(200) NOT NULL DEFAULT '',
  note TEXT,
  date DATE NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_inventory_adjustments_product (product_id),
  INDEX idx_inventory_adjustments_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS due_records (
  id VARCHAR(100) PRIMARY KEY,
  party_name VARCHAR(200) NOT NULL,
  description TEXT,
  finance_name_due VARCHAR(100) NOT NULL DEFAULT '',
  due_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_remaining DECIMAL(12,2) NOT NULL DEFAULT 0,
  due_date DATE NULL,
  due_status VARCHAR(50) NOT NULL DEFAULT 'Pending',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_due_records_status (due_status),
  INDEX idx_due_records_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fn_builder_functions (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL DEFAULT 'finance',
  inputs JSON NOT NULL,
  steps JSON NOT NULL,
  output_var VARCHAR(100) NOT NULL DEFAULT '',
  output_label VARCHAR(200) NOT NULL DEFAULT 'Result',
  output_format VARCHAR(50) NOT NULL DEFAULT 'currency',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 10. Finance chat tables ──────────────────────────────────
CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  members JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_chats_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(100) PRIMARY KEY,
  chat_id VARCHAR(100) NOT NULL,
  sender_id INT NULL,
  sender VARCHAR(200) NOT NULL DEFAULT 'Anonymous',
  message TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_messages_chat_id (chat_id),
  INDEX idx_messages_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 11. VAVH AI analytics tables ─────────────────────────────
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

CREATE TABLE IF NOT EXISTS product_click_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT NULL,
  product_name VARCHAR(255) NOT NULL,
  source VARCHAR(40) NOT NULL DEFAULT 'storefront',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_product_click_events_product (product_id),
  INDEX idx_product_click_events_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Done ──────────────────────────────────────────────────────
SELECT 'Migration complete.' AS status;

SET FOREIGN_KEY_CHECKS=1;
