const AlumniDao = require('../dao/alumniDao');

const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 100;

const AlumniService = {
  async list({ programme, graduation_year, industry, page = 1, limit = DEFAULT_LIMIT }) {
    const safeLimit = Math.min(parseInt(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const safePage  = Math.max(parseInt(page)  || 1, 1);
    const offset    = (safePage - 1) * safeLimit;

    const { rows, total } = await AlumniDao.list({
      programme, graduation_year, industry, limit: safeLimit, offset,
    });

    return {
      data: rows,
      pagination: { total, page: safePage, limit: safeLimit, pages: Math.ceil(total / safeLimit) },
    };
  },

  async getById(id) {
    const alumnus = await AlumniDao.findById(id);
    if (!alumnus) { const err = new Error('Alumnus not found'); err.status = 404; throw err; }
    const [skills, certs] = await Promise.all([AlumniDao.skillsFor(id), AlumniDao.certsFor(id)]);
    return { ...alumnus, skills, certifications: certs };
  },

  async getOfTheDay() {
    const alumnus = await AlumniDao.random();
    if (!alumnus) { const err = new Error('No alumni found'); err.status = 404; throw err; }
    return alumnus;
  },

  async getFilters() {
    const [programmes, industries, graduation_years] = await Promise.all([
      AlumniDao.distinctProgrammes(),
      AlumniDao.distinctIndustries(),
      AlumniDao.distinctYears(),
    ]);
    return { programmes, industries, graduation_years };
  },
};

module.exports = AlumniService;
