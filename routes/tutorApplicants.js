import express from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

export default function tutorApplicantsRoutes(auth) {
  const router = express.Router();

  async function getAuthenticatedTutor(req) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const user = session?.user;

    if (!user) {
      return { error: "unauthenticated" };
    }

    if (user.role !== "tutor") {
      return { error: "forbidden" };
    }

    return {
      user,
      email: user.email.toLowerCase(),
    };
  }

  // GET /api/tutor-applicants
  // Retrieve applications submitted to the logged-in tutor.
  router.get("/", async (req, res) => {
    try {
      const authResult = await getAuthenticatedTutor(req);

      if (authResult.error === "unauthenticated") {
        return res.status(401).json({
          success: false,
          message: "Please sign in to view applicants.",
        });
      }

      if (authResult.error === "forbidden") {
        return res.status(403).json({
          success: false,
          message: "Only tutors can view applicants.",
        });
      }

      const db = getDB();
      const tutorEmail = authResult.email;

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
      const authResult = await getAuthenticatedTutor(req);

      if (authResult.error === "unauthenticated") {
        return res.status(401).json({
          success: false,
          message: "Please sign in to manage applicants.",
        });
      }

      if (authResult.error === "forbidden") {
        return res.status(403).json({
          success: false,
          message: "Only tutors can manage applicants.",
        });
      }

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

      const db = getDB();
      const tutorEmail = authResult.email;

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

      const updatedApplication = await db
        .collection("applications")
        .findOne({
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
