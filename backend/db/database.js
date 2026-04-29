const { createClient } = require('@libsql/client');
const path   = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const DB_PATH = 'file:' + path.join(__dirname, 'alumni_analytics.db');
const db = createClient({ url: DB_PATH });


async function createSchema() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      email         TEXT    NOT NULL UNIQUE,
      password_hash TEXT    NOT NULL,
      name          TEXT    NOT NULL,
      created_at    TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS admin_sessions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id   INTEGER NOT NULL REFERENCES admins(id),
      ip_address TEXT,
      logged_in  TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS api_keys (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash    TEXT    NOT NULL UNIQUE,
      key_prefix  TEXT    NOT NULL,
      client_name TEXT    NOT NULL,
      permissions TEXT    NOT NULL,
      is_active   INTEGER DEFAULT 1,
      created_at  TEXT    DEFAULT (datetime('now')),
      last_used   TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS api_key_usage (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      key_id      INTEGER NOT NULL REFERENCES api_keys(id),
      endpoint    TEXT    NOT NULL,
      method      TEXT    NOT NULL,
      ip_address  TEXT,
      accessed_at TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS alumni (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      email           TEXT    NOT NULL UNIQUE,
      programme       TEXT    NOT NULL,
      graduation_year INTEGER NOT NULL,
      industry        TEXT    NOT NULL,
      job_title       TEXT,
      employer        TEXT,
      created_at      TEXT    DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS skills (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`,
    `CREATE TABLE IF NOT EXISTS alumni_skills (
      id                        INTEGER PRIMARY KEY AUTOINCREMENT,
      alumni_id                 INTEGER NOT NULL REFERENCES alumni(id),
      skill_id                  INTEGER NOT NULL REFERENCES skills(id),
      acquired_after_graduation INTEGER NOT NULL DEFAULT 1,
      UNIQUE(alumni_id, skill_id)
    )`,
    `CREATE TABLE IF NOT EXISTS certifications (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      alumni_id     INTEGER NOT NULL REFERENCES alumni(id),
      name          TEXT    NOT NULL,
      provider      TEXT    NOT NULL,
      category      TEXT    NOT NULL,
      acquired_date TEXT    NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_alumni_programme   ON alumni(programme)`,
    `CREATE INDEX IF NOT EXISTS idx_alumni_grad_year   ON alumni(graduation_year)`,
    `CREATE INDEX IF NOT EXISTS idx_alumni_industry    ON alumni(industry)`,
    `CREATE INDEX IF NOT EXISTS idx_alumni_skills_alum ON alumni_skills(alumni_id)`,
    `CREATE INDEX IF NOT EXISTS idx_certs_alumni       ON certifications(alumni_id)`,
    `CREATE INDEX IF NOT EXISTS idx_api_keys_prefix    ON api_keys(key_prefix)`,
    `CREATE INDEX IF NOT EXISTS idx_api_usage_key      ON api_key_usage(key_id)`,
  ];

  for (const sql of statements) {
    await db.execute(sql);
  }
}


async function seed() {
  const res = await db.execute('SELECT COUNT(*) AS c FROM alumni');
  if (res.rows[0].c > 0) return;

  console.log('[DB] Seeding demo data...');

  const programmes = [
    'Computer Science BSc', 'Business Management BSc', 'Data Science MSc',
    'Software Engineering BSc', 'Cyber Security BSc', 'Artificial Intelligence MSc',
  ];
  const industries = ['Technology', 'Finance', 'Healthcare', 'Consulting', 'E-Commerce', 'Education'];
  const jobTitles  = ['Software Engineer', 'Data Analyst', 'Product Manager',
                      'Consultant', 'DevOps Engineer', 'ML Engineer'];
  const employers  = ['Google', 'HSBC', 'NHS Digital', 'Deloitte', 'Amazon', 'Barclays', 'IBM', 'Meta'];
  const skillNames = [
    'Docker', 'Kubernetes', 'Python', 'AWS', 'Azure', 'GCP',
    'React', 'Node.js', 'SQL', 'Tableau', 'Machine Learning',
    'Agile/Scrum', 'Terraform', 'Java', 'TypeScript',
  ];
  const certPool = [
    { name: 'AWS Solutions Architect', provider: 'Amazon',        category: 'Cloud'     },
    { name: 'Azure Fundamentals',      provider: 'Microsoft',      category: 'Cloud'     },
    { name: 'GCP Associate',           provider: 'Google',         category: 'Cloud'     },
    { name: 'Certified Scrum Master',  provider: 'Scrum Alliance', category: 'Agile'     },
    { name: 'PMP',                     provider: 'PMI',            category: 'Agile'     },
    { name: 'Docker Certified',        provider: 'Docker Inc',     category: 'DevOps'    },
    { name: 'Kubernetes CKA',          provider: 'CNCF',           category: 'DevOps'    },
    { name: 'Tableau Desktop',         provider: 'Tableau',        category: 'Analytics' },
    { name: 'CompTIA Security+',       provider: 'CompTIA',        category: 'Security'  },
    { name: 'CISSP',                   provider: 'ISC2',           category: 'Security'  },
  ];
  const acquiredDates = ['2021-03-01','2021-09-15','2022-01-20','2022-06-10',
                         '2023-02-28','2023-08-01','2024-01-15','2024-09-30'];

  // Insert skills
  for (const name of skillNames) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO skills (name) VALUES (?)', args: [name] });
  }
  const skillsRes = await db.execute('SELECT id, name FROM skills');
  const allSkills = skillsRes.rows;

  // Insert alumni + skills + certications
  for (let i = 0; i < 120; i++) {
    const gradYr = 2019 + (i % 6);
    const aRes = await db.execute({
      sql: `INSERT INTO alumni (name, email, programme, graduation_year, industry, job_title, employer)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `Graduate ${i + 1}`,
        `grad${i + 1}@alumni.westminster.ac.uk`,
        programmes[i % programmes.length],
        gradYr,
        industries[i % industries.length],
        jobTitles[i % jobTitles.length],
        employers[i % employers.length],
      ],
    });
    const alumId = Number(aRes.lastInsertRowid);

    const numSkills = 2 + (i % 3);
    for (let s = 0; s < numSkills; s++) {
      const skill    = allSkills[(i * 3 + s) % allSkills.length];
      const postGrad = (i + s) % 4 !== 0 ? 1 : 0;
      await db.execute({
        sql: 'INSERT OR IGNORE INTO alumni_skills (alumni_id, skill_id, acquired_after_graduation) VALUES (?, ?, ?)',
        args: [alumId, Number(skill.id), postGrad],
      });
    }

    const numCerts = 1 + (i % 2);
    for (let c = 0; c < numCerts; c++) {
      const cert = certPool[(i + c) % certPool.length];
      await db.execute({
        sql: 'INSERT INTO certifications (alumni_id, name, provider, category, acquired_date) VALUES (?, ?, ?, ?, ?)',
        args: [alumId, cert.name, cert.provider, cert.category, acquiredDates[(i + c) % acquiredDates.length]],
      });
    }
  }

  // Default API keys
  const analyticsRaw  = 'ak_dash_' + crypto.randomBytes(20).toString('hex');
  const analyticsHash = crypto.createHash('sha256').update(analyticsRaw).digest('hex');
  await db.execute({
    sql: 'INSERT INTO api_keys (key_hash, key_prefix, client_name, permissions) VALUES (?, ?, ?, ?)',
    args: [analyticsHash, analyticsRaw.substring(0, 8), 'Analytics Dashboard',
           JSON.stringify(['read:alumni', 'read:analytics'])],
  });

  const arRaw  = 'ak_ar___' + crypto.randomBytes(20).toString('hex');
  const arHash = crypto.createHash('sha256').update(arRaw).digest('hex');
  await db.execute({
    sql: 'INSERT INTO api_keys (key_hash, key_prefix, client_name, permissions) VALUES (?, ?, ?, ?)',
    args: [arHash, arRaw.substring(0, 8), 'Mobile AR App',
           JSON.stringify(['read:alumni_of_day'])],
  });

  console.log('[DB] Seed complete: 120 alumni, 2 API keys');
  console.log('[DB] Analytics Dashboard key:', analyticsRaw);
  console.log('[DB] Mobile AR App key:      ', arRaw);
}

async function initDatabase() {
  await createSchema();
  await seed();
}

module.exports = { db, initDatabase };
