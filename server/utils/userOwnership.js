
function buildOrderStatsQueries() {
    return {
        totalOrders: `
            SELECT COUNT(*)::INTEGER AS total_orders
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE c.user_id = $1
        `,

        delivered: `
            SELECT COUNT(*)::INTEGER AS delivered
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE c.user_id = $1 AND o.status = 'delivered'
        `,

        wishlistCount: `
            SELECT COUNT(*)::INTEGER AS wishlist_count
            FROM wishlist w
            WHERE w.user_id = $1
        `,

        totalSpent: `
            SELECT COALESCE(SUM(o.total_amount), 0) AS total_spent
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE c.user_id = $1 AND o.status != 'cancelled'
        `
    };
}

module.exports = { buildOrderStatsQueries };
