const nodemailer = require('nodemailer');

const PORTAL_NAME = process.env.PORTAL_NAME || 'Placement Portal';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
const ADMIN_WHATSAPP = process.env.ADMIN_WHATSAPP;
const DEFAULT_COUNTRY_CODE = process.env.DEFAULT_COUNTRY_CODE || '+91';
const WHATSAPP_API_VERSION = cleanEnv(process.env.WHATSAPP_API_VERSION) || 'v20.0';
const WHATSAPP_ACCESS_TOKEN = cleanEnv(process.env.WHATSAPP_ACCESS_TOKEN);
const WHATSAPP_PHONE_NUMBER_ID = cleanEnv(process.env.WHATSAPP_PHONE_NUMBER_ID);

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: { user: 'adnanpawaskar163@gmail.com', pass: 'nncodsyhjrulkzqu' },
});

function cleanEnv(value) {
  if (!value) return '';
  return String(value).split(/\s+#/)[0].trim();
}

function isConfigured(value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return !normalized.startsWith('your_') && !normalized.includes('your_') && normalized !== 'change_me';
}

function normalizePhoneNumber(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return null;

  if (raw.startsWith('+')) return `+${raw.slice(1).replace(/\D/g, '')}`;

  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;

  return null;
}

function toWhatsAppRecipient(phone) {
  const normalized = normalizePhoneNumber(phone);
  return normalized ? normalized.replace(/^\+/, '') : null;
}

function wrap(content) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%"><tr><td align="center" style="padding:30px 0;">
  <table width="600" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.08);overflow:hidden;">
    <tr><td style="background:#1a56db;padding:20px 30px;">
      <h2 style="color:#fff;margin:0;font-size:20px;">${PORTAL_NAME}</h2></td></tr>
    <tr><td style="padding:30px;">${content}</td></tr>
    <tr><td style="background:#f8f9fa;padding:12px 30px;text-align:center;color:#999;font-size:11px;">
      Automated message from ${PORTAL_NAME}. Do not reply.</td></tr>
  </table></td></tr></table></body></html>`;
}

async function sendEmail(to, subject, html) {
  if (!to) {
    console.warn('Email recipient missing - skipping', to);
    return { sent: false, skipped: true };
  }

  try {
    await transporter.sendMail({
      from: `"${PORTAL_NAME}" <adnanpawaskar163@gmail.com>`,
      to,
      subject,
      html,
    });
    console.log(`Email -> ${to}: ${subject}`);
    return { sent: true, to };
  } catch (err) {
    console.error('Email error:', err.message);
    return { sent: false, to, error: err.message };
  }
}

async function sendWhatsApp(to, body) {
  const recipient = toWhatsAppRecipient(to);
  if (!recipient) {
    return { sent: false, skipped: true, reason: 'Invalid recipient phone number' };
  }

  if (isConfigured(WHATSAPP_ACCESS_TOKEN) && isConfigured(WHATSAPP_PHONE_NUMBER_ID)) {
    return sendWhatsAppViaCloudApi(recipient, body);
  }

  return { sent: false, skipped: true, reason: 'WhatsApp Cloud API is not configured' };
}

async function sendWhatsAppViaCloudApi(recipient, body) {
  try {
    const url = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'text',
        text: {
          preview_url: false,
          body,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `WhatsApp API returned ${response.status}`;
      throw new Error(message);
    }

    console.log(`WhatsApp -> +${recipient}`);
    return { sent: true, provider: 'cloud-api', to: `+${recipient}`, id: data?.messages?.[0]?.id };
  } catch (err) {
    console.error('WhatsApp error:', err.message);
    return { sent: false, to: `+${recipient}`, error: err.message };
  }
}

async function sendOtpEmail(to, name, otp, purpose = 'verify') {
  const subject = purpose === 'reset'
    ? `Password Reset OTP - ${PORTAL_NAME}`
    : `Email Verification OTP - ${PORTAL_NAME}`;
  const heading = purpose === 'reset' ? 'Password Reset Request' : 'Verify Your Email';
  const html = wrap(`
    <h3 style="color:#1a56db;margin-top:0;">${heading}</h3>
    <p>Hi <strong>${name}</strong>,</p>
    <p>${purpose === 'reset' ? 'We received a password reset request.' : 'Please verify your email address.'}</p>
    <div style="background:#f0f7ff;border:2px dashed #1a56db;border-radius:10px;padding:24px;text-align:center;margin:20px 0;">
      <p style="margin:0;color:#666;font-size:13px;">Your OTP</p>
      <p style="margin:8px 0 0;font-size:38px;font-weight:bold;letter-spacing:8px;color:#1a56db;">${otp}</p>
    </div>
    <p style="color:#dc2626;font-size:13px;">This OTP expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
  `);
  return sendEmail(to, subject, html);
}

async function notifyNewApplication({ studentName, studentEmail, studentPhone, jobTitle, company }) {
  const html = wrap(`
    <h3 style="color:#1a56db;margin-top:0;">Application Submitted</h3>
    <p>Dear <strong>${studentName}</strong>,</p>
    <p>Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> has been received. We will notify you of any updates.</p>
  `);
  await sendEmail(studentEmail, `Application Submitted - ${company}`, html);
  await sendWhatsApp(studentPhone, `*${PORTAL_NAME}*\n\nHi ${studentName}, your application for *${jobTitle}* at *${company}* has been submitted successfully.`);
  if (ADMIN_EMAIL) await sendEmail(ADMIN_EMAIL, `New Application: ${studentName} -> ${company}`, wrap(`<p><strong>${studentName}</strong> applied for <strong>${jobTitle}</strong> at <strong>${company}</strong>.</p>`));
  if (ADMIN_WHATSAPP) await sendWhatsApp(ADMIN_WHATSAPP, `*${PORTAL_NAME}*\n\nNew Application\n${studentName} -> ${jobTitle} @ ${company}`);
}

async function notifyApplicationStatusUpdate({ studentName, studentEmail, studentPhone, jobTitle, company, newStatus, note, interviewDate, interviewTime, interviewVenue }) {
  const detailHtml = interviewDate
    ? `<div style="background:#f0f7ff;border-left:4px solid #1a56db;padding:12px 16px;margin:16px 0;border-radius:4px;"><strong>Interview Details</strong><br>Date: <strong>${interviewDate}</strong>${interviewTime ? `<br>Time: <strong>${interviewTime}</strong>` : ''}${interviewVenue ? `<br>Venue: <strong>${interviewVenue}</strong>` : ''}</div>`
    : '';
  const html = wrap(`
    <h3 style="color:#1a56db;margin-top:0;">Application Update - ${company}</h3>
    <p>Dear <strong>${studentName}</strong>,</p>
    <p>Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> has been updated.</p>
    <div style="background:#f8f9fa;padding:14px;border-radius:6px;margin:14px 0;font-size:16px;">Status: <strong style="color:#1a56db;">${newStatus}</strong></div>
    ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}${detailHtml}
    <p style="color:#666;font-size:13px;">Log in to the portal to view full details.</p>
  `);
  await sendEmail(studentEmail, `Application Update - ${company} (${newStatus})`, html);
  let wa = `*${PORTAL_NAME}*\n\nHi ${studentName}, your application for *${jobTitle}* at *${company}* is updated.\n\n*Status: ${newStatus}*`;
  if (note) wa += `\nNote: ${note}`;
  if (interviewDate) wa += `\n\nInterview: ${interviewDate}${interviewTime ? ` at ${interviewTime}` : ''}${interviewVenue ? `\nVenue: ${interviewVenue}` : ''}`;
  wa += '\n\nLog in to the portal for details.';
  await sendEmail(studentEmail, `Application Update - ${company} (${newStatus})`, html);
  await sendWhatsApp(studentPhone, wa);
  if (ADMIN_EMAIL) await sendEmail(ADMIN_EMAIL, `App Update: ${studentName} -> ${newStatus}`, wrap(`<p><strong>${studentName}</strong> - <em>${jobTitle} @ ${company}</em><br>New status: <strong>${newStatus}</strong>${note ? '<br>Note: ' + note : ''}</p>`));
  if (ADMIN_WHATSAPP) await sendWhatsApp(ADMIN_WHATSAPP, `*${PORTAL_NAME}*\n\n${studentName} -> ${newStatus}\n${jobTitle} @ ${company}`);
}

async function notifyStudentPlaced({ studentName, studentEmail, studentPhone, company, packageLPA }) {
  const html = wrap(`
    <h3 style="color:#059669;margin-top:0;">Congratulations! You are placed!</h3>
    <p>Dear <strong>${studentName}</strong>, you have been placed at <strong>${company}</strong>!${packageLPA ? `<br><br><div style="background:#ecfdf5;border:2px solid #059669;padding:16px;border-radius:8px;text-align:center;"><span style="font-size:26px;color:#059669;font-weight:bold;">${packageLPA} LPA</span><br><small>Package Offered</small></div>` : ''}</p>
    <p>The Placement Cell is extremely proud of you.</p>
  `);
  await sendEmail(studentEmail, `Congratulations! Placed at ${company}!`, html);
  await sendWhatsApp(studentPhone, `*${PORTAL_NAME}*\n\nCongratulations ${studentName}!\n\nYou have been placed at *${company}*!${packageLPA ? `\n\nPackage: *${packageLPA} LPA*` : ''}`);
  if (ADMIN_EMAIL) await sendEmail(ADMIN_EMAIL, `Placed: ${studentName} @ ${company}`, wrap(`<p><strong>${studentName}</strong> placed at <strong>${company}</strong>${packageLPA ? ` - ${packageLPA} LPA` : ''}.</p>`));
  if (ADMIN_WHATSAPP) await sendWhatsApp(ADMIN_WHATSAPP, `*${PORTAL_NAME}*\n\n${studentName} placed at *${company}*${packageLPA ? ` - ${packageLPA} LPA` : ''}!`);
}

async function notifyNewJobOrInternship({ jobTitle, company, jobType, deadline, location, salary, courses, recipientEmails = [], recipientPhones = [] }) {
  const isIntern = jobType === 'Internship';
  const tag = isIntern ? 'Internship Opportunity' : 'Job Opportunity';
  const courseTag = courses?.length ? `\nFor: ${courses.join(', ')}` : '';
  const html = wrap(`
    <h3 style="color:#1a56db;margin-top:0;">New ${tag}</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#666;width:110px;">Position</td><td><strong>${jobTitle}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#666;">Company</td><td><strong>${company}</strong></td></tr>
      <tr><td style="padding:6px 0;color:#666;">Type</td><td>${jobType}</td></tr>
      ${location ? `<tr><td style="padding:6px 0;color:#666;">Location</td><td>${location}</td></tr>` : ''}
      ${salary ? `<tr><td style="padding:6px 0;color:#666;">Salary/Stipend</td><td>${salary}</td></tr>` : ''}
      ${courses?.length ? `<tr><td style="padding:6px 0;color:#666;">Eligible</td><td>${courses.join(', ')}</td></tr>` : ''}
      <tr><td style="padding:6px 0;color:#666;">Deadline</td><td><strong style="color:#dc2626;">${deadline}</strong></td></tr>
    </table>
  `);
  const wa = `*${PORTAL_NAME}*\n\nNew ${tag}\n\n*${jobTitle}* at *${company}*${courseTag}${location ? '\nLocation: ' + location : ''}${salary ? '\nSalary/Stipend: ' + salary : ''}\nDeadline: ${deadline}\n\nLog in to apply.`;
  for (const email of recipientEmails) await sendEmail(email, `${tag}: ${jobTitle} at ${company}`, html);
  for (const phone of recipientPhones) await sendWhatsApp(phone, wa);
}

async function sendBulkNotification({ title, message, recipientEmails = [], recipientPhones = [] }) {
  const html = wrap(`<h3 style="color:#1a56db;margin-top:0;">${title}</h3><p style="white-space:pre-line;">${message}</p>`);
  const delivery = {
    emailSent: 0,
    emailFailed: 0,
    whatsappSent: 0,
    whatsappFailed: 0,
    whatsappSkipped: 0,
  };

  for (const email of recipientEmails) {
    const result = await sendEmail(email, title, html);
    if (result?.sent) delivery.emailSent++;
    else delivery.emailFailed++;
  }

  const wa = `*${PORTAL_NAME}*\n\n*${title}*\n\n${message}`;
  for (const phone of recipientPhones) {
    const result = await sendWhatsApp(phone, wa);
    if (result?.sent) delivery.whatsappSent++;
    else if (result?.skipped) delivery.whatsappSkipped++;
    else delivery.whatsappFailed++;
  }

  return delivery;
}

async function sendApplicationReminder({ studentName, studentEmail, studentPhone, jobTitle, company, currentStatus, daysSinceApplied }) {
  const html = wrap(`
    <h3 style="color:#1a56db;margin-top:0;">Application Reminder</h3>
    <p>Dear <strong>${studentName}</strong>,</p>
    <p>This is a reminder about your application for <strong>${jobTitle}</strong> at <strong>${company}</strong>.</p>
    <div style="background:#f8f9fa;padding:14px;border-radius:6px;margin:14px 0;">
      Current Status: <strong style="color:#1a56db;">${currentStatus}</strong><br>
      <small style="color:#888;">Applied ${daysSinceApplied} days ago</small>
    </div>
  `);
  await sendEmail(studentEmail, `Application Reminder - ${company}`, html);
  await sendWhatsApp(studentPhone, `*${PORTAL_NAME}*\n\nReminder: Your application for *${jobTitle}* at *${company}* is still *${currentStatus}*.\n\nApplied ${daysSinceApplied} days ago.`);
}

module.exports = {
  sendEmail,
  sendWhatsApp,
  sendOtpEmail,
  notifyNewApplication,
  notifyApplicationStatusUpdate,
  notifyStudentPlaced,
  notifyNewJobOrInternship,
  sendBulkNotification,
  sendApplicationReminder,
  normalizePhoneNumber,
};