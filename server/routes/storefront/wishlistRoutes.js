
/* server/routes/storefront/wishlistRoutes.js */
const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { requireAuth } = require('../../middleware/authMiddleware');

router.use(requireAuth);

// GET /api/wishlist — get user's wishlist with product details
router.get('/', async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT p.id, p.name, p.price, p.image_url, p.description,
                    c.name AS category_name
             FROM wishlist w
             JOIN products p ON w.product_id = p.id
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE w.user_id = $1
             ORDER BY w.created_at DESC`,
            [req.user.id]
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/wishlist — add product to wishlist
router.post('/', async (req, res, next) => {
    try {
        const productId = Number.parseInt(req.body?.product_id, 10);

        if (!Number.isInteger(productId) || productId < 1) {
            return res.status(400).json({
                message: 'A valid product is required.'
            });
        }

        const products = await db.query(
            'SELECT id FROM products WHERE id = $1 AND is_active = TRUE LIMIT 1',
            [productId]
        );

        if (products.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        // Prevent duplicate wishlist entries.
        await db.query(
            `INSERT INTO wishlist (user_id, product_id, created_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id, product_id) DO NOTHING`,
            [req.user.id, productId]
        );

        res.status(201).json({ message: 'Added to wishlist.' });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/wishlist/:productId — remove from wishlist
router.delete('/:productId', async (req, res, next) => {
    try {
        await db.query(
            'DELETE FROM wishlist WHERE user_id = $1 AND product_id = $2',
            [req.user.id, req.params.productId]
        );

        res.json({ message: 'Removed from wishlist.' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
