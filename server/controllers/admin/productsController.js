const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

async function ensureProductColumns() {
  const requiredColumns = [
    { name: 'image_url', definition: 'VARCHAR(255)' },
    { name: 'is_featured', definition: 'BOOLEAN NOT NULL DEFAULT FALSE' },
    { name: 'is_active', definition: 'BOOLEAN NOT NULL DEFAULT TRUE' },
  ];

  for (const column of requiredColumns) {
    const result = await db.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
       AND table_name = 'products'
       AND column_name = $1`,
      [column.name]
    );

    if (result.rows.length === 0) {
      await db.query(
        `ALTER TABLE products ADD COLUMN ${column.name} ${column.definition}`
      );
    }
  }
}

function validateProductPayload(payload = {}) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const priceRaw = payload.price;
  const price = Number(priceRaw);

  if (!name) {
    return { isValid: false, error: 'Product name is required.' };
  }

  if (priceRaw === undefined || priceRaw === null || priceRaw === '' || Number.isNaN(price)) {
    return { isValid: false, error: 'Product price is required.' };
  }

  if (price < 0) {
    return { isValid: false, error: 'Price must be 0 or greater.' };
  }

  return { isValid: true, normalized: { ...payload, name, price } };
}

function normalizeAdminProductPayload(payload = {}) {
  const validation = validateProductPayload(payload);
  if (!validation.isValid) {
    return { ...validation, normalized: null };
  }

  return {
    ...validation,
    normalized: {
      name: validation.normalized.name,
      price: validation.normalized.price,
      description: (payload.description ?? payload.notes ?? '').toString().trim(),
      stock: Number.isFinite(Number(payload.stock)) ? Number(payload.stock) : 0,
      image_url: payload.image_url || '',
      is_featured: Boolean(payload.is_featured),
      category: typeof payload.category === 'string' ? payload.category.trim() : '',
      category_id: null,
      created_at: new Date(),
    },
  };
}

async function getAll(req, res) {
  try {
    const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
}

async function create(req, res) {
  const validation = normalizeAdminProductPayload(req.body);

  if (!validation.isValid) {
    return res.status(400).json({ success: false, message: validation.error });
  }

  try {
    await ensureProductColumns();

    let categoryId = null;
    if (validation.normalized.category) {
      const cats = await db.query(
        'SELECT id FROM categories WHERE name = $1 LIMIT 1',
        [validation.normalized.category]
      );
      categoryId = cats.rows[0]?.id ?? null;
    }

    const purchasedFlag = Boolean(
      req.body.product_already_purchased ||
      req.body.purchased ||
      req.body.is_purchased
    );

    const purchaseQtyRaw =
      req.body.purchase_quantity ||
      req.body.purchased_quantity ||
      req.body.purchaseQty ||
      null;

    const purchaseQty = Number.isFinite(Number(purchaseQtyRaw))
      ? Number(purchaseQtyRaw)
      : validation.normalized.stock;

    const result = await db.query(
      `INSERT INTO products
       (name, description, price, stock, category_id, image_url,
        is_featured, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, NOW())
       RETURNING id`,
      [
        validation.normalized.name,
        validation.normalized.description,
        validation.normalized.price,
        purchaseQty,
        categoryId,
        validation.normalized.image_url,
        validation.normalized.is_featured,
      ]
    );

    const newProductId = result.rows[0].id;

    if (purchasedFlag) {
      try {
        const purchaseCostRaw =
          req.body.purchase_total ||
          req.body.purchase_cost ||
          req.body.purchasePrice ||
          null;

        let totalCost = 0;
        if (purchaseCostRaw !== null && purchaseCostRaw !== '') {
          const cost = Number(purchaseCostRaw);
          if (!Number.isNaN(cost)) {
            totalCost = req.body.purchase_total
              ? cost
              : cost * (purchaseQty || 0);
          }
        }

        const supplier = req.body.purchase_supplier || req.body.supplier || '';
        const purchaseDate = req.body.purchase_date || req.body.date || null;

        if (totalCost > 0) {
          await db.query(
            `INSERT INTO product_costs
             (id, product_name, item_name, supplier, quantity, cost, date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              uuidv4(),
              validation.normalized.name,
              validation.normalized.name,
              supplier,
              purchaseQty || 0,
              totalCost,
              purchaseDate,
              'Initial purchase on product creation',
            ]
          );
        }

        if (purchaseQty > 0) {
          await db.query(
            `INSERT INTO inventory_adjustments
             (id, product_id, product_name, adj_type, qty, reference, note, date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              uuidv4(),
              newProductId,
              validation.normalized.name,
              'purchase',
              purchaseQty,
              '',
              'Initial purchase on product creation',
              purchaseDate,
            ]
          );
        }
      } catch (financeError) {
        console.error('Failed to record purchase/finance data:', financeError);
      }
    }

    res.json({ success: true, message: 'Product created.', id: newProductId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to create product.' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const {
    name, category, price, stock, notes, description,
    image_url, is_featured
  } = req.body;

  try {
    await ensureProductColumns();

    const fields = [];
    const params = [];

    if (name !== undefined) {
      fields.push(`name = $${params.length + 1}`);
      params.push(name.trim());
    }

    if (price !== undefined) {
      fields.push(`price = $${params.length + 1}`);
      params.push(Number(price));
    }

    if (stock !== undefined) {
      fields.push(`stock = $${params.length + 1}`);
      params.push(Number(stock));
    }

    if (category !== undefined) {
      const cats = await db.query(
        'SELECT id FROM categories WHERE name = $1 LIMIT 1',
        [category]
      );
      fields.push(`category_id = $${params.length + 1}`);
      params.push(cats.rows[0]?.id ?? null);
    }

    if (description !== undefined || notes !== undefined) {
      fields.push(`description = $${params.length + 1}`);
      params.push(description !== undefined ? description : notes);
    }

    if (image_url !== undefined) {
      fields.push(`image_url = $${params.length + 1}`);
      params.push(image_url);
    }

    if (is_featured !== undefined) {
      fields.push(`is_featured = $${params.length + 1}`);
      params.push(Boolean(is_featured));
    }

    if (!fields.length) {
      return res.status(400).json({ success: false, message: 'No fields to update.' });
    }

    params.push(id);
    await db.query(
      `UPDATE products SET ${fields.join(', ')} WHERE id = $${params.length}`,
      params
    );

    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
}

async function remove(req, res) {
  try {
    await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
}

async function adjustStock(req, res) {
  const { id } = req.params;
  const delta = Number(req.body.delta);

  if (!Number.isFinite(delta)) {
    return res.status(400).json({ success: false, message: 'Invalid stock adjustment.' });
  }

  try {
    await db.query(
      'UPDATE products SET stock = GREATEST(0, stock + $1) WHERE id = $2',
      [delta, id]
    );

    const result = await db.query(
      'SELECT stock FROM products WHERE id = $1',
      [id]
    );

    res.json({ success: true, newStock: result.rows[0]?.stock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to adjust stock.' });
  }
}

module.exports = {
  getAll,
  create,
  update,
  remove,
  adjustStock,
  ensureProductColumns,
  validateProductPayload,
  normalizeAdminProductPayload,
};
