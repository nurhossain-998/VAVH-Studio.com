
// ============================================================
//  controllers/suppliersController.js
//  CRUD for the Management Suppliers table (PostgreSQL)
// ============================================================

const db = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function getTableColumns(table) {
  try {
    const result = await db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = current_schema()
       AND table_name = $1`,
      [table]
    );

    return result.rows.map(row => row.column_name);
  } catch (err) {
    console.error('Get table columns error:', err);
    return [];
  }
}

const columnMap = {
  company: ['company'],
  name: ['name', 'contact', 'contact_person', 'contactPerson'],
  number: ['number', 'phone', 'phone_number'],
  email: ['email'],
  address: ['address'],
  notes: ['notes', 'comments'],
  supplierCode: ['supplier_code', 'supplierCode', 'code'],
  website: ['website', 'site', 'url'],
  tax_number: ['tax_number', 'taxnumber']
};

async function getAll(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM suppliers ORDER BY created_at DESC'
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get suppliers error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

async function create(req, res) {
  const payload = req.body || {};

  if (!payload.company) {
    return res.status(400).json({
      success: false,
      message: 'Company name is required.'
    });
  }

  try {
    const id = uuidv4();
    const cols = await getTableColumns('suppliers');

    const insertCols = ['id'];
    const values = [id];

    for (const key of Object.keys(columnMap)) {
      const found = columnMap[key].find(column => cols.includes(column));

      if (found && !insertCols.includes(found)) {
        insertCols.push(found);
        values.push(
          payload[key] !== undefined && payload[key] !== null
            ? payload[key]
            : ''
        );
      }
    }

    if (!insertCols.includes('company') && cols.includes('company')) {
      insertCols.push('company');
      values.push(payload.company);
    }

    const placeholders = insertCols.map(
      (_, index) => `$${index + 1}`
    ).join(', ');

    const sql = `
      INSERT INTO suppliers (${insertCols.join(', ')})
      VALUES (${placeholders})
    `;

    await db.query(sql, values);

    res.json({
      success: true,
      message: 'Supplier created.',
      id
    });
  } catch (err) {
    console.error('Create supplier error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const payload = req.body || {};

  try {
    const cols = await getTableColumns('suppliers');

    const setParts = [];
    const values = [];

    for (const key of Object.keys(columnMap)) {
      const found = columnMap[key].find(column => cols.includes(column));

      if (
        found &&
        Object.prototype.hasOwnProperty.call(payload, key)
      ) {
        values.push(payload[key]);
        setParts.push(`${found} = $${values.length}`);
      }
    }

    if (setParts.length === 0) {
      return res.json({
        success: true,
        message: 'Nothing to update.'
      });
    }

    values.push(id);

    const sql = `
      UPDATE suppliers
      SET ${setParts.join(', ')}
      WHERE id = $${values.length}
    `;

    const result = await db.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found.'
      });
    }

    res.json({
      success: true,
      message: 'Supplier updated.'
    });
  } catch (err) {
    console.error('Update supplier error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

async function remove(req, res) {
  try {
    const result = await db.query(
      'DELETE FROM suppliers WHERE id = $1',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found.'
      });
    }

    res.json({
      success: true,
      message: 'Supplier deleted.'
    });
  } catch (err) {
    console.error('Delete supplier error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

module.exports = { getAll, create, update, remove };
