/* server/routes/aboutRoutes.js — Public About & Social Links */
const express = require('express');
const router  = express.Router();
const db      = require('../../config/db');

// GET /api/about — get company description + social links
router.get('/', async (req, res, next) => {
  try {
    // Get about content (single row)
    const [about] = await db.query('SELECT description, partners FROM about_content LIMIT 1');

    // Get all social links
    const [social] = await db.query('SELECT platform, url FROM social_links ORDER BY id ASC');

    res.json({
      description:  about[0]?.description || '',
      partners:     about[0]?.partners    || '',
      social_links: social,
    });
  } catch (err) { next(err); }
});

module.exports = router;
