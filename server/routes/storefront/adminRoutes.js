
/* ============================================================
   server/routes/adminRoutes.js — Admin-Only API Routes
   PostgreSQL version
   ============================================================ */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { authSessionOrToken } = require('../../middleware/authMiddleware');
const {
    validateProductPayload,
    ensureProductColumns
} = require('../../controllers/admin/productsController');

// Apply authentication and admin role check to all routes
router.use(authSessionOrToken);

router.use((req, res, next) => {
    const role = (req.user?.role || req.user?.user?.role || '')
        .toString()
        .toLowerCase();

    if (role !== 'admin' && role !== 'super admin') {
        return res.status(403).json({
            message: 'Access denied. Admins only.'
        });
    }

    next();
});

/* ── PRODUCTS ─────────────────────────────────────────────── */

// GET /api/admin/products
router.get('/products', async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT p.*, c.name AS category_name
             FROM products p
             LEFT JOIN categories c ON p.category_id = c.id
             WHERE p.is_active = TRUE
             ORDER BY p.created_at DESC`
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// POST /api/admin/products
router.post('/products', async (req, res, next) => {
    try {
        await ensureProductColumns();

        const {
            name,
            price,
            category,
            image_url,
            description,
            is_featured = false
        } = req.body;

        const validation = validateProductPayload({ name, price });

        if (!validation.isValid) {
            return res.status(400).json({
                message: validation.error
            });
        }

        const categoryResult = await db.query(
            'SELECT id FROM categories WHERE name = $1 LIMIT 1',
            [category]
        );

        const categoryId = categoryResult.rows[0]?.id ?? null;

        const result = await db.query(
            `INSERT INTO products
             (name, price, category_id, image_url, description,
              is_featured, is_active, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
             RETURNING id`,
            [
                validation.normalized.name,
                validation.normalized.price,
                categoryId,
                image_url || '',
                description || '',
                Boolean(is_featured)
            ]
        );

        res.status(201).json({
            id: result.rows[0].id,
            message: 'Product created.'
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/products/:id
router.put('/products/:id', async (req, res, next) => {
    try {
        await ensureProductColumns();

        const {
            name,
            price,
            category,
            image_url,
            description,
            is_featured,
            is_active
        } = req.body;

        if (price !== undefined) {
            const validation = validateProductPayload({
                name: name ?? '',
                price
            });

            if (!validation.isValid) {
                return res.status(400).json({
                    message: validation.error
                });
            }
        }

        let categoryId;

        if (category !== undefined) {
            const categoryResult = await db.query(
                'SELECT id FROM categories WHERE name = $1 LIMIT 1',
                [category]
            );

            categoryId = categoryResult.rows[0]?.id ?? null;
        }

        const fields = [];
        const params = [];

        const addField = (column, value) => {
            params.push(value);
            fields.push(`${column} = $${params.length}`);
        };

        if (name !== undefined) {
            addField('name', name.trim());
        }

        if (price !== undefined) {
            addField('price', Number(price));
        }

        if (categoryId !== undefined || category !== undefined) {
            addField('category_id', categoryId);
        }

        if (image_url !== undefined) {
            addField('image_url', image_url);
        }

        if (description !== undefined) {
            addField('description', description);
        }

        if (is_featured !== undefined) {
            addField('is_featured', Boolean(is_featured));
        }

        if (is_active !== undefined) {
            addField('is_active', Boolean(is_active));
        }

        if (!fields.length) {
            return res.status(400).json({
                message: 'No fields to update.'
            });
        }

        params.push(req.params.id);

        await db.query(
            `UPDATE products
             SET ${fields.join(', ')}
             WHERE id = $${params.length}`,
            params
        );

        res.json({
            message: 'Product updated.'
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/products/:id
router.delete('/products/:id', async (req, res, next) => {
    try {
        await db.query(
            'UPDATE products SET is_active = FALSE WHERE id = $1',
            [req.params.id]
        );

        res.json({
            message: 'Product deleted.'
        });
    } catch (err) {
        next(err);
    }
});

/* ── CATEGORIES ───────────────────────────────────────────── */

// POST /api/admin/categories
router.post('/categories', async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: 'Name is required.'
            });
        }

        const result = await db.query(
            `INSERT INTO categories (name, is_active)
             VALUES ($1, TRUE)
             RETURNING id`,
            [name.trim()]
        );

        res.status(201).json({
            id: result.rows[0].id,
            message: 'Category created.'
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/categories/:id
router.put('/categories/:id', async (req, res, next) => {
    try {
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                message: 'Name is required.'
            });
        }

        await db.query(
            'UPDATE categories SET name = $1 WHERE id = $2',
            [name.trim(), req.params.id]
        );

        res.json({
            message: 'Category updated.'
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/categories/:id
router.delete('/categories/:id', async (req, res, next) => {
    try {
        await db.query(
            'UPDATE categories SET is_active = FALSE WHERE id = $1',
            [req.params.id]
        );

        res.json({
            message: 'Category deleted.'
        });
    } catch (err) {
        next(err);
    }
});

/* ── ORDERS ───────────────────────────────────────────────── */

// GET /api/admin/orders
router.get('/orders', async (req, res, next) => {
    try {
        const result = await db.query(
            `SELECT
                o.id,
                o.customer_id,
                o.total_amount AS total,
                o.status,
                o.created_at,
                TRIM(CONCAT(
                    COALESCE(u.first_name, ''),
                    CASE
                        WHEN COALESCE(u.first_name, '') <> ''
                         AND COALESCE(u.last_name, '') <> ''
                        THEN ' '
                        ELSE ''
                    END,
                    COALESCE(u.last_name, '')
                )) AS user_name,
                u.email AS user_email,
                COUNT(oi.id)::INTEGER AS item_count
             FROM orders o
             LEFT JOIN customers c ON o.customer_id = c.id
             LEFT JOIN users u ON c.user_id = u.id
             LEFT JOIN order_items oi ON o.id = oi.order_id
             GROUP BY
                o.id,
                o.customer_id,
                o.total_amount,
                o.status,
                o.created_at,
                u.first_name,
                u.last_name,
                u.email
             ORDER BY o.created_at DESC`
        );

        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/admin/orders/:id/status
router.patch('/orders/:id/status', async (req, res, next) => {
    try {
        const { status } = req.body;

        const validStatuses = [
            'pending',
            'processing',
            'shipped',
            'delivered',
            'cancelled'
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status value.'
            });
        }

        await db.query(
            'UPDATE orders SET status = $1 WHERE id = $2',
            [status, req.params.id]
        );

        res.json({
            message: 'Order status updated.'
        });
    } catch (err) {
        next(err);
    }
});

/* ── SERVICES ─────────────────────────────────────────────── */

// POST /api/admin/services
router.post('/services', async (req, res, next) => {
    try {
        const { title, description } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: 'Service title is required.'
            });
        }

        const result = await db.query(
            `INSERT INTO services (title, description, is_active)
             VALUES ($1, $2, TRUE)
             RETURNING id`,
            [title.trim(), description?.trim() || '']
        );

        res.status(201).json({
            id: result.rows[0].id,
            message: 'Service created.'
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/services/:id
router.put('/services/:id', async (req, res, next) => {
    try {
        const { title, description } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                message: 'Service title is required.'
            });
        }

        await db.query(
            `UPDATE services
             SET title = $1, description = $2
             WHERE id = $3`,
            [title.trim(), description?.trim() || '', req.params.id]
        );

        res.json({
            message: 'Service updated.'
        });
    } catch (err) {
        next(err);
    }
});

// DELETE /api/admin/services/:id
router.delete('/services/:id', async (req, res, next) => {
    try {
        await db.query(
            'UPDATE services SET is_active = FALSE WHERE id = $1',
            [req.params.id]
        );

        res.json({
            message: 'Service deleted.'
        });
    } catch (err) {
        next(err);
    }
});

/* ── ABOUT & SOCIAL ───────────────────────────────────────── */

// PUT /api/admin/about
router.put('/about', async (req, res, next) => {
    try {
        const { description, partners } = req.body;

        await db.query(
            `INSERT INTO about_content (id, description, partners)
             VALUES (1, $1, $2)
             ON CONFLICT (id)
             DO UPDATE SET
                description = EXCLUDED.description,
                partners = EXCLUDED.partners,
                updated_at = NOW()`,
            [description || '', partners || '']
        );

        res.json({
            message: 'About content updated.'
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/admin/social-links
router.put('/social-links', async (req, res, next) => {
    const client = await db.connect();

    try {
        const { links } = req.body;

        if (links !== undefined && !Array.isArray(links)) {
            return res.status(400).json({
                message: 'Links must be an array.'
            });
        }

        await client.query('BEGIN');

        await client.query('DELETE FROM social_links');

        if (links && links.length > 0) {
            for (const link of links) {
                if (
                    !link ||
                    typeof link.platform !== 'string' ||
                    typeof link.url !== 'string' ||
                    !link.platform.trim() ||
                    !link.url.trim()
                ) {
                    throw new Error('Each social link needs a platform and URL.');
                }

                await client.query(
                    `INSERT INTO social_links (platform, url)
                     VALUES ($1, $2)`,
                    [link.platform.trim(), link.url.trim()]
                );
            }
        }

        await client.query('COMMIT');

        res.json({
            message: 'Social links updated.'
        });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

module.exports = router;
