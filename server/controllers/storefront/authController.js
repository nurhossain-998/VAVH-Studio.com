// ============================================================
// Storefront Authentication Controller
// PostgreSQL-compatible
// ============================================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../../config/db');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required.');
}

const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const CUSTOMER_ROLE_ID = 5;

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

// REGISTER
async function register(req, res, next) {
  try {
    let { first_name, last_name, name, email, password } = req.body;

    if (!first_name && name) {
      const parts = name.trim().split(/\s+/);
      first_name = parts[0];
      last_name = parts.slice(1).join(' ');
    }

    if (!first_name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email, and password are required.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        message: 'Please provide a valid email address.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters.'
      });
    }

    const existingResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [normalizedEmail]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        message: 'An account with this email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const fullName = `${first_name.trim()} ${last_name || ''}`.trim();

    const insertResult = await db.query(
      `INSERT INTO users (
        role_id,
        first_name,
        last_name,
        name,
        username,
        email,
        role,
        password_hash
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id`,
      [
        CUSTOMER_ROLE_ID,
        first_name.trim(),
        (last_name || '').trim(),
        fullName,
        normalizedEmail,
        normalizedEmail,
        'Customer',
        hashedPassword
      ]
    );

    const userResult = await db.query(
      `SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(r.name, u.role, 'Customer') AS role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [insertResult.rows[0].id]
    );

    const user = userResult.rows[0];

    user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    const token = generateToken(user);

    res.status(201).json({ token, user });

  } catch (err) {
    next(err);
  }
}

// LOGIN
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    const result = await db.query(
      `SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.password_hash,
        COALESCE(r.name, u.role, 'Customer') AS role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email.toLowerCase().trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    delete user.password_hash;

    user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    const token = generateToken(user);

    res.json({ token, user });

  } catch (err) {
    next(err);
  }
}

// GET CURRENT USER
async function getMe(req, res, next) {
  try {
    const result = await db.query(
      `SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.created_at,
        COALESCE(r.name, u.role, 'Customer') AS role
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    const user = result.rows[0];

    user.name = `${user.first_name || ''} ${user.last_name || ''}`.trim();

    res.json(user);

  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  getMe
};
