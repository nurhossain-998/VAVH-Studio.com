const path = require('path');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is required.');

function verifyToken(token, onSuccess, onError) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return onError(err);
        onSuccess(user);
    });
}

exports.authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token.trim() === '') {
        return res.status(401).json({ message: 'No token provided' });
    }

    verifyToken(token, (user) => {
        req.user = user;
        next();
    }, () => res.status(403).json({ message: 'Invalid token' }));
};

exports.requireRole = (roles) => {
    // Accept a single role string or an array of role strings
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    // Normalize to lower case for case‑insensitive comparison
    const normalizedAllowed = allowedRoles.map(r => r.toString().toLowerCase());
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized: no user context.' });
        }
        const userRole = (req.user.role || '').toString().toLowerCase();
        if (!normalizedAllowed.includes(userRole)) {
            return res.status(403).json({ message: 'Access denied: insufficient permissions' });
        }
        next();
    };
};

exports.requireLogin = (req, res, next) => {
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    verifyToken(token, (user) => {
        req.user = user;
        next();
    }, () => res.status(403).json({ success: false, message: 'Invalid token' }));
};

exports.requireAdmin = (req, res, next) => {
    const checkRole = (user) => {
        const role = user?.role?.toString().toLowerCase();
        if (role !== 'admin' && role !== 'super admin') {
            return res.status(403).json({ success: false, message: 'Access denied. Admins only.' });
        }
        req.user = user;
        next();
    };

    if (req.session && req.session.user) {
        return checkRole(req.session.user);
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
        return res.status(401).json({ success: false, message: 'Unauthorized. Please log in.' });
    }

    verifyToken(token, checkRole, () => res.status(403).json({ success: false, message: 'Invalid token' }));
};

exports.requireAuth = exports.authenticateToken;

exports.optionalAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token == null) return next();
    
    verifyToken(token, (user) => {
        req.user = user;
        next();
    }, () => next());
};

exports.authSessionOrToken = (req, res, next) => {
    // Try session-based auth first
    if (req.session && req.session.user) {
        req.user = req.session.user;
        return next();
    }

    // Fall back to JWT token auth
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token || token.trim() === '') {
        return res.status(401).json({ message: 'Unauthorized. Please log in.' });
    }

    verifyToken(token, (user) => {
        req.user = user;
        next();
    }, () => res.status(403).json({ message: 'Invalid token' }));
};
