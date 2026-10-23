// routes/productRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/productsController');
const { requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireAdmin);

router.get('/',             ctrl.getAll);
router.post('/',            ctrl.create);
router.put('/:id',          ctrl.update);
router.delete('/:id',       ctrl.remove);
router.patch('/:id/stock',  ctrl.adjustStock);

module.exports = router;
