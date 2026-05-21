const express = require('express');
const router = express.Router();
const { getPlacementReport, getApplicationReport, exportPlacedCSV, exportAllStudentsCSV, exportApplicationsCSV, getPublicStats } = require('../controllers/reportController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/public-stats', getPublicStats);  // no auth - for login page
router.get('/placement', protect, adminOnly, getPlacementReport);
router.get('/applications', protect, adminOnly, getApplicationReport);
router.get('/export/placed', protect, adminOnly, exportPlacedCSV);
router.get('/export/all-students', protect, adminOnly, exportAllStudentsCSV);
router.get('/export/applications', protect, adminOnly, exportApplicationsCSV);

module.exports = router;
