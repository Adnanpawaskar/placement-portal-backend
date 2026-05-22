const Job = require('./Job');
const Application = require('./Application');
const Student = require('./Student');
const { notifyNewJobOrInternship } = require('./notificationService');
const { extractResumeText, screenResume } = require('./aiResumeScreener');
const path = require('path');

const getJobs = async (req, res) => {
  try {
    const { status, search, jobType, postType, page = 1, limit = 12 } = req.query;
    const query = {};
    if (status) query.status = status;
    if (jobType) query.jobType = jobType;
    if (postType) query.postType = postType;
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
      }
    }
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit));
    const counts = await Application.aggregate([
      { $match: { job: { $in: jobs.map(job => job._id) } } },
      { $group: { _id: '$job', count: { $sum: 1 } } }
    ]);
    const countMap = counts.reduce((map, item) => {
      map[item._id.toString()] = item.count;
      return map;
    }, {});
    const jobsWithCounts = jobs.map(job => ({
      ...job.toObject(),
      applicantsCount: countMap[job._id.toString()] || 0,
    }));
    res.json({ success: true, jobs: jobsWithCounts, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getJobById = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).populate('postedBy', 'name');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    const applicantsCount = await Application.countDocuments({ job: job._id });
    res.json({ success: true, job: { ...job.toObject(), applicantsCount } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const createJob = async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, postedBy: req.user._id });

    (async () => {
      try {
        const allowedCourses = job.eligibility?.allowedCourses || [];
        let studentQuery = {};
        if (allowedCourses.length) studentQuery.course = { $in: allowedCourses };
        const students = await Student.find(studentQuery).populate('user', 'name email');
        const recipientEmails = students.map(s => s.user?.email).filter(Boolean);
        const recipientPhones = students.map(s => s.phone).filter(Boolean);
        await notifyNewJobOrInternship({
          jobTitle: job.title, company: job.company, jobType: job.postType,
          deadline: new Date(job.applicationDeadline).toLocaleDateString('en-IN'),
          location: job.location,
          salary: job.postType === 'Internship'
            ? (job.stipend?.min ? `₹${job.stipend.min}/mo` : undefined)
            : (job.salary?.min ? `₹${job.salary.min}–${job.salary.max || '?'} LPA` : undefined),
          courses: allowedCourses, recipientEmails, recipientPhones,
        });
      } catch (e) { console.error('Notification error:', e.message); }
    })();

    res.status(201).json({ success: true, message: `${job.postType || 'Job'} posted successfully`, job });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const updateJob = async (req, res) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, message: 'Updated', job });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const deleteJob = async (req, res) => {
  try {
    await Job.findByIdAndDelete(req.params.id);
    await Application.deleteMany({ job: req.params.id });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const getJobApplicants = async (req, res) => {
  try {
    const applications = await Application.find({ job: req.params.id })
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .sort({ appliedAt: -1 });
    const applicants = applications.map(app => {
      const resumePath = app.student?.resume?.path || app.resumeSnapshot;

      return {
        applicationId: app._id, status: app.status, appliedAt: app.appliedAt,
        coverLetter: app.coverLetter,
        resumeUrl: resumePath ? `/uploads/resumes/${path.basename(resumePath)}` : null,
        student: {
          id: app.student?._id, userId: app.student?.user?._id, name: app.student?.user?.name, email: app.student?.user?.email,
          phone: app.student?.phone, rollNumber: app.student?.rollNumber, course: app.student?.course,
          branch: app.student?.branch, cgpa: app.student?.cgpa,
          percentage10th: app.student?.percentage10th, percentage12th: app.student?.percentage12th,
          skills: app.student?.skills, linkedIn: app.student?.linkedIn, github: app.student?.github,
          placementStatus: app.student?.placementStatus,
        }
      }
    });
    res.json({ success: true, applications: applicants, count: applicants.length });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const aiScreenResume = async (req, res) => {
  try {
    const job = await Job.findById(req.params.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    const application = await Application.findById(req.params.applicationId).populate('student');
    if (!application) return res.status(404).json({ success: false, message: 'Application not found' });
    const resumePath = application.student?.resume?.path || application.resumeSnapshot;
    if (!resumePath) return res.status(400).json({ success: false, message: 'No resume on file' });
    const resumeText = await extractResumeText(resumePath);
    const result = await screenResume({ resumeText, jobTitle: job.title, jobDescription: job.description, requiredSkills: job.skills || [], minCGPA: job.eligibility?.minCGPA || 0 });
    res.json({ success: true, screening: result });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

const aiScreenAll = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    const applications = await Application.find({ job: req.params.id })
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } });
    const results = [];
    for (const app of applications) {
      const resumePath = app.student?.resume?.path || app.resumeSnapshot;
      if (!resumePath) { results.push({ applicationId: app._id, studentName: app.student?.user?.name, score: 0, verdict: 'No Resume' }); continue; }
      const resumeText = await extractResumeText(resumePath);
      const screening = await screenResume({ resumeText, jobTitle: job.title, jobDescription: job.description, requiredSkills: job.skills || [], minCGPA: job.eligibility?.minCGPA || 0 });
      results.push({ applicationId: app._id, studentName: app.student?.user?.name, studentEmail: app.student?.user?.email, ...screening });
    }
    results.sort((a, b) => b.score - a.score);
    res.json({ success: true, results, jobTitle: job.title, company: job.company });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getJobs, getJobById, createJob, updateJob, deleteJob, getJobApplicants, aiScreenResume, aiScreenAll };
