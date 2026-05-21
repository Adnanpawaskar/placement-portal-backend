const User = require('../models/User');
const Student = require('../models/Student');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendOtpEmail } = require('../services/notificationService');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET || 'secret', { expiresIn: process.env.JWT_EXPIRE || '7d' });
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const nameRegex = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const rollNumberRegex = /^[A-Za-z0-9]+$/;
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]{6,}$/;
const allowedOAuthProviders = ['google', 'facebook', 'twitter'];

const userPayload = (user) => ({ id: user._id, name: user.name, email: user.email, role: user.role });
const getApiBaseUrl = (req) => process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
const getClientUrl = () => (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');

const oauthConfigs = {
  google: {
    clientId: 'GOOGLE_CLIENT_ID',
    clientSecret: 'GOOGLE_CLIENT_SECRET',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  facebook: {
    clientId: 'FACEBOOK_CLIENT_ID',
    clientSecret: 'FACEBOOK_CLIENT_SECRET',
    authUrl: 'https://www.facebook.com/v20.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v20.0/oauth/access_token',
    scope: 'email,public_profile',
  },
  twitter: {
    clientId: 'TWITTER_CLIENT_ID',
    clientSecret: 'TWITTER_CLIENT_SECRET',
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    tokenUrl: 'https://api.twitter.com/2/oauth2/token',
    scope: 'tweet.read users.read offline.access',
  },
};

const redirectOAuthError = (res, message) => {
  const target = `${getClientUrl()}/oauth/callback?error=${encodeURIComponent(message)}`;
  return res.redirect(target);
};

const exchangeOAuthCode = async ({ provider, code, redirectUri, state }) => {
  const config = oauthConfigs[provider];
  const clientId = process.env[config.clientId];
  const clientSecret = process.env[config.clientSecret];
  const body = new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  if (provider === 'twitter') {
    body.set('code_verifier', state.codeVerifier);
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }

  const response = await fetch(config.tokenUrl, { method: 'POST', headers, body });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error_description || data.error?.message || data.error || 'OAuth token exchange failed');
  return data;
};

const fetchOAuthProfile = async (provider, accessToken) => {
  if (provider === 'google') {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error_description || 'Unable to fetch Google profile');
    return { providerId: data.sub, name: data.name, email: normalizeEmail(data.email) };
  }

  if (provider === 'facebook') {
    const response = await fetch(`https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(accessToken)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Unable to fetch Facebook profile');
    return { providerId: data.id, name: data.name, email: normalizeEmail(data.email) };
  }

  const response = await fetch('https://api.twitter.com/2/users/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.detail || 'Unable to fetch Twitter profile');
  const id = data.data?.id;
  return { providerId: id, name: data.data?.name || data.data?.username || 'Twitter User', email: null };
};

const upsertOAuthUser = async ({ provider, profile, requestedRole }) => {
  const role = requestedRole === 'admin' ? 'admin' : 'student';
  const providerQuery = { [`socialProviders.${provider}.id`]: profile.providerId };
  const existingByProvider = await User.findOne(providerQuery);
  const user = existingByProvider || (profile.email ? await User.findOne({ email: profile.email }) : null);

  if (!user) {
    const err = new Error(`${provider} login is allowed only after normal signup with the same email`);
    err.status = 403;
    throw err;
  }

  if (role === 'admin' && user.role !== 'admin') {
    const err = new Error('Admin OAuth is allowed only for existing admin accounts');
    err.status = 403;
    throw err;
  }

  if (role === 'student' && user.role !== 'student') {
    const err = new Error('Student OAuth is allowed only for existing student accounts');
    err.status = 403;
    throw err;
  }

  if (profile.email && user.email !== profile.email) {
    const err = new Error(`${provider} account email does not match your registered portal email`);
    err.status = 403;
    throw err;
  }

  user.socialProviders = user.socialProviders || {};
  user.socialProviders[provider] = { id: profile.providerId };
  user.isEmailVerified = true;
  user.lastLogin = new Date();
  await user.save();
  return user;
};

// @desc  Step 1: Send OTP before register
// @route POST /api/auth/send-otp
const sendRegistrationOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || '').trim();
    if (!email || !name) return res.status(400).json({ success: false, message: 'Name and email required' });
    if (!nameRegex.test(name)) return res.status(400).json({ success: false, message: 'Name can contain only letters and spaces' });
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    const existing = await User.findOne({ email });
    if (existing && existing.isEmailVerified) return res.status(400).json({ success: false, message: 'Email already registered' });

    const otp = generateOtp();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    if (existing) {
      existing.emailOtp = otp; existing.emailOtpExpiry = expiry;
      await existing.save();
    } else {
      // temp user (no password yet, will be finalised on verify)
      await User.findOneAndUpdate(
        { email },
        { name, email, password: 'PENDING_' + crypto.randomBytes(8).toString('hex'), emailOtp: otp, emailOtpExpiry: expiry, isEmailVerified: false },
        { upsert: true, new: true }
      );
    }

    await sendOtpEmail(email, name, otp, 'verify');
    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Step 2: Verify OTP + complete registration
// @route POST /api/auth/register
const register = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    const course = req.body.course;
    const rollNumber = String(req.body.rollNumber || '').trim().toUpperCase();
    const phone = req.body.phone;
    const otp = String(req.body.otp || '');

    if (!nameRegex.test(name)) return res.status(400).json({ success: false, message: 'Name can contain only letters and spaces' });
    if (!emailRegex.test(email)) return res.status(400).json({ success: false, message: 'Please enter a valid email address' });
    if (rollNumber && !rollNumberRegex.test(rollNumber)) return res.status(400).json({ success: false, message: 'Roll number can contain only letters and numbers' });
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters and include a letter and a number' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'Please request OTP first' });
    if (user.isEmailVerified && user.password && !user.password.startsWith('PENDING_')) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    if (!user.emailOtp || user.emailOtp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (new Date() > user.emailOtpExpiry) return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });

    user.name = name;
    user.password = password;
    user.isEmailVerified = true;
    user.emailOtp = undefined;
    user.emailOtpExpiry = undefined;
    user.role = 'student';
    user.isActive = true;
    await user.save();

    const existingProfile = await Student.findOne({ user: user._id });
    if (!existingProfile) {
      await Student.create({ user: user._id, course: course || 'B.Tech', rollNumber: rollNumber || undefined, phone });
    } else {
      existingProfile.course = course || existingProfile.course;
      if (rollNumber) existingProfile.rollNumber = rollNumber;
      if (phone) existingProfile.phone = phone;
      await existingProfile.save();
    }

    const token = generateToken(user._id);
    res.status(201).json({ success: true, message: 'Registration successful! Welcome!', token, user: userPayload(user) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Login
// @route POST /api/auth/login
const login = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide email and password' });

    const user = await User.findOne({ email });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Account is deactivated' });

    user.lastLogin = new Date(); await user.save();
    const token = generateToken(user._id);
    res.json({ success: true, message: 'Login successful', token, user: userPayload(user) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Hidden recruiter login
// @route POST /api/auth/recruiter-login
const recruiterLogin = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ success: false, message: 'Please provide recruiter ID and password' });

    const user = await User.findOne({ email, role: 'recruiter' });
    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid recruiter credentials' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Recruiter account is deactivated' });

    user.lastLogin = new Date();
    await user.save();
    const token = generateToken(user._id);
    res.json({ success: true, message: 'Recruiter login successful', token, user: userPayload(user) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Start Google/Facebook/Twitter OAuth
// @route GET /api/auth/oauth/:provider/start
const startOAuth = async (req, res) => {
  try {
    const provider = req.params.provider;
    if (!allowedOAuthProviders.includes(provider)) return res.status(404).json({ success: false, message: 'OAuth provider not supported' });
    const config = oauthConfigs[provider];
    const clientId = process.env[config.clientId];
    const clientSecret = process.env[config.clientSecret];
    if (!clientId || !clientSecret) return redirectOAuthError(res, `${provider} login is not configured`);

    const role = req.query.role === 'admin' ? 'admin' : 'student';
    const redirectUri = `${getApiBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
    const statePayload = { provider, role, purpose: 'oauth' };
    if (provider === 'twitter') statePayload.codeVerifier = crypto.randomBytes(32).toString('hex');
    const state = jwt.sign(statePayload, process.env.JWT_SECRET || 'secret', { expiresIn: '10m' });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: config.scope,
      state,
    });

    if (provider === 'google') params.set('access_type', 'offline');
    if (provider === 'twitter') {
      const challenge = crypto.createHash('sha256').update(statePayload.codeVerifier).digest('base64url');
      params.set('code_challenge', challenge);
      params.set('code_challenge_method', 'S256');
    }

    return res.redirect(`${config.authUrl}?${params.toString()}`);
  } catch (err) {
    return redirectOAuthError(res, err.message);
  }
};

