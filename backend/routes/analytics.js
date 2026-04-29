const express = require('express');
const { requireApiKey }    = require('../middleware/auth');
const AnalyticsService = require('../services/analyticsService');

const router = express.Router();
router.use(requireApiKey('read:analytics'));

const wrap = fn => async (req, res) => {
  try { res.json({ data: await fn() }); }
  catch (err) { res.status(500).json({ error: err.message }); }
};

router.get('/summary',            wrap(() => AnalyticsService.getSummary()));
router.get('/skills-gap',         wrap(() => AnalyticsService.getSkillsGap()));
router.get('/career-pathways',    wrap(() => AnalyticsService.getCareerPathways()));
router.get('/cert-trends',        wrap(() => AnalyticsService.getCertTrends()));
router.get('/top-skills',         wrap(() => AnalyticsService.getTopSkills()));
router.get('/industry-breakdown', wrap(() => AnalyticsService.getIndustryBreakdown()));
router.get('/graduation-years',   wrap(() => AnalyticsService.getGraduationYearDist()));
router.get('/certs-by-category',  wrap(() => AnalyticsService.getCertsByCategory()));

module.exports = router;
