/* ============================================================
   server/controllers/productController.js — Product CRUD
   ============================================================ */
const db = require('../../config/db');
const { validateCheckoutCustomer, generateOrderReference } = require('./orderWorkflow');
const { sendOrderNotifications, sendOrderStatusEmail, sendPaymentNotification } = require('../../services/notificationService');
const { ensureEmailTables } = require('../../services/emailMigration');
const { recordEvent } = require('../../services/vavhAiService');

async function ensureCustomerColumns(conn) {
  const requiredColumns = [
    { name: 'first_name', definition: 'VARCHAR(100) NULL AFTER user_id' },
    { name: 'last_name', definition: 'VARCHAR(100) NULL AFTER first_name' },
    { name: 'email', definition: 'VARCHAR(150) NULL AFTER last_name' },
    { name: 'address', definition: 'TEXT NULL AFTER email' },
    { name: 'name', definition: 'VARCHAR(200) NULL AFTER user_id' },
    { name: 'contact', definition: 'VARCHAR(100) NULL AFTER name' },
    { name: 'created_at', definition: 'TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER address' },
  ];

  for (const column of requiredColumns) {
    const [rows] = await conn.query(`SHOW COLUMNS FROM customers LIKE ?`, [column.name]);
    if (rows.length === 0) {
      await conn.query(`ALTER TABLE customers ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

async function ensureOrderColumns(conn) {
  const requiredColumns = [
    { name: 'order_reference', definition: 'VARCHAR(50) NULL UNIQUE AFTER status' },
    { name: 'customer_name', definition: 'VARCHAR(200) NULL AFTER customer_id' },
    { name: 'product_id', definition: 'INT NULL AFTER customer_name' },
    { name: 'product_name', definition: 'VARCHAR(200) NULL AFTER product_id' },
    { name: 'qty', definition: 'INT NULL AFTER product_name' },
    { name: 'total', definition: 'DECIMAL(10,2) NULL AFTER qty' },
    { name: 'finance_name_due', definition: 'VARCHAR(100) NULL AFTER total' },
    { name: 'due_total', definition: 'DECIMAL(10,2) NULL AFTER finance_name_due' },
    { name: 'due_paid', definition: 'DECIMAL(10,2) NULL AFTER due_total' },
    { name: 'due_remaining', definition: 'DECIMAL(10,2) NULL AFTER due_paid' },
    { name: 'notes', definition: 'TEXT NULL AFTER due_remaining' },
  ];

  for (const column of requiredColumns) {
    const [rows] = await conn.query(`SHOW COLUMNS FROM orders LIKE ?`, [column.name]);
    if (rows.length === 0) {
      await conn.query(`ALTER TABLE orders ADD COLUMN ${column.name} ${column.definition}`);
    }
  }
}

function splitCustomerName(fullName = '') {
  const trimmed = (fullName || '').trim();
  if (!trimmed) return { first_name: '', last_name: '' };
  const parts = trimmed.split(/\s+/);
  return {
    first_name: parts.shift() || '',
    last_name: parts.join(' ') || '',
  };
}

async function findOrCreateCustomer(conn, customerData, userId) {
  const normalized = validateCheckoutCustomer(customerData).normalized;
  const { first_name, last_name } = splitCustomerName(normalized.name);
  const publicName = normalized.name || `${first_name} ${last_name}`.trim() || normalized.email || normalized.phone || null;
  const contact = normalized.phone || normalized.email || null;

  if (userId) {
    const [existingUserCustomers] = await conn.query('SELECT id FROM customers WHERE user_id = ? LIMIT 1', [userId]);
    if (existingUserCustomers.length > 0) {
      const customerId = existingUserCustomers[0].id;
      await conn.query(
        'UPDATE customers SET user_id = COALESCE(?, user_id), name = ?, contact = ?, first_name = ?, last_name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
        [userId || null, publicName, contact, first_name, last_name, normalized.email || null, normalized.phone || null, normalized.address || null, customerId]
      );
      return customerId;
    }
  }

  const [existingCustomers] = await conn.query(
    'SELECT id FROM customers WHERE (email IS NOT NULL AND email = ?) OR (phone IS NOT NULL AND phone = ?) LIMIT 1',
    [normalized.email || null, normalized.phone || null]
  );

  if (existingCustomers.length > 0) {
    const customerId = existingCustomers[0].id;
    await conn.query(
      'UPDATE customers SET user_id = COALESCE(?, user_id), name = ?, contact = ?, first_name = ?, last_name = ?, email = ?, phone = ?, address = ? WHERE id = ?',
      [userId || null, publicName, contact, first_name, last_name, normalized.email || null, normalized.phone || null, normalized.address || null, customerId]
    );
    return customerId;
  }

  const [customerResult] = await conn.query(
    'INSERT INTO customers (user_id, name, contact, first_name, last_name, email, phone, address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [userId || null, publicName, contact, first_name, last_name, normalized.email || null, normalized.phone || null, normalized.address || null]
  );

  return customerResult.insertId;
}

// GET /api/products — list all products with optional filter/search
async function getProducts(req, res, next) {
  try {
    const { cat, q, featured, limit = 100, offset = 0 } = req.query;

    // Build dynamic WHERE clause to prevent SQL injection
    const conditions = ['p.is_active = 1'];
    const params = [];

    // Filter by category name if provided
    if (cat && cat !== 'all') {
      conditions.push('c.name = ?');
      params.push(cat);
    }

    // Full-text search across name and description
    if (q) {
      conditions.push('(p.name LIKE ? OR p.description LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }

    // Filter by featured flag
    if (featured === 'true') {
      conditions.push('p.is_featured = 1');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Join with categories table to get category name
    const [products] = await db.query(
      `SELECT p.id, p.name, p.description, p.price, p.image_url, p.is_featured,
              c.name AS category_name, c.id AS category_id
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    // Get total count for pagination
    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${where}`,
      params
    );

    res.json({ products, total: countRows[0].total });
  } catch (err) { next(err); }
}

// GET /api/products/:id — single product detail
async function getProduct(req, res, next) {
  try {
    const [rows] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Product not found.' });
    res.json(rows[0]);
  } catch (err) { next(err); }
}

module.exports = { getProducts, getProduct };


/* ============================================================
   server/controllers/categoryController.js — Categories
   ============================================================ */
async function getCategories(req, res, next) {
  try {
    const [cats] = await db.query('SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC');
    res.json(cats);
  } catch (err) { next(err); }
}

module.exports.getCategories = getCategories;


/* ============================================================
   server/controllers/serviceController.js — Services
   ============================================================ */
async function getServices(req, res, next) {
  try {
    const [services] = await db.query('SELECT id, title, description, icon FROM services WHERE is_active = 1 ORDER BY sort_order ASC');
    res.json(services);
  } catch (err) { next(err); }
}

module.exports.getServices = getServices;


/* ============================================================
   server/controllers/orderController.js — Order Management
   ============================================================ */

// POST /api/orders — create new order from cart
async function createOrder(req, res, next) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { items, total, customer, customerDetails } = req.body;
    const userId = req.user?.id;
    const customerPayload = customer || customerDetails || {
      name: req.body.name || req.body.customerName || '',
      email: req.body.email || '',
      phone: req.body.phone || '',
      address: req.body.address || '',
    };

    if (!items || items.length === 0) {
      await conn.rollback();
      return res.status(400).json({ message: 'Order must contain at least one item.' });
    }

    const validation = validateCheckoutCustomer(customerPayload);
    if (!validation.isValid) {
      await conn.rollback();
      return res.status(400).json({
        message: 'Please complete the missing customer details before placing your order.',
        missing: validation.missing,
        requiresCustomerDetails: true,
        customerDetails: validation.normalized,
      });
    }

    await ensureCustomerColumns(conn);
    await ensureOrderColumns(conn);
    await ensureEmailTables();

    const customerId = await findOrCreateCustomer(conn, validation.normalized, userId);

    const [orderResult] = await conn.query(
      'INSERT INTO orders (customer_id, total_amount, status, created_at, customer_name, total, order_reference) VALUES (?, ?, "Pending", NOW(), ?, ?, ?)',
      [customerId, total || 0, validation.normalized.name || null, total || 0, generateOrderReference(null, 'ORD', new Date().toISOString().slice(0, 10).replace(/-/g, ''))]
    );
    const orderId = orderResult.insertId;
    const orderReference = generateOrderReference(orderId, 'ORD', new Date().toISOString().slice(0, 10).replace(/-/g, ''));
    await conn.query('UPDATE orders SET order_reference = ? WHERE id = ?', [orderReference, orderId]);

    for (const item of items) {
      const [prodRows] = await conn.query('SELECT price, name FROM products WHERE id = ?', [item.product_id]);
      if (!prodRows.length) throw new Error(`Product ${item.product_id} not found.`);

      await conn.query(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price, comment) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, prodRows[0].price, item.comment || '']
      );
    }

    await conn.commit();

    await recordEvent({
      sessionId: req.body?.analyticsSessionId,
      eventType: 'purchase_completed',
      source: 'checkout',
    });

    const orderItems = [];
    for (const item of items) {
      const [prodRows] = await db.query('SELECT price, name FROM products WHERE id = ?', [item.product_id]);
      if (prodRows.length) {
        orderItems.push({
          name: prodRows[0].name,
          quantity: item.quantity,
          unitPrice: prodRows[0].price,
        });
      }
    }

    setImmediate(() => {
      sendOrderNotifications({
        orderId,
        orderReference,
        customerName: validation.normalized.name,
        customerEmail: validation.normalized.email,
        items: orderItems,
        totalAmount: total || 0,
        paymentMethod: req.body.paymentMethod || 'Cash on Delivery',
        shippingAddress: validation.normalized.address,
        estimatedDeliveryDate: req.body.estimatedDeliveryDate || 'Pending',
        adminEmails: process.env.ADMIN_NOTIFICATION_EMAILS ? process.env.ADMIN_NOTIFICATION_EMAILS.split(',') : [],
      }).catch((err) => console.error('[Email] Order notification failed:', err.message));
    });

    res.status(201).json({
      order_id: orderId,
      order_reference: orderReference,
      customer_id: customerId,
      message: 'Order placed successfully!',
    });

  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// GET /api/orders/my — get all orders for current user
async function getMyOrders(req, res, next) {
  try {
    const [orders] = await db.query(
      `SELECT o.id, o.total_amount AS total, o.status, o.created_at,
              COUNT(oi.id) AS item_count
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE c.user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(orders);
  } catch (err) { next(err); }
}

// GET /api/orders/:id — get single order with items
async function getOrder(req, res, next) {
  try {
    const [orders] = await db.query(
      `SELECT o.*, o.total_amount AS total
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = ? AND c.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!orders.length) return res.status(404).json({ message: 'Order not found.' });

    const [items] = await db.query(
      `SELECT oi.*, p.name AS product_name, p.image_url
       FROM order_items oi JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`,
      [req.params.id]
    );

    res.json({ ...orders[0], items });
  } catch (err) { next(err); }
}

module.exports.createOrder = createOrder;
module.exports.getMyOrders = getMyOrders;
module.exports.getOrder    = getOrder;