// @desc  OAuth callback
// @route GET /api/auth/oauth/:provider/callback
const handleOAuthCallback = async (req, res) => {
  try {
    const provider = req.params.provider;
    if (!allowedOAuthProviders.includes(provider)) return redirectOAuthError(res, 'OAuth provider not supported');
    if (req.query.error) return redirectOAuthError(res, req.query.error_description || req.query.error);
    const decodedState = jwt.verify(req.query.state, process.env.JWT_SECRET || 'secret');
    if (decodedState.provider !== provider || decodedState.purpose !== 'oauth') return redirectOAuthError(res, 'Invalid OAuth state');

    const redirectUri = `${getApiBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
    const tokens = await exchangeOAuthCode({ provider, code: req.query.code, redirectUri, state: decodedState });
    const profile = await fetchOAuthProfile(provider, tokens.access_token);
    if (!profile.providerId) return redirectOAuthError(res, `${provider} profile did not return a usable identity`);

    const user = await upsertOAuthUser({ provider, profile, requestedRole: decodedState.role });
    if (!user.isActive) return redirectOAuthError(res, 'Account is deactivated');
    const token = generateToken(user._id);
    return res.redirect(`${getClientUrl()}/oauth/callback?token=${encodeURIComponent(token)}`);
  } catch (err) {
    return redirectOAuthError(res, err.message);
  }
};

// @desc  Forgot password – send OTP
// @route POST /api/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const user = await User.findOne({ email });
    // Always respond success to prevent email enumeration
    if (!user) return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });

    const otp = generateOtp();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendOtpEmail(email, user.name, otp, 'reset');
    res.json({ success: true, message: 'OTP sent to your email for password reset.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Verify reset OTP
// @route POST /api/auth/verify-reset-otp
const verifyResetOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '');
    const user = await User.findOne({ email });
    if (!user || !user.resetPasswordOtp) return res.status(400).json({ success: false, message: 'Invalid request' });
    if (user.resetPasswordOtp !== otp) return res.status(400).json({ success: false, message: 'Invalid OTP' });
    if (new Date() > user.resetPasswordOtpExpiry) return res.status(400).json({ success: false, message: 'OTP expired. Please request again.' });

    // Issue a short-lived token to allow password reset
    const resetToken = jwt.sign({ id: user._id, purpose: 'reset' }, process.env.JWT_SECRET || 'secret', { expiresIn: '15m' });
    res.json({ success: true, message: 'OTP verified', resetToken });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Reset password with token
// @route POST /api/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;
    let decoded;
    try { decoded = jwt.verify(resetToken, process.env.JWT_SECRET || 'secret'); } catch { return res.status(400).json({ success: false, message: 'Invalid or expired reset token' }); }
    if (decoded.purpose !== 'reset') return res.status(400).json({ success: false, message: 'Invalid token' });

    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. Please login.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Get current user
// @route GET /api/auth/me
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// @desc  Change password (logged in)
// @route PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(currentPassword))) return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    user.password = newPassword; await user.save();
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

module.exports = { register, login, startOAuth, handleOAuthCallback, getMe, changePassword, sendRegistrationOtp, forgotPassword, verifyResetOtp, resetPassword };
