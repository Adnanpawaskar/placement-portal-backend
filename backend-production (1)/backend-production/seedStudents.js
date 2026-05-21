/**
 * Seed 30 students with diverse courses, streams, and data.
 * Run: node seedStudents.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {
  getGeneratedResume,
  getGeneratedJoiningLetter,
  shouldGenerateJoiningLetter,
} = require('./utils/studentDocuments');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/placement_portal');
  console.log('✅ Connected to MongoDB');

  const User = require('./models/User');
  const Student = require('./models/Student');

  const students = [
    // B.Tech - CSE
    { name: 'Aarav Sharma', email: 'aarav.sharma@student.edu', course: 'B.Tech', branch: 'CSE', semester: 7, year: 4, cgpa: 8.9, rollNumber: 'BT-CSE-001', gender: 'Male', phone: '9876543201', placementStatus: 'Placed', placedAt: 'Google', packageOffered: 24, internshipStatus: 'Completed', internshipCompany: 'Infosys', skills: ['React', 'Node.js', 'Python', 'AWS'], percentage10th: 92, percentage12th: 88, semesterCGPAs: [{semester:1,cgpa:8.5},{semester:2,cgpa:8.7},{semester:3,cgpa:8.9},{semester:4,cgpa:9.0},{semester:5,cgpa:9.1},{semester:6,cgpa:8.8},{semester:7,cgpa:8.9}] },
    { name: 'Priya Patel', email: 'priya.patel@student.edu', course: 'B.Tech', branch: 'CSE', semester: 7, year: 4, cgpa: 9.2, rollNumber: 'BT-CSE-002', gender: 'Female', phone: '9876543202', placementStatus: 'Placed', placedAt: 'Microsoft', packageOffered: 28, internshipStatus: 'Completed', internshipCompany: 'TCS', skills: ['Java', 'Spring Boot', 'SQL', 'Azure'], percentage10th: 95, percentage12th: 93, semesterCGPAs: [{semester:1,cgpa:9.0},{semester:2,cgpa:9.2},{semester:3,cgpa:9.3},{semester:4,cgpa:9.4},{semester:5,cgpa:9.1},{semester:6,cgpa:9.2},{semester:7,cgpa:9.2}] },
    { name: 'Rohan Verma', email: 'rohan.verma@student.edu', course: 'B.Tech', branch: 'CSE', semester: 5, year: 3, cgpa: 7.8, rollNumber: 'BT-CSE-003', gender: 'Male', phone: '9876543203', placementStatus: 'In Process', internshipStatus: 'Ongoing', internshipCompany: 'Wipro', skills: ['C++', 'Data Structures', 'ML'], percentage10th: 85, percentage12th: 82, semesterCGPAs: [{semester:1,cgpa:7.5},{semester:2,cgpa:7.8},{semester:3,cgpa:7.9},{semester:4,cgpa:7.7},{semester:5,cgpa:7.8}] },
    { name: 'Sneha Gupta', email: 'sneha.gupta@student.edu', course: 'B.Tech', branch: 'CSE', semester: 3, year: 2, cgpa: 8.4, rollNumber: 'BT-CSE-004', gender: 'Female', phone: '9876543204', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['Python', 'Django', 'HTML/CSS'], percentage10th: 90, percentage12th: 87, semesterCGPAs: [{semester:1,cgpa:8.2},{semester:2,cgpa:8.5},{semester:3,cgpa:8.4}] },

    // B.Tech - ECE
    { name: 'Karan Mehta', email: 'karan.mehta@student.edu', course: 'B.Tech', branch: 'ECE', semester: 7, year: 4, cgpa: 8.1, rollNumber: 'BT-ECE-001', gender: 'Male', phone: '9876543205', placementStatus: 'Placed', placedAt: 'Samsung', packageOffered: 18, internshipStatus: 'Completed', internshipCompany: 'BSNL', skills: ['VLSI', 'Embedded C', 'IoT', 'MATLAB'], percentage10th: 88, percentage12th: 84, semesterCGPAs: [{semester:1,cgpa:7.8},{semester:2,cgpa:8.0},{semester:3,cgpa:8.2},{semester:4,cgpa:8.3},{semester:5,cgpa:8.1},{semester:6,cgpa:8.0},{semester:7,cgpa:8.1}] },
    { name: 'Divya Singh', email: 'divya.singh@student.edu', course: 'B.Tech', branch: 'ECE', semester: 5, year: 3, cgpa: 7.5, rollNumber: 'BT-ECE-002', gender: 'Female', phone: '9876543206', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['Circuit Design', 'Arduino', 'Python'], percentage10th: 82, percentage12th: 79, semesterCGPAs: [{semester:1,cgpa:7.2},{semester:2,cgpa:7.5},{semester:3,cgpa:7.6},{semester:4,cgpa:7.4},{semester:5,cgpa:7.5}] },

    // B.Tech - Mechanical
    { name: 'Arjun Nair', email: 'arjun.nair@student.edu', course: 'B.Tech', branch: 'Mechanical', semester: 7, year: 4, cgpa: 7.9, rollNumber: 'BT-ME-001', gender: 'Male', phone: '9876543207', placementStatus: 'Placed', placedAt: 'Tata Motors', packageOffered: 12, internshipStatus: 'Completed', internshipCompany: 'L&T', skills: ['AutoCAD', 'SolidWorks', 'ANSYS'], percentage10th: 86, percentage12th: 83, semesterCGPAs: [{semester:1,cgpa:7.5},{semester:2,cgpa:7.8},{semester:3,cgpa:8.0},{semester:4,cgpa:7.9},{semester:5,cgpa:7.8},{semester:6,cgpa:7.7},{semester:7,cgpa:7.9}] },
    { name: 'Meera Joshi', email: 'meera.joshi@student.edu', course: 'B.Tech', branch: 'Mechanical', semester: 5, year: 3, cgpa: 6.8, rollNumber: 'BT-ME-002', gender: 'Female', phone: '9876543208', placementStatus: 'Not Placed', internshipStatus: 'Ongoing', internshipCompany: 'Bosch', skills: ['Thermodynamics', 'CAD', 'Manufacturing'], percentage10th: 78, percentage12th: 76, semesterCGPAs: [{semester:1,cgpa:6.5},{semester:2,cgpa:6.8},{semester:3,cgpa:6.9},{semester:4,cgpa:6.7},{semester:5,cgpa:6.8}] },

    // M.Tech - CSE
    { name: 'Rahul Iyer', email: 'rahul.iyer@student.edu', course: 'M.Tech', branch: 'CSE', semester: 3, year: 2, cgpa: 8.7, rollNumber: 'MT-CSE-001', gender: 'Male', phone: '9876543209', placementStatus: 'Placed', placedAt: 'Amazon', packageOffered: 35, internshipStatus: 'Completed', internshipCompany: 'Adobe', skills: ['ML', 'Deep Learning', 'TensorFlow', 'Python', 'Scala'], percentage10th: 92, percentage12th: 90, semesterCGPAs: [{semester:1,cgpa:8.5},{semester:2,cgpa:8.8},{semester:3,cgpa:8.7}] },
    { name: 'Kavya Reddy', email: 'kavya.reddy@student.edu', course: 'M.Tech', branch: 'AI/ML', semester: 1, year: 1, cgpa: 9.0, rollNumber: 'MT-AI-001', gender: 'Female', phone: '9876543210', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['NLP', 'Computer Vision', 'PyTorch', 'R'], percentage10th: 96, percentage12th: 94, semesterCGPAs: [{semester:1,cgpa:9.0}] },

    // BCA
    { name: 'Siddharth Kumar', email: 'siddharth.kumar@student.edu', course: 'BCA', branch: 'Computer Applications', semester: 5, year: 3, cgpa: 7.6, rollNumber: 'BCA-001', gender: 'Male', phone: '9876543211', placementStatus: 'In Process', internshipStatus: 'Completed', internshipCompany: 'HCL', skills: ['PHP', 'MySQL', 'JavaScript', 'WordPress'], percentage10th: 84, percentage12th: 81, semesterCGPAs: [{semester:1,cgpa:7.3},{semester:2,cgpa:7.5},{semester:3,cgpa:7.7},{semester:4,cgpa:7.6},{semester:5,cgpa:7.6}] },
    { name: 'Pooja Agarwal', email: 'pooja.agarwal@student.edu', course: 'BCA', branch: 'Computer Applications', semester: 3, year: 2, cgpa: 8.0, rollNumber: 'BCA-002', gender: 'Female', phone: '9876543212', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['React', 'CSS', 'Figma', 'UI/UX'], percentage10th: 88, percentage12th: 86, semesterCGPAs: [{semester:1,cgpa:7.8},{semester:2,cgpa:8.0},{semester:3,cgpa:8.0}] },
    { name: 'Nikhil Chauhan', email: 'nikhil.chauhan@student.edu', course: 'BCA', branch: 'Computer Applications', semester: 5, year: 3, cgpa: 6.9, rollNumber: 'BCA-003', gender: 'Male', phone: '9876543213', placementStatus: 'Not Placed', internshipStatus: 'Ongoing', internshipCompany: 'Zoho', skills: ['Python', 'Flask', 'MongoDB'], percentage10th: 76, percentage12th: 74, semesterCGPAs: [{semester:1,cgpa:6.7},{semester:2,cgpa:6.9},{semester:3,cgpa:7.0},{semester:4,cgpa:6.8},{semester:5,cgpa:6.9}] },

    // MCA
    { name: 'Ananya Mishra', email: 'ananya.mishra@student.edu', course: 'MCA', branch: 'Computer Applications', semester: 3, year: 2, cgpa: 8.5, rollNumber: 'MCA-001', gender: 'Female', phone: '9876543214', placementStatus: 'Placed', placedAt: 'Cognizant', packageOffered: 16, internshipStatus: 'Completed', internshipCompany: 'Mphasis', skills: ['Java', 'Angular', 'Spring', 'Oracle'], percentage10th: 91, percentage12th: 89, semesterCGPAs: [{semester:1,cgpa:8.3},{semester:2,cgpa:8.5},{semester:3,cgpa:8.5}] },
    { name: 'Varun Tiwari', email: 'varun.tiwari@student.edu', course: 'MCA', branch: 'Computer Applications', semester: 1, year: 1, cgpa: 7.4, rollNumber: 'MCA-002', gender: 'Male', phone: '9876543215', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['C#', '.NET', 'SQL Server'], percentage10th: 80, percentage12th: 77, semesterCGPAs: [{semester:1,cgpa:7.4}] },

    // BBA
    { name: 'Ishaan Kapoor', email: 'ishaan.kapoor@student.edu', course: 'BBA', branch: 'Marketing', semester: 5, year: 3, cgpa: 7.8, rollNumber: 'BBA-MKT-001', gender: 'Male', phone: '9876543216', placementStatus: 'Placed', placedAt: 'Unilever', packageOffered: 8, internshipStatus: 'Completed', internshipCompany: 'P&G', skills: ['Digital Marketing', 'SEO', 'Excel', 'Google Analytics'], percentage10th: 85, percentage12th: 83, semesterCGPAs: [{semester:1,cgpa:7.5},{semester:2,cgpa:7.7},{semester:3,cgpa:7.9},{semester:4,cgpa:7.8},{semester:5,cgpa:7.8}] },
    { name: 'Riya Bansal', email: 'riya.bansal@student.edu', course: 'BBA', branch: 'Finance', semester: 5, year: 3, cgpa: 8.2, rollNumber: 'BBA-FIN-001', gender: 'Female', phone: '9876543217', placementStatus: 'In Process', internshipStatus: 'Completed', internshipCompany: 'HDFC Bank', skills: ['Financial Analysis', 'Tally', 'Excel', 'Python'], percentage10th: 89, percentage12th: 87, semesterCGPAs: [{semester:1,cgpa:8.0},{semester:2,cgpa:8.1},{semester:3,cgpa:8.3},{semester:4,cgpa:8.2},{semester:5,cgpa:8.2}] },
    { name: 'Aditya Rao', email: 'aditya.rao@student.edu', course: 'BBA', branch: 'HR', semester: 3, year: 2, cgpa: 7.3, rollNumber: 'BBA-HR-001', gender: 'Male', phone: '9876543218', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['HR Management', 'Communication', 'MS Office'], percentage10th: 79, percentage12th: 76, semesterCGPAs: [{semester:1,cgpa:7.0},{semester:2,cgpa:7.3},{semester:3,cgpa:7.3}] },

    // MBA
    { name: 'Shruti Malhotra', email: 'shruti.malhotra@student.edu', course: 'MBA', branch: 'Operations', semester: 3, year: 2, cgpa: 8.6, rollNumber: 'MBA-OPS-001', gender: 'Female', phone: '9876543219', placementStatus: 'Placed', placedAt: 'McKinsey', packageOffered: 32, internshipStatus: 'Completed', internshipCompany: 'Deloitte', skills: ['Supply Chain', 'Six Sigma', 'Power BI', 'Tableau'], percentage10th: 93, percentage12th: 91, semesterCGPAs: [{semester:1,cgpa:8.5},{semester:2,cgpa:8.7},{semester:3,cgpa:8.6}] },
    { name: 'Vivek Saxena', email: 'vivek.saxena@student.edu', course: 'MBA', branch: 'Marketing', semester: 1, year: 1, cgpa: 7.9, rollNumber: 'MBA-MKT-001', gender: 'Male', phone: '9876543220', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['Brand Management', 'Consumer Research', 'Digital Marketing'], percentage10th: 86, percentage12th: 84, semesterCGPAs: [{semester:1,cgpa:7.9}] },
    { name: 'Preeti Desai', email: 'preeti.desai@student.edu', course: 'MBA', branch: 'Finance', semester: 3, year: 2, cgpa: 8.9, rollNumber: 'MBA-FIN-001', gender: 'Female', phone: '9876543221', placementStatus: 'Placed', placedAt: 'Goldman Sachs', packageOffered: 38, internshipStatus: 'Completed', internshipCompany: 'JP Morgan', skills: ['Investment Banking', 'Valuation', 'Bloomberg', 'Excel VBA'], percentage10th: 94, percentage12th: 92, semesterCGPAs: [{semester:1,cgpa:8.8},{semester:2,cgpa:9.0},{semester:3,cgpa:8.9}] },

    // B.Sc
    { name: 'Harsh Pandey', email: 'harsh.pandey@student.edu', course: 'B.Sc', branch: 'Physics', semester: 5, year: 3, cgpa: 7.2, rollNumber: 'BSC-PHY-001', gender: 'Male', phone: '9876543222', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['Research', 'MATLAB', 'Lab Work', 'LaTeX'], percentage10th: 82, percentage12th: 80, semesterCGPAs: [{semester:1,cgpa:7.0},{semester:2,cgpa:7.1},{semester:3,cgpa:7.3},{semester:4,cgpa:7.2},{semester:5,cgpa:7.2}] },
    { name: 'Tanvi Bose', email: 'tanvi.bose@student.edu', course: 'B.Sc', branch: 'Chemistry', semester: 5, year: 3, cgpa: 8.0, rollNumber: 'BSC-CHE-001', gender: 'Female', phone: '9876543223', placementStatus: 'In Process', internshipStatus: 'Completed', internshipCompany: 'Dr. Reddy\'s', skills: ['Analytical Chemistry', 'HPLC', 'Research'], percentage10th: 87, percentage12th: 85, semesterCGPAs: [{semester:1,cgpa:7.7},{semester:2,cgpa:7.9},{semester:3,cgpa:8.1},{semester:4,cgpa:8.0},{semester:5,cgpa:8.0}] },
    { name: 'Gaurav Mishra', email: 'gaurav.mishra@student.edu', course: 'B.Sc', branch: 'Mathematics', semester: 3, year: 2, cgpa: 8.3, rollNumber: 'BSC-MAT-001', gender: 'Male', phone: '9876543224', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['Statistics', 'R', 'Python', 'Data Analysis'], percentage10th: 90, percentage12th: 88, semesterCGPAs: [{semester:1,cgpa:8.1},{semester:2,cgpa:8.3},{semester:3,cgpa:8.3}] },

    // M.Sc
    { name: 'Nidhi Agrawal', email: 'nidhi.agrawal@student.edu', course: 'M.Sc', branch: 'Data Science', semester: 3, year: 2, cgpa: 9.1, rollNumber: 'MSC-DS-001', gender: 'Female', phone: '9876543225', placementStatus: 'Placed', placedAt: 'Flipkart', packageOffered: 22, internshipStatus: 'Completed', internshipCompany: 'Mu Sigma', skills: ['Machine Learning', 'Big Data', 'Spark', 'Hadoop', 'SQL'], percentage10th: 95, percentage12th: 93, semesterCGPAs: [{semester:1,cgpa:9.0},{semester:2,cgpa:9.2},{semester:3,cgpa:9.1}] },
    { name: 'Saurabh Tripathi', email: 'saurabh.tripathi@student.edu', course: 'M.Sc', branch: 'Physics', semester: 1, year: 1, cgpa: 7.6, rollNumber: 'MSC-PHY-001', gender: 'Male', phone: '9876543226', placementStatus: 'Not Placed', internshipStatus: 'Not Done', skills: ['Quantum Mechanics', 'Simulation', 'MATLAB'], percentage10th: 83, percentage12th: 81, semesterCGPAs: [{semester:1,cgpa:7.6}] },

    // B.Tech - Civil
    { name: 'Yash Kulkarni', email: 'yash.kulkarni@student.edu', course: 'B.Tech', branch: 'Civil', semester: 7, year: 4, cgpa: 7.4, rollNumber: 'BT-CV-001', gender: 'Male', phone: '9876543227', placementStatus: 'Not Placed', internshipStatus: 'Completed', internshipCompany: 'DLF Group', skills: ['AutoCAD', 'STAAD Pro', 'Project Management'], percentage10th: 81, percentage12th: 78, semesterCGPAs: [{semester:1,cgpa:7.1},{semester:2,cgpa:7.3},{semester:3,cgpa:7.5},{semester:4,cgpa:7.4},{semester:5,cgpa:7.4},{semester:6,cgpa:7.3},{semester:7,cgpa:7.4}] },
    { name: 'Swati Jain', email: 'swati.jain@student.edu', course: 'B.Tech', branch: 'Civil', semester: 5, year: 3, cgpa: 8.1, rollNumber: 'BT-CV-002', gender: 'Female', phone: '9876543228', placementStatus: 'In Process', internshipStatus: 'Completed', internshipCompany: 'Shapoorji', skills: ['Revit', 'GIS', 'Construction Management'], percentage10th: 88, percentage12th: 86, semesterCGPAs: [{semester:1,cgpa:7.9},{semester:2,cgpa:8.0},{semester:3,cgpa:8.2},{semester:4,cgpa:8.1},{semester:5,cgpa:8.1}] },

    // BBA - International Business
    { name: 'Manish Trivedi', email: 'manish.trivedi@student.edu', course: 'BBA', branch: 'International Business', semester: 5, year: 3, cgpa: 7.7, rollNumber: 'BBA-IB-001', gender: 'Male', phone: '9876543229', placementStatus: 'Not Placed', internshipStatus: 'Ongoing', internshipCompany: 'Reliance Exports', skills: ['Import/Export', 'Forex', 'International Trade'], percentage10th: 84, percentage12th: 82, semesterCGPAs: [{semester:1,cgpa:7.5},{semester:2,cgpa:7.7},{semester:3,cgpa:7.8},{semester:4,cgpa:7.6},{semester:5,cgpa:7.7}] },

    // M.Tech - Data Engineering
    { name: 'Ritika Saxena', email: 'ritika.saxena@student.edu', course: 'M.Tech', branch: 'Data Engineering', semester: 3, year: 2, cgpa: 8.4, rollNumber: 'MT-DE-001', gender: 'Female', phone: '9876543230', placementStatus: 'Placed', placedAt: 'Uber', packageOffered: 30, internshipStatus: 'Completed', internshipCompany: 'PhonePe', skills: ['Kafka', 'Spark', 'Airflow', 'dbt', 'Python'], percentage10th: 91, percentage12th: 89, semesterCGPAs: [{semester:1,cgpa:8.2},{semester:2,cgpa:8.5},{semester:3,cgpa:8.4}] },
  ];

  let created = 0, skipped = 0;

  for (const s of students) {
    const existing = await User.findOne({ email: s.email });
    if (existing) { skipped++; continue; }

    const user = await User.create({
      name: s.name, email: s.email, password: 'student123',
      role: 'student', isEmailVerified: true, isActive: true
    });

    await Student.create({
      user: user._id,
      rollNumber: s.rollNumber,
      phone: s.phone,
      gender: s.gender,
      course: s.course,
      branch: s.branch,
      semester: s.semester,
      year: s.year,
      cgpa: s.cgpa,
      semesterCGPAs: s.semesterCGPAs || [],
      percentage10th: s.percentage10th,
      percentage12th: s.percentage12th,
      skills: s.skills || [],
      placementStatus: s.placementStatus || 'Not Placed',
      placedAt: s.placedAt,
      packageOffered: s.packageOffered,
      internshipStatus: s.internshipStatus || 'Not Done',
      internshipCompany: s.internshipCompany,
      resume: getGeneratedResume(s),
      joiningLetter: shouldGenerateJoiningLetter(s) ? getGeneratedJoiningLetter(s) : undefined,
      isEligible: true
    });
    created++;
    console.log(`✅ Created: ${s.name} (${s.course} - ${s.branch})`);
  }

  console.log(`\n🎉 Done! Created: ${created}, Skipped (already exist): ${skipped}`);
  console.log('🔑 Default password for all students: student123');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch(e => { console.error('❌', e.message); process.exit(1); });
