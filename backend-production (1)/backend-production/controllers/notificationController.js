const Notification = require('../models/Notification');
const User = require('../models/User');
const Student = require('../models/Student');
const { sendBulkNotification, sendWhatsApp } = require('../services/notificationService');

const resolveStudentRecipients = async ({ targetAll, targetCourse, targetCourses, recipientIds, studentIds }) => {
  const selectedCourses = Array.isArray(targetCourses)
    ? targetCourses.map(c => String(c || '').trim()).filter(Boolean)
    : (targetCourse ? [String(targetCourse).trim()] : []);
  let userIds = [];

  if (targetAll && selectedCourses.length === 0) {
    const users = await User.find({ role: 'student', isActive: true }).select('_id');
    userIds = users.map(s => s._id);
  } else if (selectedCourses.length > 0) {
    const courseStudents = await Student.find({ course: { $in: selectedCourses } }).populate('user', '_id isActive');
    userIds = courseStudents.filter(s => s.user?.isActive).map(s => s.user._id);
  } else if (studentIds && studentIds.length > 0) {
    const selectedStudents = await Student.find({ _id: { $in: studentIds } }).populate('user', '_id isActive');
    userIds = selectedStudents.filter(s => s.user?.isActive).map(s => s.user._id);
  } else if (recipientIds && recipientIds.length > 0) {
    userIds = recipientIds;
  }

  userIds = [...new Set(userIds.map(id => id.toString()))];
  const students = await Student.find({ user: { $in: userIds } }).populate('user', 'name email isActive');
  return students.filter(s => s.user?.isActive);
};

// @desc  Send notification (admin)
// @route POST /api/notifications
const sendNotification = async (req, res) => {
  try {
    const { title, message, type, targetAll, targetCourse, targetCourses, recipientIds, studentIds } = req.body;
    const selectedCourses = Array.isArray(targetCourses)
      ? targetCourses.map(c => String(c || '').trim()).filter(Boolean)
      : (targetCourse ? [String(targetCourse).trim()] : []);
    const recipientStudents = await resolveStudentRecipients({ targetAll, targetCourse, targetCourses, recipientIds, studentIds });
    const recipients = recipientStudents.map(s => s.user._id.toString());

    const notification = await Notification.create({
      title, message, type,
      sentBy: req.user._id,
      targetAll: targetAll && selectedCourses.length === 0,
      targetCourse: selectedCourses[0] || '',
      targetCourses: selectedCourses,
      recipients
    });

    let delivery = null;
    try {
      const recipientEmails = recipientStudents.map(s => s.user?.email).filter(Boolean);
      const recipientPhones = recipientStudents.map(s => s.phone).filter(Boolean);
      delivery = await sendBulkNotification({ title, message, recipientEmails, recipientPhones });
    } catch (e) {
      console.error('Bulk notification error:', e.message);
      delivery = { error: e.message };
    }

    res.status(201).json({ success: true, message: 'Notification sent', notification, delivery });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Send WhatsApp-only message to all, course, selected users, or selected students
// @route POST /api/notifications/whatsapp/bulk
const sendBulkWhatsAppMessage = async (req, res) => {
  try {
    const { message, targetAll, targetCourse, targetCourses, recipientIds, studentIds } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

    const recipientStudents = await resolveStudentRecipients({ targetAll, targetCourse, targetCourses, recipientIds, studentIds });
    const delivery = { whatsappSent: 0, whatsappFailed: 0, whatsappSkipped: 0, recipients: recipientStudents.length };

    for (const student of recipientStudents) {
      const result = await sendWhatsApp(student.phone, message.trim());
      if (result?.sent) delivery.whatsappSent++;
      else if (result?.skipped) delivery.whatsappSkipped++;
      else delivery.whatsappFailed++;
    }

    res.json({ success: true, message: 'WhatsApp messages processed', delivery });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Send direct WhatsApp message to a student (admin)
// @route POST /api/notifications/whatsapp
const sendWhatsAppMessage = async (req, res) => {
  try {
    const { studentId, message } = req.body;
    if (!studentId) return res.status(400).json({ success: false, message: 'Student is required' });
    if (!message || !message.trim()) return res.status(400).json({ success: false, message: 'Message is required' });

    const student = await Student.findById(studentId).populate('user', 'name');
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    if (!student.phone) return res.status(400).json({ success: false, message: 'Student has no phone number' });

    const delivery = await sendWhatsApp(student.phone, message.trim());
    if (!delivery?.sent) {
      return res.status(delivery?.skipped ? 400 : 502).json({
        success: false,
        message: delivery?.reason || delivery?.error || 'WhatsApp message failed',
        delivery,
      });
    }

    res.json({ success: true, message: 'WhatsApp message sent', delivery });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Update notification (admin)
// @route PUT /api/notifications/:id
const updateNotification = async (req, res) => {
  try {
    const { title, message, type } = req.body;
    const notification = await Notification.findById(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });

    notification.title = title || notification.title;
    notification.message = message || notification.message;
    notification.type = type || notification.type;
    await notification.save();

    res.json({ success: true, message: 'Notification updated', notification });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Delete notification (admin)
// @route DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.json({ success: true, message: 'Notification deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Get notifications for current user
// @route GET /api/notifications/my
const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [{ targetAll: true }, { recipients: req.user._id }]
    }).sort({ createdAt: -1 }).limit(50);

    const notificationsWithRead = notifications.map(n => ({
      ...n.toObject(),
      isRead: n.readBy.includes(req.user._id)
    }));

    res.json({ success: true, notifications: notificationsWithRead });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Mark notification as read
// @route PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.user._id } });
    res.json({ success: true, message: 'Marked as read' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Get all notifications (admin)
// @route GET /api/notifications
const getAllNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate('sentBy', 'name')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, notifications });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { sendNotification, sendWhatsAppMessage, sendBulkWhatsAppMessage, updateNotification, deleteNotification, getMyNotifications, markAsRead, getAllNotifications };
