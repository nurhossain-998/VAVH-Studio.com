// ============================================================
//  controllers/authController.js
//  Handles login, logout, register, and session check.
// ============================================================

const db   = require('../../config/db');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// ── POST /api/auth/login ──────────────────────────────────
async function login(req, res) {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  try {
    // Support login by email or first_name/last_name (case-insensitive)
    const [rows] = await db.query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.password_hash, u.created_at, r.name as role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?) OR LOWER(u.first_name) = LOWER(?) OR LOWER(u.last_name) = LOWER(?)
       LIMIT 1`,
      [identifier, identifier, identifier, identifier]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
    }

    const user = rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Please try again.' });
    }

    // Remove password before storing in session
    const safeUser = {
      id:          user.id,
      username:    user.username,
      name:        user.first_name + (user.last_name ? ' ' + user.last_name : ''),
      email:       user.email,
      role:        user.role || 'customer',
      designation: user.role || 'Staff',
      avatar:      '',
      created_at:  user.created_at,
    };

    // Rotate the session identifier after authentication to prevent fixation.
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error('Login session regeneration failed:', regenerateError.message);
        return res.status(500).json({ success: false, message: 'Unable to start a secure session.' });
      }

      req.session.user = safeUser;
      req.session.save((saveError) => {
        if (saveError) {
          console.error('Login session save failed:', saveError.message);
          return res.status(500).json({ success: false, message: 'Unable to start a secure session.' });
        }
        return res.json({ success: true, user: safeUser, message: `Welcome back, ${safeUser.name}!` });
      });
    });

  } catch (err) {
    console.error('Login error:', err.code || err.message);
    
    // Check for common issues
    if (err.message.includes('ECONNREFUSED')) {
      return res.status(500).json({ 
        success: false, 
        message: 'Database connection refused. Is MySQL running?' 
      });
    }
    if (err.message.includes('Unknown database')) {
      return res.status(500).json({ 
        success: false, 
        message: 'Database not found. Please run database.sql to initialize.' 
      });
    }
    
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
}

// ── POST /api/auth/logout ─────────────────────────────────
function logout(req, res) {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ success: false, message: 'Unable to end the session.' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
}

// ── GET /api/auth/session ─────────────────────────────────
// Called on page load to check if user is still logged in
function checkSession(req, res) {
  if (req.session && req.session.user) {
    return res.json({ success: true, user: req.session.user });
  }
  if (req.user) {
    return res.json({ success: true, user: req.user });
  }
  return res.json({ success: false, message: 'No active session.' });
}

// ── POST /api/auth/register (admin only — create a new user) ──
async function register(req, res) {
  const { username, name, email, password, role, designation } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ success: false, message: 'Email, name, and password are required.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
  }

  try {
    // Check if email or name already exists
    const [existing] = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)',
      [email, name]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Username already taken.' });
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // role_id default to 5 for customer/user if not provided, assuming 1 is admin
    const roleId = role === 'admin' ? 2 : 5;

    await db.query(
      `INSERT INTO users (first_name, name, email, password_hash, role_id, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, name, email.toLowerCase(), hashedPassword, roleId, role || 'user']
    );

    return res.json({ success: true, message: 'User created successfully.' });

  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
}

// ── POST /api/auth/change-password ─────────────────────────────────
async function changePassword(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Current and new password are required.' });
  }

  try {
    const userId = req.session.user.id;
    const [rows] = await db.query('SELECT password_hash FROM users WHERE id = ?', [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Incorrect current password.' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = ? WHERE id = ?', [hashedNewPassword, userId]);

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err.code || err.message);
    res.status(500).json({ success: false, message: 'Server error while changing password.' });
  }
}

module.exports = { login, logout, checkSession, register, changePassword };
