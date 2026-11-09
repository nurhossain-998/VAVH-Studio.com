
// ============================================================
// Storefront Product, Category, Service and Order Controller
// PostgreSQL-compatible
// ============================================================

const db = require('../../config/db');

const {
  validateCheckoutCustomer,
  generateOrderReference
} = require('./orderWorkflow');

const {
  sendOrderNotifications
} = require('../../services/notificationService');

const {
  ensureEmailTables
} = require('../../services/emailMigration');

const {
  recordEvent
} = require('../../services/vavhAiService');

// ============================================================
// CUSTOMER HELPERS
// ============================================================

function splitCustomerName(fullName = '') {
  const trimmed = (fullName || '').trim();

  if (!trimmed) {
    return { first_name: '', last_name: '' };
  }

  const parts = trimmed.split(/\s+/);

  return {
    first_name: parts.shift() || '',
    last_name: parts.join(' ') || ''
  };
}

async function findOrCreateCustomer(client, customerData, userId) {
  const normalized = validateCheckoutCustomer(customerData).normalized;

  const { first_name, last_name } = splitCustomerName(normalized.name);

  const publicName =
    normalized.name ||
    `${first_name} ${last_name}`.trim() ||
    normalized.email ||
    normalized.phone ||
    null;

  const contact = normalized.phone || normalized.email || null;

  if (userId) {
    const existingUserResult = await client.query(
      `SELECT id FROM customers
       WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (existingUserResult.rows.length > 0) {
      const customerId = existingUserResult.rows[0].id;

      await client.query(
        `UPDATE customers
         SET user_id = COALESCE($1, user_id),
             name = $2,
             contact = $3,
             first_name = $4,
             last_name = $5,
             email = $6,
             phone = $7,
             address = $8
         WHERE id = $9`,
        [
          userId || null,
          publicName,
          contact,
          first_name,
          last_name,
          normalized.email || null,
          normalized.phone || null,
          normalized.address || null,
          customerId
        ]
      );

      return customerId;
    }
  }

  const existingResult = await client.query(
    `SELECT id FROM customers
     WHERE (email IS NOT NULL AND email = $1)
        OR (phone IS NOT NULL AND phone = $2)
     LIMIT 1`,
    [normalized.email || null, normalized.phone || null]
  );

  if (existingResult.rows.length > 0) {
    const customerId = existingResult.rows[0].id;

    await client.query(
      `UPDATE customers
       SET user_id = COALESCE($1, user_id),
           name = $2,
           contact = $3,
           first_name = $4,
           last_name = $5,
           email = $6,
           phone = $7,
           address = $8
       WHERE id = $9`,
      [
        userId || null,
        publicName,
        contact,
        first_name,
        last_name,
        normalized.email || null,
        normalized.phone || null,
        normalized.address || null,
        customerId
      ]
    );

    return customerId;
  }

  const customerResult = await client.query(
    `INSERT INTO customers (
      user_id,
      name,
      contact,
      first_name,
      last_name,
      email,
      phone,
      address
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id`,
    [
      userId || null,
      publicName,
      contact,
      first_name,
      last_name,
      normalized.email || null,
      normalized.phone || null,
      normalized.address || null
    ]
  );

  return customerResult.rows[0].id;
}

// ============================================================
// GET ALL PRODUCTS
// ============================================================

async function getProducts(req, res, next) {
  try {
    const {
      cat,
      q,
      featured,
      limit = 100,
      offset = 0
    } = req.query;

    const conditions = ['p.is_active = TRUE'];
    const params = [];

    if (cat && cat !== 'all') {
      params.push(cat);
      conditions.push(`c.name = $${params.length}`);
    }

    if (q) {
      params.push(`%${q}%`);
      const searchIndex = params.length;

      params.push(`%${q}%`);
      const descriptionIndex = params.length;

      conditions.push(
        `(p.name ILIKE $${searchIndex} OR p.description ILIKE $${descriptionIndex})`
      );
    }

    if (featured === 'true') {
      conditions.push('p.is_featured = TRUE');
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const parsedLimit = Math.min(
      Math.max(parseInt(limit, 10) || 100, 1),
      500
    );

    const parsedOffset = Math.max(
      parseInt(offset, 10) || 0,
      0
    );

    const productsResult = await db.query(
      `SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        p.image_url,
        p.is_featured,
        c.name AS category_name,
        c.id AS category_id
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length + 1}
       OFFSET $${params.length + 2}`,
      [...params, parsedLimit, parsedOffset]
    );

    const countResult = await db.query(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       ${where}`,
      params
    );

    res.json({
      products: productsResult.rows,
      total: Number(countResult.rows[0].total)
    });

  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET SINGLE PRODUCT
// ============================================================

async function getProduct(req, res, next) {
  try {
    const result = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1
       AND p.is_active = TRUE`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'Product not found.'
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET CATEGORIES
// ============================================================

async function getCategories(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, name
       FROM categories
       WHERE is_active = TRUE
       ORDER BY sort_order ASC, name ASC`
    );

    res.json(result.rows);

  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET SERVICES
// ============================================================

async function getServices(req, res, next) {
  try {
    const result = await db.query(
      `SELECT id, title, description, icon
       FROM services
       WHERE is_active = TRUE
       ORDER BY sort_order ASC`
    );

    res.json(result.rows);

  } catch (err) {
    next(err);
  }
}

// ============================================================
// CREATE STOREFRONT ORDER
// ============================================================

async function createOrder(req, res, next) {
  let client;

  try {
    const {
      items,
      total,
      customer,
      customerDetails
    } = req.body;

    const userId = req.user?.id;

    const customerPayload =
      customer ||
      customerDetails || {
        name: req.body.name || req.body.customerName || '',
        email: req.body.email || '',
        phone: req.body.phone || '',
        address: req.body.address || ''
      };

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        message: 'Order must contain at least one item.'
      });
    }

    const validation = validateCheckoutCustomer(customerPayload);

    if (!validation.isValid) {
      return res.status(400).json({
        message: 'Please complete the missing customer details before placing your order.',
        missing: validation.missing,
        requiresCustomerDetails: true,
        customerDetails: validation.normalized
      });
    }

    await ensureEmailTables();

    client = await db.connect();

    await client.query('BEGIN');

    const customerId = await findOrCreateCustomer(
      client,
      validation.normalized,
      userId
    );

    const orderResult = await client.query(
      `INSERT INTO orders (
        customer_id,
        total_amount,
        status,
        customer_name,
        total
      )
      VALUES ($1, $2, 'Pending', $3, $2)
      RETURNING id`,
      [
        customerId,
        total || 0,
        validation.normalized.name || null
      ]
    );

    const orderId = orderResult.rows[0].id;

    const orderReference = generateOrderReference(
      orderId,
      'ORD',
      new Date().toISOString().slice(0, 10).replace(/-/g, '')
    );

    await client.query(
      `UPDATE orders
       SET order_reference = $1
       WHERE id = $2`,
      [orderReference, orderId]
    );

    // Save order items and prepare notification data.
    const orderItems = [];

    for (const item of items) {
      const productResult = await client.query(
        `SELECT price, name
         FROM products
         WHERE id = $1
         AND is_active = TRUE`,
        [item.product_id]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Product ${item.product_id} not found.`);
      }

      const product = productResult.rows[0];
      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(
          `Invalid quantity for product ${item.product_id}.`
        );
      }

      await client.query(
        `INSERT INTO order_items (
          order_id,
          product_id,
          quantity,
          unit_price,
          comment
        )
        VALUES ($1, $2, $3, $4, $5)`,
        [
          orderId,
          item.product_id,
          quantity,
          product.price,
          item.comment || ''
        ]
      );

      orderItems.push({
        name: product.name,
        quantity,
        unitPrice: product.price
      });
    }

    await client.query('COMMIT');

    // Record analytics without affecting the saved order.
    recordEvent({
      sessionId: req.body?.analyticsSessionId,
      eventType: 'purchase_completed',
      source: 'checkout'
    }).catch(err => {
      console.error('[Analytics] Purchase event failed:', err.message);
    });

    // Send order notifications.
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
        adminEmails: process.env.ADMIN_NOTIFICATION_EMAILS
          ? process.env.ADMIN_NOTIFICATION_EMAILS.split(',')
          : []
      }).catch(err => {
        console.error(
          '[Email] Order notification failed:',
          err.message
        );
      });
    });

    res.status(201).json({
      order_id: orderId,
      order_reference: orderReference,
      customer_id: customerId,
      message: 'Order placed successfully!'
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }

    next(err);

  } finally {
    if (client) {
      client.release();
    }
  }
}

// ============================================================
// GET CURRENT USER ORDERS
// ============================================================

async function getMyOrders(req, res, next) {
  try {
    const result = await db.query(
      `SELECT
        o.id,
        o.total_amount AS total,
        o.status,
        o.created_at,
        COUNT(oi.id) AS item_count
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE c.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (err) {
    next(err);
  }
}

// ============================================================
// GET SINGLE CUSTOMER ORDER
// ============================================================

async function getOrder(req, res, next) {
  try {
    const orderResult = await db.query(
      `SELECT
        o.*,
        o.total_amount AS total
       FROM orders o
       JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1
       AND c.user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    const itemsResult = await db.query(
      `SELECT
        oi.*,
        p.name AS product_name,
        p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [req.params.id]
    );

    res.json({
      ...orderResult.rows[0],
      items: itemsResult.rows
    });

  } catch (err) {
    next(err);
  }
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  getProducts,
  getProduct,
  getCategories,
  getServices,
  createOrder,
  getMyOrders,
  getOrder
};
