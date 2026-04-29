const express  = require('express');
const { query, param } = require('express-validator');
const { requireApiKey }   = require('../middleware/auth');
const { validateRequest } = require('../middleware/security');
const AlumniService = require('../services/alumniService');

const router = express.Router();

router.get('/', requireApiKey('read:alumni'),
  [
    query('programme').optional().trim().escape(),
    query('graduation_year').optional().isInt({ min: 1990, max: 2100 }).toInt(),
    query('industry').optional().trim().escape(),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  validateRequest,
  async (req, res) => {
    try { res.json(await AlumniService.list(req.query)); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
  }
);

// Must be before /:id
router.get('/of-the-day', requireApiKey('read:alumni_of_day'), async (req, res) => {
  try { res.json({ data: await AlumniService.getOfTheDay() }); }
  catch (err) { res.status(err.status || 500).json({ error: err.message }); }
});

router.get('/filters', requireApiKey('read:alumni'), async (req, res) => {
  try { res.json({ data: await AlumniService.getFilters() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', requireApiKey('read:alumni'),
  [param('id').isInt({ min: 1 }).withMessage('ID must be a positive integer').toInt()],
  validateRequest,
  async (req, res) => {
    try { res.json({ data: await AlumniService.getById(req.params.id) }); }
    catch (err) { res.status(err.status || 500).json({ error: err.message }); }
  }
);

module.exports = router;
