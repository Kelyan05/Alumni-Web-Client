const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const AdminDao = require('../dao/adminDao');

const JWT_SECRET  = process.env.JWT_SECRET || 'change-me-in-production';
const SALT_ROUNDS = 12;  // OWASP recommends >= 10; 12 adds extra margin

const AuthService = {
  async register({ email, password, name }) {
    const existing = await AdminDao.findByEmail(email);
    if (existing) {
      const err = new Error('Email already registered'); err.status = 409; throw err;
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const id = await AdminDao.create({ email, passwordHash, name });
    return { id, email, name };
  },

  async login({ email, password, ipAddress }) {
    const admin = await AdminDao.findByEmail(email);
    // Always run bcrypt even on miss — prevents timing-based user enumeration
    const dummy = '$2a$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const hash  = admin ? admin.password_hash : dummy;
    const valid = await bcrypt.compare(password, hash);

    if (!admin || !valid) {
      const err = new Error('Invalid email or password'); err.status = 401; throw err;
    }

    await AdminDao.logSession(admin.id, ipAddress);

    const token = jwt.sign(
      { id: admin.id, email: admin.email, name: admin.name },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    return { token, name: admin.name, email: admin.email };
  },

  verifyToken(token) {
    return jwt.verify(token, JWT_SECRET); // throws if invalid/expired
  },
};

module.exports = AuthService;
