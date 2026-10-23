// routes/supplierRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/suppliersController');
const { requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireAdmin);
router.get('/',       ctrl.getAll);
router.post('/',      ctrl.create);
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);
module.exports = router;
