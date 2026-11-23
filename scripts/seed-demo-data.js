import dns from "node:dns";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";

dns.setServers(["8.8.8.8", "8.8.4.4"]);

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

const SEED_BATCH = "mentorlagbe-demo-v1";

if (!MONGO_URI) {
  console.error("Missing MONGODB_URI or MONGO_URI in your server .env file.");
  process.exit(1);
}

if (!DB_NAME) {
  console.error("Missing DB_NAME in your server .env file.");
  process.exit(1);
}

// Fictional tutor profiles
const tutors = [
  {
    name: "Ayesha Rahman",
    email: "demo.ayesha@mentorlagbe.com",
    phone: "01710000001",
    bio: "Mathematics teacher with 6 years of experience helping students build strong foundations.",
    image: "https://i.pravatar.cc/300?img=47",
  },
  {
    name: "Tanvir Hasan",
    email: "demo.tanvir@mentorlagbe.com",
    phone: "01710000002",
    bio: "Physics tutor specializing in HSC and university admission preparation.",
    image: "https://i.pravatar.cc/300?img=12",
  },
  {
    name: "Nusrat Jahan",
    email: "demo.nusrat@mentorlagbe.com",
    phone: "01710000003",
    bio: "English language instructor focused on grammar, communication, and IELTS preparation.",
    image: "https://i.pravatar.cc/300?img=44",
  },
];

// Fictional student profiles
const students = [
  {
    name: "Samiul Islam",
    email: "demo.samiul@mentorlagbe.com",
    phone: "01810000001",
    bio: "Class 10 student interested in science and mathematics.",
    image: "https://i.pravatar.cc/300?img=11",
  },
  {
    name: "Nabila Ahmed",
    email: "demo.nabila@mentorlagbe.com",
    phone: "01810000002",
    bio: "HSC student preparing for university admission.",
    image: "https://i.pravatar.cc/300?img=32",
  },
  {
    name: "Rafi Mahmud",
    email: "demo.rafi@mentorlagbe.com",
    phone: "01810000003",
    bio: "Class 9 student looking for help with science subjects.",
    image: "https://i.pravatar.cc/300?img=13",
  },
  {
    name: "Farzana Karim",
    email: "demo.farzana@mentorlagbe.com",
    phone: "01810000004",
    bio: "University student interested in improving English communication.",
    image: "https://i.pravatar.cc/300?img=49",
  },
  {
    name: "Mehedi Hasan",
    email: "demo.mehedi@mentorlagbe.com",
    phone: "01810000005",
    bio: "HSC student interested in programming and mathematics.",
    image: "https://i.pravatar.cc/300?img=14",
  },
];

