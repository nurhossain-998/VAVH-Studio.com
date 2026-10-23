const db = require('../config/db');

async function ensureEmailTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      recipient VARCHAR(255) NOT NULL,
      subject VARCHAR(255),
      template_name VARCHAR(100),
      status VARCHAR(50) NOT NULL,
      error_message TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

module.exports = { ensureEmailTables };