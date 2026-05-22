const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/students', require('./routes/studentRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/applications', require('./routes/applicationRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/internships', require('./routes/internshipRoutes'));

app.get("/", (req, res) => res.json({ status: "OK", message: "Placement Portal API v2.0 🎓" }));
app.get("/api/health", (req, res) => res.json({ status: "OK", message: "Placement Portal API running" }));

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/placement_portal')
  .then(() => {
    console.log('✅ MongoDB Connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      const { startReminderCron } = require('./services/reminderCron');
      startReminderCron();
    });
  })
  .catch(err => { console.error('❌ MongoDB error:', err); process.exit(1); });

module.exports = app;
