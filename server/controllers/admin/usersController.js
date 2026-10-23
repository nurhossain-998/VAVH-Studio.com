// ============================================================
//  controllers/usersController.js
//  CRUD for the System Users table (admin-only operations)
// ============================================================

const db = require('../../config/db');
const bcrypt = require('bcryptjs');

async function getAll(req, res) {
  try {
    // Never return passwords
    const [rows] = await db.query(
      'SELECT id, username, name, email, role, designation, avatar, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

// ── POST /api/users — create new user (admin only) ────────
async function create(req, res) {
  const { username, name, email, password, role, designation } = req.body;

  if (!username || !name || !password) {
    return res.status(400).json({ success: false, message: 'Username, name, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  try {
    // Check if username already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
      [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await db.query(
      'INSERT INTO users (username, name, email, password_hash, role, designation, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [username.toLowerCase(), name, email || null, passwordHash, role || 'user', designation || '', role === 'admin' ? 2 : 4]
    );

    res.json({ success: true, message: 'User created successfully.', id: result.insertId });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ success: false, message: 'Failed to create user.' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, email, password, role, designation, avatar } = req.body;

  if (password && password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  try {
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.query(
        'UPDATE users SET name=?, email=?, password_hash=?, role=?, designation=?, avatar=? WHERE id=?',
        [name, email || null, passwordHash, role || 'user', designation || '', avatar || '', id]
      );
    } else {
      // Don't overwrite password if not provided
      await db.query(
        'UPDATE users SET name=?, email=?, role=?, designation=?, avatar=? WHERE id=?',
        [name, email || null, role || 'user', designation || '', avatar || '', id]
      );
    }
    res.json({ success: true, message: 'User updated.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

async function remove(req, res) {
  const { id } = req.params;

  // Safety: prevent deleting self
  if (req.user?.id != null && String(req.user.id) === String(id)) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }

  try {
    await db.query('DELETE FROM users WHERE id=?', [id]);
    res.json({ success: true, message: 'User deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

// ── PUT /api/users/profile — update own profile ───────────
async function updateProfile(req, res) {
  const { name, designation, password, avatar } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated.' });
  if (!name)   return res.status(400).json({ success: false, message: 'Name is required.' });

  try {
    if (password) {
      const passwordHash = await bcrypt.hash(password, 12);
      await db.query(
        'UPDATE users SET name=?, designation=?, password_hash=?, avatar=? WHERE id=?',
        [name, designation || '', passwordHash, avatar || '', userId]
      );
    } else {
      await db.query(
        'UPDATE users SET name=?, designation=?, avatar=? WHERE id=?',
        [name, designation || '', avatar || '', userId]
      );
    }

    // Refresh session with updated info
    const [[updated]] = await db.query(
      'SELECT id, username, name, email, role, designation, avatar FROM users WHERE id=?',
      [userId]
    );
    if (req.session) req.session.user = updated;

    res.json({ success: true, message: 'Profile updated.', user: updated });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
}

module.exports = { getAll, create, update, remove, updateProfile };
