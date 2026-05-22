require('dotenv').config();
const mongoose = require('mongoose');

const Student = require('./models/Student');
const Job = require('./models/Job');
const Internship = require('./models/Internship');
const Application = require('./models/Application');
const InternshipApplication = require('./models/InternshipApplication');
const { getGeneratedResume } = require('./utils/studentDocuments');

const STATUSES = ['Applied', 'Shortlisted', 'Interview Scheduled', 'Applied'];
const INTERNSHIP_STATUSES = ['Applied', 'Shortlisted', 'Applied'];

function isEligibleForJob(student, job) {
  const eligibility = job.eligibility || {};
  const allowedCourses = eligibility.allowedCourses || [];
  const allowedBranches = eligibility.allowedBranches || [];

  if (allowedCourses.length && !allowedCourses.includes(student.course)) return false;
  if (allowedBranches.length && student.branch && !allowedBranches.some(branch => student.branch.toLowerCase().includes(branch.toLowerCase()))) return false;
  if (eligibility.minCGPA && Number(student.cgpa || 0) < eligibility.minCGPA) return false;
  if (eligibility.minPercentage && Number(student.percentage12th || 0) < eligibility.minPercentage) return false;

  return true;
}

function isEligibleForInternship(student, internship) {
  const eligibility = internship.eligibility || {};
  const allowedCourses = eligibility.allowedCourses || [];
  const allowedBranches = eligibility.allowedBranches || [];

  if (allowedCourses.length && !allowedCourses.includes(student.course)) return false;
  if (allowedBranches.length && student.branch && !allowedBranches.some(branch => student.branch.toLowerCase().includes(branch.toLowerCase()))) return false;
  if (eligibility.minCGPA && Number(student.cgpa || 0) < eligibility.minCGPA) return false;
  if (eligibility.minSemester && Number(student.semester || 0) < eligibility.minSemester) return false;
  if (eligibility.maxSemester && Number(student.semester || 0) > eligibility.maxSemester) return false;

  return true;
}

async function pickStudent(students, posting, existingStudentIds, eligibleFn, offset = 0) {
  const available = students.filter(student => !existingStudentIds.has(student._id.toString()));
  const eligible = available.filter(student => eligibleFn(student, posting));
  const pool = eligible.length ? eligible : available;
  if (!pool.length) return null;
  return pool[offset % pool.length];
}

async function ensurePostingApplicants() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/placement_portal';
  await mongoose.connect(uri);

  const students = await Student.find({}).sort({ createdAt: 1 });
  if (!students.length) throw new Error('No students found to assign as applicants.');

  for (const student of students) {
    if (!student.resume?.filename) {
      student.resume = getGeneratedResume(student);
      await student.save();
    }
  }

  const refreshedStudents = await Student.find({}).sort({ createdAt: 1 });
  const jobs = await Job.find({}).sort({ createdAt: 1 });
  const internships = await Internship.find({}).sort({ createdAt: 1 });

  let jobAppsCreated = 0;
  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const existingApps = await Application.find({ job: job._id }).select('student');
    const existingStudentIds = new Set(existingApps.map(app => app.student.toString()));

    if (!existingApps.length) {
      const student = await pickStudent(refreshedStudents, job, existingStudentIds, isEligibleForJob, i);
      if (student) {
        await Application.create({
          student: student._id,
          job: job._id,
          status: STATUSES[i % STATUSES.length],
          resumeSnapshot: student.resume?.path,
          appliedAt: new Date(Date.now() - ((i % 14) + 1) * 86400000),
        });
        jobAppsCreated++;
      }
    }

    const count = await Application.countDocuments({ job: job._id });
    await Job.findByIdAndUpdate(job._id, { applicantsCount: count });
  }

  let internshipAppsCreated = 0;
  for (let i = 0; i < internships.length; i++) {
    const internship = internships[i];
    const existingApps = await InternshipApplication.find({ internship: internship._id }).select('student');
    const existingStudentIds = new Set(existingApps.map(app => app.student.toString()));

    if (!existingApps.length) {
      const student = await pickStudent(refreshedStudents, internship, existingStudentIds, isEligibleForInternship, i);
      if (student) {
        await InternshipApplication.create({
          internship: internship._id,
          student: student._id,
          status: INTERNSHIP_STATUSES[i % INTERNSHIP_STATUSES.length],
          appliedAt: new Date(Date.now() - ((i % 14) + 1) * 86400000),
        });
        internshipAppsCreated++;
      }
    }

    const count = await InternshipApplication.countDocuments({ internship: internship._id });
    await Internship.findByIdAndUpdate(internship._id, { applicantsCount: count });
  }

  const jobsWithoutApplicants = await Job.aggregate([
    { $lookup: { from: 'applications', localField: '_id', foreignField: 'job', as: 'applications' } },
    { $match: { applications: { $size: 0 } } },
    { $count: 'count' },
  ]);
  const internshipsWithoutApplicants = await Internship.aggregate([
    { $lookup: { from: 'internshipapplications', localField: '_id', foreignField: 'internship', as: 'applications' } },
    { $match: { applications: { $size: 0 } } },
    { $count: 'count' },
  ]);

  console.log(`Job applications created: ${jobAppsCreated}`);
  console.log(`Internship applications created: ${internshipAppsCreated}`);
  console.log(`Jobs without applicants: ${jobsWithoutApplicants[0]?.count || 0}`);
  console.log(`Internships without applicants: ${internshipsWithoutApplicants[0]?.count || 0}`);

  await mongoose.disconnect();
}

ensurePostingApplicants().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
