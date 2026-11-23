import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

const router = express.Router();

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

async function getAuthenticatedUser(req, auth) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  return session?.user || null;
}

async function uploadToImgBB(imageBase64) {
  if (!process.env.IMGBB_API_KEY) {
    throw new Error("ImgBB API key is not configured.");
  }

  const formData = new URLSearchParams();
  formData.append("key", process.env.IMGBB_API_KEY);
  formData.append("image", imageBase64);

  const response = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: formData,
  });

  const result = await response.json();

  if (!response.ok || !result.success || !result.data?.url) {
    throw new Error(
      result.error?.message || "Failed to upload the banner image."
    );
  }

  return result.data.url;
}

// POST /api/tutor/tuitions
router.post("/tuitions", async (req, res) => {
  try {
    const user = await getAuthenticatedUser(req, auth);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Please sign in to post a tuition.",
      });
    }

    if (user.role !== "tutor") {
      return res.status(403).json({
        success: false,
        message: "Only tutors can post tuitions.",
      });
    }

    const {
      title,
      subject,
      classLevel,
      mode,
      location = "",
      monthlyFee,
      daysPerWeek,
      description,
      bannerImage,
    } = req.body;

    // Validate required text fields
    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof subject !== "string" ||
      !subject.trim() ||
      typeof classLevel !== "string" ||
      !classLevel.trim() ||
      !["Online", "Offline"].includes(mode) ||
      typeof location !== "string" ||
      typeof description !== "string" ||
      !description.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Please complete all required tuition details.",
      });
    }

    const fee = Number(monthlyFee);
    const days = Number(daysPerWeek);

    if (!Number.isFinite(fee) || fee <= 0 || fee > 1000000) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid monthly fee.",
      });
    }

    if (!Number.isInteger(days) || days < 1 || days > 7) {
      return res.status(400).json({
        success: false,
        message: "Days per week must be between 1 and 7.",
      });
    }

    if (
      mode === "Offline" &&
      !location.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Location is required for offline tuition.",
      });
    }

    if (
      typeof bannerImage !== "string" ||
      !bannerImage.startsWith("data:image/")
    ) {
      return res.status(400).json({
        success: false,
        message: "Please upload a valid banner image.",
      });
    }

    const imageParts = bannerImage.match(
      /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i
    );

    if (!imageParts) {
      return res.status(400).json({
        success: false,
        message: "Only JPG, PNG and WEBP images are supported.",
      });
    }

    const imageBuffer = Buffer.from(imageParts[2], "base64");

    if (!imageBuffer.length || imageBuffer.length > MAX_IMAGE_SIZE) {
      return res.status(400).json({
        success: false,
        message: "Banner image must be smaller than 5 MB.",
      });
    }

    const db = getDB();
    const tutorEmail = user.email.toLowerCase();

    // Read the latest user plan from MongoDB.
    const registeredTutor = await db.collection("users").findOne({
      email: tutorEmail,
    });

    if (!registeredTutor) {
      return res.status(404).json({
        success: false,
        message: "Tutor account could not be found.",
      });
    }

    const currentPlan = registeredTutor.plan || "free";

    if (!["free", "pro"].includes(currentPlan)) {
      return res.status(400).json({
        success: false,
        message: "Your account has an invalid subscription plan.",
      });
    }

    // Free tutors can create a maximum of two posts.
    // Count all existing posts, including closed or rejected posts.
    const totalTuitions = await db.collection("tuitions").countDocuments({
      tutorEmail,
    });

    if (currentPlan === "free" && totalTuitions >= 2) {
      return res.status(403).json({
        success: false,
        code: "FREE_PLAN_LIMIT_REACHED",
        message:
          "Free Plan allows a maximum of 2 tuition posts. Upgrade to Pro to post unlimited tuitions.",
      });
    }

    // Upload the banner to ImgBB.
    const uploadedImageUrl = await uploadToImgBB(imageParts[2]);

    const tuition = {
      title: title.trim(),
      subject: subject.trim(),
      classLevel: classLevel.trim(),
      mode,
      location: location.trim(),
      monthlyFee: fee,
      daysPerWeek: days,
      bannerImage: uploadedImageUrl,
      description: description.trim(),
      tutorName: registeredTutor.name || user.name || "Tutor",
      tutorEmail,
      approvalStatus: "pending",
      isActive: true,
      createdAt: new Date(),
    };

    const result = await db.collection("tuitions").insertOne(tuition);

    return res.status(201).json({
      success: true,
      message: "Tuition submitted successfully for admin approval.",
      data: {
        _id: result.insertedId,
        ...tuition,
      },
    });
  } catch (error) {
    console.error("Post tuition error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to post tuition. Please try again.",
    });
  }
});

export default function tutorRoutes(auth) {
  return router;
}
