const db = require('../../config/db');

// GET /api/customers
async function getAll(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM customers ORDER BY created_at DESC'
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('getAll customers error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers.',
    });
  }
}

// POST /api/customers
async function create(req, res) {
  const { name, contact, address } = req.body;

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Customer name is required.',
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO customers (name, contact, address)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [name, contact || '', address || 'N/A']
    );

    res.json({
      success: true,
      message: 'Customer created.',
      id: result.rows[0].id,
    });
  } catch (err) {
    console.error('create customer error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer.',
    });
  }
}

// PUT /api/customers/:id
async function update(req, res) {
  const { id } = req.params;
  const { name, contact, address } = req.body;

  try {
    await db.query(
      'UPDATE customers SET name = $1, contact = $2, address = $3 WHERE id = $4',
      [name, contact || '', address || '', id]
    );

    res.json({ success: true, message: 'Customer updated.' });
  } catch (err) {
    console.error('update customer error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer.',
    });
  }
}

// DELETE /api/customers/:id
async function remove(req, res) {
  const { id } = req.params;

  try {
    await db.query('DELETE FROM customers WHERE id = $1', [id]);

    res.json({ success: true, message: 'Customer deleted.' });
  } catch (err) {
    console.error('delete customer error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer.',
    });
  }
}

module.exports = { getAll, create, update, remove };
