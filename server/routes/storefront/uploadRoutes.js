/* ============================================================
   server/routes/uploadRoutes.js — Handle File Uploads
   Provides endpoint for product image uploads
   ============================================================ */

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { rateLimit } = require('express-rate-limit');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { authSessionOrToken } = require('../../middleware/authMiddleware');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many upload attempts. Try again later.' },
});

const storageMode = (process.env.UPLOAD_STORAGE || 'local').toLowerCase();
const s3Client = storageMode === 's3' && process.env.S3_BUCKET
  ? new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  })
  : null;

function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

// ══════════════════════════════════════════════════════════
// POST /api/upload/product — Upload product image
// Requires: admin authentication
// ══════════════════════════════════════════════════════════
router.post('/product', authSessionOrToken, uploadLimiter, upload.single('image'), async (req, res, next) => {
  try {
    const role = (req.user?.role || req.user?.user?.role || '').toString().toLowerCase();
    if (role !== 'admin' && role !== 'super admin') {
      return res.status(403).json({ message: 'Access denied. Admins only.' });
    }

    if (process.env.NODE_ENV === 'production' && storageMode !== 's3') {
      return res.status(503).json({ success: false, message: 'External upload storage is not configured.' });
    }

    if (storageMode === 's3' && !s3Client) {
      return res.status(503).json({ success: false, message: 'Object storage is not configured.' });
    }

    console.log('[Upload] Starting product image upload for admin user');

    // ── Validation: Check if a file was uploaded ─────────────
    if (!req.file) {
      console.error('[Upload] No file in request body');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded. Please select an image.'
      });
    }

    const file = req.file;

    // Log file details for debugging
    const imageType = detectImageType(file.buffer);
    if (!imageType) {
      console.error('[Upload] Invalid image signature');
      return res.status(400).json({
        success: false,
        message: 'Invalid file type. Only JPG, PNG, and WebP images are allowed.'
      });
    }

    // ── Validation: File size (max 5MB) ───────────────────────
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      console.error(`[Upload] File size exceeds limit: ${file.size} > ${maxSize}`);
      return res.status(400).json({
        success: false,
        message: `File size exceeds 5MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      });
    }

    // ── Generate unique filename ──────────────────────────────
    const filename = `${crypto.randomUUID()}.${imageType}`;

    console.log(`[Upload] Generated filename: ${filename}`);

    let imageUrl;
    let storedSize = file.size;
    if (storageMode === 's3') {
      const key = `products/${filename}`;
      await s3Client.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentLength: file.size,
        ContentType: `image/${imageType === 'jpg' ? 'jpeg' : imageType}`,
      }));
      imageUrl = process.env.S3_PUBLIC_BASE_URL
        ? `${process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}`
        : `${(process.env.S3_ENDPOINT || '').replace(/\/$/, '')}/${process.env.S3_BUCKET}/${key}`;
    } else {
      const uploadsDir = path.join(__dirname, '../../uploads/products');
      fs.mkdirSync(uploadsDir, { recursive: true });
      const filepath = path.join(uploadsDir, filename);
      fs.writeFileSync(filepath, file.buffer, { flag: 'wx' });
      const stats = fs.statSync(filepath);
      storedSize = stats.size;
      imageUrl = `/uploads/products/${filename}`;
    }
    
    console.log(`[Upload] Upload complete. URL: ${imageUrl}`);

    res.json({
      success: true,
      message: 'Image uploaded successfully.',
      image_url: imageUrl,
      filename: filename,
      size: storedSize,
    });

  } catch (err) {
    console.error('[Upload] Unexpected error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
});

// ══════════════════════════════════════════════════════════
// GET /api/upload/verify/:filename — Verify image exists
// ══════════════════════════════════════════════════════════
router.get('/verify/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Sanitize filename to prevent directory traversal attacks
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid filename.'
      });
    }

    // Go up two levels: from server/routes to server, then to root
    const filepath = path.join(__dirname, '../../uploads/products', filename);
    
    if (fs.existsSync(filepath)) {
      const stats = fs.statSync(filepath);
      res.json({
        success: true,
        exists: true,
        size: stats.size,
        url: `/uploads/products/${filename}`
      });
    } else {
      res.json({
        success: true,
        exists: false
      });
    }
  } catch (err) {
    console.error('[Upload Verify] Error:', err);
    res.status(500).json({
      success: false,
      error: 'Something went wrong.'
    });
  }
});

module.exports = router;
