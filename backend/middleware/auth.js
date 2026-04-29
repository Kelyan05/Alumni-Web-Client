const AuthService   = require('../services/authService');
const ApiKeyService = require('../services/apiKeyService');

function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.admin = AuthService.verifyToken(header.split(' ')[1]);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired' });
  }
}

function requireApiKey(permission) {
  return async (req, res, next) => {
    try {
      req.apiKey = await ApiKeyService.validateKey(
        req.headers['x-api-key'], permission,
        { endpoint: req.path, method: req.method, ip: req.ip }
      );
      next();
    } catch (err) {
      return res.status(err.status || 401).json({ error: err.message });
    }
  };
}

module.exports = { authenticateToken, requireApiKey };
