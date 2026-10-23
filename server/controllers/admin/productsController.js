// ============================================================
//  controllers/productsController.js
//  CRUD for the Products (management inventory) table
// ============================================================

const db     = require('../../config/db');
const { v4: uuidv4 } = require('uuid');

async function ensureProductColumns(conn = db) {
  const requiredColumns = [
    { name: 'image_url', definition: 'VARCHAR(255) NULL AFTER price' },
    { name: 'is_featured', definition: 'TINYINT(1) NOT NULL DEFAULT 0 AFTER image_url' },
    { name: 'is_active', definition: 'TINYINT(1) NOT NULL DEFAULT 1 AFTER is_featured' },
  ];

  for (const column of requiredColumns) {
    const [rows] = await conn.query('SHOW COLUMNS FROM products LIKE ?', [column.name]);
    if (rows.length === 0) {
      await conn.query(`ALTER TABLE products ADD COLUMN ${column.name} ${column.definition}`);
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

  const name = validation.normalized.name;
  const price = validation.normalized.price;
  const description = (payload.description ?? payload.notes ?? '').toString().trim();
  const stock = Number.isFinite(Number(payload.stock)) ? Number(payload.stock) : 0;
  const image_url = payload.image_url || '';
  const is_featured = payload.is_featured ? 1 : 0;
  const category = typeof payload.category === 'string' ? payload.category.trim() : '';

  return {
    ...validation,
    normalized: {
      name,
      price,
      description,
      stock,
      image_url,
      is_featured,
      category,
      category_id: null,
      created_at: new Date(),
    },
  };
}

async function getAll(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM products ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
}

async function create(req, res) {
  const normalized = normalizeAdminProductPayload(req.body);

  if (!normalized.isValid) {
    return res.status(400).json({ success: false, message: normalized.error });
  }

  try {
    await ensureProductColumns();
    let categoryId = null;
    if (normalized.normalized.category) {
      const [cats] = await db.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [normalized.normalized.category]);
      categoryId = cats[0]?.id ?? null;
    }
    // Check if this product should be recorded as already purchased
    const purchasedFlag = req.body.product_already_purchased || req.body.purchased || req.body.is_purchased || false;
    // Determine initial stock: prefer explicit purchase quantity when marked purchased
    const purchaseQtyRaw = req.body.purchase_quantity || req.body.purchased_quantity || req.body.purchaseQty || null;
    const purchaseQty = Number.isFinite(Number(purchaseQtyRaw)) ? Number(purchaseQtyRaw) : normalized.normalized.stock;

    const [result] = await db.query(
      `INSERT INTO products (name, description, price, stock, category_id, image_url, is_featured, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
      [
        normalized.normalized.name,
        normalized.normalized.description,
        normalized.normalized.price,
        purchaseQty,
        categoryId,
        normalized.normalized.image_url,
        normalized.normalized.is_featured,
      ]
    );

    const newProductId = result.insertId;

    // If the product was already purchased, create finance & inventory records
    if (purchasedFlag) {
      try {
        // Compute total cost: accept either total or per-unit cost
        const purchaseCostRaw = req.body.purchase_total || req.body.purchase_cost || req.body.purchasePrice || null;
        let totalCost = 0;
        if (purchaseCostRaw !== null && purchaseCostRaw !== undefined && purchaseCostRaw !== '') {
          const pc = Number(purchaseCostRaw);
          if (!Number.isNaN(pc)) {
            // If provided as per-unit and we have a quantity, multiply
            totalCost = (req.body.purchase_total ? pc : (pc * (purchaseQty || 0)));
          }
        }

        const supplier = req.body.purchase_supplier || req.body.supplier || '';
        const purchaseDate = req.body.purchase_date || req.body.date || null;

        // Record product cost (affects finance totals and balance)
        if (totalCost && totalCost > 0) {
          const id = uuidv4();
          await db.query(
            'INSERT INTO product_costs (id, product_name, item_name, supplier, quantity, cost, date, notes) VALUES (?,?,?,?,?,?,?,?)',
            [id, normalized.normalized.name, normalized.normalized.name, supplier, purchaseQty || 0, totalCost, purchaseDate || null, 'Initial purchase on product creation']
          );
        }

        // Create an inventory adjustment record to reflect the purchased quantity
        if (purchaseQty && Number(purchaseQty) > 0) {
          const adjId = uuidv4();
          await db.query(
            'INSERT INTO inventory_adjustments (id, product_id, product_name, adj_type, qty, reference, note, date) VALUES (?,?,?,?,?,?,?,?)',
            [adjId, newProductId, normalized.normalized.name, 'purchase', purchaseQty, '', 'Initial purchase on product creation', purchaseDate || null]
          );
        }
      } catch (finErr) {
        console.error('Failed to record purchase/finance data for new product:', finErr);
        // Do not fail product creation if finance recording fails; return created product id
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
  const { name, sku, category, price, stock, supplier, manufacturer_price, notes, description, image_url, is_featured } = req.body;

  try {
    await ensureProductColumns();
    let categoryId = undefined;
    if (category !== undefined) {
      const [cats] = await db.query('SELECT id FROM categories WHERE name = ? LIMIT 1', [category]);
      categoryId = cats[0]?.id ?? null;
    }

    const fields = [];
    const params = [];

    if (name !== undefined) { fields.push('name = ?'); params.push(name.trim()); }
    if (price !== undefined) { fields.push('price = ?'); params.push(Number(price)); }
    if (stock !== undefined) { fields.push('stock = ?'); params.push(Number(stock)); }
    if (categoryId !== undefined) { fields.push('category_id = ?'); params.push(categoryId); }
    if (description !== undefined) { fields.push('description = ?'); params.push(description); }
    if (notes !== undefined && description === undefined) { fields.push('description = ?'); params.push(notes); }
    if (image_url !== undefined) { fields.push('image_url = ?'); params.push(image_url); }
    if (is_featured !== undefined) { fields.push('is_featured = ?'); params.push(is_featured ? 1 : 0); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'No fields to update.' });

    params.push(id);
    await db.query(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
    res.json({ success: true, message: 'Product updated.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    await db.query('DELETE FROM products WHERE id=?', [id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
}

// ── PATCH /api/products/:id/stock  — decrement stock when order is placed ──
async function adjustStock(req, res) {
  const { id }    = req.params;
  const { delta } = req.body;  // positive = add, negative = subtract

  try {
    // Use MAX to prevent negative stock
    await db.query(
      'UPDATE products SET stock = GREATEST(0, stock + ?) WHERE id=?',
      [delta, id]
    );
    const [[updated]] = await db.query('SELECT stock FROM products WHERE id=?', [id]);
    res.json({ success: true, newStock: updated?.stock });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to adjust stock.' });
  }
}

module.exports = { getAll, create, update, remove, adjustStock, ensureProductColumns, validateProductPayload, normalizeAdminProductPayload };
