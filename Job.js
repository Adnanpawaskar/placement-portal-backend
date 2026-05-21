const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  requirements: { type: String },
  location: { type: String, required: true },
  jobType: {
    type: String,
    enum: ['Full-time', 'Part-time', 'Contract', 'Remote'],  // NO Internship here
    default: 'Full-time'
  },
  // postType distinguishes jobs vs internships
  postType: {
    type: String,
    enum: ['Job', 'Internship'],
    default: 'Job'
  },
  // Internship-specific
  stipend: { min: Number, max: Number },
  duration: { type: String },  // e.g. "3 months", "6 months"
  isPPO: { type: Boolean, default: false }, // Pre-placement offer
  // Job salary
  salary: { min: Number, max: Number, currency: { type: String, default: 'INR' } },
  eligibility: {
    minCGPA: { type: Number, default: 0 },
    minPercentage: { type: Number, default: 0 },
    allowedCourses: [String],
    allowedBranches: [String],
    backlogs: { type: Number, default: 0 }
  },
  skills: [String],
  applicationDeadline: { type: Date, required: true },
  driveDate: { type: Date },
  rounds: [String],
  status: { type: String, enum: ['Open', 'Closed', 'Draft'], default: 'Open' },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  applicantsCount: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Job', jobSchema);
