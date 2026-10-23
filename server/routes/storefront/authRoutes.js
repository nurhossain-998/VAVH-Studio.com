/* ============================================================
   server/routes/authRoutes.js — Auth API Routes
   ============================================================ */
const express = require('express');
const router  = express.Router();
const { register, login, getMe } = require('../../controllers/storefront/authController');
const { requireAuth } = require('../../middleware/authMiddleware');

// POST /api/auth/register — create new account
router.post('/register', register);

// POST /api/auth/login — authenticate and get token
router.post('/login', login);

// GET /api/auth/me — get current user profile (requires auth)
router.get('/me', requireAuth, getMe);

module.exports = router;
