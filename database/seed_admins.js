
const bcrypt = require('bcryptjs');
const db = require('../server/config/db');
require('dotenv').config();

async function seedAdmins() {
    try {
        const seedPassword = process.env.ADMIN_SEED_PASSWORD;

        if (!seedPassword) {
            throw new Error(
                'ADMIN_SEED_PASSWORD is required. Do not use a hardcoded password.'
            );
        }

        console.log('Seeding admin accounts...');

        const passwordHash = await bcrypt.hash(seedPassword, 12);

        const admins = [
            {
                email: 'nur@vavhstudio.com',
                firstName: 'Nur',
                lastName: 'Admin',
                roleId: 1
            },
            {
                email: 'admin@vavh.com',
                firstName: 'Admin',
                lastName: 'User',
                roleId: 2
            }
        ];

        for (const admin of admins) {
            const fullName = `${admin.firstName} ${admin.lastName}`;

            const existing = await db.query(
                'SELECT id FROM users WHERE email = $1',
                [admin.email]
            );

            if (existing.rows.length > 0) {
                console.log(`Updating existing user: ${admin.email}`);

                await db.query(
                    `UPDATE users
                     SET password_hash = $1,
                         role_id = $2,
                         first_name = $3,
                         last_name = $4,
                         name = $5
                     WHERE email = $6`,
                    [
                        passwordHash,
                        admin.roleId,
                        admin.firstName,
                        admin.lastName,
                        fullName,
                        admin.email
                    ]
                );
            } else {
                console.log(`Creating new user: ${admin.email}`);

                await db.query(
                    `INSERT INTO users (
                        email,
                        password_hash,
                        role_id,
                        first_name,
                        last_name,
                        name
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        admin.email,
                        passwordHash,
                        admin.roleId,
                        admin.firstName,
                        admin.lastName,
                        fullName
                    ]
                );
            }
        }

        console.log('Admins seeded successfully.');
    } catch (err) {
        console.error('Error seeding admins:', err);
        process.exitCode = 1;
    } finally {
        await db.end();
    }
}

seedAdmins();
