import express from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

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
    console.error("ImgBB upload failed:", result);
    throw new Error(
      result.error?.message || "ImgBB image upload failed."
    );
  }

  return result.data.url;
}

function validateTuitionFields(fields) {
  const {
    title,
    subject,
    classLevel,
    mode,
    location = "",
    monthlyFee,
    daysPerWeek,
    description,
  } = fields;

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
    return "Please complete all required tuition details.";
  }

  const fee = Number(monthlyFee);
  const days = Number(daysPerWeek);

  if (!Number.isFinite(fee) || fee <= 0 || fee > 1000000) {
    return "Enter a valid monthly fee.";
  }

  if (!Number.isInteger(days) || days < 1 || days > 7) {
    return "Days per week must be between 1 and 7.";
  }

  if (mode === "Offline" && !location.trim()) {
    return "Location is required for offline tuition.";
  }

  if (description.trim().length < 20) {
    return "Description must contain at least 20 characters.";
  }

  return null;
}

async function getOwnedTuition(db, id, tutorEmail) {
  if (!ObjectId.isValid(id)) return null;

  return db.collection("tuitions").findOne({
    _id: new ObjectId(id),
    tutorEmail,
  });
}

export default function tutorRoutes(auth) {
  const router = express.Router();

  // POST /api/tutor/tuitions
  // Create a new tuition listing
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

      const fields = req.body || {};
      const validationError = validateTuitionFields(fields);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      const { bannerImage } = fields;

      if (typeof bannerImage !== "string") {
        return res.status(400).json({
          success: false,
          message: "Please upload a tuition banner image.",
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

      const uploadedImageUrl = await uploadToImgBB(imageParts[2]);

      const tuition = {
        title: fields.title.trim(),
        subject: fields.subject.trim(),
        classLevel: fields.classLevel.trim(),
        mode: fields.mode,
        location: fields.location.trim(),
        monthlyFee: Number(fields.monthlyFee),
        daysPerWeek: Number(fields.daysPerWeek),
        bannerImage: uploadedImageUrl,
        description: fields.description.trim(),
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
      console.error("Post tuition API error:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Failed to post tuition.",
      });
    }
  });

  // GET /api/tutor/tuitions
  // Get all tuition listings created by the logged-in tutor
  router.get("/tuitions", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, auth);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to view your tuitions.",
        });
      }

      if (user.role !== "tutor") {
        return res.status(403).json({
          success: false,
          message: "Only tutors can view their tuition listings.",
        });
      }

      const db = getDB();

      const tuitions = await db
        .collection("tuitions")
        .find({ tutorEmail: user.email.toLowerCase() })
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({
        success: true,
        count: tuitions.length,
        data: tuitions,
      });
    } catch (error) {
      console.error("Fetch tutor tuitions error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load your tuitions.",
      });
    }
  });

  // PATCH /api/tutor/tuitions/:id
  // Edit tuition details or toggle Active/Closed
  router.patch("/tuitions/:id", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, auth);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to update a tuition.",
        });
      }

      if (user.role !== "tutor") {
        return res.status(403).json({
          success: false,
          message: "Only tutors can update tuitions.",
        });
      }

      const tutorEmail = user.email.toLowerCase();
      const db = getDB();

      const existingTuition = await getOwnedTuition(
        db,
        req.params.id,
        tutorEmail
      );

      if (!existingTuition) {
        return res.status(404).json({
          success: false,
          message: "Tuition not found or you do not own this listing.",
        });
      }

      const fields = req.body || {};

      // Active/Closed toggle only.
      if (
        Object.keys(fields).length === 1 &&
        typeof fields.isActive === "boolean"
      ) {
        await db.collection("tuitions").updateOne(
          {
            _id: existingTuition._id,
            tutorEmail,
          },
          {
            $set: {
              isActive: fields.isActive,
              updatedAt: new Date(),
            },
          }
        );

        return res.status(200).json({
          success: true,
          message: `Tuition marked as ${
            fields.isActive ? "Active" : "Closed"
          }.`,
          data: {
            ...existingTuition,
            isActive: fields.isActive,
          },
        });
      }

      const validationError = validateTuitionFields(fields);

      if (validationError) {
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }

      const updates = {
        title: fields.title.trim(),
        subject: fields.subject.trim(),
        classLevel: fields.classLevel.trim(),
        mode: fields.mode,
        location: fields.location.trim(),
        monthlyFee: Number(fields.monthlyFee),
        daysPerWeek: Number(fields.daysPerWeek),
        description: fields.description.trim(),
        updatedAt: new Date(),
      };

      // A new banner is optional when editing.
      if (fields.bannerImage !== undefined) {
        if (typeof fields.bannerImage !== "string") {
          return res.status(400).json({
            success: false,
            message: "Invalid banner image.",
          });
        }

        const imageParts = fields.bannerImage.match(
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

        updates.bannerImage = await uploadToImgBB(imageParts[2]);
      }

      await db.collection("tuitions").updateOne(
        {
          _id: existingTuition._id,
          tutorEmail,
        },
        {
          $set: updates,
        }
      );

      const updatedTuition = await db.collection("tuitions").findOne({
        _id: existingTuition._id,
        tutorEmail,
      });

      return res.status(200).json({
        success: true,
        message: "Tuition updated successfully.",
        data: updatedTuition,
      });
    } catch (error) {
      console.error("Update tutor tuition error:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update tuition.",
      });
    }
  });

  // DELETE /api/tutor/tuitions/:id
  // Delete only the logged-in tutor's own tuition
  router.delete("/tuitions/:id", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, auth);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to delete a tuition.",
        });
      }

      if (user.role !== "tutor") {
        return res.status(403).json({
          success: false,
          message: "Only tutors can delete tuitions.",
        });
      }

      const db = getDB();
      const tutorEmail = user.email.toLowerCase();

      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tuition ID.",
        });
      }

      const result = await db.collection("tuitions").deleteOne({
        _id: new ObjectId(req.params.id),
        tutorEmail,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "Tuition not found or you do not own this listing.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Tuition deleted successfully.",
      });
    } catch (error) {
      console.error("Delete tutor tuition error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete tuition.",
      });
    }
  });

  return router;
}
