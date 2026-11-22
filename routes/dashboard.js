import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

const router = express.Router();

export default function dashboardRoutes(auth) {
  // GET /api/dashboard/tutor
  router.get("/tutor", async (req, res) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to view your dashboard.",
        });
      }

      if (session.user.role !== "tutor") {
        return res.status(403).json({
          success: false,
          message: "Only tutors can access this dashboard.",
        });
      }

      const db = getDB();
      const tutorEmail = session.user.email.toLowerCase();

      const [totalTuitions, activeTuitions, totalApplicants] =
        await Promise.all([
          db.collection("tuitions").countDocuments({
            tutorEmail,
          }),

          db.collection("tuitions").countDocuments({
            tutorEmail,
            approvalStatus: "approved",
            isActive: true,
          }),

          db.collection("applications").countDocuments({
            tutorEmail,
          }),
        ]);

      return res.status(200).json({
        success: true,
        data: {
          totalTuitions,
          activeTuitions,
          totalApplicants,
          plan: session.user.plan || "free",
          tutorName: session.user.name,
        },
      });
    } catch (error) {
      console.error("Fetch tutor dashboard error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load tutor dashboard.",
      });
    }
  });

  return router;
}
