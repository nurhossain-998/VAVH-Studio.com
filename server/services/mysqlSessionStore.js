```javascript
const session = require('express-session');
const db = require('../config/db');

class PostgreSQLSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.tableName = options.tableName || 'session_store';
    this.ready = this.ensureTable();
    this.ready.catch(() => {});

    this.cleanupTimer = setInterval(
      () => this.clearExpired(),
      options.cleanupInterval || 15 * 60 * 1000
    );
    this.cleanupTimer.unref();
  }

  async ensureTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        session_id VARCHAR(128) PRIMARY KEY,
        expires TIMESTAMPTZ NOT NULL,
        data TEXT NOT NULL
      )
    `);
  }

  get(sid, callback) {
    this.ready.then(async () => {
      const result = await db.query(
        `SELECT data, expires FROM ${this.tableName}
         WHERE session_id = $1 LIMIT 1`,
        [sid]
      );

      if (!result.rows.length) return callback(null, null);

      if (new Date(result.rows[0].expires).getTime() <= Date.now()) {
        await db.query(
          `DELETE FROM ${this.tableName} WHERE session_id = $1`,
          [sid]
        );
        return callback(null, null);
      }

      callback(null, JSON.parse(result.rows[0].data));
    }).catch(callback);
  }

  set(sid, sessionData, callback) {
    this.ready.then(async () => {
      const expires = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(
            Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000)
          );

      await db.query(
        `INSERT INTO ${this.tableName} (session_id, expires, data)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id)
         DO UPDATE SET expires = EXCLUDED.expires, data = EXCLUDED.data`,
        [sid, expires, JSON.stringify(sessionData)]
      );

      callback?.(null);
    }).catch(error => callback?.(error));
  }

  destroy(sid, callback) {
    this.ready.then(async () => {
      await db.query(
        `DELETE FROM ${this.tableName} WHERE session_id = $1`,
        [sid]
      );
      callback?.(null);
    }).catch(error => callback?.(error));
  }

  touch(sid, sessionData, callback) {
    this.ready.then(async () => {
      const expires = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(
            Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000)
          );

      await db.query(
        `UPDATE ${this.tableName} SET expires = $1 WHERE session_id = $2`,
        [expires, sid]
      );

      callback?.(null);
    }).catch(error => callback?.(error));
  }

  async clearExpired() {
    try {
      await this.ready;
      await db.query(
        `DELETE FROM ${this.tableName} WHERE expires <= NOW()`
      );
    } catch (error) {
      console.error(
        '[Session store] Cleanup failed:',
        error.code || error.message
      );
    }
  }
}

module.exports = PostgreSQLSessionStore;
```
