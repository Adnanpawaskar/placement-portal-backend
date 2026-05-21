/**
 * Seed Script — creates a default admin account
 * Run: node seed.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/placement_portal');
    console.log('Connected to MongoDB');

    const existing = await User.findOne({ email: 'admin@placement.edu' });
    if (existing) {
      console.log('Admin already exists: admin@placement.edu');
      process.exit(0);
    }

    await User.create({
      name: 'Placement Admin',
      email: 'admin@placement.edu',
      password: 'admin123',
      role: 'admin',
    });

    console.log('✅ Admin created successfully!');
    console.log('   Email:    admin@placement.edu');
    console.log('   Password: admin123');
    console.log('   ⚠️  Change the password after first login!');
    process.exit(0);
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
};

seed();
