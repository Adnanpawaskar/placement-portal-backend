const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: {
    type: String,
    required: function() { return this.authProvider === 'local'; },
    minlength: 6
  },
  role: { type: String, enum: ['student', 'admin', 'recruiter'], default: 'student' },
  authProvider: { type: String, enum: ['local', 'google', 'facebook', 'twitter'], default: 'local' },
  socialProviders: {
    google: { id: String },
    facebook: { id: String },
    twitter: { id: String },
  },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date },
  // OTP for registration email verification
  emailOtp: { type: String },
  emailOtpExpiry: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
  // Password reset
  resetPasswordOtp: { type: String },
  resetPasswordOtpExpiry: { type: Date },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.password || !this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.matchPassword = async function(enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
