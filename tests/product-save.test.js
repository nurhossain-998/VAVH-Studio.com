const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProductPayload, normalizeAdminProductPayload } = require('../server/controllers/admin/productsController');

test('accepts a zero price as a valid product price', () => {
  const result = validateProductPayload({ name: 'Test Product', price: 0 });
  assert.equal(result.isValid, true);
  assert.equal(result.error, undefined);
});

test('rejects a missing product name', () => {
  const result = validateProductPayload({ price: 10 });
  assert.equal(result.isValid, false);
  assert.match(result.error, /name/i);
});

test('rejects a negative price', () => {
  const result = validateProductPayload({ name: 'Test Product', price: -5 });
  assert.equal(result.isValid, false);
  assert.match(result.error, /price/i);
});

test('maps legacy admin product fields to the current schema', () => {
  const result = normalizeAdminProductPayload({
    name: 'Desk Lamp',
    price: '75',
    category: 'Decor',
    stock: '8',
    notes: 'Warm glow lamp',
    supplier: 'VAVH Supply'
  });

  assert.equal(result.normalized.name, 'Desk Lamp');
  assert.equal(result.normalized.price, 75);
  assert.equal(result.normalized.description, 'Warm glow lamp');
  assert.equal(result.normalized.stock, 8);
  assert.equal(result.normalized.category_id, null);
  assert.equal(result.normalized.is_featured, 0);
});
