const test = require('node:test');
const assert = require('node:assert/strict');

const { validateCheckoutCustomer, generateOrderReference } = require('../server/controllers/storefront/orderWorkflow');

test('validateCheckoutCustomer reports missing required fields', () => {
  const result = validateCheckoutCustomer({});

  assert.equal(result.isValid, false);
  assert.deepEqual(result.missing, ['name', 'email', 'phone']);
});

test('validateCheckoutCustomer normalizes supplied customer details', () => {
  const result = validateCheckoutCustomer({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+8801712345678',
    address: 'Dhaka'
  });

  assert.equal(result.isValid, true);
  assert.equal(result.normalized.name, 'Ada Lovelace');
  assert.equal(result.normalized.email, 'ada@example.com');
  assert.equal(result.normalized.phone, '+8801712345678');
  assert.equal(result.normalized.address, 'Dhaka');
});

test('generateOrderReference creates a traceable order number', () => {
  const orderNumber = generateOrderReference(7, 'ORD', '20260724');

  assert.equal(orderNumber, 'ORD-20260724-000007');
});
