
// ============================================================
//  controllers/authController.js
//  Handles login, logout, register, and session check.
//  PostgreSQL + Supabase compatible
// ============================================================

const db = require('../../config/db');
const bcrypt = require('bcryptjs');

// Role mapping from Supabase roles table
const ROLE_IDS = {
  'super admin': 1,
  admin: 2,
  manager: 3,
  staff: 4,
  customer: 5
};

function getRoleId(role) {
  return ROLE_IDS[String(role || 'customer').toLowerCase()] || null;
}

// POST /api/auth/login
async function login(req, res) {
  const { identifier, password } = req.body || {};

  if (!identifier || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.'
    });
  }

  try {
    const result = await db.query(
      `SELECT
         u.id,
         u.username,
         u.email,
         u.first_name,
         u.last_name,
         u.name,
         u.password_hash,
         u.created_at,
         u.role_id,
         COALESCE(r.name, u.role, 'Customer') AS role,
         u.designation,
         u.avatar
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = LOWER($1)
          OR LOWER(u.email) = LOWER($1)
       LIMIT 1`,
      [identifier.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please try again.'
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials. Please try again.'
      });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name || [user.first_name, user.last_name].filter(Boolean).join(' '),
      email: user.email,
      role: user.role,
      role_id: user.role_id,
      designation: user.designation || user.role,
      avatar: user.avatar || '',
      created_at: user.created_at
    };

    // Regenerate session ID after authentication.
    req.session.regenerate((regenerateError) => {
      if (regenerateError) {
        console.error('Session regeneration error:', regenerateError.message);

        return res.status(500).json({
          success: false,
          message: 'Unable to start a secure session.'
        });
      }

      req.session.user = safeUser;

      req.session.save((saveError) => {
        if (saveError) {
          console.error('Session save error:', saveError.message);

          return res.status(500).json({
            success: false,
            message: 'Unable to start a secure session.'
          });
        }

        return res.json({
          success: true,
          user: safeUser,
          message: `Welcome back, ${safeUser.name}!`
        });
      });
    });

  } catch (err) {
    console.error('Login error:', err.code || err.message);

    res.status(500).json({
      success: false,
      message: 'Server error during login.'
    });
  }
}

// POST /api/auth/logout
function logout(req, res) {
  if (!req.session) {
    res.clearCookie('connect.sid');

    return res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  }

  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Unable to end the session.'
      });
    }

    res.clearCookie('connect.sid');

    res.json({
      success: true,
      message: 'Logged out successfully.'
    });
  });
}

// GET /api/auth/session
function checkSession(req, res) {
  if (req.session && req.session.user) {
    return res.json({
      success: true,
      user: req.session.user
    });
  }

  if (req.user) {
    return res.json({
      success: true,
      user: req.user
    });
  }

  return res.json({
    success: false,
    message: 'No active session.'
  });
}

// POST /api/auth/register
// Admin-only access must be enforced by the route middleware.
async function register(req, res) {
  const {
    username,
    name,
    email,
    password,
    role,
    designation
  } = req.body || {};

  if (!email || !name || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email, name, and password are required.'
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters.'
    });
  }

  const userRole = role || 'customer';
  const roleId = getRoleId(userRole);

  if (!roleId) {
    return res.status(400).json({
      success: false,
      message: 'Invalid user role.'
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = (username || normalizedEmail).trim().toLowerCase();

    const existing = await db.query(
      `SELECT id
       FROM users
       WHERE LOWER(email) = $1
          OR LOWER(username) = $2`,
      [normalizedEmail, normalizedUsername]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const parts = name.trim().split(/\s+/);
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');

    const result = await db.query(
      `INSERT INTO users
       (
         username,
         first_name,
         last_name,
         name,
         email,
         password_hash,
         role_id,
         role,
         designation
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        normalizedUsername,
        firstName,
        lastName,
        name.trim(),
        normalizedEmail,
        hashedPassword,
        roleId,
        userRole,
        designation || ''
      ]
    );

    return res.json({
      success: true,
      message: 'User created successfully.',
      id: result.rows[0].id
    });

  } catch (err) {
    console.error('Register error:', err);

    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Server error during registration.'
    });
  }
}

// POST /api/auth/change-password
async function changePassword(req, res) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized.'
    });
  }

  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: 'Current and new password are required.'
    });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'New password must be at least 8 characters.'
    });
  }

  try {
    const userId = req.session.user.id;

    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.'
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect current password.'
      });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedNewPassword, userId]
    );

    res.json({
      success: true,
      message: 'Password updated successfully.'
    });

  } catch (err) {
    console.error('Change password error:', err.code || err.message);

    res.status(500).json({
      success: false,
      message: 'Server error while changing password.'
    });
  }
}

module.exports = {
  login,
  logout,
  checkSession,
  register,
  changePassword
};
