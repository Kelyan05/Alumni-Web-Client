/**
 * js/api.js
 * 
 * Central API helper module.
 * All backend requests go through these functions so the API key
 * and JWT token are always included correctly.
 */

const API_BASE = 'http://localhost:3000';

// Hardcoded Analytics Dashboard API key for demo
// In production this would be fetched securely or stored in env config
const ANALYTICS_API_KEY = window.__ANALYTICS_KEY__ || 'ak_analytics_demo';

// Store JWT token in memory (not localStorage - XSS protection)
let _token = null;

/**
 * Make an authenticated API request.
 * Automatically attaches:
 *   - Authorization: Bearer <jwt>     (for dashboard user auth)
 *   - X-API-Key: <key>               (for scoped data access)
 */
async function apiRequest(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (_token) headers['Authorization'] = `Bearer ${_token}`;
  if (ANALYTICS_API_KEY) headers['X-API-Key'] = ANALYTICS_API_KEY;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

// ---- AUTH ----

async function login(email, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: {}, // No API key needed for auth
  });
  _token = data.token;
  return data;
}

async function register(name, email, password) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
    headers: {},
  });
}

function logout() {
  _token = null;
}

// ---- ANALYTICS ----

async function getSummary() {
  return apiRequest('/api/analytics/summary');
}

async function getSkillsGap() {
  return apiRequest('/api/analytics/skills-gap');
}

async function getCareerPathways() {
  return apiRequest('/api/analytics/career-pathways');
}

async function getCertificationTrends() {
  return apiRequest('/api/analytics/certification-trends');
}

async function getEmploymentByYear() {
  return apiRequest('/api/analytics/employment-by-year');
}

async function getTopSkills() {
  return apiRequest('/api/analytics/top-skills');
}

async function getIndustryBreakdown() {
  return apiRequest('/api/analytics/industry-breakdown');
}

// ---- ALUMNI ----

async function getAlumni(filters = {}, page = 1, limit = 20) {
  const params = new URLSearchParams({ page, limit, ...filters });
  return apiRequest(`/api/alumni?${params}`);
}

// ---- API KEYS (admin) ----

async function getApiKeys() {
  return apiRequest('/api/keys');
}

async function revokeApiKey(id) {
  return apiRequest(`/api/keys/${id}`, { method: 'DELETE' });
}

async function getKeyUsage(id) {
  return apiRequest(`/api/keys/${id}/usage`);
}

// Export for use in other scripts
window.Api = {
  login, register, logout,
  getSummary, getSkillsGap, getCareerPathways,
  getCertificationTrends, getEmploymentByYear,
  getTopSkills, getIndustryBreakdown,
  getAlumni, getApiKeys, revokeApiKey, getKeyUsage,
};