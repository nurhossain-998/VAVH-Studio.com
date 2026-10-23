// routes/customerRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/customersController');
const { requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireAdmin); // All customer management routes require admin access

router.get('/',      ctrl.getAll);
router.post('/',     ctrl.create);
router.put('/:id',   ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
