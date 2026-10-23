function buildOrderStatsQueries() {
  return {
    totalOrders: `
      SELECT COUNT(*) AS total_orders
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE c.user_id = ?
    `,
    delivered: `
      SELECT COUNT(*) AS delivered
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE c.user_id = ? AND o.status = 'delivered'
    `,
    wishlistCount: `
      SELECT COUNT(*) AS wishlist_count
      FROM wishlist w
      WHERE w.user_id = ?
    `,
    totalSpent: `
      SELECT COALESCE(SUM(o.total_amount),0) AS total_spent
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE c.user_id = ? AND o.status != 'cancelled'
    `,
  };
}

module.exports = { buildOrderStatsQueries };
