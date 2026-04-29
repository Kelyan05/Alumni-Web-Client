const crypto     = require('crypto');
const ApiKeyDao  = require('../dao/apiKeyDao');

const VALID_PERMISSIONS = [
  'read:alumni',
  'read:analytics',
  'read:alumni_of_day',
  'read:donations',
];

const ApiKeyService = {
  async createKey({ clientName, permissions }) {
    const rawKey    = 'ak_' + crypto.randomBytes(32).toString('hex');
    const keyHash   = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 8);

    const id = await ApiKeyDao.create({ keyHash, keyPrefix, clientName, permissions });
    return { id, rawKey, clientName, permissions };
  },

  async listKeys() {
    const rows = await ApiKeyDao.listAll();
    return rows.map(k => ({ ...k, permissions: JSON.parse(k.permissions) }));
  },

  async revokeKey(id) {
    const changed = await ApiKeyDao.revoke(id);
    if (!changed) { const err = new Error('API key not found'); err.status = 404; throw err; }
  },

  async getKeyUsage(keyId) {
    return ApiKeyDao.getUsage(keyId);
  },

  async getUsageStats() {
    return ApiKeyDao.getUsageStats();
  },

  async validateKey(rawKey, requiredPermission, { endpoint, method, ip }) {
    if (!rawKey) {
      const err = new Error('API key required (X-Api-Key header)'); err.status = 401; throw err;
    }
    const prefix = rawKey.substring(0, 8);
    const keyRow = await ApiKeyDao.findByPrefix(prefix);
    if (!keyRow) {
      const err = new Error('Invalid or inactive API key'); err.status = 401; throw err;
    }
    const inputHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    if (inputHash !== keyRow.key_hash) {
      const err = new Error('Invalid API key'); err.status = 401; throw err;
    }
    const keyPermissions = JSON.parse(keyRow.permissions || '[]');
    if (requiredPermission && !keyPermissions.includes(requiredPermission)) {
      const err = new Error(`Permission denied. Key lacks: ${requiredPermission}`); err.status = 403; throw err;
    }
    await ApiKeyDao.logUsage({ keyId: keyRow.id, endpoint, method, ipAddress: ip });
    return { ...keyRow, parsedPermissions: keyPermissions };
  },

  VALID_PERMISSIONS,
};

module.exports = ApiKeyService;
