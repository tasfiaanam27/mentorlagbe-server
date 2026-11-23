
import express from "express";
import { getDB } from "../config/db.js";
import { verifyToken, verifyTutor } from "../middleware/auth.js";

export default function dashboardRoutes() {
  const router = express.Router();

  // All tutor dashboard routes require an authenticated tutor.
  router.use(verifyToken, verifyTutor);

  // GET /api/dashboard/tutor
  router.get("/tutor", async (req, res) => {
    try {
      const user = req.user;
      const db = getDB();
      const tutorEmail = user.email.toLowerCase();

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
          plan: user.plan || "free",
          tutorName: user.name,
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

