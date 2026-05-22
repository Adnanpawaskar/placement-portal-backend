const pdf = require('pdf-parse');
const fs = require('fs');
const path = require('path');

/**
 * Extract text from a resume PDF.
 */
async function extractResumeText(filePath) {
  try {
    const absPath = path.isAbsolute(filePath) ? filePath : path.join(__dirname, '..', filePath);
    const buffer = fs.readFileSync(absPath);
    const data = await pdf(buffer);
    return data.text;
  } catch (err) {
    console.error('PDF parse error:', err.message);
    return '';
  }
}

/**
 * Score a resume against a job using simple keyword + heuristic matching.
 * Returns { score (0–100), strengths[], gaps[], verdict }
 *
 * In production, replace the body of this function with an OpenAI / Gemini API call.
 */
async function screenResume({ resumeText, jobTitle, jobDescription, requiredSkills = [], minCGPA = 0 }) {
  const text = resumeText.toLowerCase();
  const results = { score: 0, strengths: [], gaps: [], verdict: 'Pending', details: {} };

  // 1. Skills match
  let skillMatches = 0;
  const matchedSkills = [];
  const missingSkills = [];
  for (const skill of requiredSkills) {
    if (text.includes(skill.toLowerCase())) { skillMatches++; matchedSkills.push(skill); }
    else missingSkills.push(skill);
  }
  const skillScore = requiredSkills.length ? Math.round((skillMatches / requiredSkills.length) * 40) : 20;
  results.details.skillScore = skillScore;
  if (matchedSkills.length) results.strengths.push(`Matched skills: ${matchedSkills.join(', ')}`);
  if (missingSkills.length) results.gaps.push(`Missing skills: ${missingSkills.join(', ')}`);

  // 2. Education keywords
  const educationKeywords = ['b.tech', 'btech', 'b.e', 'mca', 'mba', 'm.tech', 'bca', 'bachelor', 'master', 'university', 'college'];
  const hasEducation = educationKeywords.some(k => text.includes(k));
  const educationScore = hasEducation ? 15 : 5;
  results.details.educationScore = educationScore;
  if (hasEducation) results.strengths.push('Education details present');
  else results.gaps.push('Education details not clearly mentioned');

  // 3. Experience / projects
  const expKeywords = ['experience', 'project', 'internship', 'developed', 'built', 'implemented', 'designed', 'led', 'managed'];
  const expMatches = expKeywords.filter(k => text.includes(k)).length;
  const expScore = Math.min(25, expMatches * 4);
  results.details.expScore = expScore;
  if (expMatches >= 3) results.strengths.push('Good project/experience section');
  else results.gaps.push('Limited project or experience details');

  // 4. Contact info
  const hasEmail = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/.test(text);
  const hasPhone = /\d{10}/.test(text.replace(/\s/g, ''));
  const contactScore = (hasEmail ? 5 : 0) + (hasPhone ? 5 : 0);
  results.details.contactScore = contactScore;
  if (!hasEmail) results.gaps.push('Email not found in resume');
  if (!hasPhone) results.gaps.push('Phone number not found in resume');

  // 5. Certifications / achievements
  const certKeywords = ['certified', 'certification', 'award', 'achievement', 'publication', 'hackathon', 'competition'];
  const hasCerts = certKeywords.some(k => text.includes(k));
  const certScore = hasCerts ? 10 : 0;
  if (hasCerts) results.strengths.push('Certifications / achievements present');

  results.score = Math.min(100, skillScore + educationScore + expScore + contactScore + certScore);

  // Verdict
  if (results.score >= 70) results.verdict = 'Highly Recommended';
  else if (results.score >= 50) results.verdict = 'Recommended';
  else if (results.score >= 35) results.verdict = 'Consider';
  else results.verdict = 'Not Recommended';

  return results;
}

module.exports = { extractResumeText, screenResume };
