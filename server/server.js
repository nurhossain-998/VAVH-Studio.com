require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLSessionStore = require('./services/mysqlSessionStore');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const db = require('./config/db');
const { requireAdmin } = require('./middleware/authMiddleware');
const { ensureEmailTables } = require('./services/emailMigration');
const { ensureSchema: ensureVavhAiSchema } = require('./services/vavhAiService');

const app = express();

// Middleware
const configuredOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
app.use(cors({
    origin: configuredOrigins.length > 0 ? configuredOrigins : false,
    credentials: true,
}));
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false,
    frameguard: { action: 'deny' },
    hsts: false,
}));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts. Try again later.' },
});

const proxyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Too many proxy requests. Try again later.' },
});

// Baseline browser security headers. Keep local development on HTTP, but
// enable HSTS and secure cookies when the app is deployed behind HTTPS.
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; " +
        "img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; " +
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; " +
        "connect-src 'self' http://localhost:3000 https://localhost:3000; form-action 'self'"
    );
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

app.use((req, res, next) => {
    const sendJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode >= 500 && req.path.startsWith('/api/')) {
            return sendJson({ error: 'Something went wrong.' });
        }
        return sendJson(body);
    };
    next();
});
function ensureCsrfToken(req) {
    if (!req.session) return null;
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
}
// Increase body parsing limits to allow base64 image payloads from the admin UI
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_LIMIT || '10mb' }));
app.use(session({
    store: new MySQLSessionStore({ tableName: 'session_store' }),
    secret: (() => {
        if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required.');
        return process.env.SESSION_SECRET;
    })(),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: Number(process.env.SESSION_MAX_AGE || 1000 * 60 * 60 * 8)
    }
}));

app.use((req, res, next) => {
    const sendJson = res.json.bind(res);
    res.json = (body) => {
        if (res.statusCode >= 500 && req.path.startsWith('/api/')) {
            return sendJson({ error: 'Something went wrong.' });
        }
        return sendJson(body);
    };
    next();
});

app.get('/api/csrf-token', (req, res) => {
    const token = ensureCsrfToken(req);
    if (!token) {
        return res.status(500).json({ success: false, message: 'Unable to create CSRF token.' });
    }
    return res.json({ success: true, csrfToken: token });
});

app.use((req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    if (req.path.startsWith('/api/proxy')) {
        return next();
    }
    if (req.headers.authorization) {
        return next();
    }

    const origin = req.headers.origin || req.headers.referer;
    if (origin) {
        try {
            const parsedOrigin = new URL(origin);
            const sameHost = parsedOrigin.hostname === req.hostname;
            const samePort = !parsedOrigin.port || parsedOrigin.port === (req.socket.localPort || '3000').toString();
            if (sameHost && samePort) {
                return next();
            }
        } catch (err) {
            // fall through to token validation below
        }
    }

    const headerToken = req.headers['x-csrf-token'];
    const sessionToken = ensureCsrfToken(req);
    if (headerToken && sessionToken && headerToken === sessionToken) {
        return next();
    }

    return res.status(403).json({ success: false, message: 'CSRF verification failed. Refresh and try again.' });
});

function removeBlockedHeaders(headers) {
    const cleaned = { ...headers };
    delete cleaned['content-security-policy'];
    delete cleaned['content-security-policy-report-only'];
    delete cleaned['x-frame-options'];
    delete cleaned['frame-options'];
    delete cleaned['x-xss-protection'];
    delete cleaned['x-content-type-options'];
    delete cleaned['strict-transport-security'];
    delete cleaned['set-cookie'];
    delete cleaned['content-length'];
    delete cleaned['content-encoding'];
    return cleaned;
}

