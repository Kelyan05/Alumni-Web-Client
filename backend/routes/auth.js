const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const Database = require('../db/database');
const { registerRules, loginRules, handleValidationErrors, sanitizeBody } = require('../middleware/validate');
const { requireJWT } = require('../middleware/auth');
const mailer   = require('../utils/mailer');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
const RESET_TTL   = 60 * 60; // 1 hour in seconds

router.post('/register', registerRules, handleValidationErrors, sanitizeBody, async (req, res) => {
  const db = Database.getInstance();
  const { email, password, name } = req.body;

  // Check duplicate
  const existing = await db.get(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  // Hash password with bcrypt
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Cryptographically random verification token
  const verificationToken = crypto.randomBytes(32).toString('hex');

  await db.run(`
    INSERT INTO users (email, password_hash, name, verification_token)
    VALUES (?,?,?,?)
  `, [email, passwordHash, name, verificationToken]);

  // Send verification email (non-blocking)
  mailer.sendVerificationEmail(email, name, verificationToken).catch(console.error);

  res.status(201).json({ message: 'Account created. Please check your email to verify your account.' });
});

router.get('/verify/:token', async (req, res) => {
  const db = Database.getInstance();
  const { token } = req.params;

  // Token is random hex – validate format first
  if (!/^[a-f0-9]{64}$/.test(token)) {
    return res.status(400).json({ error: 'Invalid token format' });
  }

  const user = await db.get(`SELECT id FROM users WHERE verification_token = ?`, [token]);
  if (!user) return res.status(400).json({ error: 'Invalid or already used verification token' });

  await db.run(`
    UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?
  `, [user.id]);

  res.json({ message: 'Email verified. You may now log in.' });
});

router.post('/login', loginRules, handleValidationErrors, async (req, res) => {
  const db = Database.getInstance();
  const { email, password } = req.body;

  const user = await db.get(
    `SELECT id, email, name, role, password_hash, is_verified FROM users WHERE email = ?`,
    [email]
  );

  // Always run bcrypt even if user not found, to prevent timing attacks
  const fakeHash = '$2a$12$invalidhashpadding000000000000000000000000000000000000';
  const hashToCompare = user ? user.password_hash : fakeHash;
  const valid = await bcrypt.compare(password, hashToCompare);

  if (!user || !valid) {
    // Log failed attempt
    if (user) {
      await db.run(`INSERT INTO user_login_logs (user_id, ip, success) VALUES (?,?,0)`, [user.id, req.ip]);
    }
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.is_verified) {
    return res.status(403).json({ error: 'Please verify your email address before logging in.' });
  }

  // Issue JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );

  // Log successful login
  await db.run(`INSERT INTO user_login_logs (user_id, ip, success) VALUES (?,?,1)`, [user.id, req.ip]);
  await db.run(`UPDATE users SET last_login = strftime('%s','now') WHERE id = ?`, [user.id]);

  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/forgot', async (req, res) => {
  const db = Database.getInstance();
  // Always return 200 to prevent email enumeration
  const { email } = req.body;
  const user = await db.get(`SELECT id, name FROM users WHERE email = ?`, [email]);

  if (user) {
    const token   = crypto.randomBytes(32).toString('hex');
    const expires = Math.floor(Date.now() / 1000) + RESET_TTL;
    await db.run(`UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`, [token, expires, user.id]);
    mailer.sendPasswordResetEmail(email, user.name, token).catch(console.error);
  }

  res.json({ message: 'If that email is registered, a reset link has been sent.' });
});

router.post('/reset', async (req, res) => {
  const db = Database.getInstance();
  const { token, password } = req.body;

  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: 'Token and valid password required' });
  }

  const now  = Math.floor(Date.now() / 1000);
  const user = await db.get(`
    SELECT id FROM users
    WHERE reset_token = ? AND reset_token_expires > ?
  `, [token, now]);

  if (!user) return res.status(400).json({ error: 'Token invalid or expired' });

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  // Nullify token immediately (single-use)
  await db.run(`
    UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?
  `, [hash, user.id]);

  res.json({ message: 'Password reset successful.' });
});

router.get('/me', requireJWT, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;