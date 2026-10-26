const session = require('express-session');
const db = require('../config/db');

class MySQLSessionStore extends session.Store {
  constructor(options = {}) {
    super();
    this.tableName = options.tableName || 'session_store';
    this.ready = this.ensureTable();
    this.ready.catch(() => {});
    this.cleanupTimer = setInterval(() => this.clearExpired(), options.cleanupInterval || 15 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  async ensureTable() {
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.tableName} (
        session_id VARCHAR(128) NOT NULL PRIMARY KEY,
        expires DATETIME NOT NULL,
        data MEDIUMTEXT NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  get(sid, callback) {
    this.ready.then(async () => {
      const [rows] = await db.query(
        `SELECT data, expires FROM ${this.tableName} WHERE session_id = ? LIMIT 1`,
        [sid]
      );
      if (!rows.length) return callback(null, null);
      if (new Date(rows[0].expires).getTime() <= Date.now()) {
        await db.query(`DELETE FROM ${this.tableName} WHERE session_id = ?`, [sid]);
        return callback(null, null);
      }
      callback(null, JSON.parse(rows[0].data));
    }).catch(callback);
  }

  set(sid, sessionData, callback) {
    this.ready.then(async () => {
      const expires = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000));
      await db.query(
        `INSERT INTO ${this.tableName} (session_id, expires, data)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE expires = VALUES(expires), data = VALUES(data)`,
        [sid, expires, JSON.stringify(sessionData)]
      );
      callback?.(null);
    }).catch((error) => callback?.(error));
  }

  destroy(sid, callback) {
    this.ready.then(async () => {
      await db.query(`DELETE FROM ${this.tableName} WHERE session_id = ?`, [sid]);
      callback?.(null);
    }).catch((error) => callback?.(error));
  }

  touch(sid, sessionData, callback) {
    this.ready.then(async () => {
      const expires = sessionData.cookie?.expires
        ? new Date(sessionData.cookie.expires)
        : new Date(Date.now() + (sessionData.cookie?.maxAge || 8 * 60 * 60 * 1000));
      await db.query(
        `UPDATE ${this.tableName} SET expires = ? WHERE session_id = ?`,
        [expires, sid]
      );
      callback?.(null);
    }).catch((error) => callback?.(error));
  }

  async clearExpired() {
    try {
      await this.ready;
      await db.query(`DELETE FROM ${this.tableName} WHERE expires <= NOW()`);
    } catch (error) {
      console.error('[Session store] Cleanup failed:', error.code || error.message);
    }
  }
}

module.exports = MySQLSessionStore;