function sanitizeHtmlContent(body, parsedUrl) {
    let cleanBody = body
        .replace(/<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/gi, '')
        .replace(/<meta[^>]+http-equiv=["']x-content-security-policy["'][^>]*>/gi, '')
        .replace(/<meta[^>]+http-equiv=["']x-webkit-csp["'][^>]*>/gi, '')
        .replace(/<meta[^>]+content-security-policy[^>]*>/gi, '');

    if (!/<base[^>]*>/i.test(cleanBody)) {
        const basePath = parsedUrl.pathname.endsWith('/')
            ? parsedUrl.pathname
            : parsedUrl.pathname.replace(/\/[^/]*$/, '/') || '/';
        const baseHref = `${parsedUrl.origin}${basePath}`;
        if (/<head[^>]*>/i.test(cleanBody)) {
            cleanBody = cleanBody.replace(/<head([^>]*)>/i, `<head$1><base href="${baseHref}">`);
        } else if (/<html[^>]*>/i.test(cleanBody)) {
            cleanBody = cleanBody.replace(/<html([^>]*)>/i, `<html$1><head><base href="${baseHref}"></head>`);
        } else {
            cleanBody = `<head><base href="${baseHref}"></head>` + cleanBody;
        }
    }

    return cleanBody;
}

function isPrivateAddress(address) {
    if (net.isIPv4(address)) {
        const octets = address.split('.').map(Number);
        return octets[0] === 10 || octets[0] === 127 || octets[0] === 0 ||
            (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
            (octets[0] === 192 && octets[1] === 168) ||
            (octets[0] === 169 && octets[1] === 254);
    }
    if (net.isIPv6(address)) {
        const normalized = address.toLowerCase();
        return normalized === '::1' || normalized === '::' ||
            normalized.startsWith('fc') || normalized.startsWith('fd') ||
            normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
            normalized.startsWith('fea') || normalized.startsWith('feb');
    }
    return true;
}

const ALLOWED_PROXY_HOSTS = new Set([
    'google.com',
    'www.google.com',
    'bing.com',
    'www.bing.com',
    'duckduckgo.com',
    'www.duckduckgo.com',
    'youtube.com',
    'www.youtube.com',
    'wikipedia.org',
    'www.wikipedia.org'
]);

function isAllowedProxyHost(hostname) {
    const normalized = String(hostname || '').toLowerCase().replace(/^www\./, '');
    if (!normalized) return false;
    if (normalized === 'localhost' || normalized.endsWith('.localhost')) return false;
    if (ALLOWED_PROXY_HOSTS.has(normalized) || ALLOWED_PROXY_HOSTS.has(`www.${normalized}`)) return true;
    return [...ALLOWED_PROXY_HOSTS].some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

app.get('/api/proxy', proxyLimiter, requireAdmin, async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing url parameter');
    }

    let parsedUrl;
    try {
        parsedUrl = new URL(targetUrl);
    } catch (err) {
        return res.status(400).send('Invalid url parameter');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
        return res.status(400).send('Unsupported protocol');
    }

    if (!isAllowedProxyHost(parsedUrl.hostname)) {
        return res.status(403).send('Target host is not allowed by proxy policy');
    }

    try {
        const addresses = await dns.lookup(parsedUrl.hostname, { all: true, verbatim: true });
        if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
            return res.status(403).send('Target host is not allowed');
        }
    } catch (err) {
        return res.status(400).send('Target host could not be resolved');
    }

    const client = parsedUrl.protocol === 'https:' ? https : http;
    const requestOptions = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
        },
    };

    const maxResponseSize = 5 * 1024 * 1024;
    const proxyRequest = client.get(parsedUrl, { ...requestOptions, timeout: 10000 }, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || '';
        const declaredSize = Number(proxyRes.headers['content-length'] || 0);
        if (declaredSize > maxResponseSize) {
            proxyRes.destroy();
            return res.status(413).send('Proxy response too large');
        }

        const safeHeaders = removeBlockedHeaders(proxyRes.headers);
        if (contentType.startsWith('text/html')) {
            let body = '';
            let bodySize = 0;
            proxyRes.on('data', chunk => { body += chunk.toString(); });
            proxyRes.on('data', chunk => {
                bodySize += chunk.length;
                if (bodySize > maxResponseSize) proxyRes.destroy(new Error('Proxy response too large'));
            });
            proxyRes.on('end', () => {
                if (bodySize > maxResponseSize) return res.status(413).send('Proxy response too large');
                body = sanitizeHtmlContent(body, parsedUrl);
                res.writeHead(proxyRes.statusCode || 200, safeHeaders);
                res.end(body);
            });
        } else {
            let bodySize = 0;
            proxyRes.on('data', chunk => {
                bodySize += chunk.length;
                if (bodySize > maxResponseSize) {
                    proxyRes.destroy(new Error('Proxy response too large'));
                    if (!res.headersSent) res.status(413).send('Proxy response too large');
                }
            });
            res.writeHead(proxyRes.statusCode || 200, safeHeaders);
            proxyRes.pipe(res);
        }
    });
    proxyRequest.on('timeout', () => proxyRequest.destroy(new Error('Proxy request timed out')));
    proxyRequest.on('error', (err) => {
        console.error('[Proxy] Request error:', err.message);
        if (!res.headersSent) res.status(502).send('Proxy request failed');
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Admin Routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/storefront/auth/login', authLimiter);
app.use('/api/storefront/auth/register', authLimiter);
app.use('/api/auth', require('./routes/admin/authRoutes'));
app.use('/api/analytics', require('./routes/admin/analyticsRoutes'));
app.use('/api/ai', require('./routes/admin/vavhAiRoutes'));
app.use('/api/customers', require('./routes/admin/customerRoutes'));
app.use('/api/finance', require('./routes/admin/financeRoutes'));
app.use('/api/orders', require('./routes/admin/orderRoutes'));
app.use('/api/products', require('./routes/admin/productRoutes'));
app.use('/api/suppliers', require('./routes/admin/supplierRoutes'));
app.use('/api/users', require('./routes/admin/userRoutes'));

// Storefront Routes
app.use('/api/storefront/auth', require('./routes/storefront/authRoutes'));
app.use('/api/storefront/products', require('./routes/storefront/productRoutes'));
app.use('/api/storefront/analytics', require('./routes/storefront/analyticsRoutes'));
app.use('/api/storefront/cart', require('./routes/storefront/cartRoutes'));
app.use('/api/storefront/wishlist', require('./routes/storefront/wishlistRoutes'));
app.use('/api/storefront/orders', require('./routes/storefront/orderRoutes'));
app.use('/api/storefront/users', require('./routes/storefront/userRoutes'));
app.use(['/api/categories', '/api/storefront/categories'], require('./routes/storefront/categoryRoutes'));
app.use('/api/storefront/services', require('./routes/storefront/serviceRoutes'));
app.use('/api/storefront/about', require('./routes/storefront/aboutRoutes'));
app.use('/api/storefront/upload', require('./routes/storefront/uploadRoutes'));
app.use('/api/admin', require('./routes/storefront/adminRoutes'));
app.use('/api/storefront/admin', require('./routes/storefront/adminRoutes'));

// Platform unified auth routes
app.get(/^\/platform\/.*$/, (req, res, next) => {
    if (req.path.includes('dashboard') && (!req.session || !req.session.user)) {
        return res.redirect('/platform/login.html');
    }
    if (req.path.includes('login') && req.session && req.session.user) {
        return res.redirect('/platform/dashboard.html');
    }
    next();
});

// Admin Dashboard Route (serve frontend)
app.get(/^\/admin(?:\/index\.html)?\/?$/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'admin', 'index.html'));
});

// ── JSON Error Handler (must be BEFORE the HTML catch-all) ──
// Returns JSON for API errors instead of falling through to index.html
app.use((err, req, res, next) => {
    console.error('[Server Error]', err.code || err.message);
    if (res.headersSent) return next(err);
    // Only send JSON if this looks like an API request
    if (req.path.startsWith('/api/')) {
        return res.status(err.status || 500).json({ error: 'Something went wrong.' });
    }
    next(err);
});

// Storefront Route (serve frontend)
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, '../client', 'index.html'));
});

const PORT = process.env.PORT || 3000;
ensureEmailTables().catch((err) => console.error('[Email] Initialization failed:', err.message));
ensureVavhAiSchema().catch((err) => console.error('[VAVH AI] Analytics initialization failed:', err.message));
app.listen(PORT, () => {
    console.log(` VAVH Platform Server running on port ${PORT}`);
});
