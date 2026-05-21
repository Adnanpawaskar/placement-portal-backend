const Student = require('../models/Student');

const generateAIResume = async (req, res) => {
  try {
    const student = await Student.findOne({ user: req.user._id }).populate('user', 'name email');
    if (!student) return res.status(404).json({ success: false, message: 'Profile not found' });

    const { jobTarget, extraData = {} } = req.body;
    const { experience = [], projects = [], certifications = [], achievements = [] } = extraData;

    // Build AI-enhanced bio
    const skillsStr = (student.skills || []).join(', ');
    const targetStr = jobTarget ? ` targeting ${jobTarget}` : '';
    const bio = student.bio ||
      `Motivated ${student.course || 'Engineering'} student${targetStr} with hands-on experience in ${skillsStr || 'software development'}. Passionate about building impactful solutions and eager to contribute to a dynamic organization.`;

    const education = [
      {
        degree: student.course || 'B.Tech',
        institution: 'S. M. Shetty College of Engineering & Technology',
        year: '2021 – 2025',
        score: student.cgpa ? `CGPA: ${student.cgpa} / 10` : ''
      },
      student.percentage12th && {
        degree: '12th Standard (HSC)',
        institution: '—',
        year: '2021',
        score: `${student.percentage12th}%`
      },
      student.percentage10th && {
        degree: '10th Standard (SSC)',
        institution: '—',
        year: '2019',
        score: `${student.percentage10th}%`
      }
    ].filter(Boolean);

    const resume = {
      name: student.user.name,
      email: student.user.email,
      phone: student.phone,
      linkedIn: student.linkedIn,
      github: student.github,
      bio,
      course: student.course,
      branch: student.branch,
      cgpa: student.cgpa,
      skills: student.skills || [],
      education,
      experience,
      projects,
      certifications,
      achievements,
      generatedAt: new Date().toISOString(),
      jobTarget,
    };

    res.json({ success: true, resume });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { generateAIResume };
