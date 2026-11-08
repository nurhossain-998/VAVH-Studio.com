
// ============================================================
//  controllers/usersController.js
//  CRUD for the System Users table (PostgreSQL)
// ============================================================

const db = require('../../config/db');
const bcrypt = require('bcryptjs');

async function getAll(req, res) {
  try {
    const result = await db.query(
      `SELECT id, username, name, email, role, designation, avatar, created_at
       FROM users
       ORDER BY created_at DESC`
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

// POST /api/users — create new user (admin only)
async function create(req, res) {
  const { username, name, email, password, role, designation } = req.body;

  if (!username || !name || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username, name, and password are required.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.'
    });
  }

  try {
    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username already taken.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userRole = role || 'user';
    const roleId = userRole === 'admin' ? 2 : 4;

    const result = await db.query(
      `INSERT INTO users
       (username, name, email, password_hash, role, designation, role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        username.toLowerCase(),
        name,
        email || null,
        passwordHash,
        userRole,
        designation || '',
        roleId
      ]
    );

    res.json({
      success: true,
      message: 'User created successfully.',
      id: result.rows[0].id
    });
  } catch (err) {
    console.error('Create user error:', err);

    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create user.'
    });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, email, password, role, designation, avatar } = req.body;

  if (password && password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.'
    });
  }

  try {
    let result;

    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);

      result = await db.query(
        `UPDATE users
         SET name = $1, email = $2, password_hash = $3,
             role = $4, designation = $5, avatar = $6
         WHERE id = $7`,
        [
          name,
          email || null,
          passwordHash,
          role || 'user',
          designation || '',
          avatar || '',
          id
        ]
      );
    } else {
      result = await db.query(
        `UPDATE users
         SET name = $1, email = $2, role = $3,
             designation = $4, avatar = $5
         WHERE id = $6`,
        [
          name,
          email || null,
          role || 'user',
          designation || '',
          avatar || '',
          id
        ]
      );
    }

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

async function remove(req, res) {
  const { id } = req.params;

  // Prevent deleting the currently logged-in user
  if (req.user?.id != null && String(req.user.id) === String(id)) {
    return res.status(400).json({
      success: false,
      message: 'You cannot delete your own account.'
    });
  }

  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

// PUT /api/users/profile — update own profile
async function updateProfile(req, res) {
  const { name, designation, password, avatar } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated.'
    });
  }

  if (!name) {
    return res.status(400).json({
      success: false,
      message: 'Name is required.'
    });
  }

  if (password && password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.'
    });
  }

  try {
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);

      await db.query(
        `UPDATE users
         SET name = $1, designation = $2,
             password_hash = $3, avatar = $4
         WHERE id = $5`,
        [name, designation || '', passwordHash, avatar || '', userId]
      );
    } else {
      await db.query(
        `UPDATE users
         SET name = $1, designation = $2, avatar = $3
         WHERE id = $4`,
        [name, designation || '', avatar || '', userId]
      );
    }

    // Refresh session with updated user information
    const result = await db.query(
      `SELECT id, username, name, email, role, designation, avatar
       FROM users
       WHERE id = $1`,
      [userId]
    );

    const updated = result.rows[0];

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (req.session) {
      req.session.user = updated;
    }

    res.json({
      success: true,
      message: 'Profile updated.',
      user: updated
    });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
}

module.exports = { getAll, create, update, remove, updateProfile };
