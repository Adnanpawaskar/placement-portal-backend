require('dotenv').config();
const mongoose = require('mongoose');
require('./models/User');
const Student = require('./models/Student');
const Application = require('./models/Application');
const {
  getGeneratedResume,
  getGeneratedJoiningLetter,
  shouldGenerateJoiningLetter,
} = require('./utils/studentDocuments');

async function markResumesUploaded() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/placement_portal';
  await mongoose.connect(uri);

  const allStudents = await Student.find({}).populate('user', 'name email');

  let resumeUpdates = 0;
  let joiningLetterUpdates = 0;
  for (const student of allStudents) {
    student.resume = getGeneratedResume(student);
    resumeUpdates++;

    if (shouldGenerateJoiningLetter(student)) {
      student.joiningLetter = getGeneratedJoiningLetter(student);
      joiningLetterUpdates++;
    }

    await student.save();
  }

  const students = await Student.find({ 'resume.path': { $exists: true, $ne: null } }).select('_id resume.path');
  const resumeByStudent = new Map(students.map(student => [student._id.toString(), student.resume.path]));
  const applications = await Application.find({}).select('_id student resumeSnapshot');

  let applicationUpdates = 0;
  for (const application of applications) {
    const resumePath = resumeByStudent.get(application.student.toString());
    if (resumePath && application.resumeSnapshot !== resumePath) {
      application.resumeSnapshot = resumePath;
      await application.save();
      applicationUpdates++;
    }
  }

  console.log(`Generated real resumes for ${resumeUpdates} student(s).`);
  console.log(`Generated joining letters for ${joiningLetterUpdates} student(s).`);
  console.log(`Resume snapshots updated for ${applicationUpdates} application(s).`);

  await mongoose.disconnect();
}

markResumesUploaded().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