// Realistic fictional tuition listings
const tuitionData = [
  {
    key: "math-class-8",
    title: "Mathematics Support for Class 8",
    subject: "Mathematics",
    classLevel: "Class 8",
    mode: "Online",
    location: "Dhaka",
    monthlyFee: 3500,
    daysPerWeek: 3,
    tutorEmail: tutors[0].email,
    description:
      "Build a strong foundation in mathematics through weekly lessons, practice problems, and individual feedback.",
    bannerImage:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200",
  },
  {
    key: "math-hsc",
    title: "HSC Higher Mathematics Preparation",
    subject: "Higher Mathematics",
    classLevel: "HSC",
    mode: "Offline",
    location: "Uttara, Dhaka",
    monthlyFee: 6000,
    daysPerWeek: 4,
    tutorEmail: tutors[0].email,
    description:
      "Detailed HSC higher mathematics lessons covering calculus, vectors, matrices, and exam preparation.",
    bannerImage:
      "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1200",
  },
  {
    key: "algebra-class-9",
    title: "Algebra and Geometry for Class 9",
    subject: "Mathematics",
    classLevel: "Class 9",
    mode: "Online",
    location: "Online",
    monthlyFee: 4000,
    daysPerWeek: 3,
    tutorEmail: tutors[0].email,
    description:
      "Step-by-step lessons in algebra and geometry with regular assignments and progress checks.",
    bannerImage:
      "https://images.unsplash.com/photo-1509228468518-180dd4864904?w=1200",
  },
  {
    key: "physics-hsc",
    title: "HSC Physics Complete Course",
    subject: "Physics",
    classLevel: "HSC",
    mode: "Online",
    location: "Online",
    monthlyFee: 5500,
    daysPerWeek: 4,
    tutorEmail: tutors[1].email,
    description:
      "Concept-focused physics classes with numerical problem solving and board exam preparation.",
    bannerImage:
      "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=1200",
  },
  {
    key: "physics-class-10",
    title: "Physics Coaching for Class 10",
    subject: "Physics",
    classLevel: "Class 10",
    mode: "Offline",
    location: "Mirpur, Dhaka",
    monthlyFee: 4500,
    daysPerWeek: 3,
    tutorEmail: tutors[1].email,
    description:
      "Understand important physics concepts through demonstrations, examples, and exam-oriented practice.",
    bannerImage:
      "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?w=1200",
  },
  {
    key: "chemistry-hsc",
    title: "HSC Chemistry Concept Classes",
    subject: "Chemistry",
    classLevel: "HSC",
    mode: "Online",
    location: "Online",
    monthlyFee: 5000,
    daysPerWeek: 3,
    tutorEmail: tutors[1].email,
    description:
      "Learn organic and inorganic chemistry with clear explanations, reaction practice, and model tests.",
    bannerImage:
      "https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=1200",
  },
  {
    key: "english-class-7",
    title: "English Language Skills for Class 7",
    subject: "English",
    classLevel: "Class 7",
    mode: "Offline",
    location: "Dhanmondi, Dhaka",
    monthlyFee: 3000,
    daysPerWeek: 3,
    tutorEmail: tutors[2].email,
    description:
      "Improve grammar, vocabulary, reading comprehension, and everyday English communication.",
    bannerImage:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200",
  },
  {
    key: "ielts-preparation",
    title: "IELTS Academic Preparation",
    subject: "English",
    classLevel: "University",
    mode: "Online",
    location: "Online",
    monthlyFee: 7000,
    daysPerWeek: 4,
    tutorEmail: tutors[2].email,
    description:
      "Structured IELTS preparation covering Listening, Reading, Writing, and Speaking with practice tests.",
    bannerImage:
      "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1200",
  },
  {
    key: "spoken-english",
    title: "Spoken English and Communication",
    subject: "English",
    classLevel: "University",
    mode: "Online",
    location: "Online",
    monthlyFee: 3500,
    daysPerWeek: 2,
    tutorEmail: tutors[2].email,
    description:
      "Build confidence in spoken English through guided conversations and practical communication exercises.",
    bannerImage:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200",
  },
  {
    key: "programming-basics",
    title: "Programming Fundamentals with Python",
    subject: "Programming",
    classLevel: "University",
    mode: "Online",
    location: "Online",
    monthlyFee: 6500,
    daysPerWeek: 3,
    tutorEmail: tutors[1].email,
    description:
      "Learn Python fundamentals, problem solving, functions, loops, and introductory programming projects.",
    bannerImage:
      "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1200",
  },
  {
    key: "ict-class-9",
    title: "ICT and Digital Technology for Class 9",
    subject: "ICT",
    classLevel: "Class 9",
    mode: "Offline",
    location: "Bashundhara, Dhaka",
    monthlyFee: 3500,
    daysPerWeek: 2,
    tutorEmail: tutors[1].email,
    description:
      "Understand ICT fundamentals, computer systems, digital safety, and practical technology concepts.",
    bannerImage:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200",
  },
  {
    key: "biology-hsc",
    title: "HSC Biology and Human Physiology",
    subject: "Biology",
    classLevel: "HSC",
    mode: "Online",
    location: "Online",
    monthlyFee: 5000,
    daysPerWeek: 3,
    tutorEmail: tutors[0].email,
    description:
      "Study cell biology, genetics, human physiology, and important HSC biology topics with regular revision.",
    bannerImage:
      "https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=1200",
  },
];

