const express = require('express');
const router = express.Router();
const { sendNotification, sendWhatsAppMessage, sendBulkWhatsAppMessage, updateNotification, deleteNotification, getMyNotifications, markAsRead, getAllNotifications } = require('./controllers/notificationController');
const { protect, adminOnly } = require('./middleware/auth');

router.post('/', protect, adminOnly, sendNotification);
router.post('/whatsapp', protect, adminOnly, sendWhatsAppMessage);
router.post('/whatsapp/bulk', protect, adminOnly, sendBulkWhatsAppMessage);
router.get('/my', protect, getMyNotifications);
router.get('/', protect, adminOnly, getAllNotifications);
router.put('/:id/read', protect, markAsRead);
router.put('/:id', protect, adminOnly, updateNotification);
router.delete('/:id', protect, adminOnly, deleteNotification);

module.exports = router;
