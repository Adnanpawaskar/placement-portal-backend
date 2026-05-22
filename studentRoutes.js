const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, uploadResume, uploadStudentResume, uploadJoiningLetter, uploadMyJoiningLetter, getAllStudents, getStudentById, updateStudentByAdmin } = require('./controllers/studentController');
const { generateAIResume } = require('./controllers/aiResumeController');
const { protect, adminOnly, studentOnly } = require('./middleware/auth');
const upload = require('./middleware/upload');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const Application = require('./models/Application');
const { getGeneratedJoiningLetter, shouldGenerateJoiningLetter } = require('./utils/studentDocuments');

function isSampleResumePlaceholder(document) {
  const filename = String(document?.filename || document?.path || '').toLowerCase();
  const originalName = String(document?.originalName || '').toLowerCase();
  return filename.includes('sample_student_resume') || originalName.includes('sample student resume');
}

async function ensureRealJoiningLetter(student) {
  if (!student) return null;
  if (student.joiningLetter?.path && !isSampleResumePlaceholder(student.joiningLetter)) return student;
  if (!shouldGenerateJoiningLetter(student)) return student;

  student.joiningLetter = getGeneratedJoiningLetter(student);
  await student.save();
  return student;
}

router.get('/profile', protect, studentOnly, getProfile);
router.put('/profile', protect, studentOnly, updateProfile);
router.post('/resume', protect, studentOnly, upload.single('resume'), uploadResume);
router.post('/profile/joining-letter', protect, studentOnly, upload.single('joiningLetter'), uploadMyJoiningLetter);
router.post('/ai-resume', protect, studentOnly, generateAIResume);

router.get('/', protect, adminOnly, getAllStudents);
router.post('/:id/resume', protect, adminOnly, upload.single('resume'), uploadStudentResume);
router.post('/:id/joining-letter', protect, adminOnly, upload.single('joiningLetter'), uploadJoiningLetter);
// VIEW resume inline in browser (no download)
router.get('/resume/view/:studentId', protect, adminOnly, async (req, res) => {
  try {
    const Student = require('./models/Student');
    const student = await Student.findById(req.params.studentId).populate('user', 'name');
    if (!student || !student.resume?.path) return res.status(404).json({ success: false, message: 'Resume not found' });
    const filePath = path.join(__dirname, student.resume.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Resume file not found on server' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DOWNLOAD resume as attachment
router.get('/resume/download/:studentId', protect, adminOnly, async (req, res) => {
  try {
    const Student = require('./models/Student');
    const student = await Student.findById(req.params.studentId).populate('user', 'name');
    if (!student || !student.resume?.path) return res.status(404).json({ success: false, message: 'Resume not found' });
    const filePath = path.join(__dirname, student.resume.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Resume file not found on server' });
    res.download(filePath, `${student.user?.name || 'student'}_resume.pdf`);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// VIEW joining letter inline in browser
router.get('/joining-letter/view/:studentId', protect, async (req, res) => {
  try {
    const Student = require('./models/Student');
    const query = req.user.role === 'admin'
      ? { _id: req.params.studentId }
      : { _id: req.params.studentId, user: req.user._id };
    const student = await ensureRealJoiningLetter(
      await Student.findOne(query).populate('user', 'name email')
    );
    if (!student || !student.joiningLetter?.path || isSampleResumePlaceholder(student.joiningLetter)) {
      return res.status(404).json({ success: false, message: 'Joining letter not found' });
    }
    const filePath = path.join(__dirname, student.joiningLetter.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Joining letter file not found on server' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.sendFile(filePath);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// DOWNLOAD joining letter as attachment
router.get('/joining-letter/download/:studentId', protect, async (req, res) => {
  try {
    const Student = require('./models/Student');
    const query = req.user.role === 'admin'
      ? { _id: req.params.studentId }
      : { _id: req.params.studentId, user: req.user._id };
    const student = await ensureRealJoiningLetter(
      await Student.findOne(query).populate('user', 'name email')
    );
    if (!student || !student.joiningLetter?.path || isSampleResumePlaceholder(student.joiningLetter)) {
      return res.status(404).json({ success: false, message: 'Joining letter not found' });
    }
    const filePath = path.join(__dirname, student.joiningLetter.path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Joining letter file not found on server' });
    const ext = path.extname(student.joiningLetter.filename || filePath) || '.pdf';
    res.download(filePath, `${student.user?.name || 'student'}_joining_letter${ext}`);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Download all resumes for a job as ZIP
router.get('/resume/download-bulk/:jobId', protect, adminOnly, async (req, res) => {
  try {
    const Student = require('./models/Student');
    const applications = await Application.find({ job: req.params.jobId })
      .populate({ path: 'student', populate: { path: 'user', select: 'name' } });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="resumes_${req.params.jobId}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);

    let added = 0;
    for (const app of applications) {
      if (!app.resumeSnapshot) continue;
      const filePath = path.join(__dirname, app.resumeSnapshot);
      if (!fs.existsSync(filePath)) continue;
      const name = app.student?.user?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'student';
      archive.file(filePath, { name: `${name}_resume.pdf` });
      added++;
    }

    if (added === 0) {
      archive.abort();
      return res.status(404).json({ success: false, message: 'No resumes found for this job' });
    }
    await archive.finalize();
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/:id', protect, adminOnly, getStudentById);
router.put('/:id', protect, adminOnly, updateStudentByAdmin);

module.exports = router;
