const db = require('../config/db');
const { GoogleGenAI} = require('@google/genai');

let schemaPromise;

function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = db.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        session_id VARCHAR(80) NOT NULL,
        event_type VARCHAR(40) NOT NULL,
        product_id INT NULL,
        category_id INT NULL,
        source VARCHAR(60) NOT NULL DEFAULT 'website',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX idx_analytics_events_type_date (event_type, created_at),
        INDEX idx_analytics_events_product_type (product_id, event_type),
        INDEX idx_analytics_events_session (session_id),
        CONSTRAINT fk_analytics_events_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
        CONSTRAINT fk_analytics_events_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((err) => {
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getDateRange(query = {}) {
  const preset = query.range || '30';
  const allowed = new Set(['today', '7', '30', '90', '180', '365', 'all', 'custom']);
  if (preset === 'custom' && query.from && query.to) {
    return { preset, from: query.from.slice(0, 10), to: query.to.slice(0, 10) };
  }
  if (!allowed.has(preset) || preset === 'all') return { preset: 'all', clause: '', params: [] };
  if (preset === 'today') return { preset, clause: 'AND created_at >= CURDATE()', params: [] };
  return { preset, clause: 'AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', params: [Number(preset)] };
}

function orderDateRange(range) {
  if (range.preset === 'all') return { clause: '', params: [] };
  if (range.preset === 'custom') return { clause: 'AND o.created_at >= ? AND o.created_at < DATE_ADD(?, INTERVAL 1 DAY)', params: [range.from, range.to] };
  if (range.preset === 'today') return { clause: 'AND o.created_at >= CURDATE()', params: [] };
  return { clause: 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', params: [Number(range.preset)] };
}

function previousOrderDateRange(range) {
  if (range.preset === 'all' || range.preset === 'today' || range.preset === 'custom') return null;
  const days = Number(range.preset);
  return { clause: 'AND o.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND o.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', params: [days * 2, days] };
}

function previousEventDateRange(range) {
  if (range.preset === 'today') return { clause: 'AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) AND e.created_at < CURDATE()', params: [] };
  if (range.preset === 'all' || range.preset === 'custom') return null;
  const days = Number(range.preset);
  return { clause: 'AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND e.created_at < DATE_SUB(NOW(), INTERVAL ? DAY)', params: [days * 2, days] };
}

async function recordEvent({ sessionId, eventType, productId = null, categoryId = null, source = 'website' }) {
  await ensureSchema();
  const safeSessionId = String(sessionId || 'anonymous').slice(0, 80);
  const safeType = String(eventType || '').slice(0, 40);
  const safeSource = String(source || 'website').slice(0, 60);
  const validTypes = new Set(['session', 'product_view', 'product_click', 'add_to_cart', 'remove_from_cart', 'checkout_started', 'purchase_completed']);
  if (!validTypes.has(safeType)) throw new Error('Unsupported analytics event.');
  const normalizedProductId = productId !== null && productId !== undefined && Number.isInteger(Number(productId)) && Number(productId) > 0
    ? Number(productId)
    : null;
  const normalizedCategoryId = categoryId !== null && categoryId !== undefined && Number.isInteger(Number(categoryId)) && Number(categoryId) > 0
    ? Number(categoryId)
    : null;
  await db.query(
    'INSERT INTO analytics_events (session_id, event_type, product_id, category_id, source) VALUES (?, ?, ?, ?, ?)',
    [safeSessionId, safeType, normalizedProductId, normalizedCategoryId, safeSource]
  );
}

function productMetricSql(eventType, alias, dateSql = '', dateParams = []) {
  return {
    sql: `SELECT e.product_id, p.name, p.price, p.image_url, c.name AS category_name,
                 COUNT(*) AS ${alias}
          FROM analytics_events e
          JOIN products p ON p.id = e.product_id
          LEFT JOIN categories c ON c.id = p.category_id
          WHERE e.event_type = ? ${dateSql}
          GROUP BY e.product_id, p.name, p.price, p.image_url, c.name`,
    params: [eventType, ...dateParams],
  };
}

async function buildDashboard(query = {}) {
  await ensureSchema();
  const range = getDateRange(query);
  const orderRange = orderDateRange(range);
  const previousRange = previousOrderDateRange(range);
  const previousEventRange = previousEventDateRange(range);
  const eventDate = range.preset === 'custom'
    ? { clause: 'AND e.created_at >= ? AND e.created_at < DATE_ADD(?, INTERVAL 1 DAY)', params: [range.from, range.to] }
    : range.preset === 'all'
      ? { clause: '', params: [] }
      : range.preset === 'today'
        ? { clause: 'AND e.created_at >= CURDATE()', params: [] }
        : { clause: 'AND e.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', params: [Number(range.preset)] };

  const [[visitorRow]] = await db.query(`SELECT COUNT(DISTINCT e.session_id) AS total FROM analytics_events e WHERE e.event_type = 'session' ${eventDate.clause}`, eventDate.params);
  const [[viewRow]] = await db.query(`SELECT COUNT(*) AS total FROM analytics_events e WHERE e.event_type = 'product_view' ${eventDate.clause}`, eventDate.params);
  const [[clickRow]] = await db.query(`SELECT COUNT(*) AS total FROM analytics_events e WHERE e.event_type = 'product_click' ${eventDate.clause}`, eventDate.params);
  const [[cartRow]] = await db.query(`SELECT COUNT(*) AS total FROM analytics_events e WHERE e.event_type = 'add_to_cart' ${eventDate.clause}`, eventDate.params);
  const [[orderRow]] = await db.query(`SELECT COUNT(*) AS total, COALESCE(SUM(COALESCE(o.total_amount, o.total, 0)), 0) AS revenue
    FROM orders o WHERE o.status IN ('Completed', 'Delivered') ${orderRange.clause}`, orderRange.params);
  const [[quantityRow]] = await db.query(`SELECT COALESCE(SUM(oi.quantity), 0) AS total FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status IN ('Completed', 'Delivered') ${orderRange.clause}`, orderRange.params);

  const topViewsQuery = productMetricSql('product_view', 'views', eventDate.clause.replaceAll('e.created_at', 'e.created_at'), eventDate.params);
  const topClicksQuery = productMetricSql('product_click', 'clicks', eventDate.clause, eventDate.params);
  const topCartsQuery = productMetricSql('add_to_cart', 'cart_adds', eventDate.clause, eventDate.params);
  const [views] = await db.query(`${topViewsQuery.sql} ORDER BY views DESC LIMIT 10`, topViewsQuery.params);
  const [clicks] = await db.query(`${topClicksQuery.sql} ORDER BY clicks DESC LIMIT 10`, topClicksQuery.params);
  const [carts] = await db.query(`${topCartsQuery.sql} ORDER BY cart_adds DESC LIMIT 10`, topCartsQuery.params);

  const [sales] = await db.query(`SELECT oi.product_id, p.name, p.price, p.image_url, c.name AS category_name,
      COALESCE(SUM(oi.quantity), 0) AS quantity, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE o.status IN ('Completed', 'Delivered') ${orderRange.clause}
    GROUP BY oi.product_id, p.name, p.price, p.image_url, c.name ORDER BY quantity DESC LIMIT 20`, orderRange.params);

  const previousSales = previousRange ? await db.query(`SELECT COALESCE(SUM(o.total_amount), 0) AS revenue, COALESCE(SUM(oi.quantity), 0) AS quantity
    FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.status IN ('Completed', 'Delivered') ${previousRange.clause}`, previousRange.params).then(([rows]) => rows[0]) : null;
  const [dailySales] = await db.query(`SELECT DATE(o.created_at) AS day, COUNT(DISTINCT o.id) AS orders, COALESCE(SUM(o.total_amount), 0) AS revenue
    FROM orders o WHERE o.status IN ('Completed', 'Delivered') ${orderRange.clause}
    GROUP BY DATE(o.created_at) ORDER BY day ASC`, orderRange.params);
  const [categories] = await db.query(`SELECT COALESCE(c.name, 'Uncategorized') AS name, COUNT(DISTINCT o.id) AS orders,
      COALESCE(SUM(oi.quantity), 0) AS quantity, COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue
    FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id LEFT JOIN categories c ON c.id = p.category_id
    WHERE o.status IN ('Completed', 'Delivered') ${orderRange.clause}
    GROUP BY c.id, c.name ORDER BY revenue DESC LIMIT 10`, orderRange.params);
  const [related] = await db.query(`SELECT a.product_id AS product_id, p1.name AS product_name,
      b.product_id AS related_product_id, p2.name AS related_product_name, COUNT(DISTINCT a.order_id) AS purchases_together
    FROM order_items a JOIN order_items b ON a.order_id = b.order_id AND a.product_id < b.product_id
    JOIN orders o ON o.id = a.order_id JOIN products p1 ON p1.id = a.product_id JOIN products p2 ON p2.id = b.product_id
    WHERE o.status IN ('Completed', 'Delivered') ${orderRange.clause}
    GROUP BY a.product_id, p1.name, b.product_id, p2.name ORDER BY purchases_together DESC LIMIT 10`, orderRange.params);

  const previousInterest = previousEventRange ? await db.query(`SELECT e.product_id, COUNT(*) AS interest
    FROM analytics_events e WHERE e.event_type IN ('product_view', 'product_click', 'add_to_cart') ${previousEventRange.clause}
    GROUP BY e.product_id`, previousEventRange.params).then(([rows]) => new Map(rows.map((row) => [row.product_id, safeNumber(row.interest)]))) : new Map();

  const byProduct = new Map();
  for (const row of [...views, ...clicks, ...carts, ...sales]) {
    const item = byProduct.get(row.product_id) || { productId: row.product_id, name: row.name, category: row.category_name || 'Uncategorized', image: row.image_url, price: safeNumber(row.price), views: 0, clicks: 0, cartAdds: 0, quantity: 0, revenue: 0 };
    if (row.views !== undefined) item.views = safeNumber(row.views);
    if (row.clicks !== undefined) item.clicks = safeNumber(row.clicks);
    if (row.cart_adds !== undefined) item.cartAdds = safeNumber(row.cart_adds);
    if (row.quantity !== undefined) item.quantity = safeNumber(row.quantity);
    if (row.revenue !== undefined) item.revenue = safeNumber(row.revenue);
    byProduct.set(row.product_id, item);
  }
  const products = [...byProduct.values()].map((item) => {
    item.conversionRate = item.views ? (item.quantity / item.views) * 100 : 0;
    const currentInterest = item.views + item.clicks + item.cartAdds;
    const previousInterestValue = previousInterest.get(item.productId) || 0;
    item.growthPercent = previousInterestValue ? ((currentInterest - previousInterestValue) / previousInterestValue) * 100 : null;
    const growthBoost = item.growthPercent === null ? 0 : clamp(item.growthPercent, -100, 100) * 0.15;
    item.trendScore = clamp(Math.round(item.views * 0.15 + item.clicks * 0.25 + item.cartAdds * 0.35 + item.quantity * 0.25 + growthBoost), 0, 100);
    item.trendDirection = item.trendScore >= 60 ? 'Strongly trending' : item.trendScore >= 25 ? 'Trending' : 'Building interest';
    return item;
  }).sort((a, b) => b.trendScore - a.trendScore);

  const totalViews = safeNumber(viewRow.total);
  const totalOrders = safeNumber(orderRow.total);
  const revenue = safeNumber(orderRow.revenue);
  const previousRevenue = safeNumber(previousSales?.revenue);
  const growth = previousRevenue ? ((revenue - previousRevenue) / previousRevenue) * 100 : null;
  const mostViewed = views[0] || null;
  const mostClicked = clicks[0] || null;
  const bestSelling = sales[0] || null;
  const trending = products[0] || null;

  return {
    range,
    actualData: {
      visitors: safeNumber(visitorRow.total), productViews: totalViews, productClicks: safeNumber(clickRow.total), cartAdds: safeNumber(cartRow.total), orders: totalOrders, revenue, productsSold: safeNumber(quantityRow.total), salesGrowthPercent: growth,
      mostViewed: mostViewed ? { name: mostViewed.name, views: safeNumber(mostViewed.views) } : null,
      mostClicked: mostClicked ? { name: mostClicked.name, clicks: safeNumber(mostClicked.clicks) } : null,
      bestSelling: bestSelling ? { name: bestSelling.name, quantity: safeNumber(bestSelling.quantity), revenue: safeNumber(bestSelling.revenue) } : null,
    },
    sales: { products: sales.map((row) => ({ ...row, quantity: safeNumber(row.quantity), revenue: safeNumber(row.revenue) })), daily: dailySales, categories },
    behavior: { views: views.map((row) => ({ ...row, views: safeNumber(row.views) })), clicks: clicks.map((row) => ({ ...row, clicks: safeNumber(row.clicks) })), carts: carts.map((row) => ({ ...row, cartAdds: safeNumber(row.cart_adds) })) },
    trending: products.slice(0, 10),
    related: related.map((row) => ({ product: row.product_name, relatedProduct: row.related_product_name, purchasesTogether: safeNumber(row.purchases_together) })),
    insights: buildInsights({ revenue, growth, mostViewed, mostClicked, bestSelling, trending, products }),
  };
}

function buildInsights({ revenue, growth, mostViewed, mostClicked, bestSelling, trending, products }) {
  const insights = [];
  if (bestSelling) insights.push({ type: 'actual', title: 'Best seller', text: `${bestSelling.name} is the leading product with ${safeNumber(bestSelling.quantity)} units sold.` });
  if (mostViewed) insights.push({ type: 'actual', title: 'Most viewed', text: `${mostViewed.name} received ${safeNumber(mostViewed.views)} product views in this period.` });
  if (mostClicked) insights.push({ type: 'actual', title: 'Most clicked', text: `${mostClicked.name} received the most recorded product clicks: ${safeNumber(mostClicked.clicks)}.` });
  const highAttention = products.find((item) => item.views >= 5 && item.conversionRate < 2);
  if (highAttention) insights.push({ type: 'recommendation', title: 'Review conversion', text: `${highAttention.name} receives attention but converts below 2%. Review its price, images, and product description.` });
  if (trending) insights.push({ type: 'recommendation', title: 'Promotion opportunity', text: `${trending.name} has the strongest combined trend score. Consider featuring it on the homepage or social channels.` });
  if (growth !== null) insights.push({ type: 'actual', title: 'Sales movement', text: `Revenue is ${growth >= 0 ? 'up' : 'down'} ${Math.abs(growth).toFixed(1)}% compared with the previous equivalent period.` });
  if (!insights.length && revenue === 0) insights.push({ type: 'recommendation', title: 'Collect more data', text: 'There is not enough recorded activity for a reliable recommendation yet.' });
  return insights.slice(0, 8);
}

async function answerQuestion(question, query = {}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing from the environment.');
  }

  // Initialize Gemini using your existing API key.
  const ai = new GoogleGenAI({ apiKey });

  // Fetch actual business analytics from MySQL.
  const dashboard = await buildDashboard(query);

  // Pass only relevant, aggregated analytics to the AI.
  const businessContext = {
    period: dashboard.range,
    actualData: dashboard.actualData,
    sales: dashboard.sales,
    behavior: dashboard.behavior,
    trending: dashboard.trending,
    related: dashboard.related,
    insights: dashboard.insights
  };

  const prompt = `
You are VAVH AI, an intelligent business analytics assistant
for VAVH Studio.

Your job is to help administrators understand business performance
and make better decisions using the supplied business data.

USER QUESTION:
${String(question).slice(0, 3000)}

BUSINESS ANALYTICS DATA:
${JSON.stringify(businessContext)}

INSTRUCTIONS:
1. Answer the user's actual question directly.
2. Use the supplied data to explain sales, revenue, products,
   customer interest, trends, and business performance.
3. Give practical recommendations when appropriate.
4. Use BDT for Bangladeshi Taka amounts.
5. Never invent sales figures, orders, customers, or other metrics.
6. Clearly distinguish recorded facts from your recommendations.
7. If the data is insufficient, explicitly say so.
8. If the question is unrelated to the supplied data, explain
   what information is available and ask for relevant context.
9. Do not claim to have accessed data that was not supplied.
10. Respond in clear, professional language.

Return a useful answer, not JSON.
`;

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    contents: prompt
  });

  const answer = String(response.text || '').trim();

  if (!answer) {
    throw new Error('Gemini returned an empty response.');
  }

  return {
    answer,
    basis: 'Generated by Gemini using recorded VAVH Studio analytics.'
  };
}

module.exports = { ensureSchema, recordEvent, buildDashboard, answerQuestion, safeNumber };
