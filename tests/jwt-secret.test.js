const assert = require('assert');
const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../server/middleware/authMiddleware');

function runTest() {
  delete process.env.JWT_SECRET;

  const token = jwt.sign(
    { id: 1, email: 'admin@example.com', role: 'admin' },
    'vavh_jwt_secret_change_in_prod',
    { expiresIn: '1h' }
  );

  const req = {
    headers: { authorization: `Bearer ${token}` },
  };

  let statusCode;
  let jsonPayload;
  let nextCalled = false;

  const res = {
    status(code) {
      statusCode = code;
      return {
        json(payload) {
          jsonPayload = payload;
        },
      };
    },
  };

  authenticateToken(req, res, () => {
    nextCalled = true;
  });

  assert.strictEqual(statusCode, 403, 'middleware must reject tokens signed with the removed legacy secret');
  assert.strictEqual(nextCalled, false, 'middleware must not authenticate a legacy-secret token');
  assert.deepStrictEqual(jsonPayload, { message: 'Invalid token' });
}

try {
  runTest();
  console.log('JWT regression test passed');
} catch (err) {
  console.error('JWT regression test failed');
  console.error(err.stack);
  process.exit(1);
}
