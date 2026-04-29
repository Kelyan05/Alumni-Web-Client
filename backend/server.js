require('dotenv').config();

const express = require('express');
const path    = require('path');
const { helmetMiddleware, corsMiddleware, generalLimiter } = require('./middleware/security');
const { initDatabase } = require('./db/database');

const authRoutes      = require('./routes/auth');
const alumniRoutes    = require('./routes/alumni');
const analyticsRoutes = require('./routes/analytics');
const apiKeyRoutes    = require('./routes/apikeys');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(generalLimiter);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

app.use('/api/auth',      authRoutes);
app.use('/api/alumni',    alumniRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/keys',      apiKeyRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  // Only handle routes without file extensions
  if (!path.extname(req.path)) {
    return res.sendFile(path.join(__dirname, '../frontend/index.html'));
  }

  res.status(404).end();
});

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`SERVER Alumni Analytics Dashboard → http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('FATAL Database init failed:', err);
    process.exit(1);
  });

module.exports = app;
