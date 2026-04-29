/**
 * routes/auth.js  —  ROUTER LAYER (Auth)
 * POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
 */

const express  = require('express');
const { body } = require('express-validator');
const AuthService = require('../services/authService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest, authLimiter } = require('../middleware/security');

const router = express.Router();

router.post('/register',
  [
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password')
      .isLength({ min: 8 }).withMessage('Minimum 8 characters')
      .matches(/[A-Z]/).withMessage('Must contain an uppercase letter')
      .matches(/\d/).withMessage('Must contain a number'),
    body('name').trim().notEmpty().withMessage('Name required').escape(),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const result = await AuthService.register(req.body);
      res.status(201).json({ message: 'Admin account created', ...result });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.post('/login', authLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty().withMessage('Password required'),
  ],
  validateRequest,
  async (req, res) => {
    try {
      const result = await AuthService.login({ ...req.body, ipAddress: req.ip });
      res.json(result);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  }
);

router.get('/me', authenticateToken, (req, res) => {
  res.json({ id: req.admin.id, name: req.admin.name, email: req.admin.email });
});

module.exports = router;
