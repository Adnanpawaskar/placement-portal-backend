const mongoose = require('mongoose');

const internshipSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  company: { type: String, required: true, trim: true },
  companyLogo: { type: String },
  description: { type: String, required: true },
  requirements: { type: String },
  location: { type: String, required: true },
  mode: {
    type: String,
    enum: ['On-site', 'Remote', 'Hybrid'],
    default: 'On-site'
  },
  duration: { type: String, required: true }, // e.g., "3 months", "6 months"
  stipend: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    period: { type: String, default: 'month' }
  },
  eligibility: {
    minCGPA: { type: Number, default: 0 },
    allowedCourses: [String],
    allowedBranches: [String],
    minSemester: { type: Number, default: 1 },
    maxSemester: { type: Number, default: 8 },
  },
  skills: [String],
  applicationDeadline: { type: Date, required: true },
  startDate: { type: Date },
  status: {
    type: String,
    enum: ['Open', 'Closed', 'Draft'],
    default: 'Open'
  },
  postedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  applicantsCount: { type: Number, default: 0 },
  isPPO: { type: Boolean, default: false }, // Pre-Placement Offer opportunity
}, { timestamps: true });

module.exports = mongoose.model('Internship', internshipSchema);
