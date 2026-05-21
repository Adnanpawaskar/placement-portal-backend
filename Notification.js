const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: {
    type: String,
    enum: ['Job Alert', 'Internship Alert', 'Interview', 'Reminder', 'General', 'Result'],
    default: 'General'
  },
  sentBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetAll: { type: Boolean, default: false },
  targetCourse: { type: String },
  targetCourses: [{ type: String }],
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
