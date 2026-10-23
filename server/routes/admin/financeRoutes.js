// routes/financeRoutes.js
const express = require('express');
const router  = express.Router();
const ctrl    = require('../../controllers/admin/financeController');
const { requireAdmin } = require('../../middleware/authMiddleware');

router.use(requireAdmin);

// Dashboard stats
router.get('/stats',            ctrl.getStats);
router.post('/balance',         ctrl.setManualBalance);
router.delete('/balance',       ctrl.clearManualBalance);

// Investments
router.get('/investments',          ctrl.getInvestments);
router.post('/investments',         ctrl.createInvestment);
router.put('/investments/:id',      ctrl.updateInvestment);
router.delete('/investments/:id',   ctrl.deleteInvestment);

// Expenses
router.get('/expenses',             ctrl.getExpenses);
router.post('/expenses',            ctrl.createExpense);
router.put('/expenses/:id',         ctrl.updateExpense);
router.delete('/expenses/:id',      ctrl.deleteExpense);

// Product Costs
router.get('/product-costs',        ctrl.getProductCosts);
router.post('/product-costs',       ctrl.createProductCost);
router.put('/product-costs/:id',    ctrl.updateProductCost);
router.delete('/product-costs/:id', ctrl.deleteProductCost);

// Marketing
router.get('/marketing',            ctrl.getMarketing);
router.post('/marketing',           ctrl.createMarketing);
router.put('/marketing/:id',        ctrl.updateMarketing);
router.delete('/marketing/:id',     ctrl.deleteMarketing);

// Dealer / Supplier Ledger
router.get('/dealer-supplier',          ctrl.getDealerSupplier);
router.post('/dealer-supplier',         ctrl.createDealerSupplier);
router.put('/dealer-supplier/:id',      ctrl.updateDealerSupplier);
router.delete('/dealer-supplier/:id',   ctrl.deleteDealerSupplier);

// Inventory Adjustments
router.get('/inventory-adjustments',          ctrl.getInventoryAdjustments);
router.post('/inventory-adjustments',         ctrl.createInventoryAdjustment);
router.put('/inventory-adjustments/:id',      ctrl.updateInventoryAdjustment);
router.delete('/inventory-adjustments/:id',   ctrl.deleteInventoryAdjustment);

// Order Revenue & Tracking
router.get('/order-revenue',   ctrl.getOrderRevenue);
router.get('/order-tracking',  ctrl.getOrderTracking);

// Due Tracking
router.get('/due-tracking',          ctrl.getDueTracking);
router.post('/due-tracking',         ctrl.createDueRecord);
router.put('/due-tracking/:id',      ctrl.updateDueRecord);
router.delete('/due-tracking/:id',   ctrl.deleteDueRecord);

// Functions (FnBuilder)
router.get('/functions',             ctrl.getFunctions);
router.post('/functions',            ctrl.createFunction);
router.put('/functions/:id',         ctrl.updateFunction);
router.delete('/functions/:id',      ctrl.deleteFunction);

// Messages / Chat
router.get('/chats',               ctrl.getChats);
router.post('/chats',              ctrl.createChat);
router.get('/messages',            ctrl.getMessages);
router.post('/messages',           ctrl.createMessage);
router.delete('/messages/:id',     ctrl.deleteMessage);

// Reports
router.get('/report',              ctrl.getFinanceReport);

module.exports = router;
