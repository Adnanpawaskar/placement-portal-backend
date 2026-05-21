const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Trust proxy (required for Render)
app.set('trust proxy', 1);

// CORS - allow multiple origins
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    // Allow all netlify previews
    if (origin && origin.endsWith('.netlify.app')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./authRoutes'));
app.use('/api/students', require('./studentRoutes'));
app.use('/api/jobs', require('./jobRoutes'));
app.use('/api/applications', require('./applicationRoutes'));
app.use('/api/admin', require('./adminRoutes'));
app.use('/api/notifications', require('./notificationRoutes'));
app.use('/api/reports', require('./reportRoutes'));
app.use('/api/internships', require('./internshipRoutes'));

// Health check
app.get('/', (req, res) => res.json({ status: 'OK', message: 'Placement Portal API v2.0 🎓' }));
app.get('/api/health', (req, res) => res.json({ status: 'OK', message: 'Placement Portal API running', timestamp: new Date().toISOString() }));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ success: false, message: 'CORS: Origin not allowed' });
  }
  res.status(err.status || 500).json({ success: false, message: err.message || 'Internal server error' });
});

// MongoDB connect then start server
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not set in environment variables!');
  process.exit(1);
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      try {
        const { startReminderCron } = require('./reminderCron');
startReminderCron();
      } catch (e) {
        console.warn('⚠️ Could not start cron:', e.message);
      }
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1);
  });

module.exports = app;
