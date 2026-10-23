// routes/authRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/authController');
const { requireLogin, requireAdmin, optionalAuth } = require('../../middleware/authMiddleware');

router.post('/login',    ctrl.login);
router.post('/logout',   ctrl.logout);
router.get('/session',   optionalAuth, ctrl.checkSession);
router.post('/register', requireLogin, requireAdmin, ctrl.register); // Only logged-in admins can create users
router.post('/change-password', requireLogin, ctrl.changePassword);
module.exports = router;