// Applications connect actual demo students to actual seeded tuition IDs.
const applicationData = [
  {
    key: "application-01",
    tuitionKey: "math-class-8",
    studentIndex: 0,
    schedule: "Saturday, Monday and Wednesday, 5:00 PM",
    note: "I need help understanding algebra and geometry before my school exams.",
    status: "pending",
  },
  {
    key: "application-02",
    tuitionKey: "physics-hsc",
    studentIndex: 1,
    schedule: "Sunday, Tuesday and Thursday, 7:00 PM",
    note: "I want to improve my understanding of HSC physics numerical problems.",
    status: "accepted",
  },
  {
    key: "application-03",
    tuitionKey: "english-class-7",
    studentIndex: 2,
    schedule: "Friday and Saturday, 4:00 PM",
    note: "I want to improve my grammar and spoken English.",
    status: "pending",
  },
  {
    key: "application-04",
    tuitionKey: "ielts-preparation",
    studentIndex: 3,
    schedule: "Sunday, Tuesday and Thursday, 8:00 PM",
    note: "I am planning to take the IELTS Academic test and need structured preparation.",
    status: "accepted",
  },
  {
    key: "application-05",
    tuitionKey: "programming-basics",
    studentIndex: 4,
    schedule: "Saturday, Monday and Wednesday, 8:00 PM",
    note: "I want to learn Python from the beginning and practise problem solving.",
    status: "pending",
  },
  {
    key: "application-06",
    tuitionKey: "math-hsc",
    studentIndex: 1,
    schedule: "Sunday, Tuesday and Thursday, 6:00 PM",
    note: "I need regular guidance for higher mathematics.",
    status: "pending",
  },
  {
    key: "application-07",
    tuitionKey: "physics-class-10",
    studentIndex: 0,
    schedule: "Saturday, Monday and Wednesday, 6:00 PM",
    note: "I need help with physics concepts and board exam preparation.",
    status: "rejected",
  },
  {
    key: "application-08",
    tuitionKey: "spoken-english",
    studentIndex: 3,
    schedule: "Friday and Saturday, 7:00 PM",
    note: "I want to become more confident speaking English.",
    status: "pending",
  },
  {
    key: "application-09",
    tuitionKey: "chemistry-hsc",
    studentIndex: 4,
    schedule: "Sunday, Tuesday and Thursday, 5:00 PM",
    note: "I need support with organic chemistry and chemical reactions.",
    status: "accepted",
  },
  {
    key: "application-10",
    tuitionKey: "algebra-class-9",
    studentIndex: 2,
    schedule: "Saturday, Monday and Wednesday, 5:30 PM",
    note: "I want to practise algebra regularly.",
    status: "pending",
  },
  {
    key: "application-11",
    tuitionKey: "ict-class-9",
    studentIndex: 0,
    schedule: "Friday and Saturday, 3:00 PM",
    note: "I want to improve my ICT knowledge for school.",
    status: "pending",
  },
  {
    key: "application-12",
    tuitionKey: "biology-hsc",
    studentIndex: 1,
    schedule: "Sunday, Tuesday and Thursday, 4:00 PM",
    note: "I need help revising human physiology and genetics.",
    status: "pending",
  },
];

