const express = require('express');
const router = express.Router();
const { authenticate, requireInternal } = require('../middleware/auth');
const {
  getSummaryStats,
  getRegistrationTrend,
  getBusinessTypeTrend,
  getKpiTable,
  getTicketReport
} = require('../controllers/dashboardController');

router.use(authenticate, requireInternal);

router.get('/stats',           getSummaryStats);
router.get('/trend/registrations', getRegistrationTrend);
router.get('/trend/business-type', getBusinessTypeTrend);
router.get('/kpi',             getKpiTable);
router.get('/tickets',         getTicketReport);

module.exports = router;
