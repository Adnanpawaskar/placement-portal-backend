const Student = require('../models/Student');
const Application = require('../models/Application');

// @desc  Get placement report
// @route GET /api/reports/placement
const getPlacementReport = async (req, res) => {
  try {
    const { course } = req.query;
    const query = {};
    if (course) query.course = course;

    const allStudents = await Student.find(query).populate('user', 'name email');
    const placed    = allStudents.filter(s => s.placementStatus === 'Placed');
    const inProcess = allStudents.filter(s => s.placementStatus === 'In Process');
    const unplaced  = allStudents.filter(s => s.placementStatus === 'Not Placed');

    const companyMap = {};
    placed.forEach(s => { if (s.placedAt) companyMap[s.placedAt] = (companyMap[s.placedAt] || 0) + 1; });
    const topCompanies = Object.entries(companyMap)
      .map(([company, count]) => ({ company, count }))
      .sort((a, b) => b.count - a.count).slice(0, 10);

    const packages = placed.filter(s => s.packageOffered).map(s => s.packageOffered);
    const avgPackage = packages.length ? (packages.reduce((a, b) => a + b, 0) / packages.length).toFixed(2) : 0;
    const maxPackage = packages.length ? Math.max(...packages) : 0;

    // Course-wise breakdown
    const courseMap = {};
    allStudents.forEach(s => {
      if (!courseMap[s.course]) courseMap[s.course] = { course: s.course, total: 0, placed: 0 };
      courseMap[s.course].total++;
      if (s.placementStatus === 'Placed') courseMap[s.course].placed++;
    });
    const courseWise = Object.values(courseMap).map(c => ({ ...c, rate: c.total ? ((c.placed / c.total) * 100).toFixed(0) : 0 }));

    res.json({
      success: true,
      report: {
        total: allStudents.length, placed: placed.length,
        inProcess: inProcess.length, unplaced: unplaced.length,
        placementRate: allStudents.length ? ((placed.length / allStudents.length) * 100).toFixed(1) : 0,
        avgPackage, maxPackage, topCompanies, courseWise,
        placedStudents: placed.map(s => ({
          name: s.user?.name || '',
          email: s.user?.email || '',
          phone: s.phone || '',
          rollNumber: s.rollNumber || '',
          course: s.course || '',
          branch: s.branch || '',
          cgpa: s.cgpa || '',
          company: s.placedAt || '',
          package: s.packageOffered || '',
        }))
      }
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Get application report
// @route GET /api/reports/applications
const getApplicationReport = async (req, res) => {
  try {
    const statusCounts = await Application.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const jobWise = await Application.aggregate([
      { $group: { _id: '$job', count: { $sum: 1 } } },
      { $lookup: { from: 'jobs', localField: '_id', foreignField: '_id', as: 'jobDetails' } },
      { $unwind: '$jobDetails' },
      { $project: { title: '$jobDetails.title', company: '$jobDetails.company', count: 1 } },
      { $sort: { count: -1 } }, { $limit: 10 }
    ]);

    res.json({ success: true, statusCounts, jobWise });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Export placed students CSV
// @route GET /api/reports/export/placed
const exportPlacedCSV = async (req, res) => {
  try {
    const { course } = req.query;
    const query = { placementStatus: 'Placed' };
    if (course) query.course = course;

    const students = await Student.find(query).populate('user', 'name email');

    const headers = ['Name', 'Email', 'Phone', 'Roll Number', 'Course', 'Branch', 'CGPA', '10th %', '12th %', 'Company', 'Package (LPA)'];
    const rows = students.map(s => [
      s.user?.name || '', s.user?.email || '', s.phone || '', s.rollNumber || '',
      s.course || '', s.branch || '', s.cgpa || '',
      s.percentage10th || '', s.percentage12th || '',
      s.placedAt || '', s.packageOffered || ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="placed_students${course ? '_' + course : ''}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Export all students CSV
// @route GET /api/reports/export/all-students
const exportAllStudentsCSV = async (req, res) => {
  try {
    const { course } = req.query;
    const query = course ? { course } : {};
    const students = await Student.find(query).populate('user', 'name email');

    const headers = ['Name', 'Email', 'Phone', 'Roll Number', 'Course', 'Branch', 'CGPA', '10th %', '12th %', 'Placement Status', 'Company', 'Package (LPA)', 'Skills'];
    const rows = students.map(s => [
      s.user?.name || '', s.user?.email || '', s.phone || '', s.rollNumber || '',
      s.course || '', s.branch || '', s.cgpa || '',
      s.percentage10th || '', s.percentage12th || '',
      s.placementStatus || '', s.placedAt || '', s.packageOffered || '',
      (s.skills || []).join('; ')
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="all_students${course ? '_' + course : ''}.csv"`);
    res.send(csv);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Export all applications CSV
// @route GET /api/reports/export/applications
const exportApplicationsCSV = async (req, res) => {
  try {
    const applications = await Application.find()
      .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
      .populate('job', 'title company jobType');

    const headers = ['Student Name', 'Email', 'Phone', 'Course', 'CGPA', 'Job Title', 'Company', 'Type', 'Status', 'Applied Date'];
    const rows = applications.map(a => [
      a.student?.user?.name || '', a.student?.user?.email || '',
      a.student?.phone || '', a.student?.course || '', a.student?.cgpa || '',
      a.job?.title || '', a.job?.company || '', a.job?.jobType || '',
      a.status || '', a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('en-IN') : ''
    ]);

    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="all_applications.csv"');
    res.send(csv);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};


// @desc  Public stats for login page (no auth required)
// @route GET /api/reports/public-stats
const getPublicStats = async (req, res) => {
  try {
    const [totalStudents, placed, totalCompanies] = await Promise.all([
      Student.countDocuments(),
      Student.find({ placementStatus: 'Placed' }),
      Student.distinct('placedAt').then(arr => arr.filter(Boolean).length),
    ]);
    const packages = placed.filter(s => s.packageOffered).map(s => s.packageOffered);
    const avgPackage = packages.length ? (packages.reduce((a, b) => a + b, 0) / packages.length).toFixed(1) : 0;
    const placementRate = totalStudents ? ((placed.length / totalStudents) * 100).toFixed(1) : 0;
    res.json({ success: true, stats: { totalStudents, placed: placed.length, totalCompanies, avgPackage, placementRate } });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { getPlacementReport, getApplicationReport, exportPlacedCSV, exportAllStudentsCSV, exportApplicationsCSV, getPublicStats };
