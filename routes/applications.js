import express from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

const router = express.Router();

async function getAuthenticatedUser(req, auth) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  return session?.user || null;
}

export default function applicationRoutes(auth) {
  // POST /api/applications
  // Submit a tuition application
  router.post("/", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, auth);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to apply for a tuition.",
        });
      }

      if (user.role !== "student") {
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
        !preferredSchedule?.trim() ||
        typeof studentNote !== "string"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Please provide a valid tuition, phone number and preferred schedule.",
        });
      }

      const db = getDB();

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

      const studentEmail = user.email.toLowerCase();

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
        studentName: user.name,
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

  // GET /api/applications/my-applications
  // Fetch all applications belonging to the logged-in student
  router.get("/my-applications", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, auth);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to view your applications.",
        });
      }

      if (user.role !== "student") {
        return res.status(403).json({
          success: false,
          message: "Only students can view their applications.",
        });
      }

      const db = getDB();

      const applications = await db
        .collection("applications")
        .find({
          studentEmail: user.email.toLowerCase(),
        })
        .sort({ appliedAt: -1 })
        .toArray();

      // Retrieve the registered tutor names and emails.
      const tutorEmails = [
        ...new Set(
          applications
            .map((application) => application.tutorEmail?.toLowerCase())
            .filter(Boolean)
        ),
      ];

      const tutors = tutorEmails.length
        ? await db
            .collection("users")
            .find(
              { email: { $in: tutorEmails } },
              { projection: { name: 1, email: 1 } }
            )
            .toArray()
        : [];

      const tutorNameMap = new Map(
        tutors.map((tutor) => [
          tutor.email.toLowerCase(),
          tutor.name,
        ])
      );

      const applicationsWithTutorNames = applications.map((application) => ({
        ...application,
        tutorName:
          tutorNameMap.get(application.tutorEmail?.toLowerCase()) || "Tutor",
      }));

      return res.status(200).json({
        success: true,
        count: applicationsWithTutorNames.length,
        data: applicationsWithTutorNames,
      });
    } catch (error) {
      console.error("Fetch student applications error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load your applications.",
      });
    }
  });

  // DELETE /api/applications/:id
  // Cancel only the logged-in student's pending application
  router.delete("/:id", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req, auth);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to cancel an application.",
        });
      }

      if (user.role !== "student") {
        return res.status(403).json({
          success: false,
          message: "Only students can cancel their applications.",
        });
      }

      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid application ID.",
        });
      }

      const db = getDB();

      const result = await db.collection("applications").deleteOne({
        _id: new ObjectId(id),
        studentEmail: user.email.toLowerCase(),
        status: "pending",
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message:
            "Application not found, or it can no longer be cancelled.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Your application has been cancelled successfully.",
      });
    } catch (error) {
      console.error("Cancel application error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to cancel your application.",
      });
    }
  });

  return router;
}
