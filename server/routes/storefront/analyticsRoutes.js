const express = require('express');
const db = require('../../config/db');
const { recordEvent } = require('../../services/vavhAiService');

const router = express.Router();

router.post('/product-click', async (req, res) => {
    try {
        const productId = Number.parseInt(req.body?.productId, 10);

        const requestedName = typeof req.body?.productName === 'string'
            ? req.body.productName.trim().slice(0, 255)
            : '';

        const source = typeof req.body?.source === 'string'
            ? req.body.source.trim().slice(0, 40) || 'storefront'
            : 'storefront';

        if ((!Number.isInteger(productId) || productId <= 0) && !requestedName) {
            return res.status(400).json({
                success: false,
                message: 'A product is required.'
            });
        }

        let productName = requestedName;

        if (Number.isInteger(productId) && productId > 0) {
            const productResult = await db.query(
                'SELECT name FROM products WHERE id = $1 LIMIT 1',
                [productId]
            );

            if (productResult.rows[0]?.name) {
                productName = productResult.rows[0].name;
            }
        }

        if (!productName) {
            return res.status(400).json({
                success: false,
                message: 'Product was not found.'
            });
        }

        await db.query(
            `INSERT INTO product_click_events
                (product_id, product_name, source)
             VALUES ($1, $2, $3)`,
            [
                Number.isInteger(productId) && productId > 0 ? productId : null,
                productName,
                source
            ]
        );

        await recordEvent({
            sessionId: req.body?.sessionId,
            eventType: 'product_click',
            productId,
            source
        });

        return res.status(201).json({ success: true });

    } catch (err) {
        console.error('[Storefront product click]', err.message);

        return res.status(500).json({
            success: false,
            message: 'Unable to record product click.'
        });
    }
});

router.post('/event', async (req, res) => {
    try {
        await recordEvent({
            sessionId: req.body?.sessionId,
            eventType: req.body?.eventType,
            productId: req.body?.productId,
            categoryId: req.body?.categoryId,
            source: req.body?.source
        });

        return res.status(201).json({ success: true });

    } catch (err) {
        console.error('[Storefront analytics event]', err.message);

        return res.status(400).json({
            success: false,
            message: 'Unable to record analytics event.'
        });
    }
});

module.exports = router;
