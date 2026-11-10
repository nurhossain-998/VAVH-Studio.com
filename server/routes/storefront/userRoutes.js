
/* server/routes/storefront/userRoutes.js */
const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../../middleware/authMiddleware');
const { buildOrderStatsQueries } = require('../../utils/userOwnership');

// All user routes require authentication
router.use(requireAuth);

// GET /api/users/stats — dashboard overview counts
router.get('/stats', async (req, res, next) => {
    try {
        const userId = req.user.id;
        const queries = buildOrderStatsQueries();

        const totalOrdersResult = await db.query(
            queries.totalOrders,
            [userId]
        );

        const deliveredResult = await db.query(
            queries.delivered,
            [userId]
        );

        let wishlistCount = 0;

        try {
            const wishlistResult = await db.query(
                queries.wishlistCount,
                [userId]
            );

            wishlistCount = wishlistResult.rows[0]?.wishlist_count || 0;
        } catch (wishlistErr) {
            if (wishlistErr.code === '42P01') {
                wishlistCount = 0;
            } else {
                throw wishlistErr;
            }
        }

        const totalSpentResult = await db.query(
            queries.totalSpent,
            [userId]
        );

        res.json({
            total_orders: totalOrdersResult.rows[0]?.total_orders || 0,
            delivered: deliveredResult.rows[0]?.delivered || 0,
            wishlist_count: wishlistCount,
            total_spent: Number(totalSpentResult.rows[0]?.total_spent || 0)
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/users/profile — update profile information
router.put('/profile', async (req, res, next) => {
    try {
        const { name, email, password } = req.body;
        const userId = req.user.id;

        const fields = [];
        const params = [];

        if (typeof name === 'string' && name.trim()) {
            params.push(name.trim());
            fields.push(`name = $${params.length}`);
        }

        if (typeof email === 'string' && email.trim()) {
            params.push(email.toLowerCase().trim());
            fields.push(`email = $${params.length}`);
        }

        if (password) {
            if (typeof password !== 'string' || password.length < 8) {
                return res.status(400).json({
                    message: 'Password must be at least 8 characters long.'
                });
            }

            const hashed = await bcrypt.hash(password, 12);
            params.push(hashed);
            fields.push(`password_hash = $${params.length}`);
        }

        if (fields.length === 0) {
            return res.status(400).json({
                message: 'No valid fields to update.'
            });
        }

        params.push(userId);

        await db.query(
            `UPDATE users
             SET ${fields.join(', ')}
             WHERE id = $${params.length}`,
            params
        );

        const result = await db.query(
            `SELECT id, name, email, role
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json({ user: result.rows[0] });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
