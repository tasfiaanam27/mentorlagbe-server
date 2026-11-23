import express from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

export default function adminTransactionsRoutes(auth) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user) {
        return res.status(401).json({
          success: false,
          message: "Please sign in to view transactions.",
        });
      }

      if (session.user.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin access only.",
        });
      }

      const payments = await getDB()
        .collection("payments")
        .find(
          { paymentStatus: "paid" },
          {
            projection: {
              userName: 1,
              userEmail: 1,
              userRole: 1,
              planName: 1,
              amount: 1,
              currency: 1,
              transactionId: 1,
              stripeSessionId: 1,
              paymentStatus: 1,
              paidAt: 1,
            },
          }
        )
        .sort({ paidAt: -1 })
        .toArray();

      return res.status(200).json({
        success: true,
        count: payments.length,
        data: payments,
      });
    } catch (error) {
      console.error("Admin transactions fetch error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load transactions.",
      });
    }
  });

  return router;
}
