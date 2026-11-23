
import express from "express";
import { getDB } from "../config/db.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

export default function adminTransactionsRoutes() {
  const router = express.Router();

  router.use(verifyToken, verifyAdmin);

  // GET /api/admin-transactions
  // Retrieve all successful payments for the admin dashboard.
  router.get("/", async (req, res) => {
    try {
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

