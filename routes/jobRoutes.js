const express = require('express');
const router = express.Router();
const { getJobs, getJobById, createJob, updateJob, deleteJob, getJobApplicants, aiScreenResume, aiScreenAll } = require('../controllers/jobController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, getJobs);
router.get('/:id', protect, getJobById);
router.post('/', protect, adminOnly, createJob);
router.put('/:id', protect, adminOnly, updateJob);
router.delete('/:id', protect, adminOnly, deleteJob);
router.get('/:id/applicants', protect, adminOnly, getJobApplicants);
router.post('/:jobId/screen/:applicationId', protect, adminOnly, aiScreenResume);
router.get('/:id/screen-all', protect, adminOnly, aiScreenAll);

module.exports = router;
