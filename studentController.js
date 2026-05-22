const Student = require('./Student');
const User = require('./User');
const path = require('path');
const fs = require('fs');
const { notifyStudentPlaced } = require('./notificationService');
const Application = require('./Application');
const { getGeneratedJoiningLetter, shouldGenerateJoiningLetter } = require('./studentDocuments');

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

// @desc  Get student profile
const getProfile = async (req, res) => {
  try {
    const student = await ensureRealJoiningLetter(
      await Student.findOne({ user: req.user._id }).populate('user', 'name email')
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    res.json({ success: true, student });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Update student profile
const updateProfile = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.name) {
      await User.findByIdAndUpdate(req.user._id, { name: updates.name });
      delete updates.name;
    }
    if (updates.skills && typeof updates.skills === 'string')
      updates.skills = updates.skills.split(',').map(s => s.trim()).filter(Boolean);

    // Handle semesterCGPAs and auto-compute averageCGPA
    if (updates.semesterCGPAs && Array.isArray(updates.semesterCGPAs)) {
      const validSems = updates.semesterCGPAs.filter(s => s.cgpa);
      if (validSems.length > 0) {
        updates.averageCGPA = parseFloat(
          (validSems.reduce((sum, s) => sum + parseFloat(s.cgpa), 0) / validSems.length).toFixed(2)
        );
      }
    }

    const student = await Student.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('user', 'name email');
    res.json({ success: true, message: 'Profile updated', student });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Upload resume
const uploadResume = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    if (student.resume && student.resume.path) {
      const oldPath = path.join(__dirname, student.resume.path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    student.resume = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `uploads/resumes/${req.file.filename}`,
      uploadedAt: new Date()
    };
    await student.save();

    await Application.updateMany(
      { student: student._id },
      { $set: { resumeSnapshot: student.resume.path } }
    );

    res.json({ success: true, message: 'Resume uploaded successfully', resume: student.resume });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Upload/replace resume for a student (admin)
const uploadStudentResume = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (student.resume?.path) {
      const oldPath = path.join(__dirname, student.resume.path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    student.resume = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `uploads/resumes/${req.file.filename}`,
      uploadedAt: new Date()
    };
    await student.save();

    await Application.updateMany(
      { student: student._id },
      { $set: { resumeSnapshot: student.resume.path } }
    );

    res.json({ success: true, message: 'Resume uploaded successfully', resume: student.resume });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Upload joining letter for a student (admin)
const uploadJoiningLetter = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (student.joiningLetter?.path) {
      const oldPath = path.join(__dirname, student.joiningLetter.path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    student.joiningLetter = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `uploads/resumes/${req.file.filename}`,
      uploadedAt: new Date()
    };
    await student.save();
    res.json({ success: true, message: 'Joining letter uploaded', joiningLetter: student.joiningLetter });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Upload joining/offer letter for own profile (student)
const uploadMyJoiningLetter = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    if (student.joiningLetter?.path) {
      const oldPath = path.join(__dirname, student.joiningLetter.path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    student.joiningLetter = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `uploads/resumes/${req.file.filename}`,
      uploadedAt: new Date()
    };
    await student.save();
    res.json({ success: true, message: 'Letter uploaded', joiningLetter: student.joiningLetter });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Get all students (admin) with extended filters
const getAllStudents = async (req, res) => {
  try {
    const { course, branch, cgpa, status, search, semester, internshipStatus, hasResume, hasJoiningLetter, page = 1, limit = 10 } = req.query;
    const query = {};
    if (course) query.course = course;
    if (branch) query.branch = { $regex: branch, $options: 'i' };
    if (cgpa) query.cgpa = { $gte: parseFloat(cgpa) };
    if (status) query.placementStatus = status;
    if (semester) query.semester = parseInt(semester);
    if (internshipStatus) query.internshipStatus = internshipStatus;
    if (hasResume === 'true') query['resume.filename'] = { $exists: true, $ne: null };
    if (hasResume === 'false') query.$or = [{ 'resume.filename': { $exists: false } }, { 'resume.filename': null }];
    if (hasJoiningLetter === 'true') query['joiningLetter.filename'] = { $exists: true, $ne: null };
    if (hasJoiningLetter === 'false') {
      const noJoiningLetterQuery = [{ 'joiningLetter.filename': { $exists: false } }, { 'joiningLetter.filename': null }];
      query.$and = [...(query.$and || []), { $or: noJoiningLetterQuery }];
    }

    let finalQuery = query;
    let studentsQuery = Student.find(finalQuery).populate('user', 'name email isActive');
    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = users.map(u => u._id);
      finalQuery = { ...query, user: { $in: userIds } };
      studentsQuery = Student.find(finalQuery).populate('user', 'name email isActive');
    }

    const total = await Student.countDocuments(finalQuery);
    const students = await studentsQuery
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });

    res.json({ success: true, students, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Get student by ID (admin)
const getStudentById = async (req, res) => {
  try {
    const student = await ensureRealJoiningLetter(
      await Student.findById(req.params.id).populate('user', 'name email isActive lastLogin')
    );
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Update student by admin
const updateStudentByAdmin = async (req, res) => {
  try {
    const oldStudent = await Student.findById(req.params.id).populate('user', 'name email');
    if (!oldStudent) return res.status(404).json({ success: false, message: 'Student not found' });

    const wasAlreadyPlaced = oldStudent.placementStatus === 'Placed';
    const isNowPlaced = req.body.placementStatus === 'Placed';

    // Recompute averageCGPA if semesterCGPAs provided
    if (req.body.semesterCGPAs && Array.isArray(req.body.semesterCGPAs)) {
      const validSems = req.body.semesterCGPAs.filter(s => s.cgpa);
      if (validSems.length > 0) {
        req.body.averageCGPA = parseFloat(
          (validSems.reduce((sum, s) => sum + parseFloat(s.cgpa), 0) / validSems.length).toFixed(2)
        );
      }
    }

    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true }).populate('user', 'name email');

    if (!wasAlreadyPlaced && isNowPlaced && student.user) {
      notifyStudentPlaced({
        studentName: student.user.name,
        studentEmail: student.user.email,
        studentPhone: student.phone,
        company: req.body.placedAt || student.placedAt || 'a company',
        packageLPA: req.body.packageOffered || student.packageOffered,
      }).catch(err => console.error('Notification error:', err));
    }

    res.json({ success: true, message: 'Student updated', student });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getProfile, updateProfile, uploadResume, uploadStudentResume, uploadJoiningLetter, uploadMyJoiningLetter, getAllStudents, getStudentById, updateStudentByAdmin };
