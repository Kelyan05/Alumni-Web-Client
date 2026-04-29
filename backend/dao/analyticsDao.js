const { db } = require('../db/database');

const AnalyticsDao = {
  async summary() {
    const [a, c, s, p] = await Promise.all([
      db.execute('SELECT COUNT(*) AS c FROM alumni'),
      db.execute('SELECT COUNT(*) AS c FROM certifications'),
      db.execute('SELECT COUNT(DISTINCT skill_id) AS c FROM alumni_skills WHERE acquired_after_graduation = 1'),
      db.execute('SELECT COUNT(DISTINCT programme) AS c FROM alumni'),
    ]);
    return {
      totalAlumni:    a.rows[0].c,
      totalCerts:     c.rows[0].c,
      postGradSkills: s.rows[0].c,
      programmes:     p.rows[0].c,
    };
  },

  async skillsGap() {
    const res = await db.execute(`
      SELECT
        a.programme,
        s.name AS skill,
        COUNT(*) AS alumni_count,
        ROUND(COUNT(*) * 100.0 /
          (SELECT COUNT(*) FROM alumni a2 WHERE a2.programme = a.programme), 1
        ) AS percentage
      FROM alumni_skills als
      JOIN alumni a ON als.alumni_id = a.id
      JOIN skills  s ON als.skill_id  = s.id
      WHERE als.acquired_after_graduation = 1
      GROUP BY a.programme, s.name
      ORDER BY a.programme, alumni_count DESC
    `);
    return res.rows;
  },

  async careerPathways() {
    const res = await db.execute(`
      SELECT programme, industry, COUNT(*) AS alumni_count
      FROM alumni
      GROUP BY programme, industry
      ORDER BY programme, alumni_count DESC
    `);
    return res.rows;
  },

  async certTrends() {
    const res = await db.execute(`
      SELECT SUBSTR(acquired_date, 1, 4) AS year, category, COUNT(*) AS count
      FROM certifications
      GROUP BY year, category
      ORDER BY year ASC
    `);
    return res.rows;
  },

  async topSkills() {
    const res = await db.execute(`
      SELECT s.name AS skill, COUNT(*) AS total_alumni,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM alumni), 1) AS percentage
      FROM alumni_skills als
      JOIN skills s ON als.skill_id = s.id
      WHERE als.acquired_after_graduation = 1
      GROUP BY s.name
      ORDER BY total_alumni DESC
      LIMIT 10
    `);
    return res.rows;
  },

  async industryBreakdown() {
    const res = await db.execute(`
      SELECT industry, COUNT(*) AS count
      FROM alumni
      GROUP BY industry
      ORDER BY count DESC
    `);
    return res.rows;
  },

  async graduationYearDist() {
    const res = await db.execute(`
      SELECT graduation_year, COUNT(*) AS count
      FROM alumni
      GROUP BY graduation_year
      ORDER BY graduation_year ASC
    `);
    return res.rows;
  },

  async certsByCategory() {
    const res = await db.execute(`
      SELECT category, COUNT(*) AS count
      FROM certifications
      GROUP BY category
      ORDER BY count DESC
    `);
    return res.rows;
  },
};

module.exports = AnalyticsDao;
