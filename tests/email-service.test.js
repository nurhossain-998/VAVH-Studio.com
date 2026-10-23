const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { buildEmailPayload } = require(path.join(__dirname, '..', 'server', 'services', 'emailService'));

test('buildEmailPayload renders order confirmation content with customer and order details', () => {
  const payload = buildEmailPayload('order_confirmation', {
    orderId: 42,
    orderReference: 'ORD-20260803-000042',
    customerName: 'Asha Kumar',
    items: [{ name: 'Laptop', quantity: 1, unitPrice: 999.99 }],
    totalAmount: 999.99,
    paymentMethod: 'Card',
    shippingAddress: '12 Main Street',
    estimatedDeliveryDate: '2026-08-07',
    companyName: 'VAVH Studio',
  });

  assert.equal(payload.subject, 'Order confirmation for ORD-20260803-000042');
  assert.match(payload.html, /Asha Kumar/);
  assert.match(payload.html, /Laptop/);
  assert.match(payload.html, /VAVH Studio/);
});
