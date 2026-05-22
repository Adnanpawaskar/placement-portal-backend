const mongoose = require('mongoose');
const interviewSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  job: { type: mongoose.Schema.Types.ObjectId, ref: 'Job' },
  companyName: { type: String },
  scheduledAt: { type: Date, required: true },
  mode: { type: String, enum: ['Online', 'In-Person', 'Phone'], default: 'Online' },
  meetLink: { type: String },
  venue: { type: String },
  round: { type: String },
  status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'], default: 'Scheduled' },
  feedback: { type: String },
  result: { type: String, enum: ['Pass', 'Fail', 'Pending'], default: 'Pending' },
  adminNotes: { type: String },
}, { timestamps: true });
module.exports = mongoose.model('Interview', interviewSchema);
