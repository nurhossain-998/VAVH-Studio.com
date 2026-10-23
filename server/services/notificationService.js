const { sendEmail } = require('./emailService');

function getAdminNotificationEmails() {
  return (process.env.ADMIN_NOTIFICATION_EMAILS || '')
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

async function sendNewOrderAdminNotification(orderData = {}) {
  const adminEmails = getAdminNotificationEmails();
  if (!adminEmails.length) return { success: true, skipped: true, message: 'No admin notification recipients configured.' };

  return sendEmail({
    to: adminEmails[0],
    cc: adminEmails.slice(1),
    template: 'admin_notification',
    data: {
      orderId: orderData.orderId,
      orderReference: orderData.orderReference,
      customerName: orderData.customerName || orderData.customer?.name,
      customerEmail: orderData.customerEmail || orderData.customer?.email,
      totalAmount: orderData.totalAmount || orderData.total || 0,
      status: orderData.status || 'Pending',
      companyName: orderData.companyName || 'VAVH Studio',
    },
  });
}

async function sendOrderNotifications(orderData = {}) {
  const customerEmail = orderData.customerEmail || orderData.customer?.email;
  const adminEmails = (orderData.adminEmails || getAdminNotificationEmails()).filter(Boolean);

  const baseData = {
    orderId: orderData.orderId,
    orderReference: orderData.orderReference,
    customerName: orderData.customerName || orderData.customer?.name || 'Customer',
    customerEmail,
    items: orderData.items || [],
    totalAmount: orderData.totalAmount || orderData.total || 0,
    paymentMethod: orderData.paymentMethod || 'Cash on Delivery',
    shippingAddress: orderData.shippingAddress || orderData.customer?.address || 'N/A',
    estimatedDeliveryDate: orderData.estimatedDeliveryDate || 'Pending',
    status: orderData.status || 'Pending',
    companyName: orderData.companyName || 'VAVH Studio',
  };

  const promises = [];

  if (customerEmail) {
    promises.push(sendEmail({
      to: customerEmail,
      template: 'order_confirmation',
      data: baseData,
    }));
  }

  if (adminEmails.length) {
    promises.push(sendEmail({
      to: adminEmails[0],
      cc: adminEmails.slice(1),
      template: 'admin_notification',
      data: baseData,
    }));
  }

  return Promise.allSettled(promises);
}

async function sendOrderStatusEmail(orderData = {}) {
  const customerEmail = orderData.customerEmail || orderData.customer?.email;
  if (!customerEmail) return { success: true, skipped: true };

  return sendEmail({
    to: customerEmail,
    template: 'status_update',
    data: {
      orderId: orderData.orderId,
      orderReference: orderData.orderReference,
      status: orderData.status,
      updatedAt: orderData.updatedAt || new Date().toLocaleString(),
      trackingNumber: orderData.trackingNumber || 'Pending',
      companyName: orderData.companyName || 'VAVH Studio',
    },
  });
}

async function sendPaymentNotification(orderData = {}) {
  const customerEmail = orderData.customerEmail || orderData.customer?.email;
  if (!customerEmail) return { success: true, skipped: true };

  return sendEmail({
    to: customerEmail,
    template: 'payment_notification',
    data: {
      orderId: orderData.orderId,
      orderReference: orderData.orderReference,
      paymentStatus: orderData.paymentStatus,
      amount: orderData.amount || 0,
      companyName: orderData.companyName || 'VAVH Studio',
    },
  });
}

module.exports = {
  getAdminNotificationEmails,
  sendNewOrderAdminNotification,
  sendOrderNotifications,
  sendOrderStatusEmail,
  sendPaymentNotification,
};
