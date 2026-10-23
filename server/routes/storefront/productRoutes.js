/* ============================================================
   server/routes/productRoutes.js — Product API Routes
   ============================================================ */
const express = require('express');
const router  = express.Router();
const { getProducts, getProduct } = require('../../controllers/storefront/productController');
const { optionalAuth } = require('../../middleware/authMiddleware');

// GET /api/products — list products (optional category/search filter)
router.get('/', optionalAuth, getProducts);

// GET /api/products/:id — single product detail
router.get('/:id', optionalAuth, getProduct);

module.exports = router;
