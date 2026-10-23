const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function seedAdmins() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'app_user',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'vavh_main',
  });

  try {
    const seedPassword = process.env.ADMIN_SEED_PASSWORD;
    if (!seedPassword) {
      throw new Error('ADMIN_SEED_PASSWORD is required to seed admin accounts. Do not use a hardcoded password.');
    }

    console.log('Seeding admin accounts...');
    const passwordHash = await bcrypt.hash(seedPassword, 12);

    const admins = [
      {
        email: 'nur@vavhstudio.com',
        firstName: 'Nur',
        lastName: 'Admin',
        roleId: 1 // Super Admin
      },
      {
        email: 'admin@vavh.com',
        firstName: 'Admin',
        lastName: 'User',
        roleId: 2 // Admin
      }
    ];

    for (const admin of admins) {
      const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [admin.email]);

      if (existing.length > 0) {
        console.log(`Updating existing user: ${admin.email}`);
        await db.query(
          'UPDATE users SET password_hash = ?, role_id = ?, first_name = ?, last_name = ? WHERE email = ?',
          [passwordHash, admin.roleId, admin.firstName, admin.lastName, admin.email]
        );
      } else {
        console.log(`Creating new user: ${admin.email}`);
        await db.query(
          'INSERT INTO users (email, password_hash, role_id, first_name, last_name) VALUES (?, ?, ?, ?, ?)',
          [admin.email, passwordHash, admin.roleId, admin.firstName, admin.lastName]
        );
      }
    }

    console.log('Admins seeded successfully.');
  } catch (err) {
    console.error('Error seeding admins:', err);
  } finally {
    await db.end();
  }
}

seedAdmins();
