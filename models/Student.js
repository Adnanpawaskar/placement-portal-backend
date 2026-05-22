const mongoose = require('mongoose');

const semesterCGPASchema = new mongoose.Schema({
  semester: { type: Number, required: true, min: 1, max: 12 },
  cgpa: { type: Number, required: true, min: 0, max: 10 },
  backlogs: { type: Number, default: 0 }
}, { _id: false });

const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  rollNumber: { type: String, unique: true, sparse: true },
  phone: { type: String },
  dateOfBirth: { type: Date },
  gender: { type: String, enum: ['Male', 'Female', 'Other'] },
  address: { type: String },
  course: { type: String, required: true },
  branch: { type: String },
  semester: { type: Number },
  year: { type: Number },
  cgpa: { type: Number, min: 0, max: 10 },
  semesterCGPAs: [semesterCGPASchema],   // NEW: semester-wise CGPA
  averageCGPA: { type: Number, min: 0, max: 10 }, // auto-computed
  percentage10th: { type: Number, min: 0, max: 100 },
  percentage12th: { type: Number, min: 0, max: 100 },
  skills: [{ type: String }],
  linkedIn: { type: String },
  github: { type: String },
  resume: {
    filename: String,
    originalName: String,
    path: String,
    uploadedAt: Date
  },
  joiningLetter: {
    filename: String,
    originalName: String,
    path: String,
    uploadedAt: Date
  },
  placementStatus: {
    type: String,
    enum: ['Not Placed', 'Placed', 'In Process'],
    default: 'Not Placed'
  },
  placedAt: { type: String },
  packageOffered: { type: Number },
  // NEW: Internship info
  internshipStatus: {
    type: String,
    enum: ['Not Done', 'Completed', 'Ongoing'],
    default: 'Not Done'
  },
  internshipCompany: { type: String },
  internshipDuration: { type: String },
  internshipStipend: { type: Number },
  profilePhoto: { type: String },
  bio: { type: String },
  isEligible: { type: Boolean, default: true },
}, { timestamps: true });

// Auto-compute averageCGPA from semesterCGPAs
studentSchema.pre('save', function (next) {
  if (this.semesterCGPAs && this.semesterCGPAs.length > 0) {
    const sum = this.semesterCGPAs.reduce((acc, s) => acc + s.cgpa, 0);
    this.averageCGPA = parseFloat((sum / this.semesterCGPAs.length).toFixed(2));
  }
  next();
});

module.exports = mongoose.model('Student', studentSchema);
