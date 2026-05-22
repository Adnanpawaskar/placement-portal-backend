const express = require('express');
const router = express.Router();
const {
  register,
  login,
  startOAuth,
  handleOAuthCallback,
  getMe,
  changePassword,
  sendRegistrationOtp,
  forgotPassword,
  verifyResetOtp,
  resetPassword
} = require('./controllers/authController');
const { protect } = require('./middleware/auth');

router.post('/send-otp', sendRegistrationOtp);
router.post('/register', register);
router.post('/login', login);
router.get('/oauth/:provider/start', startOAuth);
router.get('/oauth/:provider/callback', handleOAuthCallback);
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-otp', verifyResetOtp);
router.post('/reset-password', resetPassword);

module.exports = router;
