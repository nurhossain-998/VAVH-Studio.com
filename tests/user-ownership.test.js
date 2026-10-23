const test = require('node:test');
const assert = require('node:assert/strict');
const { buildOrderStatsQueries } = require('../server/utils/userOwnership');

test('order statistics use the customer ownership link instead of direct orders.user_id filters', () => {
  const queries = buildOrderStatsQueries();

  assert.match(queries.totalOrders, /JOIN customers c ON o\.customer_id = c\.id/i);
  assert.match(queries.totalOrders, /WHERE c\.user_id = \?/i);
  assert.match(queries.totalSpent, /JOIN customers c ON o\.customer_id = c\.id/i);
  assert.match(queries.totalSpent, /WHERE c\.user_id = \?/i);

  assert.doesNotMatch(queries.totalOrders, /orders\s+WHERE\s+user_id\s*=/i);
  assert.doesNotMatch(queries.totalSpent, /orders\s+WHERE\s+user_id\s*=/i);
});
