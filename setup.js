/**
 * Run this once to create the first admin account:
 * node setup.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function setup() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/placement_portal');
  console.log('✅ Connected to MongoDB');

  const User = require('./models/User');
  const existing = await User.findOne({ email: 'admin@placement.edu' });
  if (existing) {
    console.log('ℹ️  Admin already exists: admin@placement.edu / admin123');
  } else {
    await User.create({ name: 'Admin', email: 'admin@placement.edu', password: 'admin123', role: 'admin', isEmailVerified: true, isActive: true });
    console.log('✅ Admin created!\n   Email: admin@placement.edu\n   Password: admin123\n   ⚠️  Change this password after first login!');
  }
  await mongoose.disconnect();
  process.exit(0);
}
setup().catch(e => { console.error('❌', e.message); process.exit(1); });
