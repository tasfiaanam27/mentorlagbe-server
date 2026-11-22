import express from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

const router = express.Router();

export default function applicationRoutes(auth) {
  // POST /api/applications
  router.post("/", async (req, res) => {
    try {
      // Verify the logged-in user's BetterAuth session
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to apply for a tuition.",
        });
      }

      // Only Students can apply
      if (session.user.role !== "student") {
        return res.status(403).json({
          success: false,
          message: "Only students can apply for tuitions.",
        });
      }

      const {
        tuitionId,
        studentPhone,
        preferredSchedule,
        studentNote = "",
      } = req.body;

      if (
        !tuitionId ||
        !ObjectId.isValid(tuitionId) ||
        !studentPhone?.trim() ||
        !preferredSchedule?.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid tuition, phone number and preferred schedule.",
        });
      }

      const db = getDB();

      // Find an approved and active tuition
      const tuition = await db.collection("tuitions").findOne({
        _id: new ObjectId(tuitionId),
        approvalStatus: "approved",
        isActive: true,
      });

      if (!tuition) {
        return res.status(404).json({
          success: false,
          message: "This tuition is not available for applications.",
        });
      }

      const studentEmail = session.user.email.toLowerCase();

      // Prevent duplicate applications
      const existingApplication = await db.collection("applications").findOne({
        tuitionId: tuition._id.toString(),
        studentEmail,
      });

      if (existingApplication) {
        return res.status(409).json({
          success: false,
          message: "You have already applied for this tuition.",
        });
      }

      const application = {
        tuitionId: tuition._id.toString(),
        tuitionTitle: tuition.title,
        subject: tuition.subject,
        monthlyFee: tuition.monthlyFee,
        tutorEmail: tuition.tutorEmail,
        studentName: session.user.name,
        studentEmail,
        studentPhone: studentPhone.trim(),
        preferredSchedule: preferredSchedule.trim(),
        studentNote: studentNote.trim(),
        status: "pending",
        appliedAt: new Date(),
      };

      const result = await db.collection("applications").insertOne(application);

      return res.status(201).json({
        success: true,
        message: "Your application has been submitted successfully.",
        data: {
          _id: result.insertedId,
          ...application,
        },
      });
    } catch (error) {
      console.error("Submit application error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to submit your application.",
      });
    }
  });

  return router;
}
