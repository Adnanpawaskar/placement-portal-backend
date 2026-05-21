const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
  status: {
    type: String,
    enum: ['Applied', 'Shortlisted', 'Interview Scheduled', 'Offer Extended', 'Selected', 'Placed', 'Rejected', 'On Hold'],
    default: 'Applied'
  },
  appliedAt: { type: Date, default: Date.now },
  resumeSnapshot: { type: String },
  coverLetter: { type: String },
  interviewDate: { type: Date },
  interviewTime: { type: String },
  interviewVenue: { type: String },
  adminNotes: { type: String },
  statusHistory: [{
    status: { type: String },
    note: { type: String },
    changedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Prevent duplicate applications
applicationSchema.index({ student: 1, job: 1 }, { unique: true });

module.exports = mongoose.model('Application', applicationSchema);
