// ============================================================
//  controllers/suppliersController.js
//  CRUD for the Management Suppliers table
// ============================================================

const db     = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function getTableColumns(table) {
  try {
    const schema = process.env.DB_NAME || process.env.MYSQL_DATABASE || null;
    if (!schema) return [];
    const [rows] = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
      [schema, table]
    );
    return rows.map(r => r.COLUMN_NAME);
  } catch (err) {
    return [];
  }
}

async function getAll(req, res) {
  try {
    const [rows] = await db.query('SELECT * FROM suppliers ORDER BY created_at DESC');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get suppliers error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

async function create(req, res) {
  const payload = req.body || {};
  if (!payload.company) return res.status(400).json({ success: false, message: 'Company name is required.' });

  try {
    const id = uuidv4();
    const cols = await getTableColumns('suppliers');

    // Map incoming keys to possible DB column names
    const map = {
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

    const insertCols = ['id'];
    const values = [id];

    for (const key of Object.keys(map)) {
      const candidates = map[key];
      const found = candidates.find(c => cols.includes(c));
      if (found) {
        insertCols.push(found);
        values.push(payload[key] || payload[key] === 0 ? payload[key] : '');
      }
    }

    // Ensure at least company column is present
    if (!insertCols.includes('company') && cols.includes('company')) {
      insertCols.push('company');
      values.push(payload.company || '');
    }

    const placeholders = insertCols.map(() => '?').join(',');
    const sql = `INSERT INTO suppliers (${insertCols.join(',')}) VALUES (${placeholders})`;
    await db.query(sql, values);
    res.json({ success: true, message: 'Supplier created.', id });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const payload = req.body || {};
  try {
    const cols = await getTableColumns('suppliers');
    const map = {
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

    const setParts = [];
    const values = [];
    for (const key of Object.keys(map)) {
      const candidates = map[key];
      const found = candidates.find(c => cols.includes(c));
      if (found && Object.prototype.hasOwnProperty.call(payload, key)) {
        setParts.push(`${found}=?`);
        values.push(payload[key]);
      }
    }

    // If nothing to update, return
    if (setParts.length === 0) return res.json({ success: true, message: 'Nothing to update.' });

    const sql = `UPDATE suppliers SET ${setParts.join(', ')} WHERE id=?`;
    values.push(id);
    await db.query(sql, values);
    res.json({ success: true, message: 'Supplier updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

async function remove(req, res) {
  try {
    await db.query('DELETE FROM suppliers WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Supplier deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

module.exports = { getAll, create, update, remove };
