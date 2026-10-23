/* ============================================================
   server/routes/adminRoutes.js — Admin-Only API Routes
   All routes protected by requireAuth + requireRole('admin')
   ============================================================ */
const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');
const { authSessionOrToken }  = require('../../middleware/authMiddleware');
const { requireRole } = require('../../middleware/authMiddleware');
const { validateProductPayload, ensureProductColumns } = require('../../controllers/admin/productsController');

// Apply auth (session or token) + admin role check to ALL admin routes
router.use(authSessionOrToken);
router.use((req, res, next) => {
  const role = (req.user?.role || req.user?.user?.role || '').toString().toLowerCase();
  if (role !== 'admin' && role !== 'super admin') {
    return res.status(403).json({ message: 'Access denied. Admins only.' });
  }
  next();
});

/* ── PRODUCTS ─────────────────────────────────────────────── */

// GET /api/admin/products — all active products only (deleted products not shown)
router.get('/products', async (req, res, next) => {
  try {
    const [products] = await db.query(
      `SELECT p.*, c.name AS category_name
       FROM products p LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_active = 1
       ORDER BY p.created_at DESC`
    );
    res.json(products);
  } catch (err) { next(err); }
});

// POST /api/admin/products — create new product
router.post('/products', async (req, res, next) => {
  try {
    await ensureProductColumns();
    const { name, price, category, image_url, description, is_featured = false } = req.body;
    const validation = validateProductPayload({ name, price });

    if (!validation.isValid) {
      return res.status(400).json({ message: validation.error });
    }

    // Resolve category name to ID
    const [cats] = await db.query('SELECT id FROM categories WHERE name = ?', [category]);
    const categoryId = cats[0]?.id || null;

    const [result] = await db.query(
      `INSERT INTO products (name, price, category_id, image_url, description, is_featured, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, NOW())`,
      [validation.normalized.name, validation.normalized.price, categoryId, image_url || '', description || '', is_featured ? 1 : 0]
    );
    res.status(201).json({ id: result.insertId, message: 'Product created.' });
  } catch (err) { next(err); }
});

// PUT /api/admin/products/:id — update product
router.put('/products/:id', async (req, res, next) => {
  try {
    await ensureProductColumns();
    const { name, price, category, image_url, description, is_featured, is_active } = req.body;

    if (price !== undefined) {
      const validation = validateProductPayload({ name: name ?? '', price });
      if (!validation.isValid) {
        return res.status(400).json({ message: validation.error });
      }
    }

    // Resolve category name to ID if provided
    let categoryId = undefined;
    if (category) {
      const [cats] = await db.query('SELECT id FROM categories WHERE name = ?', [category]);
      categoryId = cats[0]?.id || null;
    }

    const fields = [];
    const params = [];

    if (name !== undefined)        { fields.push('name = ?');        params.push(name.trim()); }
    if (price !== undefined)       { fields.push('price = ?');       params.push(parseFloat(price)); }
    if (categoryId !== undefined)  { fields.push('category_id = ?'); params.push(categoryId); }
    if (image_url !== undefined)   { fields.push('image_url = ?');   params.push(image_url); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (is_featured !== undefined) { fields.push('is_featured = ?'); params.push(is_featured ? 1 : 0); }
    if (is_active !== undefined)   { fields.push('is_active = ?');   params.push(is_active ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ message: 'No fields to update.' });

    params.push(req.params.id);
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ message: 'Product updated.' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/products/:id — soft delete (set is_active = 0)
router.delete('/products/:id', async (req, res, next) => {
  try {
    await db.query('UPDATE products SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Product deleted.' });
  } catch (err) { next(err); }
});

/* ── CATEGORIES ───────────────────────────────────────────── */

// POST /api/admin/categories — create category
router.post('/categories', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required.' });
    const [r] = await db.query('INSERT INTO categories (name, is_active) VALUES (?, 1)', [name.trim()]);
    res.status(201).json({ id: r.insertId, message: 'Category created.' });
  } catch (err) { next(err); }
});

// PUT /api/admin/categories/:id — update category
router.put('/categories/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    await db.query('UPDATE categories SET name = ? WHERE id = ?', [name.trim(), req.params.id]);
    res.json({ message: 'Category updated.' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/categories/:id — deactivate category
router.delete('/categories/:id', async (req, res, next) => {
  try {
    await db.query('UPDATE categories SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Category deleted.' });
  } catch (err) { next(err); }
});

/* ── ORDERS ───────────────────────────────────────────────── */

// GET /api/admin/orders — all orders
router.get('/orders', async (req, res, next) => {
  try {
    const [orders] = await db.query(
      `SELECT o.id,
              o.customer_id,
              o.total_amount AS total,
              o.status,
              o.created_at,
              TRIM(CONCAT(
                COALESCE(u.first_name, ''),
                CASE WHEN COALESCE(u.first_name, '') <> '' AND COALESCE(u.last_name, '') <> '' THEN ' ' ELSE '' END,
                COALESCE(u.last_name, '')
              )) AS user_name,
              u.email AS user_email,
              COUNT(oi.id) AS item_count
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       LEFT JOIN users u ON c.user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       GROUP BY o.id, o.customer_id, o.total_amount, o.status, o.created_at, u.first_name, u.last_name, u.email
       ORDER BY o.created_at DESC`
    );
    res.json(orders);
  } catch (err) { next(err); }
});

// PATCH /api/admin/orders/:id/status — update order status
router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending','processing','shipped','delivered','cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status value.' });
    }
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ message: 'Order status updated.' });
  } catch (err) { next(err); }
});

/* ── SERVICES ─────────────────────────────────────────────── */

// POST /api/admin/services — create service
router.post('/services', async (req, res, next) => {
  try {
    const { title, description } = req.body;
    const [r] = await db.query(
      'INSERT INTO services (title, description, is_active) VALUES (?, ?, 1)',
      [title.trim(), description?.trim() || '']
    );
    res.status(201).json({ id: r.insertId, message: 'Service created.' });
  } catch (err) { next(err); }
});

// PUT /api/admin/services/:id — update service
router.put('/services/:id', async (req, res, next) => {
  try {
    const { title, description } = req.body;
    await db.query('UPDATE services SET title = ?, description = ? WHERE id = ?',
      [title.trim(), description?.trim() || '', req.params.id]);
    res.json({ message: 'Service updated.' });
  } catch (err) { next(err); }
});

// DELETE /api/admin/services/:id
router.delete('/services/:id', async (req, res, next) => {
  try {
    await db.query('UPDATE services SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Service deleted.' });
  } catch (err) { next(err); }
});

/* ── ABOUT & SOCIAL ───────────────────────────────────────── */

// PUT /api/admin/about — update about content
router.put('/about', async (req, res, next) => {
  try {
    const { description, partners } = req.body;
    // Upsert: update if exists, insert if not
    await db.query(
      `INSERT INTO about_content (id, description, partners)
       VALUES (1, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description), partners = VALUES(partners)`,
      [description || '', partners || '']
    );
    res.json({ message: 'About content updated.' });
  } catch (err) { next(err); }
});

// PUT /api/admin/social-links — replace all social links
router.put('/social-links', async (req, res, next) => {
  try {
    const { links } = req.body; // Array of { platform, url }
    // Delete all existing and re-insert
    await db.query('DELETE FROM social_links');
    if (links && links.length > 0) {
      const values = links.map(l => [l.platform, l.url]);
      await db.query('INSERT INTO social_links (platform, url) VALUES ?', [values]);
    }
    res.json({ message: 'Social links updated.' });
  } catch (err) { next(err); }
});

module.exports = router;
