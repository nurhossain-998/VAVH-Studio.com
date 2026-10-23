// routes/userRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/usersController');
const { requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireAdmin);

router.get('/',            requireAdmin, ctrl.getAll);
router.post('/',           requireAdmin, ctrl.create);      // Create new user
router.put('/profile',     ctrl.updateProfile);             // Own profile update
router.put('/:id',         requireAdmin, ctrl.update);
router.delete('/:id',      requireAdmin, ctrl.remove);

module.exports = router;
