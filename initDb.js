const path = require('path');
const fs   = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Database = require('../db/database');

async function init() {
  const db = Database.getInstance();
  await db.open();

  // Stores university staff / dashboard admin accounts.
  // Passwords hashed with bcrypt (salt rounds >= 12).
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      email             TEXT NOT NULL UNIQUE,
      password_hash     TEXT NOT NULL,
      name              TEXT NOT NULL,
      role              TEXT NOT NULL DEFAULT 'analyst',  -- analyst | admin
      is_verified       INTEGER NOT NULL DEFAULT 0,
      verification_token TEXT,
      reset_token       TEXT,
      reset_token_expires INTEGER,                       -- Unix timestamp
      created_at        INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      last_login        INTEGER
    )
  `);

  // Core alumni profile table.
  await db.run(`
    CREATE TABLE IF NOT EXISTS alumni (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      email           TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      graduation_year INTEGER NOT NULL,
      programme       TEXT NOT NULL,   -- degree programme name
      industry_sector TEXT NOT NULL,
      job_title       TEXT,
      company         TEXT,
      location        TEXT,
      linkedin_url    TEXT,
      created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      updated_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  // Post-graduation certifications acquired by alumni.
  await db.run(`
    CREATE TABLE IF NOT EXISTS certifications (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      alumni_id   INTEGER NOT NULL REFERENCES alumni(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,       -- e.g. "AWS Certified Solutions Architect"
      provider    TEXT NOT NULL,       -- e.g. "Amazon", "Google", "Coursera"
      category    TEXT NOT NULL,       -- e.g. "Cloud", "Agile", "Data", "Security"
      year_earned INTEGER NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  // Registered API client applications
  await db.run(`
    CREATE TABLE IF NOT EXISTS api_clients (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL UNIQUE,     -- human-readable client name
      description TEXT,
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      created_by  INTEGER REFERENCES users(id)
    )
  `);

  // API keys are scoped to a client and carry a JSON array of permissions.
  await db.run(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id   INTEGER NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
      key_prefix  TEXT NOT NULL,            -- first 8 chars, stored plaintext for UI display
      key_hash    TEXT NOT NULL,            -- bcrypt hash of full key
      permissions TEXT NOT NULL,            -- JSON array: ["read:alumni","read:analytics"]
      is_active   INTEGER NOT NULL DEFAULT 1,
      expires_at  INTEGER,                  -- Unix timestamp, NULL = no expiry
      created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
      last_used   INTEGER
    )
  `);

  // Separated from api_keys to avoid growing the keys table unboundedly.
  await db.run(`
    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      api_key_id  INTEGER NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
      endpoint    TEXT NOT NULL,
      method      TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      ip_address  TEXT,
      timestamp   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS user_login_logs (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ip        TEXT,
      success   INTEGER NOT NULL,   -- 1 = success, 0 = failure
      timestamp INTEGER NOT NULL DEFAULT (strftime('%s','now'))
    )
  `);

  // ── Indexes for frequent queries ───────────────────────────────────────────
  await db.run(`CREATE INDEX IF NOT EXISTS idx_alumni_programme       ON alumni(programme)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_alumni_grad_year       ON alumni(graduation_year)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_alumni_sector          ON alumni(industry_sector)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cert_alumni            ON certifications(alumni_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cert_category          ON certifications(category)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_cert_year              ON certifications(year_earned)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_usage_key              ON api_usage_logs(api_key_id)`);
  await db.run(`CREATE INDEX IF NOT EXISTS idx_usage_timestamp        ON api_usage_logs(timestamp)`);

  console.log('✅  Database tables created successfully');
  await db.close();
}

init().catch(err => { console.error('DB init failed:', err); process.exit(1); });