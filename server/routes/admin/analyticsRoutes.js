
const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { requireAdmin } = require('../../middleware/authMiddleware');
const {
    buildOverviewData,
    buildProfitLossData
} = require('../../services/analyticsService');

router.use(requireAdmin);

// PostgreSQL date range filter
function getRangeClause(range = '30') {
    if (range === '7') {
        return "AND completed_at >= NOW() - INTERVAL '7 days'";
    }

    if (range === '30') {
        return "AND completed_at >= NOW() - INTERVAL '30 days'";
    }

    if (range === '90') {
        return "AND completed_at >= NOW() - INTERVAL '90 days'";
    }

    return '';
}

// Check whether a table exists in the public schema
async function hasTable(tableName) {
    const result = await db.query(
        `SELECT to_regclass($1) IS NOT NULL AS exists`,
        [`public.${tableName}`]
    );

    return result.rows[0]?.exists === true;
}

// GET /api/admin/analytics/overview
router.get('/overview', async (req, res) => {
    try {
        const range = req.query.range || '30';
        const dateClause = getRangeClause(range);

        const productCountResult = await db.query(
            'SELECT COUNT(*)::INTEGER AS total FROM products'
        );

        const orderCountResult = await db.query(
            `SELECT COUNT(*)::INTEGER AS total
             FROM orders
             WHERE status = 'Completed' ${dateClause}`
        );

        const revenueResult = await db.query(
            `SELECT COALESCE(SUM(total), 0) AS total
             FROM orders
             WHERE status = 'Completed' ${dateClause}`
        );

        const profitResult = await db.query(`
            SELECT COALESCE(
                (
                    SELECT SUM(total)
                    FROM orders
                    WHERE status = 'Completed' ${dateClause}
                ) - (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM expenses
                ) - (
                    SELECT COALESCE(SUM(cost), 0)
                    FROM product_costs
                ) - (
                    SELECT COALESCE(SUM(amount), 0)
                    FROM marketing
                ),
                0
            ) AS total
        `);

        const topProductsResult = await db.query(`
            SELECT
                product_name AS name,
                COUNT(*)::INTEGER AS sales,
                COALESCE(SUM(total), 0) AS revenue
            FROM orders
            WHERE status = 'Completed' ${dateClause}
            GROUP BY product_name
            ORDER BY sales DESC, revenue DESC
            LIMIT 5
        `);

        const hasClicksTable = await hasTable('product_click_events');

        let topClicks = [];

        if (hasClicksTable) {
            const clicksResult = await db.query(`
                SELECT
                    product_name AS name,
                    COUNT(*)::INTEGER AS clicks
                FROM product_click_events
                GROUP BY product_name
                ORDER BY clicks DESC
                LIMIT 5
            `);

            topClicks = clicksResult.rows;
        }

        const monthlyTrendResult = await db.query(`
            SELECT
                TO_CHAR(completed_at, 'YYYY-MM') AS month,
                COALESCE(SUM(total), 0) AS revenue
            FROM orders
            WHERE status = 'Completed' ${dateClause}
            GROUP BY TO_CHAR(completed_at, 'YYYY-MM')
            ORDER BY month ASC
        `);

        const categoryPerformanceResult = await db.query(`
            SELECT
                p.category_id,
                c.name,
                COUNT(o.id)::INTEGER AS orders,
                COALESCE(SUM(o.total), 0) AS revenue
            FROM orders o
            LEFT JOIN products p ON p.id = o.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE o.status = 'Completed' ${dateClause}
            GROUP BY p.category_id, c.name
            ORDER BY revenue DESC
            LIMIT 5
        `);

        const overview = buildOverviewData({
            productCount: productCountResult.rows[0]?.total || 0,
            revenueTotal: revenueResult.rows[0]?.total || 0,
            profitTotal: profitResult.rows[0]?.total || 0,
            orderCount: orderCountResult.rows[0]?.total || 0,
            topProducts: topProductsResult.rows,
            topClicks,
            monthlyTrend: monthlyTrendResult.rows,
            categoryPerformance: categoryPerformanceResult.rows
        });

        return res.json({ success: true, data: overview });

    } catch (err) {
        console.error('[Analytics overview]', err);
        return res.status(500).json({
            success: false,
            error: 'Something went wrong.'
        });
    }
});

// GET /api/admin/analytics/profit-loss
router.get('/profit-loss', async (req, res) => {
    try {
        const range = req.query.range || '30';
        const dateClause = getRangeClause(range);

        const revenueResult = await db.query(`
            SELECT COALESCE(SUM(total), 0) AS total
            FROM orders
            WHERE status = 'Completed' ${dateClause}
        `);

        const costResult = await db.query(
            'SELECT COALESCE(SUM(cost), 0) AS total FROM product_costs'
        );

        const expensesResult = await db.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses'
        );

        const marketingResult = await db.query(
            'SELECT COALESCE(SUM(amount), 0) AS total FROM marketing'
        );

        const result = buildProfitLossData({
            revenue: revenueResult.rows[0]?.total || 0,
            cost: costResult.rows[0]?.total || 0,
            expenses:
                Number(expensesResult.rows[0]?.total || 0) +
                Number(marketingResult.rows[0]?.total || 0)
        });

        return res.json({ success: true, data: result });

    } catch (err) {
        console.error('[Analytics profit-loss]', err);
        return res.status(500).json({
            success: false,
            error: 'Something went wrong.'
        });
    }
});

// GET /api/admin/analytics/top-products
router.get('/top-products', async (req, res) => {
    try {
        const range = req.query.range || '30';
        const dateClause = getRangeClause(range);

        const result = await db.query(`
            SELECT
                product_name AS name,
                COUNT(*)::INTEGER AS sales,
                COALESCE(SUM(total), 0) AS revenue
            FROM orders
            WHERE status = 'Completed' ${dateClause}
            GROUP BY product_name
            ORDER BY sales DESC, revenue DESC
            LIMIT 10
        `);

        return res.json({ success: true, data: result.rows });

    } catch (err) {
        console.error('[Analytics top-products]', err);
        return res.status(500).json({
            success: false,
            error: 'Something went wrong.'
        });
    }
});

// GET /api/admin/analytics/clicks
router.get('/clicks', async (req, res) => {
    try {
        const hasClicksTable = await hasTable('product_click_events');

        if (!hasClicksTable) {
            return res.json({ success: true, data: [] });
        }

        const result = await db.query(`
            SELECT
                product_name AS name,
                COUNT(*)::INTEGER AS clicks
            FROM product_click_events
            GROUP BY product_name
            ORDER BY clicks DESC
            LIMIT 10
        `);

        return res.json({ success: true, data: result.rows });

    } catch (err) {
        console.error('[Analytics clicks]', err);
        return res.status(500).json({
            success: false,
            error: 'Something went wrong.'
        });
    }
});

module.exports = router;