async function seedDemoData() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();

    const db = client.db(DB_NAME);

    const usersCollection = db.collection("users");
    const tuitionsCollection = db.collection("tuitions");
    const applicationsCollection = db.collection("applications");

    console.log(`Connected to MongoDB database: ${DB_NAME}`);
    console.log("Starting MentorLagbe demo data seeding...\n");

    // 1. Insert demo tutor and student profiles without overwriting users.
    const allDemoUsers = [
      ...tutors.map((user) => ({ ...user, role: "tutor" })),
      ...students.map((user) => ({ ...user, role: "student" })),
    ];

    for (const user of allDemoUsers) {
      const now = new Date();

      await usersCollection.updateOne(
        { email: user.email },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            name: user.name,
            email: user.email,
            emailVerified: false,
            image: user.image,
            role: user.role,
            phone: user.phone,
            bio: user.bio,
            plan: "free",
            createdAt: now,
            updatedAt: now,
            isDemo: true,
            seedBatch: SEED_BATCH,
          },
        },
        { upsert: true }
      );
    }

    console.log("Demo tutor and student profiles processed.");

    // 2. Insert tuition records and retrieve their real MongoDB IDs.
    const tuitionIdMap = new Map();

    for (const tuition of tuitionData) {
      const tutor = tutors.find(
        (item) => item.email === tuition.tutorEmail
      );

      const now = new Date();

      await tuitionsCollection.updateOne(
        { seedKey: tuition.key, seedBatch: SEED_BATCH },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            title: tuition.title,
            subject: tuition.subject,
            classLevel: tuition.classLevel,
            mode: tuition.mode,
            location: tuition.location,
            monthlyFee: tuition.monthlyFee,
            daysPerWeek: tuition.daysPerWeek,
            bannerImage: tuition.bannerImage,
            description: tuition.description,
            tutorName: tutor.name,
            tutorEmail: tutor.email,
            approvalStatus: "approved",
            isActive: true,
            createdAt: now,
            isDemo: true,
            seedKey: tuition.key,
            seedBatch: SEED_BATCH,
          },
        },
        { upsert: true }
      );

      const savedTuition = await tuitionsCollection.findOne({
        seedKey: tuition.key,
        seedBatch: SEED_BATCH,
      });

      if (!savedTuition) {
        throw new Error(`Could not retrieve seeded tuition: ${tuition.key}`);
      }

      tuitionIdMap.set(tuition.key, savedTuition._id);
    }

    console.log(`${tuitionData.length} demo tuition records processed.`);

    // 3. Insert applications linked to the seeded tuition and student records.
    for (const application of applicationData) {
      const tuitionId = tuitionIdMap.get(application.tuitionKey);
      const tuition = tuitionData.find(
        (item) => item.key === application.tuitionKey
      );
      const student = students[application.studentIndex];
      const tutor = tutors.find(
        (item) => item.email === tuition.tutorEmail
      );

      if (!tuitionId || !student || !tutor) {
        throw new Error(
          `Missing relationship for application: ${application.key}`
        );
      }

      const now = new Date();

      await applicationsCollection.updateOne(
        { seedKey: application.key, seedBatch: SEED_BATCH },
        {
          $setOnInsert: {
            _id: new ObjectId(),
            tuitionId,
            tuitionTitle: tuition.title,
            subject: tuition.subject,
            monthlyFee: tuition.monthlyFee,
            tutorEmail: tutor.email,
            studentName: student.name,
            studentEmail: student.email,
            studentPhone: student.phone,
            preferredSchedule: application.schedule,
            studentNote: application.note,
            status: application.status,
            appliedAt: now,
            isDemo: true,
            seedKey: application.key,
            seedBatch: SEED_BATCH,
          },
        },
        { upsert: true }
      );
    }

    console.log(`${applicationData.length} demo applications processed.`);

    // 4. Print a summary of the seeded records.
    const demoTutorCount = await usersCollection.countDocuments({
      role: "tutor",
      seedBatch: SEED_BATCH,
    });

    const demoStudentCount = await usersCollection.countDocuments({
      role: "student",
      seedBatch: SEED_BATCH,
    });

    const demoTuitionCount = await tuitionsCollection.countDocuments({
      seedBatch: SEED_BATCH,
    });

    const demoApplicationCount =
      await applicationsCollection.countDocuments({
        seedBatch: SEED_BATCH,
      });

    console.log("\n========== SEED SUMMARY ==========");
    console.log(`Demo tutors:       ${demoTutorCount}`);
    console.log(`Demo students:     ${demoStudentCount}`);
    console.log(`Demo tuitions:     ${demoTuitionCount}`);
    console.log(`Demo applications: ${demoApplicationCount}`);
    console.log("==================================");
    console.log("\nDemo data seeding completed successfully!");
  } catch (error) {
    console.error("\nDemo data seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}

seedDemoData();
