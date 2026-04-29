const { db } = require('../db/database');

const ApiKeyDao = {
  async findByPrefix(prefix) {
    const res = await db.execute({
      sql: 'SELECT * FROM api_keys WHERE key_prefix = ? AND is_active = 1',
      args: [prefix],
    });
    return res.rows[0] || null;
  },

  async listAll() {
    const res = await db.execute(`
      SELECT
        k.id, k.client_name, k.permissions, k.is_active,
        k.created_at, k.last_used,
        k.key_prefix || '...' AS key_preview,
        COUNT(u.id) AS total_requests
      FROM api_keys k
      LEFT JOIN api_key_usage u ON k.id = u.key_id
      GROUP BY k.id
      ORDER BY k.created_at DESC
    `);
    return res.rows;
  },

  async create({ keyHash, keyPrefix, clientName, permissions }) {
    const res = await db.execute({
      sql: 'INSERT INTO api_keys (key_hash, key_prefix, client_name, permissions) VALUES (?, ?, ?, ?)',
      args: [keyHash, keyPrefix, clientName, JSON.stringify(permissions)],
    });
    return Number(res.lastInsertRowid);
  },

  async revoke(id) {
    const res = await db.execute({
      sql: 'UPDATE api_keys SET is_active = 0 WHERE id = ?',
      args: [id],
    });
    return res.rowsAffected;
  },

  async logUsage({ keyId, endpoint, method, ipAddress }) {
    await db.execute({
      sql: 'INSERT INTO api_key_usage (key_id, endpoint, method, ip_address) VALUES (?, ?, ?, ?)',
      args: [keyId, endpoint, method, ipAddress],
    });
    await db.execute({
      sql: "UPDATE api_keys SET last_used = datetime('now') WHERE id = ?",
      args: [keyId],
    });
  },

  async getUsage(keyId) {
    const res = await db.execute({
      sql: 'SELECT endpoint, method, ip_address, accessed_at FROM api_key_usage WHERE key_id = ? ORDER BY accessed_at DESC LIMIT 200',
      args: [keyId],
    });
    return res.rows;
  },

  async getUsageStats() {
    const res = await db.execute(`
      SELECT k.client_name, u.endpoint, COUNT(*) AS hits, MAX(u.accessed_at) AS last_hit
      FROM api_key_usage u
      JOIN api_keys k ON u.key_id = k.id
      GROUP BY k.client_name, u.endpoint
      ORDER BY hits DESC
    `);
    return res.rows;
  },
};

module.exports = ApiKeyDao;
