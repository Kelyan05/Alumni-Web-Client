const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const bcrypt    = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const Database  = require('../db/database');
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;

// ── Sample data ──────────────────────────────────────────────────────────────

const PROGRAMMES = [
  'Computer Science', 'Software Engineering', 'Data Science',
  'Business Management', 'Digital Marketing', 'Cybersecurity',
  'Artificial Intelligence', 'Information Systems'
];

const SECTORS = [
  'Technology', 'Finance', 'Healthcare', 'Education',
  'Consulting', 'E-Commerce', 'Media', 'Government', 'Data Analytics'
];

const CERT_DATA = [
  { name: 'AWS Certified Solutions Architect',   provider: 'Amazon',     category: 'Cloud' },
  { name: 'Microsoft Azure Administrator',        provider: 'Microsoft',  category: 'Cloud' },
  { name: 'Google Cloud Professional',            provider: 'Google',     category: 'Cloud' },
  { name: 'Certified Kubernetes Administrator',   provider: 'CNCF',       category: 'DevOps' },
  { name: 'Docker Certified Associate',           provider: 'Docker',     category: 'DevOps' },
  { name: 'Certified Scrum Master',               provider: 'Scrum Alliance', category: 'Agile' },
  { name: 'PMI Agile Certified Practitioner',     provider: 'PMI',        category: 'Agile' },
  { name: 'Python for Data Science',              provider: 'Coursera',   category: 'Data' },
  { name: 'Tableau Desktop Specialist',           provider: 'Tableau',    category: 'Data' },
  { name: 'Google Data Analytics Certificate',    provider: 'Google',     category: 'Data' },
  { name: 'CompTIA Security+',                    provider: 'CompTIA',    category: 'Security' },
  { name: 'Certified Ethical Hacker',             provider: 'EC-Council', category: 'Security' },
  { name: 'CISSP',                                provider: 'ISC2',       category: 'Security' },
  { name: 'Machine Learning Specialisation',      provider: 'Coursera',   category: 'AI/ML' },
  { name: 'TensorFlow Developer Certificate',     provider: 'Google',     category: 'AI/ML' },
];

const TITLES = [
  'Software Engineer', 'Data Analyst', 'Cloud Architect', 'Product Manager',
  'DevOps Engineer', 'Security Analyst', 'Full Stack Developer', 'ML Engineer',
  'Business Analyst', 'IT Consultant', 'Data Scientist', 'Solutions Architect'
];

const COMPANIES = [
  'Google', 'Amazon', 'Microsoft', 'Deloitte', 'Accenture',
  'HSBC', 'NHS Digital', 'BT Group', 'Lloyds Banking', 'Sky'
];

function rnd(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rndInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function seed() {
  const db = Database.getInstance();
  await db.open();

  const existing = await db.get(`SELECT id FROM users WHERE email = 'admin@university.ac.uk'`);
  if (!existing) {
    const hash = await bcrypt.hash('Admin@1234!', SALT_ROUNDS);
    await db.run(`
      INSERT INTO users (email, password_hash, name, role, is_verified)
      VALUES ('admin@university.ac.uk', ?, 'Dashboard Admin', 'admin', 1)
    `, [hash]);
    console.log('Admin user created  (admin@university.ac.uk / Admin@1234!)');
  }

  const clients = [
    { name: 'Analytics Dashboard', description: 'University analytics web dashboard', perms: '["read:alumni","read:analytics"]' },
    { name: 'Mobile AR App',       description: 'AR mobile app for campus tours',     perms: '["read:alumni_of_day"]' },
  ];

  for (const c of clients) {
    const ec = await db.get(`SELECT id FROM api_clients WHERE name = ?`, [c.name]);
    let clientId;
    if (!ec) {
      const r = await db.run(`INSERT INTO api_clients (name, description) VALUES (?,?)`, [c.name, c.description]);
      clientId = r.lastID;
    } else {
      clientId = ec.id;
    }

    // Check if key already exists for this client
    const ek = await db.get(`SELECT id FROM api_keys WHERE client_id = ?`, [clientId]);
    if (!ek) {
      // Generate a cryptographically random key
      const crypto = require('crypto');
      const rawKey  = 'ak_' + crypto.randomBytes(24).toString('hex');
      const prefix  = rawKey.slice(0, 10);
      const hash    = await bcrypt.hash(rawKey, SALT_ROUNDS);
      await db.run(`
        INSERT INTO api_keys (client_id, key_prefix, key_hash, permissions)
        VALUES (?,?,?,?)
      `, [clientId, prefix, hash, c.perms]);
      console.log(`API key for "${c.name}": ${rawKey}`);
    }
  }

  const count = await db.get(`SELECT COUNT(*) as n FROM alumni`);
  if (count.n >= 100) {
    console.log('⏩  Alumni data already seeded, skipping');
    await db.close();
    return;
  }

  console.log('🌱  Seeding 120 alumni records...');
  for (let i = 1; i <= 120; i++) {
    const programme   = rnd(PROGRAMMES);
    const sector      = rnd(SECTORS);
    const gradYear    = rndInt(2018, 2024);
    const res = await db.run(`
      INSERT INTO alumni (email, name, graduation_year, programme, industry_sector, job_title, company, location)
      VALUES (?,?,?,?,?,?,?,?)
    `, [
      `alumni${i}@example.com`,
      `Graduate ${i}`,
      gradYear,
      programme,
      sector,
      rnd(TITLES),
      rnd(COMPANIES),
      'London'
    ]);

    // 1-4 certifications per alumnus, acquired after graduation
    const numCerts = rndInt(1, 4);
    const certPool = [...CERT_DATA].sort(() => 0.5 - Math.random()).slice(0, numCerts);
    for (const cert of certPool) {
      await db.run(`
        INSERT INTO certifications (alumni_id, name, provider, category, year_earned)
        VALUES (?,?,?,?,?)
      `, [res.lastID, cert.name, cert.provider, cert.category, rndInt(gradYear, 2025)]);
    }
  }

  console.log('✅  Seed complete');
  await db.close();
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });