const bcrypt = require('bcryptjs');

const admins = [
    {
        email: 'nur@vavhstudio.com',
        firstName: 'Nur',
        lastName: 'Admin',
        roleId: 1,
        passwordEnv: 'ADMIN_SEED_PASSWORD'
    },
    {
        email: 'admin@vavh.com',
        firstName: 'Admin',
        lastName: 'User',
        roleId: 2,
        passwordEnv: 'ADMIN_SEED_PASSWORD_ADMIN'
    }
];

function getSeedPasswords(env) {
    const missing = admins
        .filter((admin) => !env[admin.passwordEnv] || !env[admin.passwordEnv].trim())
        .map((admin) => admin.passwordEnv);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
    }

    const passwords = admins.map((admin) => env[admin.passwordEnv]);
    if (new Set(passwords).size !== passwords.length) {
        throw new Error('Each administrator must have a distinct seed password.');
    }

    return passwords;
}

async function seedAdmins({ db, env = process.env } = {}) {
    if (!db || typeof db.query !== 'function') {
        throw new Error('A database client is required to seed administrators.');
    }

    const passwords = getSeedPasswords(env);
    const passwordHashes = await Promise.all(
        passwords.map((password) => bcrypt.hash(password, 12))
    );

    for (let i = 0; i < admins.length; i += 1) {
        const admin = admins[i];
        const fullName = `${admin.firstName} ${admin.lastName}`;
        const result = await db.query(
            `INSERT INTO users (
                email,
                password_hash,
                role_id,
                first_name,
                last_name,
                name
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (email) DO NOTHING
            RETURNING id`,
            [
                admin.email,
                passwordHashes[i],
                admin.roleId,
                admin.firstName,
                admin.lastName,
                fullName
            ]
        );

        if (result.rowCount === 0) {
            console.log(`Administrator already exists; left unchanged: ${admin.email}`);
        } else {
            console.log(`Created administrator: ${admin.email}`);
        }
    }
}

async function main() {
    require('dotenv').config();
    const db = require('../server/config/db');

    try {
        await seedAdmins({ db });
    } finally {
        await db.end();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Administrator seeding failed:', error.message);
        process.exitCode = 1;
    });
}

module.exports = { seedAdmins };
