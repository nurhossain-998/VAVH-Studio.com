// ============================================================
//  controllers/financeController.js
//  Handles: Investments, Expenses, Product Costs, Marketing,
//           Dealer/Supplier, and Dashboard stats
// ============================================================

const db     = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

// ── Helper: sum a column from a table ────────────────────
async function sumColumn(table, column) {
  const [[row]] = await db.query(`SELECT COALESCE(SUM(${column}), 0) AS total FROM ${column === 'due_remaining' ? table + ' WHERE due_remaining > 0' : table}`);
  return parseFloat(row.total) || 0;
}

// ──────────────────────────────────────────────────────────
//  INVESTMENTS
// ──────────────────────────────────────────────────────────
async function getInvestments(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM investments ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createInvestment(req, res) {
  const { investor_name, amount, date, method, notes } = req.body;
  if (!investor_name || !amount) {
    return res.status(400).json({ success: false, message: 'Investor name and amount are required.' });
  }
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO investments (id, investor_name, amount, date, method, notes) VALUES (?,?,?,?,?,?)',
      [id, investor_name, amount, date || null, method || 'Cash', notes || '']
    );
    res.json({ success: true, message: 'Investment saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateInvestment(req, res) {
  const { id } = req.params;
  const { investor_name, amount, date, method, notes } = req.body;
  try {
    await db.query(
      'UPDATE investments SET investor_name=?, amount=?, date=?, method=?, notes=? WHERE id=?',
      [investor_name, amount, date || null, method || 'Cash', notes || '', id]
    );
    res.json({ success: true, message: 'Investment updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteInvestment(req, res) {
  try {
    await db.query('DELETE FROM investments WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Investment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  EXPENSES
// ──────────────────────────────────────────────────────────
async function getExpenses(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM expenses ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createExpense(req, res) {
  const { employee_name, amount, date, reason, attachment } = req.body;
  if (!employee_name || !amount) {
    return res.status(400).json({ success: false, message: 'Employee name and amount are required.' });
  }
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO expenses (id, employee_name, amount, date, reason, attachment) VALUES (?,?,?,?,?,?)',
      [id, employee_name, amount, date || null, reason || '', attachment || '']
    );
    res.json({ success: true, message: 'Expense saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateExpense(req, res) {
  const { id } = req.params;
  const { employee_name, amount, date, reason, attachment } = req.body;
  try {
    await db.query(
      'UPDATE expenses SET employee_name=?, amount=?, date=?, reason=?, attachment=? WHERE id=?',
      [employee_name, amount, date || null, reason || '', attachment || '', id]
    );
    res.json({ success: true, message: 'Expense updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteExpense(req, res) {
  try {
    await db.query('DELETE FROM expenses WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  PRODUCT COSTS
// ──────────────────────────────────────────────────────────
async function getProductCosts(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM product_costs ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createProductCost(req, res) {
  const { product_name, item_name, supplier, quantity, cost, date, notes } = req.body;
  if (!product_name || !cost) {
    return res.status(400).json({ success: false, message: 'Product name and cost are required.' });
  }
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO product_costs (id, product_name, item_name, supplier, quantity, cost, date, notes) VALUES (?,?,?,?,?,?,?,?)',
      [id, product_name, item_name || '', supplier || '', quantity || 1, cost, date || null, notes || '']
    );
    res.json({ success: true, message: 'Product cost saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateProductCost(req, res) {
  const { id } = req.params;
  const { product_name, item_name, supplier, quantity, cost, date, notes } = req.body;
  try {
    await db.query(
      'UPDATE product_costs SET product_name=?, item_name=?, supplier=?, quantity=?, cost=?, date=?, notes=? WHERE id=?',
      [product_name, item_name || '', supplier || '', quantity || 1, cost, date || null, notes || '', id]
    );
    res.json({ success: true, message: 'Product cost updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteProductCost(req, res) {
  try {
    await db.query('DELETE FROM product_costs WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Product cost deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  MARKETING
// ──────────────────────────────────────────────────────────
async function getMarketing(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM marketing ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createMarketing(req, res) {
  const { platform, campaign_name, amount, date, transaction_id, notes } = req.body;
  if (!platform || !amount) {
    return res.status(400).json({ success: false, message: 'Platform and amount are required.' });
  }
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO marketing (id, platform, campaign_name, amount, date, transaction_id, notes) VALUES (?,?,?,?,?,?,?)',
      [id, platform, campaign_name || '', amount, date || null, transaction_id || '', notes || '']
    );
    res.json({ success: true, message: 'Marketing record saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateMarketing(req, res) {
  const { id } = req.params;
  const { platform, campaign_name, amount, date, transaction_id, notes } = req.body;
  try {
    await db.query(
      'UPDATE marketing SET platform=?, campaign_name=?, amount=?, date=?, transaction_id=?, notes=? WHERE id=?',
      [platform, campaign_name || '', amount, date || null, transaction_id || '', notes || '', id]
    );
    res.json({ success: true, message: 'Marketing record updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteMarketing(req, res) {
  try {
    await db.query('DELETE FROM marketing WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Marketing record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  DEALER / SUPPLIER LEDGER
// ──────────────────────────────────────────────────────────
async function getDealerSupplier(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM dealer_supplier ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createDealerSupplier(req, res) {
  const { supplier_name, product, amount, paid, date, status, note } = req.body;
  if (!supplier_name) {
    return res.status(400).json({ success: false, message: 'Supplier name is required.' });
  }
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO dealer_supplier (id, supplier_name, product, amount, paid, date, status, note) VALUES (?,?,?,?,?,?,?,?)',
      [id, supplier_name, product || '', amount || 0, paid || 0, date || null, status || 'Pending', note || '']
    );
    res.json({ success: true, message: 'Dealer/Supplier record saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateDealerSupplier(req, res) {
  const { id } = req.params;
  const { supplier_name, product, amount, paid, date, status, note } = req.body;
  try {
    await db.query(
      'UPDATE dealer_supplier SET supplier_name=?, product=?, amount=?, paid=?, date=?, status=?, note=? WHERE id=?',
      [supplier_name, product || '', amount || 0, paid || 0, date || null, status || 'Pending', note || '', id]
    );
    res.json({ success: true, message: 'Dealer/Supplier record updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteDealerSupplier(req, res) {
  try {
    await db.query('DELETE FROM dealer_supplier WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  FINANCE DASHBOARD STATS  (GET /api/finance/stats)
//  Returns all summary numbers the Finance Dashboard needs
// ──────────────────────────────────────────────────────────
async function getStats(req, res) {
  try {
    const [[invRow]]  = await db.query('SELECT COALESCE(SUM(amount),0) AS total FROM investments');
    const [[expRow]]  = await db.query('SELECT COALESCE(SUM(amount),0) AS total FROM expenses');
    const [[prodRow]] = await db.query('SELECT COALESCE(SUM(cost),0)   AS total FROM product_costs');
    const [[mktRow]]  = await db.query('SELECT COALESCE(SUM(amount),0) AS total FROM marketing');
    const [[revRow]]  = await db.query("SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE status='Completed'");

    // Manual balance override (if set)
    const [[manRow]]  = await db.query('SELECT amount FROM balance_manual ORDER BY id DESC LIMIT 1');

    const tI  = parseFloat(invRow.total)  || 0;
    const tE  = parseFloat(expRow.total)  || 0;
    const tP  = parseFloat(prodRow.total) || 0;
    const tM  = parseFloat(mktRow.total)  || 0;
    const tOR = parseFloat(revRow.total)  || 0;

    const totalExpenses = tE + tP + tM;
    const autoBalance   = tI + tOR - totalExpenses;
    const finalBalance  = manRow ? parseFloat(manRow.amount) : autoBalance;

    // Monthly breakdown for charts (last 6 months)
    const [monthlyRev] = await db.query(
      `SELECT DATE_FORMAT(completed_at, '%Y-%m') AS month, COALESCE(SUM(total),0) AS revenue
       FROM orders
       WHERE status='Completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month ASC`
    );
    const [monthlyExp] = await db.query(
      `SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, COALESCE(SUM(amount),0) AS expenses
       FROM expenses
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month ORDER BY month ASC`
    );

    res.json({
      success: true,
      stats: { tI, tE, tP, tM, tOR, totalExpenses, finalBalance, isManualBalance: !!manRow },
      charts: { monthlyRevenue: monthlyRev, monthlyExpenses: monthlyExp },
    });

  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ── POST /api/finance/balance — set manual balance ────────
async function setManualBalance(req, res) {
  const { amount } = req.body;
  try {
    // Always keep just one row (upsert style)
    const [[existing]] = await db.query('SELECT id FROM balance_manual LIMIT 1');
    if (existing) {
      await db.query('UPDATE balance_manual SET amount=? WHERE id=?', [amount, existing.id]);
    } else {
      await db.query('INSERT INTO balance_manual (amount) VALUES (?)', [amount]);
    }
    res.json({ success: true, message: 'Balance override saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function clearManualBalance(req, res) {
  try {
    await db.query('DELETE FROM balance_manual');
    res.json({ success: true, message: 'Manual balance cleared. Auto-calculation restored.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  INVENTORY ADJUSTMENTS
// ──────────────────────────────────────────────────────────
async function getInventoryAdjustments(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM inventory_adjustments ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createInventoryAdjustment(req, res) {
  const { product_id, product_name, adj_type, qty, reference, note, date } = req.body;
  if (!product_id || !qty) {
    return res.status(400).json({ success: false, message: 'Product ID and quantity are required.' });
  }
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO inventory_adjustments (id, product_id, product_name, adj_type, qty, reference, note, date) VALUES (?,?,?,?,?,?,?,?)',
      [id, product_id, product_name || '', adj_type || 'adjustment_add', qty, reference || '', note || '', date || null]
    );
    res.json({ success: true, message: 'Inventory adjustment recorded.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateInventoryAdjustment(req, res) {
  const { id } = req.params;
  const { product_id, product_name, adj_type, qty, reference, note, date } = req.body;
  try {
    await db.query(
      'UPDATE inventory_adjustments SET product_id=?, product_name=?, adj_type=?, qty=?, reference=?, note=?, date=? WHERE id=?',
      [product_id, product_name || '', adj_type || 'adjustment_add', qty, reference || '', note || '', date || null, id]
    );
    res.json({ success: true, message: 'Inventory adjustment updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteInventoryAdjustment(req, res) {
  try {
    await db.query('DELETE FROM inventory_adjustments WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Inventory adjustment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  ORDER REVENUE & TRACKING
// ──────────────────────────────────────────────────────────
async function getOrderRevenue(req, res) {
  try {
    const [orders] = await db.query(
      `SELECT * FROM orders ORDER BY created_at DESC`
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getOrderTracking(req, res) {
  try {
    const [orders] = await db.query(
      `SELECT * FROM orders ORDER BY created_at DESC`
    );
    res.json({ success: true, data: orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  DUE TRACKING (computed from orders)
// ──────────────────────────────────────────────────────────
// ──────────────────────────────────────────────────────────
//  DUE TRACKING (computed from orders + standalone)
// ──────────────────────────────────────────────────────────
async function getDueTracking(req, res) {
  try {
    // Get orders with due tracking
    const [orders] = await db.query(
      `SELECT id, customer_name AS party_name, product_name AS description, qty, total AS due_total, status AS due_status,
              finance_name_due, due_paid, due_remaining, notes,
              created_at, updated_at, 'order' AS _type FROM orders 
       WHERE finance_name_due IS NOT NULL AND finance_name_due != ''`
    );
    // Get standalone due records
    const [standalone] = await db.query('SELECT *, "standalone" AS _type FROM due_records');
    
    const combined = [...orders, ...standalone].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, data: combined });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createDueRecord(req, res) {
  const { party_name, description, finance_name_due, due_total, due_paid, due_date, due_status, notes } = req.body;
  if (!party_name || !due_total) {
    return res.status(400).json({ success: false, message: 'Party name and total due are required.' });
  }
  try {
    const id = uuidv4();
    const due_remaining = Math.max(0, due_total - (due_paid || 0));
    await db.query(
      'INSERT INTO due_records (id, party_name, description, finance_name_due, due_total, due_paid, due_remaining, due_date, due_status, notes) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, party_name, description || '', finance_name_due || '', due_total, due_paid || 0, due_remaining, due_date || null, due_status || 'Pending', notes || '']
    );
    res.json({ success: true, message: 'Due record saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateDueRecord(req, res) {
  const { id } = req.params;
  const { party_name, description, finance_name_due, due_total, due_paid, due_date, due_status, notes } = req.body;
  try {
    const due_remaining = Math.max(0, due_total - (due_paid || 0));
    await db.query(
      'UPDATE due_records SET party_name=?, description=?, finance_name_due=?, due_total=?, due_paid=?, due_remaining=?, due_date=?, due_status=?, notes=? WHERE id=?',
      [party_name, description || '', finance_name_due || '', due_total, due_paid || 0, due_remaining, due_date || null, due_status || 'Pending', notes || '', id]
    );
    res.json({ success: true, message: 'Due record updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteDueRecord(req, res) {
  try {
    await db.query('DELETE FROM due_records WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Due record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  FUNCTION BUILDER
// ──────────────────────────────────────────────────────────
async function getFunctions(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM fn_builder_functions ORDER BY created_at DESC');
    // Parse JSON strings back to arrays
    const data = rows.map(r => ({
      ...r,
      inputs: JSON.parse(r.inputs || '[]'),
      steps:  JSON.parse(r.steps  || '[]')
    }));
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createFunction(req, res) {
  const { name, description, category, inputs, steps, output_var, output_label, output_format } = req.body;
  if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO fn_builder_functions (id, name, description, category, inputs, steps, output_var, output_label, output_format) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, name, description || '', category || 'finance', JSON.stringify(inputs || []), JSON.stringify(steps || []), output_var || '', output_label || 'Result', output_format || 'currency']
    );
    res.json({ success: true, message: 'Function saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateFunction(req, res) {
  const { id } = req.params;
  const { name, description, category, inputs, steps, output_var, output_label, output_format } = req.body;
  try {
    await db.query(
      'UPDATE fn_builder_functions SET name=?, description=?, category=?, inputs=?, steps=?, output_var=?, output_label=?, output_format=? WHERE id=?',
      [name, description || '', category || 'finance', JSON.stringify(inputs || []), JSON.stringify(steps || []), output_var || '', output_label || 'Result', output_format || 'currency', id]
    );
    res.json({ success: true, message: 'Function updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteFunction(req, res) {
  try {
    await db.query('DELETE FROM fn_builder_functions WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Function deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  MESSAGES / CHAT
// ──────────────────────────────────────────────────────────
async function getChats(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM chats ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createChat(req, res) {
  const { name, members } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, message: 'Chat name is required.' });
  }
  try {
    const id = uuidv4();
    const membersJSON = JSON.stringify(members || []);
    await db.query(
      'INSERT INTO chats (id, name, members) VALUES (?,?,?)',
      [id, name, membersJSON]
    );
    res.json({ success: true, message: 'Chat created.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getMessages(req, res) {
  const { chat_id } = req.query;
  try {
    if (chat_id) {
      const [rows] = await db.query('SELECT * FROM messages WHERE chat_id=? ORDER BY timestamp ASC', [chat_id]);
      res.json({ success: true, data: rows });
    } else {
      const [rows] = await db.query('SELECT * FROM messages ORDER BY timestamp DESC');
      res.json({ success: true, data: rows });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createMessage(req, res) {
  const { chat_id, sender_id, sender, message } = req.body;
  if (!chat_id || !message) {
    return res.status(400).json({ success: false, message: 'Chat ID and message are required.' });
  }
  try {
    const id = uuidv4();
    await db.query(
      'INSERT INTO messages (id, chat_id, sender_id, sender, message) VALUES (?,?,?,?,?)',
      [id, chat_id, sender_id || null, sender || 'Anonymous', message]
    );
    res.json({ success: true, message: 'Message sent.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteMessage(req, res) {
  try {
    await db.query('DELETE FROM messages WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ──────────────────────────────────────────────────────────
//  REPORTS (comprehensive financial data)
// ──────────────────────────────────────────────────────────
async function getFinanceReport(req, res) {
  try {
    // Get all financial data
    const [[invTotal]] = await db.query('SELECT COALESCE(SUM(amount),0) AS total FROM investments');
    const [[expTotal]] = await db.query('SELECT COALESCE(SUM(amount),0) AS total FROM expenses');
    const [[prodTotal]] = await db.query('SELECT COALESCE(SUM(cost),0) AS total FROM product_costs');
    const [[mktTotal]] = await db.query('SELECT COALESCE(SUM(amount),0) AS total FROM marketing');
    const [[orderTotal]] = await db.query("SELECT COALESCE(SUM(total),0) AS total FROM orders WHERE status='Completed'");
    const [[manRow]] = await db.query('SELECT amount FROM balance_manual ORDER BY id DESC LIMIT 1');

    const [investments] = await db.query('SELECT * FROM investments ORDER BY created_at DESC');
    const [expenses] = await db.query('SELECT * FROM expenses ORDER BY created_at DESC');
    const [productCosts] = await db.query('SELECT * FROM product_costs ORDER BY created_at DESC');
    const [marketing] = await db.query('SELECT * FROM marketing ORDER BY created_at DESC');
    const [orders] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    const [dealerSupplier] = await db.query('SELECT * FROM dealer_supplier ORDER BY created_at DESC');
    const [inventoryAdj] = await db.query('SELECT * FROM inventory_adjustments ORDER BY created_at DESC');

    const tI  = parseFloat(invTotal.total)  || 0;
    const tE  = parseFloat(expTotal.total)  || 0;
    const tP  = parseFloat(prodTotal.total) || 0;
    const tM  = parseFloat(mktTotal.total)  || 0;
    const tOR = parseFloat(orderTotal.total) || 0;

    const totalExpenses = tE + tP + tM;
    const autoBalance   = tI + tOR - totalExpenses;
    const finalBalance  = manRow ? parseFloat(manRow.amount) : autoBalance;

    res.json({
      success: true,
      summary: {
        totalInvestment: tI,
        totalExpenses: totalExpenses,
        totalRevenue: tOR,
        finalBalance: finalBalance,
        isManualBalance: !!manRow
      },
      details: {
        investments,
        expenses,
        productCosts,
        marketing,
        orders,
        dealerSupplier,
        inventoryAdjustments: inventoryAdj
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getInvestments, createInvestment, updateInvestment, deleteInvestment,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getProductCosts, createProductCost, updateProductCost, deleteProductCost,
  getMarketing, createMarketing, updateMarketing, deleteMarketing,
  getDealerSupplier, createDealerSupplier, updateDealerSupplier, deleteDealerSupplier,
  getStats, setManualBalance, clearManualBalance,
  getInventoryAdjustments, createInventoryAdjustment, updateInventoryAdjustment, deleteInventoryAdjustment,
  getOrderRevenue, getOrderTracking, getDueTracking, createDueRecord, updateDueRecord, deleteDueRecord,
  getChats, createChat, getMessages, createMessage, deleteMessage,
  getFunctions, createFunction, updateFunction, deleteFunction,
  getFinanceReport,
};
