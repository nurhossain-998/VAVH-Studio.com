/* server/routes/cartRoutes.js — Server-side cart (syncs with localStorage) */
const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');

router.use(requireAuth);

// GET /api/cart — get user's cart
router.get('/', async (req, res, next) => {
  try {
    const [items] = await db.query(
      `SELECT c.id, c.product_id, c.quantity, c.comment,
              p.name, p.price, p.image_url
       FROM cart c JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.id]
    );
    res.json(items);
  } catch (err) { next(err); }
});

// POST /api/cart — add item to cart
router.post('/', async (req, res, next) => {
  try {
    const productId = Number.parseInt(req.body?.product_id, 10);
    const quantity = Number.parseInt(req.body?.quantity ?? 1, 10);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';

    if (!Number.isInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      return res.status(400).json({ message: 'A valid product and quantity from 1 to 100 are required.' });
    }

    const [products] = await db.query(
      'SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
      [productId]
    );
    if (!products.length) return res.status(404).json({ message: 'Product not found.' });

    // Upsert: if product already in cart, increase quantity
    await db.query(
      `INSERT INTO cart (user_id, product_id, quantity, comment)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE quantity = LEAST(quantity + VALUES(quantity), 100), comment = VALUES(comment)`,
      [req.user.id, productId, quantity, comment]
    );
    res.status(201).json({ message: 'Added to cart.' });
  } catch (err) { next(err); }
});

// DELETE /api/cart/:productId — remove item from cart
router.delete('/:productId', async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.productId]);
    res.json({ message: 'Removed from cart.' });
  } catch (err) { next(err); }
});

// DELETE /api/cart — clear entire cart
router.delete('/', async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart WHERE user_id = ?', [req.user.id]);
    res.json({ message: 'Cart cleared.' });
  } catch (err) { next(err); }
});

module.exports = router;
