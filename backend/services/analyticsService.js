const AnalyticsDao = require('../dao/analyticsDao');

const AnalyticsService = {
  async getSummary()          { return AnalyticsDao.summary(); },
  async getCareerPathways()   { return AnalyticsDao.careerPathways(); },
  async getTopSkills()        { return AnalyticsDao.topSkills(); },
  async getIndustryBreakdown(){ return AnalyticsDao.industryBreakdown(); },
  async getGraduationYearDist(){ return AnalyticsDao.graduationYearDist(); },
  async getCertsByCategory()  { return AnalyticsDao.certsByCategory(); },

  async getSkillsGap() {
    const raw       = await AnalyticsDao.skillsGap();
    const skills    = [...new Set(raw.map(r => r.skill))];
    const programmes= [...new Set(raw.map(r => r.programme))];
    const lookup    = {};
    for (const row of raw) lookup[`${row.programme}|${row.skill}`] = row.percentage;
    const datasets  = programmes.map(prog => ({
      label: prog,
      data:  skills.map(skill => lookup[`${prog}|${skill}`] || 0),
    }));
    return { labels: skills, datasets, raw };
  },

  async getCertTrends() {
    const raw        = await AnalyticsDao.certTrends();
    const years      = [...new Set(raw.map(r => r.year))].sort();
    const categories = [...new Set(raw.map(r => r.category))];
    const lookup     = {};
    for (const row of raw) lookup[`${row.category}|${row.year}`] = row.count;
    const datasets   = categories.map(cat => ({
      label: cat,
      data:  years.map(yr => lookup[`${cat}|${yr}`] || 0),
    }));
    return { labels: years, datasets };
  },
};

module.exports = AnalyticsService;
