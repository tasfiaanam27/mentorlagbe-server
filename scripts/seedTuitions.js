import { connectDB, getDB } from "../config/db.js";

const demoTutor = {
  name: "MentorLagbe Demo Tutor",
  email: "demo.tutor@mentorlagbe.com",
};

const sampleTuitions = [
  {
    title: "Experienced Mathematics Tutor for Class 9–10",
    subject: "Mathematics",
    classLevel: "Class 9-10",
    mode: "Offline",
    location: "Dhanmondi, Dhaka",
    monthlyFee: 5000,
    daysPerWeek: 4,
    bannerImage: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=900",
    description: "Build a strong foundation in algebra, geometry, trigonometry and general mathematics through structured lessons and regular practice.",
  },
  {
    title: "Physics Coaching for HSC Science Students",
    subject: "Physics",
    classLevel: "HSC",
    mode: "Online",
    location: "Online",
    monthlyFee: 4000,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=900",
    description: "Understand HSC physics concepts, solve numerical problems and prepare for board examinations with guided practice.",
  },
  {
    title: "English Language and Grammar Tutor",
    subject: "English",
    classLevel: "Class 6-8",
    mode: "Offline",
    location: "Uttara, Dhaka",
    monthlyFee: 3500,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=900",
    description: "Improve grammar, reading comprehension, vocabulary, writing and spoken English with interactive lessons.",
  },
  {
    title: "Programming Fundamentals with Python",
    subject: "Programming",
    classLevel: "University",
    mode: "Online",
    location: "Online",
    monthlyFee: 6000,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=900",
    description: "Learn Python programming from the fundamentals, including variables, loops, functions, data structures and practical projects.",
  },
  {
    title: "Chemistry Tutor for HSC and Admission Preparation",
    subject: "Chemistry",
    classLevel: "HSC",
    mode: "Offline",
    location: "Mirpur, Dhaka",
    monthlyFee: 4500,
    daysPerWeek: 4,
    bannerImage: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=900",
    description: "Master organic, inorganic and physical chemistry with concept-based explanations and exam-focused practice.",
  },
  {
    title: "IELTS Preparation and Spoken English",
    subject: "IELTS",
    classLevel: "University",
    mode: "Online",
    location: "Online",
    monthlyFee: 5500,
    daysPerWeek: 4,
    bannerImage: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=900",
    description: "Prepare for IELTS Listening, Reading, Writing and Speaking with mock tests, feedback and individual guidance.",
  },
  {
    title: "Biology Tutor for Class 9–10",
    subject: "Biology",
    classLevel: "Class 9-10",
    mode: "Offline",
    location: "Mohammadpur, Dhaka",
    monthlyFee: 4000,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=900",
    description: "Learn human physiology, cell biology, genetics and other important topics through visual explanations and practice.",
  },
  {
    title: "Accounting and Finance for HSC Students",
    subject: "Accounting",
    classLevel: "HSC",
    mode: "Offline",
    location: "Bashundhara, Dhaka",
    monthlyFee: 4500,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=900",
    description: "Develop strong accounting fundamentals and improve problem-solving skills with regular assignments and assessments.",
  },
  {
    title: "Advanced Mathematics for University Admission",
    subject: "Mathematics",
    classLevel: "Admission",
    mode: "Online",
    location: "Online",
    monthlyFee: 6500,
    daysPerWeek: 5,
    bannerImage: "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=900",
    description: "Prepare for university admission mathematics with topic-based lessons, shortcuts and timed problem-solving sessions.",
  },
  {
    title: "ICT and Computer Studies Tutor",
    subject: "ICT",
    classLevel: "HSC",
    mode: "Offline",
    location: "Badda, Dhaka",
    monthlyFee: 3500,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=900",
    description: "Learn ICT fundamentals, number systems, logic gates, database concepts and introductory programming.",
  },
  {
    title: "Economics and Business Studies Tutor",
    subject: "Economics",
    classLevel: "University",
    mode: "Online",
    location: "Online",
    monthlyFee: 5000,
    daysPerWeek: 3,
    bannerImage: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=900",
    description: "Explore microeconomics, macroeconomics and business concepts through practical examples and structured study materials.",
  },
  {
    title: "Primary School All Subjects Tutor",
    subject: "All Subjects",
    classLevel: "Class 1-5",
    mode: "Offline",
    location: "Banani, Dhaka",
    monthlyFee: 4000,
    daysPerWeek: 5,
    bannerImage: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900",
    description: "Support primary learners in English, Bangla, Mathematics and Science with patient, engaging and structured lessons.",
  },
];

const seedTuitions = async () => {
  try {
    await connectDB();

    const tuitionsCollection = getDB().collection("tuitions");

    const existingSamples = await tuitionsCollection.countDocuments({
      tutorEmail: demoTutor.email,
    });

    if (existingSamples > 0) {
      console.log("Demo tuition data already exists. No duplicates inserted.");
      return;
    }

    const now = Date.now();

    const documents = sampleTuitions.map((tuition, index) => ({
      ...tuition,
      tutorName: demoTutor.name,
      tutorEmail: demoTutor.email,
      approvalStatus: "approved",
      isActive: true,
      createdAt: new Date(now - index * 60 * 60 * 1000),
    }));

    const result = await tuitionsCollection.insertMany(documents);

    console.log(`${result.insertedCount} sample tuitions inserted successfully.`);
  } catch (error) {
    console.error("Tuition seeding failed:", error);
    process.exitCode = 1;
  } finally {
    process.exit();
  }
};

seedTuitions();
