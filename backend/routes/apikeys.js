const express  = require('express');
const { body, param } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest }   = require('../middleware/security');
const ApiKeyService = require('../services/apiKeyService');

const router = express.Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  res.json({ data: await ApiKeyService.listKeys() });
});

router.get('/stats', async (req, res) => {
  res.json({ data: await ApiKeyService.getUsageStats() });
});

router.post('/',
  [
    body('client_name').trim().notEmpty().withMessage('client_name required').escape(),
    body('permissions').isArray({ min: 1 }).withMessage('permissions must be a non-empty array'),
    body('permissions.*').isIn(ApiKeyService.VALID_PERMISSIONS)
      .withMessage(`Valid: ${ApiKeyService.VALID_PERMISSIONS.join(', ')}`),
  ],
  validateRequest,
  async (req, res) => {
    const result = await ApiKeyService.createKey({
      clientName: req.body.client_name, permissions: req.body.permissions,
    });
    res.status(201).json({ message: 'API key created. Copy it now — not shown again.', ...result });
  }
);

router.delete('/:id',
  [param('id').isInt({ min: 1 }).toInt()], validateRequest,
  async (req, res) => {
    try { await ApiKeyService.revokeKey(req.params.id); res.json({ message: 'API key revoked' }); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
  }
);

router.get('/:id/usage',
  [param('id').isInt({ min: 1 }).toInt()], validateRequest,
  async (req, res) => {
    res.json({ data: await ApiKeyService.getKeyUsage(req.params.id) });
  }
);

module.exports = router;
