const nodemailer = require('nodemailer');
const db = require('../config/db');

const DEFAULT_FROM = process.env.SMTP_FROM || 'no-reply@vavh.local';
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';

function getTransporter() {
  if (!SMTP_HOST) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
  const number = Number(value || 0);
  return `₹${number.toFixed(2)}`;
}

function buildEmailPayload(template, data = {}) {
  const companyName = data.companyName || 'VAVH Studio';
  const orderReference = data.orderReference || `ORD-${data.orderId || '000000'}`;
  const itemsMarkup = (data.items || []).map((item) => {
    const quantity = item.quantity || 0;
    const unitPrice = formatCurrency(item.unitPrice || item.price || 0);
    const total = formatCurrency((item.quantity || 0) * (item.unitPrice || item.price || 0));
    return `<tr><td>${escapeHtml(item.name || 'Product')}</td><td>${quantity}</td><td>${unitPrice}</td><td>${total}</td></tr>`;
  }).join('');

  const body = {
    order_confirmation: `
      <h2>Order Confirmation</h2>
      <p>Hi ${escapeHtml(data.customerName || 'Customer')},</p>
      <p>Your order <strong>${escapeHtml(orderReference)}</strong> has been received.</p>
      <table>
        <tr><th>Product</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
        ${itemsMarkup || '<tr><td colspan="4">No items listed</td></tr>'}
      </table>
      <p><strong>Total:</strong> ${formatCurrency(data.totalAmount || 0)}</p>
      <p><strong>Payment Method:</strong> ${escapeHtml(data.paymentMethod || 'N/A')}</p>
      <p><strong>Shipping Address:</strong> ${escapeHtml(data.shippingAddress || 'N/A')}</p>
      <p><strong>Estimated Delivery:</strong> ${escapeHtml(data.estimatedDeliveryDate || 'Pending')}</p>
      <p>Thank you for choosing ${escapeHtml(companyName)}.</p>
    `,
    admin_notification: `
      <h2>New Order Received</h2>
      <p>A new order <strong>${escapeHtml(orderReference)}</strong> has been created.</p>
      <p><strong>Customer:</strong> ${escapeHtml(data.customerName || 'N/A')}</p>
      <p><strong>Contact:</strong> ${escapeHtml(data.customerEmail || 'N/A')}</p>
      <p><strong>Total:</strong> ${formatCurrency(data.totalAmount || 0)}</p>
      <p><strong>Status:</strong> ${escapeHtml(data.status || 'Pending')}</p>
    `,
    status_update: `
      <h2>Order Status Update</h2>
      <p>Your order <strong>${escapeHtml(orderReference)}</strong> is now <strong>${escapeHtml(data.status || 'Updated')}</strong>.</p>
      <p><strong>Updated At:</strong> ${escapeHtml(data.updatedAt || new Date().toLocaleString())}</p>
      <p><strong>Tracking:</strong> ${escapeHtml(data.trackingNumber || 'Pending')}</p>
      <p>Contact support for assistance.</p>
    `,
    payment_notification: `
      <h2>Payment Update</h2>
      <p>Your payment for order <strong>${escapeHtml(orderReference)}</strong> has been updated.</p>
      <p><strong>Status:</strong> ${escapeHtml(data.paymentStatus || 'Updated')}</p>
      <p><strong>Amount:</strong> ${formatCurrency(data.amount || 0)}</p>
    `,
    invoice: `
      <h2>Invoice</h2>
      <p>Invoice for order <strong>${escapeHtml(orderReference)}</strong> is attached.</p>
      <p>Please review the attached PDF.</p>
    `,
  };

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <div style="max-width: 680px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <div style="background: #111827; color: #fff; padding: 16px 20px; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 20px;">${escapeHtml(companyName)}</h1>
        </div>
        <div style="padding: 20px; background: #f9fafb;">
          ${body[template] || '<p>No content available.</p>'}
        </div>
      </div>
    </div>
  `;

  return {
    subject: {
      order_confirmation: `Order confirmation for ${orderReference}`,
      admin_notification: `New order notification for ${orderReference}`,
      status_update: `Order status update for ${orderReference}`,
      payment_notification: `Payment update for ${orderReference}`,
      invoice: `Invoice for ${orderReference}`,
    }[template] || 'Notification',
    html,
    text: `Notification for ${orderReference}`,
  };
}

async function logEmailEvent({ to, subject, template, status, error }) {
  try {
    await db.query(
      'INSERT INTO email_logs (recipient, subject, template_name, status, error_message, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
      [to, subject, template, status, error || null]
    );
  } catch (err) {
    console.error('[EmailLog] Failed to persist event:', err.message);
  }
}

async function getSettingValue(key, fallback = 'true') {
  try {
    const [rows] = await db.query('SELECT setting_value FROM settings WHERE setting_key = ? LIMIT 1', [key]);
    if (rows.length) {
      return rows[0].setting_value;
    }
  } catch (err) {
    console.error('[EmailSettings] Unable to read setting:', err.message);
  }
  return fallback;
}

async function isNotificationEnabled(template, fallback = true) {
  const defaultSettingKey = `email_${template}_enabled`;
  const value = await getSettingValue(defaultSettingKey, fallback ? 'true' : 'false');
  return String(value).toLowerCase() !== 'false' && String(value).toLowerCase() !== '0' && String(value).toLowerCase() !== 'no';
}

async function sendEmail({ to, cc, bcc, template, data = {}, attachments = [] }) {
  const transporter = getTransporter();
  const payload = buildEmailPayload(template, data);
  const recipients = [to, ...(cc || []), ...(bcc || [])].filter(Boolean);

  if (!recipients.length) {
    return { success: true, skipped: true, message: 'No recipients provided.' };
  }

  const enabled = await isNotificationEnabled(template, true);
  if (!enabled) {
    await logEmailEvent({ to: recipients.join(','), subject: payload.subject, template, status: 'skipped', error: 'Notification disabled' });
    return { success: true, skipped: true, message: 'Notification disabled.' };
  }

  if (!transporter) {
    await logEmailEvent({ to: recipients.join(','), subject: payload.subject, template, status: 'skipped', error: 'SMTP not configured' });
    return { success: true, skipped: true, message: 'SMTP not configured. Email simulated.' };
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || DEFAULT_FROM,
        to: recipients.join(','),
        cc: (cc || []).join(','),
        bcc: (bcc || []).join(','),
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        attachments,
      });

      await logEmailEvent({ to: recipients.join(','), subject: payload.subject, template, status: 'sent' });
      return { success: true, skipped: false };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        continue;
      }
      await logEmailEvent({ to: recipients.join(','), subject: payload.subject, template, status: 'failed', error: error.message });
      return { success: false, error: error.message };
    }
  }

  if (lastError) {
    await logEmailEvent({ to: recipients.join(','), subject: payload.subject, template, status: 'failed', error: lastError.message });
  }
  return { success: false, error: lastError?.message || 'Unknown email error.' };
}

module.exports = {
  buildEmailPayload,
  sendEmail,
  logEmailEvent,
};
