const express = require('express');
const db = require('../../config/db');
const { recordEvent } = require('../../services/vavhAiService');

const router = express.Router();
let tableReady;

function ensureClickTable() {
  if (!tableReady) {
    tableReady = db.query(`
      CREATE TABLE IF NOT EXISTS product_click_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        product_id BIGINT NULL,
        product_name VARCHAR(255) NOT NULL,
        source VARCHAR(40) NOT NULL DEFAULT 'storefront',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_product_click_events_product (product_id),
        INDEX idx_product_click_events_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((err) => {
      tableReady = null;
      throw err;
    });
  }
  return tableReady;
}

router.post('/product-click', async (req, res) => {
  try {
    await ensureClickTable();

    const productId = Number.parseInt(req.body?.productId, 10);
    const requestedName = typeof req.body?.productName === 'string'
      ? req.body.productName.trim().slice(0, 255)
      : '';
    const source = typeof req.body?.source === 'string'
      ? req.body.source.trim().slice(0, 40) || 'storefront'
      : 'storefront';

    if (!Number.isInteger(productId) && !requestedName) {
      return res.status(400).json({ success: false, message: 'A product is required.' });
    }

    let productName = requestedName;
    if (Number.isInteger(productId)) {
      const [products] = await db.query('SELECT name FROM products WHERE id = ? LIMIT 1', [productId]);
      if (products[0]?.name) productName = products[0].name;
    }

    if (!productName) {
      return res.status(400).json({ success: false, message: 'Product was not found.' });
    }

    await db.query(
      'INSERT INTO product_click_events (product_id, product_name, source) VALUES (?, ?, ?)',
      [Number.isInteger(productId) ? productId : null, productName, source]
    );
    await recordEvent({
      sessionId: req.body?.sessionId,
      eventType: 'product_click',
      productId,
      source,
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[Storefront product click]', err.message);
    return res.status(500).json({ success: false, message: 'Unable to record product click.' });
  }
});

router.post('/event', async (req, res) => {
  try {
    await recordEvent({
      sessionId: req.body?.sessionId,
      eventType: req.body?.eventType,
      productId: req.body?.productId,
      categoryId: req.body?.categoryId,
      source: req.body?.source,
    });
    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[Storefront analytics event]', err.message);
    return res.status(400).json({ success: false, message: 'Unable to record analytics event.' });
  }
});

module.exports = router;
