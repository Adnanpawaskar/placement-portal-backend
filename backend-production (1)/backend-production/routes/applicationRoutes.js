const express = require('express');
const router = express.Router();
const { applyForJob, getMyApplications, updateStatus, updateMyStatus, getAllApplications } = require('../controllers/applicationController');
const { protect, adminOnly, studentOnly } = require('../middleware/auth');

router.post('/:jobId/apply', protect, studentOnly, applyForJob);
router.get('/my', protect, studentOnly, getMyApplications);
router.get('/', protect, adminOnly, getAllApplications);
router.put('/:id/status/self', protect, studentOnly, updateMyStatus);
router.put('/:id/status', protect, adminOnly, updateStatus);

module.exports = router;
