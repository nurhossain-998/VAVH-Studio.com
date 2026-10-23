// routes/orderRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/ordersController');
const { requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireAdmin);

router.get('/',                ctrl.getAll);
router.post('/',               ctrl.create);
router.put('/:id/status',      ctrl.updateStatus);
router.delete('/:id',          ctrl.remove);

module.exports = router;
