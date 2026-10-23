/* server/routes/categoryRoutes.js */
const express = require('express');
const router  = express.Router();
const { getCategories } = require('../../controllers/storefront/categoryController');
router.get('/', getCategories);
module.exports = router;
