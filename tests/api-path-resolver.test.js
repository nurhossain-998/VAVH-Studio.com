const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveApiPath } = require('../client/js/utils/apiPathResolver');

test('admin routes resolve to the admin API base', () => {
  assert.equal(resolveApiPath('/admin/products', '/api/storefront'), '/api/admin/products');
  assert.equal(resolveApiPath('/admin/products/42', '/api/storefront'), '/api/admin/products/42');
});

test('storefront routes keep the storefront API base', () => {
  assert.equal(resolveApiPath('/products', '/api/storefront'), '/api/storefront/products');
  assert.equal(resolveApiPath('/categories', '/api/storefront'), '/api/storefront/categories');
});

test('absolute URLs remain unchanged', () => {
  assert.equal(resolveApiPath('https://example.com/api/products', '/api/storefront'), 'https://example.com/api/products');
});
