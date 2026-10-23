function validateCheckoutCustomer(customerData = {}) {
  const normalized = {
    name: (customerData.name || '').toString().trim(),
    email: (customerData.email || '').toString().trim().toLowerCase(),
    phone: (customerData.phone || '').toString().trim(),
    address: (customerData.address || '').toString().trim(),
  };

  const missing = [];
  if (!normalized.name) missing.push('name');
  if (!normalized.email) missing.push('email');
  if (!normalized.phone) missing.push('phone');

  return {
    isValid: missing.length === 0,
    missing,
    normalized,
  };
}

function generateOrderReference(sequenceNumber, prefix = 'ORD', date = new Date().toISOString().slice(0, 10).replace(/-/g, '')) {
  const safeSequence = Number(sequenceNumber || 0);
  return `${prefix}-${date}-${String(safeSequence).padStart(6, '0')}`;
}

module.exports = { validateCheckoutCustomer, generateOrderReference };
