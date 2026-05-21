const Application = require('../models/Application');
const Job = require('../models/Job');
const InternshipApplication = require('../models/InternshipApplication');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const {
  notifyNewApplication,
  notifyApplicationStatusUpdate,
} = require('../services/notificationService');

// @desc  Apply for a job
// @route POST /api/applications/:jobId/apply
const applyForJob = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).populate('user', 'name email');
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    if (!student.resume) return res.status(400).json({ success: false, message: 'Please upload your resume before applying' });

    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    if (job.status !== 'Open') return res.status(400).json({ success: false, message: 'This job is no longer accepting applications' });

    const deadline = new Date(job.applicationDeadline);
    if (new Date() > deadline) return res.status(400).json({ success: false, message: 'Application deadline has passed' });

    if (job.eligibility.minCGPA && student.cgpa < job.eligibility.minCGPA)
      return res.status(400).json({ success: false, message: `Minimum CGPA required: ${job.eligibility.minCGPA}` });
    if (job.eligibility.allowedCourses?.length > 0 && !job.eligibility.allowedCourses.includes(student.course))
      return res.status(400).json({ success: false, message: 'Your course is not eligible for this job' });

    const existing = await Application.findOne({ student: student._id, job: job._id });
    if (existing) return res.status(400).json({ success: false, message: 'You have already applied for this job' });

    const application = await Application.create({
      student: student._id,
      job: job._id,
      resumeSnapshot: student.resume.path,
      coverLetter: req.body.coverLetter,
      statusHistory: [{ status: 'Applied', note: 'Application submitted' }]
    });

    await Job.findByIdAndUpdate(job._id, { $inc: { applicantsCount: 1 } });

    // Fire notifications (non-blocking)
    notifyNewApplication({
      studentName: student.user.name,
      studentEmail: student.user.email,
      studentPhone: student.phone,
      jobTitle: job.title,
      company: job.company,
    }).catch(err => console.error('Notification error:', err));

    res.status(201).json({ success: true, message: 'Application submitted successfully', application });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Already applied for this job' });
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get my applications
// @route GET /api/applications/my
const getMyApplications = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });

    const applications = await Application.find({ student: student._id })
      .populate('job', 'title company location jobType status salary applicationDeadline')
      .sort({ appliedAt: -1 });

    res.json({ success: true, applications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Update application status (admin)
// @route PUT /api/applications/:id/status
const updateStatus = async (req, res) => {
  try {
    const { status, note, interviewDate, interviewTime, interviewVenue } = req.body;
    const application = await Application.findById(req.params.id)
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .populate('job', 'title company');

    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });

    application.status = status;
    application.statusHistory.push({ status, note });
    if (interviewDate) application.interviewDate = interviewDate;
    if (interviewTime) application.interviewTime = interviewTime;
    if (interviewVenue) application.interviewVenue = interviewVenue;
    if (req.body.adminNotes) application.adminNotes = req.body.adminNotes;

    await application.save();

    // Fire notifications (non-blocking)
    const student = application.student;
    const job = application.job;
    if (student && student.user) {
      notifyApplicationStatusUpdate({
        studentName: student.user.name,
        studentEmail: student.user.email,
        studentPhone: student.phone,
        jobTitle: job.title,
        company: job.company,
        newStatus: status,
        note,
        interviewDate,
        interviewTime,
        interviewVenue,
      }).catch(err => console.error('Notification error:', err));
    }

    res.json({ success: true, message: 'Application status updated', application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Update my own application status
// @route PUT /api/applications/:id/status/self
const updateMyStatus = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id });
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });

    const { status, note } = req.body;
    const allowedStatuses = ['Applied', 'Shortlisted', 'Interview Scheduled', 'Offer Extended', 'Selected'];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    if (!application.student.equals(student._id)) return res.status(403).json({ success: false, message: 'Not authorized to update this application' });

    application.status = status;
    application.statusHistory.push({ status, note: note || `Updated to ${status}` });
    await application.save();

    res.json({ success: true, message: 'Application status updated', application });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @desc  Get all applications (admin)
// @route GET /api/applications
const getAllApplications = async (req, res) => {
  try {
    const { status, job, course, search, postType, page = 1, limit = 20 } = req.query;
    const studentFilter = {};
    if (course || search) {
      const studentQuery = {};
      if (course) studentQuery.course = course;
      if (search) {
        const users = await require('../models/User').find({
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } }
          ]
        }).select('_id');
        studentQuery.$or = [
          { user: { $in: users.map(user => user._id) } },
          { rollNumber: { $regex: search, $options: 'i' } },
          { course: { $regex: search, $options: 'i' } },
          { branch: { $regex: search, $options: 'i' } },
        ];
      }
      const students = await Student.find(studentQuery).select('_id');
      studentFilter.student = { $in: students.map(student => student._id) };
    }

    const jobQuery = { ...studentFilter };
    const internshipQuery = { ...studentFilter };
    if (status) {
      jobQuery.status = status;
      internshipQuery.status = status;
    }
    if (job) jobQuery.job = job;

    if (postType && !job) {
      const matchingJobs = await Job.find({ postType }).select('_id');
      jobQuery.job = { $in: matchingJobs.map(item => item._id) };
    }

    const includeJobs = true;
    const includeInternships = postType !== 'Job' && !job;

    const [jobApplications, internshipApplications] = await Promise.all([
      includeJobs
        ? Application.find(jobQuery)
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .populate('job', 'title company postType location')
      .sort({ appliedAt: -1 })
        : [],
      includeInternships
        ? InternshipApplication.find(internshipQuery)
          .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
          .populate('internship', 'title company location')
          .sort({ appliedAt: -1 })
        : [],
    ]);

    const normalizedInternshipApplications = internshipApplications.map(app => {
      const item = app.toObject();
      item.applicationType = 'Internship';
      item.position = item.internship
        ? { ...item.internship, postType: 'Internship' }
        : null;
      item.job = item.position;
      delete item.internship;
      return item;
    });

    const normalizedJobApplications = jobApplications.map(app => {
      const item = app.toObject();
      item.applicationType = item.job?.postType === 'Internship' ? 'Internship' : 'Job';
      item.position = item.job;
      return item;
    });

    const combined = [
      ...normalizedJobApplications,
      ...normalizedInternshipApplications,
    ].sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt));

    const pageNumber = parseInt(page);
    const pageLimit = parseInt(limit);
    const applications = combined.slice((pageNumber - 1) * pageLimit, pageNumber * pageLimit);
    const total = combined.length;

    res.json({ success: true, applications, total });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { applyForJob, getMyApplications, updateStatus, updateMyStatus, getAllApplications };
