const mongoose = require('mongoose');

const internshipApplicationSchema = new mongoose.Schema({
  internship: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  status: {
    type: String,
    enum: ['Applied', 'Shortlisted', 'Selected', 'Rejected', 'Withdrawn'],
    default: 'Applied'
  },
  appliedAt: { type: Date, default: Date.now },
  notes: { type: String },
}, { timestamps: true });

internshipApplicationSchema.index({ internship: 1, student: 1 }, { unique: true });

module.exports = mongoose.model('InternshipApplication', internshipApplicationSchema);
