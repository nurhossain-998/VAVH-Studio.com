/* server/routes/wishlistRoutes.js */
const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');

router.use(requireAuth);

// GET /api/wishlist — get user's wishlist with product details
router.get('/', async (req, res, next) => {
  try {
    const [items] = await db.query(
      `SELECT p.id, p.name, p.price, p.image_url, p.description,
              c.name AS category_name
       FROM wishlist w
       JOIN products p ON w.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.json(items);
  } catch (err) { next(err); }
});

// POST /api/wishlist — add product to wishlist
router.post('/', async (req, res, next) => {
  try {
    const productId = Number.parseInt(req.body?.product_id, 10);
    if (!Number.isInteger(productId) || productId < 1) {
      return res.status(400).json({ message: 'A valid product is required.' });
    }

    const [products] = await db.query(
      'SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1',
      [productId]
    );
    if (!products.length) return res.status(404).json({ message: 'Product not found.' });

    // INSERT IGNORE prevents duplicate wishlist entries
    await db.query(
      'INSERT IGNORE INTO wishlist (user_id, product_id, created_at) VALUES (?, ?, NOW())',
      [req.user.id, productId]
    );
    res.status(201).json({ message: 'Added to wishlist.' });
  } catch (err) { next(err); }
});

// DELETE /api/wishlist/:productId — remove from wishlist
router.delete('/:productId', async (req, res, next) => {
  try {
    await db.query('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [req.user.id, req.params.productId]);
    res.json({ message: 'Removed from wishlist.' });
  } catch (err) { next(err); }
});

module.exports = router;
