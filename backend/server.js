

require('dotenv').config();

const express     = require('express');
const helmet      = require('helmet');
const cors        = require('cors');
const rateLimit   = require('express-rate-limit');
const path        = require('path');

const Database    = require('./db/database');
const authRoutes  = require('./routes/auth');
const alumniRoutes= require('./routes/alumni');
const analyticsRoutes = require('./routes/analytics');
const keysRoutes  = require('./routes/keys');
const usageRoutes = require('./routes/usage');
const exportRoutes= require('./routes/export');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── 1. Security Headers (helmet) ────────────────────────────────────────────
// Sets Content-Security-Policy, X-Frame-Options, X-XSS-Protection, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc : ["'self'"],
      scriptSrc  : ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "cdnjs.cloudflare.com"],
      styleSrc   : ["'self'", "'unsafe-inline'", "fonts.googleapis.com", "cdnjs.cloudflare.com"],
      fontSrc    : ["'self'", "fonts.gstatic.com"],
      imgSrc     : ["'self'", "data:"],
      connectSrc : ["'self'"],
    }
  }
}));

// ── 2. CORS ──────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (e.g. curl, Postman) in dev
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── 3. Body parsing ──────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Limit payload size to prevent ReDoS
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// ── 4. Global rate limiter ───────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs : parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max      : parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders  : false,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(globalLimiter);

// Stricter limiter for auth endpoints (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max     : parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  message : { error: 'Too many login attempts, please try again in 15 minutes.' }
});

// ── 5. Static frontend ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend/public')));

// ── 6. API Routes ────────────────────────────────────────────────────────────
app.use('/api/auth',      authLimiter, authRoutes);
app.use('/api/alumni',    alumniRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/keys',      keysRoutes);
app.use('/api/usage',     usageRoutes);
app.use('/api/export',    exportRoutes);

// ── 7. Health check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── 8. SPA fallback ──────────────────────────────────────────────────────────
// Any unmatched route serves the frontend so client-side routing works
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ── 9. Global error handler ───────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

// ── 10. Start server ─────────────────────────────────────────────────────────
async function start() {
  const db = Database.getInstance();
  await db.open();
  console.log('✅  Database connected');

  app.listen(PORT, () => {
    console.log(`🚀  Server running at http://localhost:${PORT}`);
    console.log(`📊  Dashboard at     http://localhost:${PORT}/pages/dashboard.html`);
  });
}

start().catch(err => { console.error('Failed to start:', err); process.exit(1); });