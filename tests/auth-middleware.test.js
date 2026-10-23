const test = require('node:test');
const assert = require('node:assert/strict');
const { authSessionOrToken } = require('../server/middleware/authMiddleware');

test('authSessionOrToken ignores blank bearer tokens and returns unauthorized instead of invalid-token', () => {
  const req = {
    headers: { authorization: 'Bearer ' },
    session: undefined,
  };
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  authSessionOrToken(req, res, next);

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: 'Unauthorized. Please log in.' });
  assert.equal(nextCalled, false);
});
