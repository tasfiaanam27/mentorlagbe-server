
import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";
import { verifyToken, verifyTutor } from "../middleware/auth.js";

export default function tutorApplicantsRoutes() {
  const router = express.Router();

  router.use(verifyToken, verifyTutor);

  // GET /api/tutor-applicants
  // Retrieve applications submitted to the logged-in tutor.
  router.get("/", async (req, res) => {
    try {
      const tutorEmail = req.user.email.toLowerCase();
      const db = getDB();

      const applications = await db
        .collection("applications")
        .find({ tutorEmail })
        .sort({ appliedAt: -1 })
        .toArray();

      return res.status(200).json({
        success: true,
        count: applications.length,
        data: applications,
      });
    } catch (error) {
      console.error("Fetch tutor applicants error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load applicants.",
      });
    }
  });

  // PATCH /api/tutor-applicants/:id
  // Accept or reject an application belonging to this tutor.
  router.patch("/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application ID.",
        });
      }

      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be accepted or rejected.",
        });
      }

      const tutorEmail = req.user.email.toLowerCase();
      const db = getDB();

      const application = await db.collection("applications").findOne({
        _id: new ObjectId(id),
        tutorEmail,
      });

      if (!application) {
        return res.status(404).json({
          success: false,
          message: "Application not found or you do not own it.",
        });
      }

      if (application.status !== "pending") {
        return res.status(409).json({
          success: false,
          message: "Only pending applications can be updated.",
        });
      }

      await db.collection("applications").updateOne(
        {
          _id: application._id,
          tutorEmail,
          status: "pending",
        },
        {
          $set: {
            status,
            reviewedAt: new Date(),
          },
        }
      );

      const updatedApplication = await db.collection("applications").findOne({
        _id: application._id,
        tutorEmail,
      });

      return res.status(200).json({
        success: true,
        message: `Application ${status} successfully.`,
        data: updatedApplication,
      });
    } catch (error) {
      console.error("Update applicant status error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update application status.",
      });
    }
  });

  return router;
}
