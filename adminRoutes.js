const express = require('express');
const router = express.Router();
const { getDashboardStats, createAdmin, createRecruiter, toggleStudentStatus, downloadAllResumes, downloadSelectiveResumes } = require('../controllers/adminController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/dashboard', protect, adminOnly, getDashboardStats);
router.post('/create-admin', protect, adminOnly, createAdmin);
router.post('/create-recruiter', protect, adminOnly, createRecruiter);
router.put('/students/:id/toggle', protect, adminOnly, toggleStudentStatus);

// Resume download routes
router.get('/resumes/download-all', protect, adminOnly, downloadAllResumes);
router.post('/resumes/download-selective', protect, adminOnly, downloadSelectiveResumes);

module.exports = router;
