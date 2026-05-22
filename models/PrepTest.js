const mongoose = require('mongoose');
const prepTestSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  type: { type: String, enum: ['Aptitude', 'Coding', 'HR', 'Technical', 'GK'] },
  score: { type: Number },
  totalQuestions: { type: Number },
  timeTaken: { type: Number },
  answers: [{ question: String, selected: String, correct: String, isCorrect: Boolean }],
  completedAt: { type: Date, default: Date.now },
}, { timestamps: true });
module.exports = mongoose.model('PrepTest', prepTestSchema);
