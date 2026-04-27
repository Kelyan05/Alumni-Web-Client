const { body, param, query, validationResult } = require('express-validator');
const xss = require('xss');

/**
 * After applying validation rules, this middleware checks for errors.
 * If any exist, it returns 422 with a structured error list.
 */
function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ errors: errors.array() });
  }
  next();
}

/**
 * Sanitise all string body fields against XSS.
 * Called after express-validator checks pass.
 */
function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    for (const key of Object.keys(req.body)) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key].trim());
      }
    }
  }
  next();
}

const registerRules = [
  body('email')
    .isEmail().withMessage('Valid email required')
    .normalizeEmail()
    .matches(/@.+\.(ac\.uk|edu|university)$/)
    .withMessage('University email address required'),

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a special character'),

  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name too long'),
];

const loginRules = [
  body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password required'),
];

const apiKeyCreateRules = [
  body('clientName')
    .trim().notEmpty().withMessage('Client name required')
    .isLength({ max: 100 }),
  body('permissions')
    .isArray({ min: 1 }).withMessage('At least one permission required'),
  body('permissions.*')
    .isIn(['read:alumni', 'read:analytics', 'read:alumni_of_day', 'read:donations'])
    .withMessage('Invalid permission scope'),
];

module.exports = {
  handleValidationErrors,
  sanitizeBody,
  registerRules,
  loginRules,
  apiKeyCreateRules,
};