
const { db } = require('../db/database');

const AlumniDao = {
  async list({ programme, graduation_year, industry, limit, offset }) {
    const conditions = [];
    const params     = [];

    if (programme)       { conditions.push('a.programme = ?');       params.push(programme); }
    if (graduation_year) { conditions.push('a.graduation_year = ?'); params.push(graduation_year); }
    if (industry)        { conditions.push('a.industry = ?');        params.push(industry); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const rowRes = await db.execute({
      sql: `SELECT a.id, a.name, a.programme, a.graduation_year,
                   a.industry, a.job_title, a.employer, a.created_at
            FROM alumni a ${where}
            ORDER BY a.graduation_year DESC, a.name ASC
            LIMIT ? OFFSET ?`,
      args: [...params, limit, offset],
    });

    const countRes = await db.execute({
      sql: `SELECT COUNT(*) AS c FROM alumni a ${where}`,
      args: params,
    });

    return { rows: rowRes.rows, total: countRes.rows[0].c };
  },

  async findById(id) {
    const res = await db.execute({ sql: 'SELECT * FROM alumni WHERE id = ?', args: [id] });
    return res.rows[0] || null;
  },

  async random() {
    const res = await db.execute(
      'SELECT id, name, programme, graduation_year, industry, job_title, employer FROM alumni ORDER BY RANDOM() LIMIT 1'
    );
    return res.rows[0] || null;
  },

  async skillsFor(alumniId) {
    const res = await db.execute({
      sql: `SELECT s.name AS skill, als.acquired_after_graduation
            FROM alumni_skills als
            JOIN skills s ON als.skill_id = s.id
            WHERE als.alumni_id = ?`,
      args: [alumniId],
    });
    return res.rows;
  },

  async certsFor(alumniId) {
    const res = await db.execute({
      sql: 'SELECT name, provider, category, acquired_date FROM certifications WHERE alumni_id = ?',
      args: [alumniId],
    });
    return res.rows;
  },

  async distinctProgrammes() {
    const res = await db.execute('SELECT DISTINCT programme FROM alumni ORDER BY programme');
    return res.rows.map(r => r.programme);
  },

  async distinctIndustries() {
    const res = await db.execute('SELECT DISTINCT industry FROM alumni ORDER BY industry');
    return res.rows.map(r => r.industry);
  },

  async distinctYears() {
    const res = await db.execute('SELECT DISTINCT graduation_year FROM alumni ORDER BY graduation_year');
    return res.rows.map(r => r.graduation_year);
  },
};

module.exports = AlumniDao;
