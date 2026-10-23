/* ============================================================
   server/controllers/authController.js — Auth Logic
   Handles user registration, login, and token generation
   ============================================================ */

// bcrypt for hashing passwords before storing in database
const bcrypt = require('bcryptjs');

// jsonwebtoken for generating and signing JWT tokens
const jwt = require('jsonwebtoken');

// Database connection pool
const db = require('../../config/db');

// JWT secret — should be a long random string in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required.');

// Token expiry duration
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

/**
 * Helper: Generate a signed JWT for a user.
 * @param {object} user - User row from database
 * @returns {string}    - Signed JWT token string
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/* ── REGISTER ──────────────────────────────────────────────── */

/**
 * POST /api/auth/register
 * Create a new user account with hashed password.
 */
async function register(req, res, next) {
  try {
    let { first_name, last_name, name, email, password } = req.body;

    // Support both `name` (single field from storefront form) and `first_name` + `last_name`
    if (!first_name && name) {
      const parts = name.trim().split(/\s+/);
      first_name = parts[0];
      last_name  = parts.slice(1).join(' ');
    }

    // Validate required fields
    if (!first_name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Please provide a valid email address.' });
    }

    // Validate password length
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    // Check if email already exists in database
    const [existing] = await db.query(
      'SELECT id FROM users WHERE email = ?',
      [email.toLowerCase()]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    // Hash password with bcrypt — cost factor 12 for security
    const hashedPassword = await bcrypt.hash(password, 12);

    // Insert new user into database
    const [result] = await db.query(
      `INSERT INTO users (
      role_id,
      first_name,
      last_name,
      email,
      password_hash
   )
   VALUES (?, ?, ?, ?, ?)`,
      [
        5,
        first_name.trim(),
        last_name || '',
        email.toLowerCase().trim(),
        hashedPassword
      ]
    );

    // Fetch newly created user (without password) for token generation
    const [rows] = await db.query(
      `SELECT
      u.id,
      u.first_name,
      u.last_name,
      u.email,
      r.name AS role
   FROM users u
   JOIN roles r ON u.role_id = r.id
   WHERE u.id = ?`,
      [result.insertId]
    );

    const user = rows[0];
    user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    // Generate JWT token for the new user
    const token = generateToken(user);

    // Return token and user data
    res.status(201).json({ token, user });

  } catch (err) {
    next(err);
  }
}

/* ── LOGIN ─────────────────────────────────────────────────── */

/**
 * POST /api/auth/login
 * Authenticate user with email/password and return JWT.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user by email — include password_hash for comparison
    const [rows] = await db.query(
      `SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.password_hash,
        r.name AS role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      // Use generic message to prevent email enumeration attacks
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    // Compare submitted password against stored hash
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Remove password hash from user object before sending
    delete user.password_hash;
    
    // Add computed name for frontend
    user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    // Generate new JWT for this session
    const token = generateToken(user);

    // Return token and safe user data
    res.json({ token, user });

  } catch (err) {
    next(err);
  }
}

/* ── GET CURRENT USER ──────────────────────────────────────── */

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 */
async function getMe(req, res, next) {
  try {
    // req.user is set by requireAuth middleware
    const [rows] = await db.query(
      `SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.created_at,
        r.name AS role 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const user = rows[0];
    user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    res.json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
