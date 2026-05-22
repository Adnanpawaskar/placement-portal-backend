const fs = require('fs');
const path = require('path');

const uploadDir = path.join(__dirname, 'uploads', 'resumes');

function ensureUploadDir() {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

function cleanText(value) {
  return String(value ?? '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function fileSafe(value, fallback = 'student') {
  const safe = cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return safe || fallback;
}

function wrapText(text, maxLength = 86) {
  const words = cleanText(text).split(' ').filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxLength) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }

  if (line) lines.push(line);
  return lines;
}

function pdfString(value) {
  return cleanText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildPdf(lines) {
  const safeLines = lines.map(line => ({
    text: cleanText(line.text),
    size: line.size || 10,
    gap: line.gap || 14,
  }));

  const content = [
    'BT',
    '/F1 18 Tf',
    '50 748 Td',
    ...safeLines.flatMap((line, index) => {
      const parts = [];
      if (index > 0) parts.push(`0 -${line.gap} Td`);
      parts.push(`/F1 ${line.size} Tf`);
      parts.push(`(${pdfString(line.text)}) Tj`);
      return parts;
    }),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
}

function writePdf(filename, lines) {
  ensureUploadDir();
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buildPdf(lines));
  return filePath;
}

function normalizeStudent(student) {
  const user = student.user || {};
  return {
    name: student.name || user.name || 'Student',
    email: student.email || user.email || '',
    phone: student.phone || '',
    rollNumber: student.rollNumber || student.roll || '',
    course: student.course || '',
    branch: student.branch || '',
    semester: student.semester || student.sem || '',
    year: student.year || student.yr || '',
    cgpa: student.cgpa || '',
    percentage10th: student.percentage10th || student.p10 || '',
    percentage12th: student.percentage12th || student.p12 || '',
    skills: student.skills || [],
    linkedIn: student.linkedIn || student.li || '',
    github: student.github || student.gh || '',
    bio: student.bio || '',
    placementStatus: student.placementStatus || student.ps || 'Not Placed',
    placedAt: student.placedAt || student.pa || '',
    packageOffered: student.packageOffered || student.pkg || '',
    internshipStatus: student.internshipStatus || student.is || 'Not Done',
    internshipCompany: student.internshipCompany || student.ic || '',
    internshipDuration: student.internshipDuration || student.id || '',
    internshipStipend: student.internshipStipend || student.ist || '',
  };
}

function resumeLines(student) {
  const s = normalizeStudent(student);
  const skills = Array.isArray(s.skills) ? s.skills.join(', ') : cleanText(s.skills);
  const headline = `${s.course}${s.branch ? ` - ${s.branch}` : ''} | CGPA ${s.cgpa || 'N/A'}`;
  const summary = s.bio || `${s.course} student with strengths in ${skills || 'academics, communication, and project work'}.`;

  return [
    { text: `${s.name} - Resume`, size: 18, gap: 0 },
    { text: headline, size: 11, gap: 22 },
    { text: `Email: ${s.email || 'N/A'} | Phone: ${s.phone || 'N/A'} | Roll No: ${s.rollNumber || 'N/A'}`, size: 10, gap: 18 },
    { text: 'PROFILE', size: 12, gap: 26 },
    ...wrapText(summary).map(text => ({ text, size: 10, gap: 14 })),
    { text: 'ACADEMICS', size: 12, gap: 24 },
    { text: `${s.course || 'Course'} ${s.branch ? `(${s.branch})` : ''} | Semester: ${s.semester || 'N/A'} | Year: ${s.year || 'N/A'}`, size: 10, gap: 16 },
    { text: `CGPA: ${s.cgpa || 'N/A'} | 10th: ${s.percentage10th || 'N/A'}% | 12th: ${s.percentage12th || 'N/A'}%`, size: 10, gap: 16 },
    { text: 'SKILLS', size: 12, gap: 24 },
    ...wrapText(skills || 'Communication, teamwork, problem solving').map(text => ({ text, size: 10, gap: 14 })),
    { text: 'EXPERIENCE AND STATUS', size: 12, gap: 24 },
    { text: `Placement: ${s.placementStatus}${s.placedAt ? ` at ${s.placedAt}` : ''}${s.packageOffered ? ` | Package: ${s.packageOffered} LPA` : ''}`, size: 10, gap: 16 },
    { text: `Internship: ${s.internshipStatus}${s.internshipCompany ? ` at ${s.internshipCompany}` : ''}${s.internshipDuration ? ` | Duration: ${s.internshipDuration}` : ''}`, size: 10, gap: 16 },
    { text: 'LINKS', size: 12, gap: 24 },
    { text: `LinkedIn: ${s.linkedIn || 'N/A'} | GitHub: ${s.github || 'N/A'}`, size: 10, gap: 16 },
  ];
}

function joiningLetterLines(student) {
  const s = normalizeStudent(student);
  const company = s.placedAt || s.internshipCompany || 'Partner Company';
  const role = s.placedAt ? 'Graduate Trainee' : 'Intern';
  const compensation = s.placedAt
    ? `${s.packageOffered || 'as discussed'} LPA`
    : `INR ${s.internshipStipend || 'as discussed'} per month`;

  return [
    { text: `${company} - Joining Letter`, size: 18, gap: 0 },
    { text: `Date: ${new Date().toLocaleDateString('en-IN')}`, size: 10, gap: 24 },
    { text: `To, ${s.name}`, size: 11, gap: 22 },
    { text: `Roll No: ${s.rollNumber || 'N/A'} | Course: ${s.course || 'N/A'} ${s.branch ? `- ${s.branch}` : ''}`, size: 10, gap: 16 },
    { text: 'Subject: Confirmation of Selection and Joining', size: 12, gap: 26 },
    ...wrapText(`Congratulations. We are pleased to confirm your selection for the ${role} position at ${company}. Your profile, academic record, and interview performance were found suitable for this opportunity.`).map(text => ({ text, size: 10, gap: 14 })),
    { text: `Role: ${role}`, size: 10, gap: 22 },
    { text: `Compensation/Stipend: ${compensation}`, size: 10, gap: 16 },
    { text: `Joining Mode: As communicated by ${company}`, size: 10, gap: 16 },
    ...wrapText('Please report with your college ID, government ID proof, academic documents, and any other documents requested by the placement cell or company HR team.').map(text => ({ text, size: 10, gap: 16 })),
    { text: 'Authorized Signatory', size: 11, gap: 34 },
    { text: `${company} HR Team`, size: 10, gap: 16 },
  ];
}

function getGeneratedResume(student, uploadedAt = new Date()) {
  const s = normalizeStudent(student);
  const key = fileSafe(s.rollNumber || s.email || s.name);
  const filename = `resume_${key}.pdf`;
  writePdf(filename, resumeLines(s));

  return {
    filename,
    originalName: `${fileSafe(s.name, 'student')}_Resume.pdf`,
    path: `uploads/resumes/${filename}`,
    uploadedAt,
  };
}

function getGeneratedJoiningLetter(student, uploadedAt = new Date()) {
  const s = normalizeStudent(student);
  const key = fileSafe(s.rollNumber || s.email || s.name);
  const filename = `joining_letter_${key}.pdf`;
  writePdf(filename, joiningLetterLines(s));

  return {
    filename,
    originalName: `${fileSafe(s.name, 'student')}_Joining_Letter.pdf`,
    path: `uploads/resumes/${filename}`,
    uploadedAt,
  };
}

function shouldGenerateJoiningLetter(student) {
  const s = normalizeStudent(student);
  return s.placementStatus === 'Placed' || ['Completed', 'Ongoing'].includes(s.internshipStatus);
}

module.exports = {
  getGeneratedResume,
  getGeneratedJoiningLetter,
  shouldGenerateJoiningLetter,
};
