const User = require('./User');
const Student = require('./Student');
const Job = require('./Job');
const Internship = require('./Internship');
const Application = require('./Application');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

// @desc  Get dashboard stats
// @route GET /api/admin/dashboard
const getDashboardStats = async (req, res) => {
  try {
    const [
      totalStudents, placedStudents, totalJobs, openJobs,
      totalApplications, recentApplications, recentJobs,
      totalInternships, openInternships
    ] = await Promise.all([
      Student.countDocuments(),
      Student.countDocuments({ placementStatus: 'Placed' }),
      Job.countDocuments(),
      Job.countDocuments({ status: 'Open' }),
      Application.countDocuments(),
      Application.find()
        .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
        .populate('job', 'title company')
        .sort({ appliedAt: -1 }).limit(5),
      Job.find().sort({ createdAt: -1 }).limit(5),
      Internship.countDocuments(),
      Internship.countDocuments({ status: 'Open' }),
    ]);

    const applicationStats = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const placementByCourse = await Student.aggregate([
      { $group: { _id: '$course', total: { $sum: 1 }, placed: { $sum: { $cond: [{ $eq: ['$placementStatus', 'Placed'] }, 1, 0] } } } }
    ]);

    // Average CGPA by course
    const avgCGPAByCourse = await Student.aggregate([
      { $match: { cgpa: { $exists: true, $ne: null } } },
      { $group: { _id: '$course', avgCGPA: { $avg: '$cgpa' }, count: { $sum: 1 } } },
      { $sort: { avgCGPA: -1 } }
    ]);

    // Internship stats
    const internshipStats = await Student.aggregate([
      { $group: { _id: '$internshipStatus', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalStudents, placedStudents,
        unplacedStudents: totalStudents - placedStudents,
        placementRate: totalStudents > 0 ? ((placedStudents / totalStudents) * 100).toFixed(1) : 0,
        totalJobs, openJobs, totalApplications,
        totalInternships, openInternships,
      },
      totalJobs, totalInternships,
      recentApplications, recentJobs, applicationStats, placementByCourse,
      avgCGPAByCourse, internshipStats
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Create admin user
const createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
    const user = await User.create({ name, email, password, role: 'admin' });
    res.status(201).json({ success: true, message: 'Admin created', user: { id: user._id, name, email, role: 'admin' } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Create recruiter user
const createRecruiter = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'Name, email and password are required' });
    const existing = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
    const user = await User.create({
      name,
      email: String(email).trim().toLowerCase(),
      password,
      role: 'recruiter',
      isEmailVerified: true,
      isActive: true
    });
    res.status(201).json({ success: true, message: 'Recruiter created', user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Toggle student active status
const toggleStudentStatus = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate('user');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const user = await User.findById(student.user._id);
    user.isActive = !user.isActive;
    await user.save();
    res.json({ success: true, message: `Student ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Download ALL student resumes as a ZIP
// @route GET /api/admin/resumes/download-all
const downloadAllResumes = async (req, res) => {
  try {
    const { course, branch, status, cgpa, semester, internshipStatus, search } = req.query;
    const query = { 'resume.filename': { $exists: true, $ne: null } };
    if (course) query.course = course;
    if (branch) query.branch = { $regex: branch, $options: 'i' };
    if (status) query.placementStatus = status;
    if (cgpa) query.cgpa = { $gte: parseFloat(cgpa) };
    if (semester) query.semester = parseInt(semester);
    if (internshipStatus) query.internshipStatus = internshipStatus;

    if (search) {
      const users = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.user = { $in: users.map(u => u._id) };
    }

    const students = await Student.find(query).populate('user', 'name email');
    const uploadsDir = path.join(__dirname, 'uploads', 'resumes');
    const files = [];
    for (const student of students) {
      const filePath = path.join(uploadsDir, student.resume.filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(student.resume.originalName || student.resume.filename);
        const safeName = (student.user?.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
        files.push({ filePath, name: `${safeName}_${student.rollNumber || student._id}${ext}` });
      }
    }

    if (files.length === 0) return res.status(404).json({ success: false, message: 'No resumes found for the selected filters' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="resumes-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);
    files.forEach(file => archive.file(file.filePath, { name: file.name }));

    await archive.finalize();
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Download SELECTIVE student resumes as a ZIP
// @route POST /api/admin/resumes/download-selective
const downloadSelectiveResumes = async (req, res) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0)
      return res.status(400).json({ success: false, message: 'Please provide studentIds array' });

    const students = await Student.find({
      _id: { $in: studentIds },
      'resume.filename': { $exists: true, $ne: null }
    }).populate('user', 'name email');

    const uploadsDir = path.join(__dirname, 'uploads', 'resumes');
    const files = [];
    for (const student of students) {
      const filePath = path.join(uploadsDir, student.resume.filename);
      if (fs.existsSync(filePath)) {
        const ext = path.extname(student.resume.originalName || student.resume.filename);
        const safeName = (student.user?.name || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
        files.push({ filePath, name: `${safeName}_${student.rollNumber || student._id}${ext}` });
      }
    }

    if (files.length === 0) return res.status(404).json({ success: false, message: 'No resumes found for selected students' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="selected-resumes-${Date.now()}.zip"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.on('error', err => { throw err; });
    archive.pipe(res);
    files.forEach(file => archive.file(file.filePath, { name: file.name }));

    await archive.finalize();
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getDashboardStats, createAdmin, createRecruiter, toggleStudentStatus, downloadAllResumes, downloadSelectiveResumes };
