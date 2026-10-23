const express = require('express');
const router = express.Router();
const db = require('../../config/db');
const { requireAdmin } = require('../../middleware/authMiddleware');
const { buildOverviewData, buildProfitLossData } = require('../../services/analyticsService');

router.use(requireAdmin);

function getRangeClause(range = '30') {
  if (range === '7') return 'AND completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)';
  if (range === '30') return 'AND completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)';
  if (range === '90') return 'AND completed_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)';
  return '';
}

async function hasTable(tableName) {
  try {
    const [rows] = await db.query('SHOW TABLES LIKE ?', [tableName]);
    return rows.length > 0;
  } catch (err) {
    return false;
  }
}

router.get('/overview', async (req, res) => {
  try {
    const range = req.query.range || '30';
    const dateClause = getRangeClause(range);

    const [[productCountRow]] = await db.query('SELECT COUNT(*) AS total FROM products');
    const [[orderCountRow]] = await db.query(`SELECT COUNT(*) AS total FROM orders WHERE status = 'Completed' ${dateClause}`);
    const [[revenueRow]] = await db.query(`SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status = 'Completed' ${dateClause}`);
    const [[profitRow]] = await db.query(`
      SELECT COALESCE(
        (
          SELECT SUM(total) FROM orders WHERE status = 'Completed' ${dateClause}
        ) - (
          SELECT COALESCE(SUM(amount), 0) FROM expenses
        ) - (
          SELECT COALESCE(SUM(cost), 0) FROM product_costs
        ) - (
          SELECT COALESCE(SUM(amount), 0) FROM marketing
        ),
        0
      ) AS total
    `);

    const [topProducts] = await db.query(`
      SELECT product_name AS name, COUNT(*) AS sales, SUM(total) AS revenue
      FROM orders
      WHERE status = 'Completed' ${dateClause}
      GROUP BY product_name
      ORDER BY sales DESC, revenue DESC
      LIMIT 5
    `);

    const hasClicksTable = await hasTable('product_click_events');
    const [topClicks] = hasClicksTable
      ? await db.query(`
          SELECT product_name AS name, COUNT(*) AS clicks
          FROM product_click_events
          GROUP BY product_name
          ORDER BY clicks DESC
          LIMIT 5
        `)
      : [ [] ];

    const [monthlyTrend] = await db.query(`
      SELECT DATE_FORMAT(completed_at, '%Y-%m') AS month, COALESCE(SUM(total), 0) AS revenue
      FROM orders
      WHERE status = 'Completed' ${dateClause}
      GROUP BY DATE_FORMAT(completed_at, '%Y-%m')
      ORDER BY month ASC
    `);

    const [categoryPerformance] = await db.query(`
      SELECT p.category_id, c.name, COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS revenue
      FROM orders o
      LEFT JOIN products p ON p.id = o.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.status = 'Completed' ${dateClause}
      GROUP BY p.category_id, c.name
      ORDER BY revenue DESC
      LIMIT 5
    `);

    const overview = buildOverviewData({
      productCount: productCountRow.total,
      revenueTotal: revenueRow.total,
      profitTotal: profitRow.total,
      orderCount: orderCountRow.total,
      topProducts,
      topClicks,
      monthlyTrend,
      categoryPerformance,
    });

    return res.json({ success: true, data: overview });
  } catch (err) {
    console.error('[Analytics overview]', err);
    return res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
});

router.get('/profit-loss', async (req, res) => {
  try {
    const range = req.query.range || '30';
    const dateClause = getRangeClause(range);

    const [[revenueRow]] = await db.query(`SELECT COALESCE(SUM(total), 0) AS total FROM orders WHERE status='Completed' ${dateClause}`);
    const [[costRow]] = await db.query('SELECT COALESCE(SUM(cost), 0) AS total FROM product_costs');
    const [[expensesRow]] = await db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses');
    const [[marketingRow]] = await db.query('SELECT COALESCE(SUM(amount), 0) AS total FROM marketing');

    const result = buildProfitLossData({
      revenue: revenueRow.total,
      cost: costRow.total,
      expenses: Number(expensesRow.total) + Number(marketingRow.total),
    });

    return res.json({ success: true, data: result });
  } catch (err) {
    console.error('[Analytics profit-loss]', err);
    return res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
});

router.get('/top-products', async (req, res) => {
  try {
    const range = req.query.range || '30';
    const dateClause = getRangeClause(range);

    const [rows] = await db.query(`
      SELECT product_name AS name, COUNT(*) AS sales, COALESCE(SUM(total), 0) AS revenue
      FROM orders
      WHERE status = 'Completed' ${dateClause}
      GROUP BY product_name
      ORDER BY sales DESC, revenue DESC
      LIMIT 10
    `);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Analytics top-products]', err);
    return res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
});

router.get('/clicks', async (req, res) => {
  try {
    const hasClicksTable = await hasTable('product_click_events');
    if (!hasClicksTable) {
      return res.json({ success: true, data: [] });
    }

    const [rows] = await db.query(`
      SELECT product_name AS name, COUNT(*) AS clicks
      FROM product_click_events
      GROUP BY product_name
      ORDER BY clicks DESC
      LIMIT 10
    `);

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Analytics clicks]', err);
    return res.status(500).json({ success: false, error: 'Something went wrong.' });
  }
});

module.exports = router;
