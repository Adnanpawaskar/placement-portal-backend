const Internship = require('./Internship');
const InternshipApplication = require('./InternshipApplication');
const Student = require('./Student');
const User = require('./User');

// GET all internships
const getInternships = async (req, res) => {
  try {
    const { status, search, mode, page = 1, limit = 10 } = req.query;
    const query = {};
    if (status) query.status = status;  // only filter when explicitly provided
    if (mode) query.mode = mode;
    if (search) query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { company: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } }
    ];
    if (req.user?.role === 'student') {
      const student = await Student.findOne({ user: req.user._id });
      if (student) {
        query.$and = [
          ...(query.$and || []),
          {
            $or: [
              { 'eligibility.allowedCourses': { $exists: false } },
              { 'eligibility.allowedCourses': { $size: 0 } },
              { 'eligibility.allowedCourses': student.course },
            ]
          },
        ];
        if (typeof student.cgpa === 'number') {
          query.$and.push({ $or: [{ 'eligibility.minCGPA': { $exists: false } }, { 'eligibility.minCGPA': { $lte: student.cgpa } }] });
        }
        if (typeof student.semester === 'number') {
          query.$and.push(
            { $or: [{ 'eligibility.minSemester': { $exists: false } }, { 'eligibility.minSemester': { $lte: student.semester } }] },
            { $or: [{ 'eligibility.maxSemester': { $exists: false } }, { 'eligibility.maxSemester': { $gte: student.semester } }] }
          );
        }
      }
    }
    const total = await Internship.countDocuments(query);
    const internships = await Internship.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const counts = await InternshipApplication.aggregate([
      { $match: { internship: { $in: internships.map(internship => internship._id) } } },
      { $group: { _id: '$internship', count: { $sum: 1 } } }
    ]);
    const countMap = counts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {});
    // Use aggregate count (live) and fall back to stored applicantsCount
    const internshipsWithCounts = internships.map(internship => ({
      ...internship.toObject(),
      applicantsCount: countMap[internship._id.toString()] ?? internship.applicantsCount ?? 0,
    }));
    res.json({ success: true, internships: internshipsWithCounts, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET internship by ID
const getInternshipById = async (req, res) => {
  try {
    const internship = await Internship.findById(req.params.id).populate('postedBy', 'name');
    if (!internship) return res.status(404).json({ success: false, message: 'Internship not found' });
    const applicantsCount = await InternshipApplication.countDocuments({ internship: internship._id });
    res.json({ success: true, internship: { ...internship.toObject(), applicantsCount } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST create internship (admin)
const createInternship = async (req, res) => {
  try {
    const data = { ...req.body, postedBy: req.user._id };
    if (data.skills && typeof data.skills === 'string')
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    if (data.eligibility?.allowedCourses && typeof data.eligibility.allowedCourses === 'string')
      data.eligibility.allowedCourses = data.eligibility.allowedCourses.split(',').map(s => s.trim()).filter(Boolean);
    if (data.eligibility?.allowedBranches && typeof data.eligibility.allowedBranches === 'string')
      data.eligibility.allowedBranches = data.eligibility.allowedBranches.split(',').map(s => s.trim()).filter(Boolean);
    const internship = await Internship.create(data);
    res.status(201).json({ success: true, message: 'Internship posted successfully', internship });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT update internship (admin)
const updateInternship = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.skills && typeof data.skills === 'string')
      data.skills = data.skills.split(',').map(s => s.trim()).filter(Boolean);
    if (data.eligibility?.allowedCourses && typeof data.eligibility.allowedCourses === 'string')
      data.eligibility.allowedCourses = data.eligibility.allowedCourses.split(',').map(s => s.trim()).filter(Boolean);
    if (data.eligibility?.allowedBranches && typeof data.eligibility.allowedBranches === 'string')
      data.eligibility.allowedBranches = data.eligibility.allowedBranches.split(',').map(s => s.trim()).filter(Boolean);
    const internship = await Internship.findByIdAndUpdate(req.params.id, data, { new: true, runValidators: true });
    if (!internship) return res.status(404).json({ success: false, message: 'Internship not found' });
    res.json({ success: true, message: 'Internship updated', internship });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// DELETE internship (admin)
const deleteInternship = async (req, res) => {
  try {
    await Internship.findByIdAndDelete(req.params.id);
    await InternshipApplication.deleteMany({ internship: req.params.id });
    res.json({ success: true, message: 'Internship deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET applicants for internship (admin)
const getInternshipApplicants = async (req, res) => {
  try {
    const applications = await InternshipApplication.find({ internship: req.params.id })
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .sort({ appliedAt: -1 });
    const mapped = applications.map(app => ({
      _id: app._id,
      status: app.status,
      appliedAt: app.appliedAt,
      resumeUrl: app.student?.resume?.path ? `/uploads/resumes/${require('path').basename(app.student.resume.path)}` : null,
      student: {
        _id: app.student?._id,
        userId: app.student?.user?._id,
        user: { name: app.student?.user?.name, email: app.student?.user?.email },
        phone: app.student?.phone,
        rollNumber: app.student?.rollNumber,
        course: app.student?.course,
        branch: app.student?.branch,
        cgpa: app.student?.cgpa,
        skills: app.student?.skills,
        placementStatus: app.student?.placementStatus,
      }
    }));
    res.json({ success: true, applications: mapped });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// POST apply for internship (student)
const applyInternship = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    if (!student.resume || !student.resume.path)
      return res.status(400).json({ success: false, message: 'Please upload your resume before applying' });

    const internship = await Internship.findById(req.params.id);
    if (!internship) return res.status(404).json({ success: false, message: 'Internship not found' });
    if (internship.status !== 'Open')
      return res.status(400).json({ success: false, message: 'This internship is no longer accepting applications' });
    if (new Date() > new Date(internship.applicationDeadline))
      return res.status(400).json({ success: false, message: 'Application deadline has passed' });

    const existing = await InternshipApplication.findOne({ internship: req.params.id, student: student._id });
    if (existing) return res.status(400).json({ success: false, message: 'Already applied' });
    const app = await InternshipApplication.create({ internship: req.params.id, student: student._id });
    await Internship.findByIdAndUpdate(req.params.id, { $inc: { applicantsCount: 1 } });
    res.status(201).json({ success: true, message: 'Applied successfully', application: app });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// GET student's internship applications
const getMyInternshipApplications = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    const applications = await InternshipApplication.find({ student: student._id })
      .populate('internship')
      .sort({ appliedAt: -1 });
    res.json({ success: true, applications });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// PUT update application status (admin)
const updateApplicationStatus = async (req, res) => {
  try {
    const app = await InternshipApplication.findByIdAndUpdate(
      req.params.appId, { status: req.body.status }, { new: true }
    );
    res.json({ success: true, application: app });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = {
  getInternships, getInternshipById, createInternship, updateInternship, deleteInternship,
  getInternshipApplicants, applyInternship, getMyInternshipApplications, updateApplicationStatus
};
