/* server/routes/serviceRoutes.js */
const express = require('express');
const router  = express.Router();
const { getServices } = require('../../controllers/storefront/serviceController');
router.get('/', getServices);
module.exports = router;
