const fs = require('fs');
const path = require('path');

const SAMPLE_RESUME_FILENAME = 'sample_student_resume.pdf';
const SAMPLE_RESUME_ORIGINAL_NAME = 'Sample_Student_Resume.pdf';

const sampleResumePdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 154 >>
stream
BT
/F1 18 Tf
72 720 Td
(Sample Student Resume) Tj
/F1 11 Tf
0 -32 Td
(This placeholder resume is attached for seeded/demo student records.) Tj
0 -18 Td
(Students can replace it by uploading their own resume from the profile page.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000445 00000 n 
trailer
<< /Root 1 0 R /Size 6 >>
startxref
515
%%EOF
`;

function ensureSampleResumeFile() {
  const uploadDir = path.join(__dirname, '..', 'uploads', 'resumes');
  const filePath = path.join(uploadDir, SAMPLE_RESUME_FILENAME);

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, sampleResumePdf);
  }

  return filePath;
}

function getSampleResume(uploadedAt = new Date()) {
  ensureSampleResumeFile();
  return {
    filename: SAMPLE_RESUME_FILENAME,
    originalName: SAMPLE_RESUME_ORIGINAL_NAME,
    path: `uploads/resumes/${SAMPLE_RESUME_FILENAME}`,
    uploadedAt,
  };
}

module.exports = {
  SAMPLE_RESUME_FILENAME,
  ensureSampleResumeFile,
  getSampleResume,
};
