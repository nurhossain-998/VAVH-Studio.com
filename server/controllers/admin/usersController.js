
const db = require('../../config/db');
const bcrypt = require('bcryptjs');

const ROLE_IDS = {
  'super admin': 1,
  admin: 2,
  manager: 3,
  staff: 4,
  customer: 5
};

function getRoleId(role) {
  return ROLE_IDS[String(role || 'staff').toLowerCase()] || null;
}

async function getAll(req, res) {
  try {
    const result = await db.query(`
      SELECT id, username, first_name, last_name, name,
             email, role_id, role, designation, avatar, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

async function create(req, res) {
  const { username, name, email, password, role, designation } = req.body;

  if (!username || !name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username, name, email, and password are required.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.'
    });
  }

  const roleId = getRoleId(role);
  if (!roleId) {
    return res.status(400).json({ success: false, message: 'Invalid user role.' });
  }

  try {
    const existing = await db.query(
      `SELECT id FROM users
       WHERE LOWER(username) = LOWER($1)
          OR LOWER(email) = LOWER($2)`,
      [username, email]
    );

    if (existing.rows.length) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const result = await db.query(
      `INSERT INTO users
       (username, first_name, last_name, name, email,
        password_hash, role_id, role, designation)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        username.toLowerCase(),
        firstName,
        lastName,
        name,
        email.toLowerCase(),
        passwordHash,
        roleId,
        role,
        designation || ''
      ]
    );

    res.json({
      success: true,
      message: 'User created successfully.',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(err.code === '23505' ? 409 : 500).json({
      success: false,
      message: err.code === '23505'
        ? 'Username or email already exists.'
        : 'Failed to create user.'
    });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, email, password, role, designation, avatar } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: 'Name and email are required.'
    });
  }

  if (password && password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.'
    });
  }

  const roleId = getRoleId(role);
  if (!roleId) {
    return res.status(400).json({ success: false, message: 'Invalid user role.' });
  }

  try {
    const parts = name.trim().split(/\s+/);
    const values = [
      parts[0],
      parts.slice(1).join(' '),
      name,
      email.toLowerCase(),
      roleId,
      role,
      designation || '',
      avatar || ''
    ];

    let sql = `
      UPDATE users
      SET first_name=$1, last_name=$2, name=$3, email=$4,
          role_id=$5, role=$6, designation=$7, avatar=$8
    `;

    if (password) {
      values.push(await bcrypt.hash(password, 12));
      sql += `, password_hash=$${values.length}`;
    }

    values.push(id);
    sql += ` WHERE id=$${values.length}`;

    const result = await db.query(sql, values);

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

async function remove(req, res) {
  const { id } = req.params;

  if (req.user?.id != null && String(req.user.id) === String(id)) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete your own account.'
    });
  }

  try {
    const result = await db.query(
      'DELETE FROM users WHERE id=$1',
      [id]
    );

    if (!result.rowCount) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

async function updateProfile(req, res) {
  const { name, designation, password, avatar } = req.body;
  const userId = req.user?.id || req.session?.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }

  if (!name) {
    return res.status(400).json({ success: false, message: 'Name is required.' });
  }

  if (password && password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.'
    });
  }

  try {
    const parts = name.trim().split(/\s+/);
    const values = [
      parts[0],
      parts.slice(1).join(' '),
      name,
      designation || '',
      avatar || ''
    ];

    let sql = `
      UPDATE users
      SET first_name=$1, last_name=$2, name=$3,
          designation=$4, avatar=$5
    `;

    if (password) {
      values.push(await bcrypt.hash(password, 12));
      sql += `, password_hash=$${values.length}`;
    }

    values.push(userId);
    sql += ` WHERE id=$${values.length}`;

    const updateResult = await db.query(sql, values);

    if (!updateResult.rowCount) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const result = await db.query(
      `SELECT id, username, first_name, last_name, name,
              email, role_id, role, designation, avatar
       FROM users WHERE id=$1`,
      [userId]
    );

    const updated = result.rows[0];

    if (req.session) {
      req.session.user = { ...req.session.user, ...updated };
    }

    res.json({ success: true, message: 'Profile updated.', user: updated });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

module.exports = { getAll, create, update, remove, updateProfile };
