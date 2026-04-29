const { db } = require('../db/database');

const AdminDao = {
  async findByEmail(email) {
    const res = await db.execute({ sql: 'SELECT * FROM admins WHERE email = ?', args: [email] });
    return res.rows[0] || null;
  },

  async create({ email, passwordHash, name }) {
    const res = await db.execute({
      sql: 'INSERT INTO admins (email, password_hash, name) VALUES (?, ?, ?)',
      args: [email, passwordHash, name],
    });
    return Number(res.lastInsertRowid);
  },

  async logSession(adminId, ipAddress) {
    await db.execute({
      sql: 'INSERT INTO admin_sessions (admin_id, ip_address) VALUES (?, ?)',
      args: [adminId, ipAddress],
    });
  },

  async getSessions(adminId) {
    const res = await db.execute({
      sql: 'SELECT logged_in, ip_address FROM admin_sessions WHERE admin_id = ? ORDER BY logged_in DESC LIMIT 50',
      args: [adminId],
    });
    return res.rows;
  },
};

module.exports = AdminDao;
