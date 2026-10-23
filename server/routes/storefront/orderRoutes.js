/* server/routes/orderRoutes.js */
const express = require('express');
const router  = express.Router();
const { createOrder, getMyOrders, getOrder } = require('../../controllers/storefront/orderController');
const { requireAuth } = require('../../middleware/authMiddleware');

// All order routes require authentication
router.use(requireAuth);

// POST /api/orders — place new order
router.post('/', createOrder);

// GET /api/orders/my — list current user's orders
router.get('/my', getMyOrders);

// GET /api/orders/:id — single order detail
router.get('/:id', getOrder);

module.exports = router;
