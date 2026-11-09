
// ============================================================
// controllers/ordersController.js
// PostgreSQL-compatible CRUD for Orders.
// Also handles stock deduction.
// ============================================================

const db = require('../../config/db');
const {
  sendNewOrderAdminNotification,
  sendOrderStatusEmail
} = require('../../services/notificationService');
const { ensureEmailTables } = require('../../services/emailMigration');

// ============================================================
// GET ALL ORDERS
// ============================================================

async function getAll(req, res) {
  try {
    const { rows } = await db.query(
      'SELECT * FROM orders ORDER BY created_at DESC'
    );

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Orders] Get all failed:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch orders.'
    });
  }
}

// ============================================================
// CREATE ORDER + DEDUCT STOCK
// ============================================================

async function create(req, res) {
 const {
  customerId,
  customerName,
  productId,
  productName,
  qty,
  total,
  financeNameDue,
  dueTotal,
  duePaid,
  dueRemaining,
  notes
} = req.body;

const quantity = Number(qty);
const totalAmount = Number(total);

  if (
  !customerId ||
  !customerName ||
  !productId ||
  !Number.isFinite(quantity) ||
  quantity <= 0 ||
  !Number.isFinite(totalAmount) ||
  totalAmount < 0
) {
  return res.status(400).json({
    success: false,
    message: 'Customer, product, and valid order details are required.'
  });
}

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // Lock the product row to prevent simultaneous orders
    // from deducting more stock than is available.
    const productResult = await client.query(
      'SELECT stock FROM products WHERE id = $1 FOR UPDATE',
      [productId]
    );

    const product = productResult.rows[0];

    if (!product) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Product not found.'
      });
    }

    if (Number(product.stock) < quantity) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stock}`
      });
    }

    // Deduct stock.
    await client.query(
      'UPDATE products SET stock = stock - $1 WHERE id = $2',
      [quantity, productId]
    );

    // Insert order and retrieve its generated ID.
const orderResult = await client.query(
  `INSERT INTO orders
   (
     customer_id,
     customer_name,
     product_id,
     product_name,
     qty,
     total_amount,
     total,
     status,
     finance_name_due,
     due_total,
     due_paid,
     due_remaining,
     notes
   )
   VALUES ($1, $2, $3, $4, $5, $6, $6, 'Pending', $7, $8, $9, $10, $11)
   RETURNING id`,
  [
    customerId,
    customerName,
    productId,
    productName || '',
    quantity,
    totalAmount,
    financeNameDue || '',
    dueTotal || 0,
    duePaid || 0,
    dueRemaining || 0,
    notes || ''
  ]
);

    const newOrderId = orderResult.rows[0].id;
    const orderId = 'ID' + String(newOrderId).padStart(4, '0');

    await client.query(
      'UPDATE orders SET order_reference = $1 WHERE id = $2',
      [orderId, newOrderId]
    );

    await client.query('COMMIT');

    // Send notification only after the database transaction succeeds.
    setImmediate(() => {
      sendNewOrderAdminNotification({
        orderId,
        customerName,
        totalAmount: total || 0,
        status: 'Pending'
      }).catch(err => {
        console.error(
          '[Email] Admin order notification failed:',
          err.message
        );
      });
    });

    res.json({
      success: true,
      message: `Order ${orderId} created.`,
      id: newOrderId,
      order_reference: orderId
    });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Orders] Create failed:', err);

    res.status(500).json({
      success: false,
      message: 'Failed to create order.'
    });
  } finally {
    client.release();
  }
}

// ============================================================
// UPDATE ORDER STATUS
// PUT /api/orders/:id/status
// ============================================================

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['Pending', 'Completed', 'Cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid status value.'
    });
  }

  try {
    await ensureEmailTables();

    const updateResult = await db.query(
      `UPDATE orders
       SET status = $1,
           completed_at = CASE
             WHEN $1 = 'Completed'
             THEN COALESCE(completed_at, NOW())
             ELSE completed_at
           END
       WHERE id = $2`,
      [status, id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    const orderResult = await db.query(
      `SELECT
         o.id,
         o.order_reference,
         c.email,
         c.name
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1`,
      [id]
    );

    const order = orderResult.rows[0];

    if (order?.email) {
      setImmediate(() => {
        sendOrderStatusEmail({
          orderId: order.id,
          orderReference: order.order_reference || `ORD-${order.id}`,
          customerEmail: order.email,
          customer: {
            email: order.email,
            name: order.name
          },
          status,
          updatedAt: new Date().toISOString()
        }).catch(err => {
          console.error(
            '[Email] Status notification failed:',
            err.message
          );
        });
      });
    }

    res.json({
      success: true,
      message: 'Order status updated.'
    });

  } catch (err) {
    console.error('[Orders] Status update failed:', err);

    res.status(500).json({
      success: false,
      message: 'Failed to update order status.'
    });
  }
}

// ============================================================
// DELETE ORDER
// ============================================================

async function remove(req, res) {
  const { id } = req.params;

  try {
    const result = await db.query(
      'DELETE FROM orders WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Order not found.'
      });
    }

    res.json({
      success: true,
      message: 'Order deleted.'
    });

  } catch (err) {
    console.error('[Orders] Delete failed:', err);

    res.status(500).json({
      success: false,
      message: 'Failed to delete order.'
    });
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getAll,
  create,
  updateStatus,
  remove
};
