
/* server/routes/aboutRoutes.js — Public About & Social Links */

const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// GET /api/about — get company description + social links
router.get('/', async (req, res, next) => {
    try {
        // Get about content (single row)
        const aboutResult = await db.query(
            'SELECT description, partners FROM about_content ORDER BY id ASC LIMIT 1'
        );

        // Get all social links
        const socialResult = await db.query(
            'SELECT platform, url FROM social_links ORDER BY id ASC'
        );

        res.json({
            description: aboutResult.rows[0]?.description || '',
            partners: aboutResult.rows[0]?.partners || '',
            social_links: socialResult.rows
        });

    } catch (err) {
        next(err);
    }
});

module.exports = router;
