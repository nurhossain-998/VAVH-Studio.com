// ============================================================
//  controllers/ordersController.js
//  CRUD for Orders. Also handles stock deduction.
// ============================================================

const db     = require('../../config/db');
const { sendNewOrderAdminNotification, sendOrderStatusEmail, sendPaymentNotification } = require('../../services/notificationService');
const { ensureEmailTables } = require('../../services/emailMigration');

async function getAll(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders.' });
  }
}

async function create(req, res) {
  const {
    customerName, productId, productName, qty,
    total, financeNameDue, dueTotal, duePaid, dueRemaining, notes
  } = req.body;

  if (!customerName || !productId || !qty) {
    return res.status(400).json({ success: false, message: 'Customer, product, and qty are required.' });
  }

  try {
    // ── Generate next sequential order ID ──────────────────
    const [existing] = await db.query("SELECT id FROM orders ORDER BY created_at DESC");
    let maxNum = 0;
    existing.forEach(o => {
      const n = parseInt((o.id || '').replace('ID', '')) || 0;
      if (n > maxNum) maxNum = n;
    });
    const orderId = 'ID' + String(maxNum + 1).padStart(4, '0');

    // ── Check stock ────────────────────────────────────────
    const [[product]] = await db.query('SELECT stock FROM products WHERE id=?', [productId]);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    if (product.stock < qty) {
      return res.status(400).json({ success: false, message: `Insufficient stock. Available: ${product.stock}` });
    }

    // ── Deduct stock ───────────────────────────────────────
    await db.query('UPDATE products SET stock = stock - ? WHERE id=?', [qty, productId]);

    // ── Insert order ───────────────────────────────────────
    await db.query(
      `INSERT INTO orders
         (id, customer_name, product_id, product_name, qty, total, status,
          finance_name_due, due_total, due_paid, due_remaining, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?)`,
      [orderId, customerName, productId, productName, qty, total || 0,
       financeNameDue || '', dueTotal || 0, duePaid || 0, dueRemaining || 0, notes || '']
    );

    setImmediate(() => {
      sendNewOrderAdminNotification({
        orderId,
        customerName,
        totalAmount: total || 0,
        status: 'Pending',
      }).catch((err) => console.error('[Email] Admin order notification failed:', err.message));
    });

    res.json({ success: true, message: `Order ${orderId} created.`, id: orderId });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create order.' });
  }
}

// ── PUT /api/orders/:id/status — update status only ──────
async function updateStatus(req, res) {
  const { id }     = req.params;
  const { status } = req.body;

  const validStatuses = ['Pending', 'Completed', 'Cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value.' });
  }

  try {
    await ensureEmailTables();

    // If completing the order, record the completion time
    const completedAt = status === 'Completed' ? new Date() : null;

    await db.query(
      `UPDATE orders SET status=?, completed_at=COALESCE(?, completed_at) WHERE id=?`,
      [status, completedAt, id]
    );

    const [[order]] = await db.query('SELECT o.id, o.order_reference, o.total_amount, c.email, c.name FROM orders o LEFT JOIN customers c ON o.customer_id = c.id WHERE o.id = ?', [id]);
    if (order?.email) {
      setImmediate(() => {
        sendOrderStatusEmail({
          orderId: order.id,
          orderReference: order.order_reference || `ORD-${order.id}`,
          customerEmail: order.email,
          customer: { email: order.email, name: order.name },
          status,
          updatedAt: new Date().toISOString(),
        }).catch((err) => console.error('[Email] Status notification failed:', err.message));
      });
    }

    res.json({ success: true, message: 'Order status updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update order status.' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM orders WHERE id=?', [id]);
    res.json({ success: true, message: 'Order deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete order.' });
  }
}

module.exports = { getAll, create, updateStatus, remove };
