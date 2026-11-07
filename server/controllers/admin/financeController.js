
// ============================================================
// controllers/financeController.js
// PostgreSQL-compatible finance controller
// Handles: Investments, Expenses, Product Costs, Marketing,
// Dealer/Supplier, Dashboard, Inventory, Due Tracking,
// Function Builder, Chats, Messages and Reports
// ============================================================

const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// INVESTMENTS
// ============================================================

async function getInvestments(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM investments ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createInvestment(req, res) {
  const { investor_name, amount, date, method, notes } = req.body;

  if (!investor_name || amount == null || amount === '') {
    return res.status(400).json({
      success: false,
      message: 'Investor name and amount are required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO investments
       (id, investor_name, amount, date, method, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
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
      `UPDATE investments
       SET investor_name = $1, amount = $2, date = $3,
           method = $4, notes = $5
       WHERE id = $6`,
      [investor_name, amount, date || null, method || 'Cash', notes || '', id]
    );

    res.json({ success: true, message: 'Investment updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteInvestment(req, res) {
  try {
    await db.query('DELETE FROM investments WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Investment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// EXPENSES
// ============================================================

async function getExpenses(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM expenses ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createExpense(req, res) {
  const { employee_name, amount, date, reason, attachment } = req.body;

  if (!employee_name || amount == null || amount === '') {
    return res.status(400).json({
      success: false,
      message: 'Employee name and amount are required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO expenses
       (id, employee_name, amount, date, reason, attachment)
       VALUES ($1, $2, $3, $4, $5, $6)`,
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
      `UPDATE expenses
       SET employee_name = $1, amount = $2, date = $3,
           reason = $4, attachment = $5
       WHERE id = $6`,
      [employee_name, amount, date || null, reason || '', attachment || '', id]
    );

    res.json({ success: true, message: 'Expense updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteExpense(req, res) {
  try {
    await db.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Expense deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// PRODUCT COSTS
// ============================================================

async function getProductCosts(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM product_costs ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createProductCost(req, res) {
  const {
    product_name, item_name, supplier, quantity, cost, date, notes
  } = req.body;

  if (!product_name || cost == null || cost === '') {
    return res.status(400).json({
      success: false,
      message: 'Product name and cost are required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO product_costs
       (id, product_name, item_name, supplier, quantity, cost, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id, product_name, item_name || '', supplier || '',
        quantity || 1, cost, date || null, notes || ''
      ]
    );

    res.json({ success: true, message: 'Product cost saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateProductCost(req, res) {
  const { id } = req.params;
  const {
    product_name, item_name, supplier, quantity, cost, date, notes
  } = req.body;

  try {
    await db.query(
      `UPDATE product_costs
       SET product_name = $1, item_name = $2, supplier = $3,
           quantity = $4, cost = $5, date = $6, notes = $7
       WHERE id = $8`,
      [
        product_name, item_name || '', supplier || '',
        quantity || 1, cost, date || null, notes || '', id
      ]
    );

    res.json({ success: true, message: 'Product cost updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteProductCost(req, res) {
  try {
    await db.query('DELETE FROM product_costs WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Product cost deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// MARKETING
// ============================================================

async function getMarketing(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM marketing ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createMarketing(req, res) {
  const {
    platform, campaign_name, amount, date, transaction_id, notes
  } = req.body;

  if (!platform || amount == null || amount === '') {
    return res.status(400).json({
      success: false,
      message: 'Platform and amount are required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO marketing
       (id, platform, campaign_name, amount, date, transaction_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        id, platform, campaign_name || '', amount,
        date || null, transaction_id || '', notes || ''
      ]
    );

    res.json({ success: true, message: 'Marketing record saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateMarketing(req, res) {
  const { id } = req.params;
  const {
    platform, campaign_name, amount, date, transaction_id, notes
  } = req.body;

  try {
    await db.query(
      `UPDATE marketing
       SET platform = $1, campaign_name = $2, amount = $3,
           date = $4, transaction_id = $5, notes = $6
       WHERE id = $7`,
      [
        platform, campaign_name || '', amount,
        date || null, transaction_id || '', notes || '', id
      ]
    );

    res.json({ success: true, message: 'Marketing record updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteMarketing(req, res) {
  try {
    await db.query('DELETE FROM marketing WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Marketing record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// DEALER / SUPPLIER LEDGER
// ============================================================

async function getDealerSupplier(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM dealer_supplier ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createDealerSupplier(req, res) {
  const { supplier_name, product, amount, paid, date, status, note } = req.body;

  if (!supplier_name) {
    return res.status(400).json({
      success: false,
      message: 'Supplier name is required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO dealer_supplier
       (id, supplier_name, product, amount, paid, date, status, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id, supplier_name, product || '', amount || 0,
        paid || 0, date || null, status || 'Pending', note || ''
      ]
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
      `UPDATE dealer_supplier
       SET supplier_name = $1, product = $2, amount = $3, paid = $4,
           date = $5, status = $6, note = $7
       WHERE id = $8`,
      [
        supplier_name, product || '', amount || 0, paid || 0,
        date || null, status || 'Pending', note || '', id
      ]
    );

    res.json({ success: true, message: 'Dealer/Supplier record updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteDealerSupplier(req, res) {
  try {
    await db.query('DELETE FROM dealer_supplier WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// FINANCE DASHBOARD STATS
// ============================================================

async function getStats(req, res) {
  try {
    const [
      invResult,
      expResult,
      prodResult,
      mktResult,
      revResult,
      manualResult
    ] = await Promise.all([
      db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM investments'),
      db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses'),
      db.query('SELECT COALESCE(SUM(cost), 0) AS total FROM product_costs'),
      db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM marketing'),
      db.query(
        `SELECT COALESCE(SUM(total), 0) AS total
         FROM orders WHERE status = 'Completed'`
      ),
      db.query(
        'SELECT amount FROM balance_manual ORDER BY id DESC LIMIT 1'
      )
    ]);

    const tI = Number(invResult.rows[0].total) || 0;
    const tE = Number(expResult.rows[0].total) || 0;
    const tP = Number(prodResult.rows[0].total) || 0;
    const tM = Number(mktResult.rows[0].total) || 0;
    const tOR = Number(revResult.rows[0].total) || 0;

    const manRow = manualResult.rows[0];
    const totalExpenses = tE + tP + tM;
    const autoBalance = tI + tOR - totalExpenses;
    const finalBalance = manRow ? Number(manRow.amount) : autoBalance;

    const [monthlyRevResult, monthlyExpResult] = await Promise.all([
      db.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', completed_at), 'YYYY-MM') AS month,
           COALESCE(SUM(total), 0) AS revenue
         FROM orders
         WHERE status = 'Completed'
           AND completed_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', completed_at)
         ORDER BY DATE_TRUNC('month', completed_at) ASC`
      ),
      db.query(
        `SELECT
           TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
           COALESCE(SUM(amount), 0) AS expenses
         FROM expenses
         WHERE created_at >= NOW() - INTERVAL '6 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at) ASC`
      )
    ]);

    res.json({
      success: true,
      stats: {
        tI, tE, tP, tM, tOR,
        totalExpenses,
        finalBalance,
        isManualBalance: !!manRow
      },
      charts: {
        monthlyRevenue: monthlyRevResult.rows,
        monthlyExpenses: monthlyExpResult.rows
      }
    });
  } catch (err) {
    console.error('getStats error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// MANUAL BALANCE
// ============================================================

async function setManualBalance(req, res) {
  const { amount } = req.body;

  if (amount == null || amount === '') {
    return res.status(400).json({
      success: false,
      message: 'Balance amount is required.'
    });
  }

  try {
    const existingResult = await db.query(
      'SELECT id FROM balance_manual ORDER BY id DESC LIMIT 1'
    );

    const existing = existingResult.rows[0];

    if (existing) {
      await db.query(
        'UPDATE balance_manual SET amount = $1 WHERE id = $2',
        [amount, existing.id]
      );
    } else {
      await db.query(
        'INSERT INTO balance_manual (amount) VALUES ($1)',
        [amount]
      );
    }

    res.json({ success: true, message: 'Balance override saved.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function clearManualBalance(req, res) {
  try {
    await db.query('DELETE FROM balance_manual');
    res.json({
      success: true,
      message: 'Manual balance cleared. Auto-calculation restored.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// INVENTORY ADJUSTMENTS
// ============================================================

async function getInventoryAdjustments(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM inventory_adjustments ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createInventoryAdjustment(req, res) {
  const {
    product_id, product_name, adj_type, qty, reference, note, date
  } = req.body;

  if (!product_id || qty == null || qty === '') {
    return res.status(400).json({
      success: false,
      message: 'Product ID and quantity are required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO inventory_adjustments
       (id, product_id, product_name, adj_type, qty, reference, note, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id, product_id, product_name || '', adj_type || 'adjustment_add',
        qty, reference || '', note || '', date || null
      ]
    );

    res.json({ success: true, message: 'Inventory adjustment recorded.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateInventoryAdjustment(req, res) {
  const { id } = req.params;
  const {
    product_id, product_name, adj_type, qty, reference, note, date
  } = req.body;

  try {
    await db.query(
      `UPDATE inventory_adjustments
       SET product_id = $1, product_name = $2, adj_type = $3,
           qty = $4, reference = $5, note = $6, date = $7
       WHERE id = $8`,
      [
        product_id, product_name || '', adj_type || 'adjustment_add',
        qty, reference || '', note || '', date || null, id
      ]
    );

    res.json({ success: true, message: 'Inventory adjustment updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteInventoryAdjustment(req, res) {
  try {
    await db.query(
      'DELETE FROM inventory_adjustments WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true, message: 'Inventory adjustment deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// ORDER REVENUE & TRACKING
// ============================================================

async function getOrderRevenue(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getOrderTracking(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// DUE TRACKING
// ============================================================

async function getDueTracking(req, res) {
  try {
    const [ordersResult, standaloneResult] = await Promise.all([
      db.query(
        `SELECT
           id,
           customer_name AS party_name,
           product_name AS description,
           qty,
           total AS due_total,
           status AS due_status,
           finance_name_due,
           due_paid,
           due_remaining,
           notes,
           created_at,
           updated_at,
           'order' AS _type
         FROM orders
         WHERE finance_name_due IS NOT NULL
           AND finance_name_due <> ''`
      ),
      db.query(
        `SELECT *, 'standalone' AS _type
         FROM due_records`
      )
    ]);

    const combined = [
      ...ordersResult.rows,
      ...standaloneResult.rows
    ].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    res.json({ success: true, data: combined });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createDueRecord(req, res) {
  const {
    party_name, description, finance_name_due,
    due_total, due_paid, due_date, due_status, notes
  } = req.body;

  if (!party_name || due_total == null || due_total === '') {
    return res.status(400).json({
      success: false,
      message: 'Party name and total due are required.'
    });
  }

  try {
    const id = uuidv4();
    const paid = Number(due_paid) || 0;
    const remaining = Math.max(0, Number(due_total) - paid);

    await db.query(
      `INSERT INTO due_records
       (id, party_name, description, finance_name_due, due_total,
        due_paid, due_remaining, due_date, due_status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id, party_name, description || '', finance_name_due || '',
        due_total, paid, remaining, due_date || null,
        due_status || 'Pending', notes || ''
      ]
    );

    res.json({ success: true, message: 'Due record saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateDueRecord(req, res) {
  const { id } = req.params;
  const {
    party_name, description, finance_name_due,
    due_total, due_paid, due_date, due_status, notes
  } = req.body;

  if (due_total == null || due_total === '') {
    return res.status(400).json({
      success: false,
      message: 'Total due is required.'
    });
  }

  try {
    const paid = Number(due_paid) || 0;
    const remaining = Math.max(0, Number(due_total) - paid);

    await db.query(
      `UPDATE due_records
       SET party_name = $1, description = $2, finance_name_due = $3,
           due_total = $4, due_paid = $5, due_remaining = $6,
           due_date = $7, due_status = $8, notes = $9
       WHERE id = $10`,
      [
        party_name, description || '', finance_name_due || '',
        due_total, paid, remaining, due_date || null,
        due_status || 'Pending', notes || '', id
      ]
    );

    res.json({ success: true, message: 'Due record updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteDueRecord(req, res) {
  try {
    await db.query('DELETE FROM due_records WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Due record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// FUNCTION BUILDER
// ============================================================

// PostgreSQL JSON/JSONB columns are normally returned as JS objects.
// This helper also supports rows containing JSON strings.
function parseJson(value, fallback = []) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function getFunctions(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM fn_builder_functions ORDER BY created_at DESC'
    );

    const data = rows.map(row => ({
      ...row,
      inputs: parseJson(row.inputs),
      steps: parseJson(row.steps)
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createFunction(req, res) {
  const {
    name, description, category, inputs, steps,
    output_var, output_label, output_format
  } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Name is required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO fn_builder_functions
       (id, name, description, category, inputs, steps,
        output_var, output_label, output_format)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)`,
      [
        id, name, description || '', category || 'finance',
        JSON.stringify(inputs || []), JSON.stringify(steps || []),
        output_var || '', output_label || 'Result',
        output_format || 'currency'
      ]
    );

    res.json({ success: true, message: 'Function saved.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateFunction(req, res) {
  const { id } = req.params;
  const {
    name, description, category, inputs, steps,
    output_var, output_label, output_format
  } = req.body;

  try {
    await db.query(
      `UPDATE fn_builder_functions
       SET name = $1, description = $2, category = $3,
           inputs = $4::jsonb, steps = $5::jsonb,
           output_var = $6, output_label = $7, output_format = $8
       WHERE id = $9`,
      [
        name, description || '', category || 'finance',
        JSON.stringify(inputs || []), JSON.stringify(steps || []),
        output_var || '', output_label || 'Result',
        output_format || 'currency', id
      ]
    );

    res.json({ success: true, message: 'Function updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteFunction(req, res) {
  try {
    await db.query(
      'DELETE FROM fn_builder_functions WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true, message: 'Function deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// MESSAGES / CHAT
// ============================================================

async function getChats(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM chats ORDER BY created_at DESC'
    );

    const data = rows.map(row => ({
      ...row,
      members: parseJson(row.members)
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createChat(req, res) {
  const { name, members } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Chat name is required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO chats (id, name, members)
       VALUES ($1, $2, $3::jsonb)`,
      [id, name, JSON.stringify(members || [])]
    );

    res.json({ success: true, message: 'Chat created.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function getMessages(req, res) {
  const { chat_id } = req.query;

  try {
    let result;

    if (chat_id) {
      result = await db.query(
        `SELECT * FROM messages
         WHERE chat_id = $1
         ORDER BY timestamp ASC`,
        [chat_id]
      );
    } else {
      result = await db.query(
        'SELECT * FROM messages ORDER BY timestamp DESC'
      );
    }

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function createMessage(req, res) {
  const { chat_id, sender_id, sender, message } = req.body;

  if (!chat_id || !message) {
    return res.status(400).json({
      success: false,
      message: 'Chat ID and message are required.'
    });
  }

  try {
    const id = uuidv4();

    await db.query(
      `INSERT INTO messages
       (id, chat_id, sender_id, sender, message)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, chat_id, sender_id || null, sender || 'Anonymous', message]
    );

    res.json({ success: true, message: 'Message sent.', id });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function deleteMessage(req, res) {
  try {
    await db.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Message deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// FINANCE REPORT
// ============================================================

async function getFinanceReport(req, res) {
  try {
    const [
      invResult,
      expResult,
      prodResult,
      mktResult,
      orderResult,
      manualResult,
      investmentsResult,
      expensesResult,
      productCostsResult,
      marketingResult,
      ordersResult,
      dealerSupplierResult,
      inventoryResult
    ] = await Promise.all([
      db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM investments'),
      db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses'),
      db.query('SELECT COALESCE(SUM(cost), 0) AS total FROM product_costs'),
      db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM marketing'),
      db.query(
        `SELECT COALESCE(SUM(total), 0) AS total
         FROM orders WHERE status = 'Completed'`
      ),
      db.query(
        'SELECT amount FROM balance_manual ORDER BY id DESC LIMIT 1'
      ),
      db.query('SELECT * FROM investments ORDER BY created_at DESC'),
      db.query('SELECT * FROM expenses ORDER BY created_at DESC'),
      db.query('SELECT * FROM product_costs ORDER BY created_at DESC'),
      db.query('SELECT * FROM marketing ORDER BY created_at DESC'),
      db.query('SELECT * FROM orders ORDER BY created_at DESC'),
      db.query('SELECT * FROM dealer_supplier ORDER BY created_at DESC'),
      db.query(
        'SELECT * FROM inventory_adjustments ORDER BY created_at DESC'
      )
    ]);

    const tI = Number(invResult.rows[0].total) || 0;
    const tE = Number(expResult.rows[0].total) || 0;
    const tP = Number(prodResult.rows[0].total) || 0;
    const tM = Number(mktResult.rows[0].total) || 0;
    const tOR = Number(orderResult.rows[0].total) || 0;

    const totalExpenses = tE + tP + tM;
    const autoBalance = tI + tOR - totalExpenses;
    const manRow = manualResult.rows[0];
    const finalBalance = manRow ? Number(manRow.amount) : autoBalance;

    res.json({
      success: true,
      summary: {
        totalInvestment: tI,
        totalExpenses,
        totalRevenue: tOR,
        finalBalance,
        isManualBalance: !!manRow
      },
      details: {
        investments: investmentsResult.rows,
        expenses: expensesResult.rows,
        productCosts: productCostsResult.rows,
        marketing: marketingResult.rows,
        orders: ordersResult.rows,
        dealerSupplier: dealerSupplierResult.rows,
        inventoryAdjustments: inventoryResult.rows
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getInvestments, createInvestment, updateInvestment, deleteInvestment,
  getExpenses, createExpense, updateExpense, deleteExpense,
  getProductCosts, createProductCost, updateProductCost, deleteProductCost,
  getMarketing, createMarketing, updateMarketing, deleteMarketing,
  getDealerSupplier, createDealerSupplier, updateDealerSupplier, deleteDealerSupplier,
  getStats, setManualBalance, clearManualBalance,
  getInventoryAdjustments, createInventoryAdjustment,
  updateInventoryAdjustment, deleteInventoryAdjustment,
  getOrderRevenue, getOrderTracking,
  getDueTracking, createDueRecord, updateDueRecord, deleteDueRecord,
  getChats, createChat, getMessages, createMessage, deleteMessage,
  getFunctions, createFunction, updateFunction, deleteFunction,
  getFinanceReport
};
