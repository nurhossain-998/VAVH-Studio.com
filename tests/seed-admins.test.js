const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { seedAdmins } = require('../database/seed_admins');

const initialEnv = {
  ADMIN_SEED_PASSWORD: 'distinct-first-admin-password',
  ADMIN_SEED_PASSWORD_ADMIN: 'distinct-second-admin-password',
};

function createFakeDatabase() {
  const users = new Map();
  const queries = [];

  return {
    users,
    queries,
    async query(sql, values) {
      queries.push({ sql, values });
      assert.match(sql, /INSERT INTO users/);
      assert.match(sql, /ON CONFLICT \(email\) DO NOTHING/);
      assert.doesNotMatch(sql, /UPDATE users/);

      const [email, passwordHash, roleId, firstName, lastName, name] = values;
      if (users.has(email)) {
        return { rowCount: 0, rows: [] };
      }

      const user = {
        id: users.size + 1,
        email,
        passwordHash,
        roleId,
        firstName,
        lastName,
        name,
      };
      users.set(email, user);
      return { rowCount: 1, rows: [{ id: user.id }] };
    },
  };
}

test('first-time seeding creates administrators with their distinct supplied passwords', async () => {
  const db = createFakeDatabase();

  await seedAdmins({ db, env: initialEnv });

  assert.equal(db.users.size, 2);
  const users = [...db.users.values()];
  assert.equal(await bcrypt.compare(initialEnv.ADMIN_SEED_PASSWORD, users[0].passwordHash), true);
  assert.equal(await bcrypt.compare(initialEnv.ADMIN_SEED_PASSWORD_ADMIN, users[1].passwordHash), true);
  assert.notEqual(users[0].passwordHash, users[1].passwordHash);
  assert.notEqual(initialEnv.ADMIN_SEED_PASSWORD, initialEnv.ADMIN_SEED_PASSWORD_ADMIN);
});

test('rerunning the seed leaves existing administrator password hashes unchanged', async () => {
  const db = createFakeDatabase();
  await seedAdmins({ db, env: initialEnv });
  const originalHashes = new Map(
    [...db.users].map(([email, user]) => [email, user.passwordHash])
  );
  const queryCountBeforeRerun = db.queries.length;

  await seedAdmins({
    db,
    env: {
      ADMIN_SEED_PASSWORD: 'replacement-first-admin-password',
      ADMIN_SEED_PASSWORD_ADMIN: 'replacement-second-admin-password',
    },
  });

  assert.equal(db.queries.length, queryCountBeforeRerun + 2);
  for (const [email, user] of db.users) {
    assert.equal(user.passwordHash, originalHashes.get(email));
  }
});

test('missing ADMIN_SEED_PASSWORD fails before any database query', async () => {
  const db = createFakeDatabase();

  await assert.rejects(
    seedAdmins({
      db,
      env: { ADMIN_SEED_PASSWORD_ADMIN: initialEnv.ADMIN_SEED_PASSWORD_ADMIN },
    }),
    /Missing required environment variable\(s\): ADMIN_SEED_PASSWORD/
  );

  assert.equal(db.queries.length, 0);
});

test('identical administrator seed passwords are rejected before provisioning', async () => {
  const db = createFakeDatabase();

  await assert.rejects(
    seedAdmins({
      db,
      env: {
        ADMIN_SEED_PASSWORD: 'same-password',
        ADMIN_SEED_PASSWORD_ADMIN: 'same-password',
      },
    }),
    /Each administrator must have a distinct seed password/
  );

  assert.equal(db.queries.length, 0);
});
