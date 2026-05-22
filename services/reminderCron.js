const cron = require('node-cron');
const Application = require('../models/Application');
const Student = require('../models/Student');
const { sendApplicationReminder } = require('./notificationService');

/**
 * Every day at 9 AM, check for applications that haven't been updated
 * in 5–7 days and send a reminder to the student.
 */
function startReminderCron() {
  cron.schedule('0 9 * * *', async () => {
    console.log('⏰ Running application reminder cron...');
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const fiveDaysAgo  = new Date(now - 5 * 24 * 60 * 60 * 1000);

      // Applications where last status update was 5–7 days ago and not yet final
      const applications = await Application.find({
        status: { $nin: ['Selected', 'Rejected', 'Placed'] },
        updatedAt: { $lte: fiveDaysAgo, $gte: sevenDaysAgo },
      })
        .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
        .populate('job', 'title company');

      console.log(`📬 Sending reminders to ${applications.length} students`);

      for (const app of applications) {
        if (!app.student?.user) continue;
        const daysSince = Math.floor((now - app.updatedAt) / (1000 * 60 * 60 * 24));
        await sendApplicationReminder({
          studentName: app.student.user.name,
          studentEmail: app.student.user.email,
          studentPhone: app.student.phone,
          jobTitle: app.job?.title || 'Job',
          company: app.job?.company || 'Company',
          currentStatus: app.status,
          daysSinceApplied: daysSince,
        });
      }
    } catch (err) {
      console.error('Reminder cron error:', err.message);
    }
  });

  console.log('✅ Application reminder cron started (runs daily at 9 AM)');
}

module.exports = { startReminderCron };
