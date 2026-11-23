import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

export default function adminRoutes(auth) {
  const router = express.Router();

  async function getAdmin(req) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const user = session?.user;

    if (!user) {
      return { error: "unauthenticated" };
    }

    if (user.role !== "admin") {
      return { error: "forbidden" };
    }

    return { user };
  }

  // GET /api/admin/overview
  router.get("/overview", async (req, res) => {
    try {
      const authResult = await getAdmin(req);

      if (authResult.error === "unauthenticated") {
        return res.status(401).json({
          success: false,
          message: "Please sign in to access the admin dashboard.",
        });
      }

      if (authResult.error === "forbidden") {
        return res.status(403).json({
          success: false,
          message: "Admin access only.",
        });
      }

      const db = getDB();

      const usersCollection = db.collection("users");
      const tuitionsCollection = db.collection("tuitions");
      const paymentsCollection = db.collection("payments");

      const [
        totalUsers,
        totalTutors,
        pendingTuitions,
        approvedTuitions,
        rejectedTuitions,
        revenueResult,
      ] = await Promise.all([
        usersCollection.countDocuments(),
        usersCollection.countDocuments({ role: "tutor" }),
        tuitionsCollection.countDocuments({
          approvalStatus: "pending",
        }),
        tuitionsCollection.countDocuments({
          approvalStatus: "approved",
        }),
        tuitionsCollection.countDocuments({
          approvalStatus: "rejected",
        }),
        paymentsCollection
          .aggregate([
            {
              $match: {
                paymentStatus: "paid",
              },
            },
            {
              $group: {
                _id: "$currency",
                totalRevenue: { $sum: "$amount" },
                transactionCount: { $sum: 1 },
              },
            },
          ])
          .toArray(),
      ]);

      const revenueByCurrency = revenueResult.map((item) => ({
        currency: (item._id || "usd").toUpperCase(),
        totalRevenue: Number(item.totalRevenue || 0),
        transactionCount: item.transactionCount,
      }));

      return res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalTutors,
          tuitions: {
            pending: pendingTuitions,
            approved: approvedTuitions,
            rejected: rejectedTuitions,
          },
          revenueByCurrency,
        },
      });
    } catch (error) {
      console.error("Admin overview error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load admin dashboard statistics.",
      });
    }
  });

  return router;
}
