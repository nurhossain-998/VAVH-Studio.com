/* server/routes/userRoutes.js */
const express  = require('express');
const router   = express.Router();
const db       = require('../../config/db');
const bcrypt   = require('bcryptjs');
const { requireAuth } = require('../../middleware/authMiddleware');
const { buildOrderStatsQueries } = require('../../utils/userOwnership');

// All user routes require auth
router.use(requireAuth);

// GET /api/users/stats — dashboard overview counts
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user.id;
    const queries = buildOrderStatsQueries();

    // Total orders count
    const [[{ total_orders }]] = await db.query(queries.totalOrders, [userId]);

    // Delivered count
    const [[{ delivered }]] = await db.query(queries.delivered, [userId]);

    // Wishlist count
    let wishlist_count = 0;
    try {
      const [[row]] = await db.query(queries.wishlistCount, [userId]);
      wishlist_count = row?.wishlist_count || 0;
    } catch (wishlistErr) {
      if (wishlistErr.code === 'ER_NO_SUCH_TABLE' || wishlistErr.message?.includes('doesn\'t exist')) {
        wishlist_count = 0;
      } else {
        throw wishlistErr;
      }
    }

    // Total amount spent on completed orders
    const [[{ total_spent }]] = await db.query(queries.totalSpent, [userId]);

    res.json({ total_orders, delivered, wishlist_count, total_spent });
  } catch (err) { next(err); }
});

// PUT /api/users/profile — update profile info
router.put('/profile', async (req, res, next) => {
  try {
    const { name, email, phone, address, password } = req.body;
    const userId = req.user.id;

    // Build update fields dynamically
    const fields = [];
    const params = [];

    if (name)    { fields.push('name = ?');    params.push(name.trim()); }
    if (email)   { fields.push('email = ?');   params.push(email.toLowerCase().trim()); }
    if (phone)   { fields.push('phone = ?');   params.push(phone.trim()); }
    if (address) { fields.push('address = ?'); params.push(address.trim()); }

    // Hash new password if provided
    if (password && password.length >= 8) {
      const hashed = await bcrypt.hash(password, 12);
      fields.push('password_hash = ?');
      params.push(hashed);
    }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update.' });
    }

    params.push(userId);
    await db.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);

    // Return updated user object
    const [rows] = await db.query(
      'SELECT id, name, email, phone, address, role FROM users WHERE id = ?', [userId]
    );
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
