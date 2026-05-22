const express = require('express');
const router = express.Router();
const {
  getInternships, getInternshipById, createInternship, updateInternship, deleteInternship,
  getInternshipApplicants, applyInternship, getMyInternshipApplications, updateApplicationStatus
} = require('./controllers/internshipController');
const { protect, adminOnly, studentOnly } = require('./middleware/auth');

router.get('/', protect, getInternships);
router.get('/my-applications', protect, studentOnly, getMyInternshipApplications);
router.get('/:id', protect, getInternshipById);
router.post('/', protect, adminOnly, createInternship);
router.put('/:id', protect, adminOnly, updateInternship);
router.delete('/:id', protect, adminOnly, deleteInternship);
router.get('/:id/applicants', protect, adminOnly, getInternshipApplicants);
router.post('/:id/apply', protect, studentOnly, applyInternship);
router.put('/:id/applicants/:appId/status', protect, adminOnly, updateApplicationStatus);

module.exports = router;
