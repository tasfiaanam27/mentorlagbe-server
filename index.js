import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Stripe from "stripe";
import { toNodeHandler } from "better-auth/node";

import { connectDB, getDB } from "./config/db.js";
import { createAuth } from "./config/auth.js";
import tuitionRoutes from "./routes/tuitions.js";
import applicationRoutes from "./routes/applications.js";
import stripeRoutes, {
  createStripeWebhookHandler,
} from "./routes/stripe.js";
import dashboardRoutes from "./routes/dashboard.js";
import tutorRoutes from "./routes/tutor.js";
import tutorApplicantsRoutes from "./routes/tutorApplicants.js";
import adminRoutes from "./routes/admin.js";
import adminTransactionsRoutes from "./routes/adminTransactions.js";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY is missing from the server .env file.");
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const auth = createAuth();

    // Stripe webhook must be registered before express.json().
    // Stripe signature verification requires the original raw request body.
    app.post(
      "/api/stripe/webhook",
      express.raw({ type: "application/json" }),
      createStripeWebhookHandler(stripe)
    );

    // BetterAuth handler must come before express.json().
    app.all("/api/auth/*", toNodeHandler(auth));

    app.use(express.json({ limit: "10mb" }));
    app.use("/api/dashboard", dashboardRoutes(auth));
    app.use("/api/tutor", tutorRoutes(auth));
    app.use("/api/tutor-applicants", tutorApplicantsRoutes(auth));
    app.use("/api/admin", adminRoutes(auth));
    app.use("/api/admin/transactions", adminTransactionsRoutes(auth));

    // Root route
    app.get("/", (req, res) => {
      res.send("Welcome to MentorLagbe API!");
    });

    // Health check
    app.get("/api/health", (req, res) => {
      res.json({
        success: true,
        message: "MentorLagbe server is running",
      });
    });

    // Platform statistics
    app.get("/api/stats", async (req, res) => {
      try {
        const db = getDB();
        const usersCollection = db.collection("users");

        const [totalStudents, totalTutors] = await Promise.all([
          usersCollection.countDocuments({ role: "student" }),
          usersCollection.countDocuments({ role: "tutor" }),
        ]);

        return res.status(200).json({
          success: true,
          data: {
            totalStudents,
            totalTutors,
          },
        });
      } catch (error) {
        console.error("Platform statistics error:", error);

        return res.status(500).json({
          success: false,
          message: "Failed to retrieve platform statistics",
        });
      }
    });

    // Tuition routes
    app.use("/api/tuitions", tuitionRoutes);

    // Application routes
    app.use("/api/applications", applicationRoutes(auth));

    // Stripe Checkout and verification routes
    app.use("/api/stripe", stripeRoutes(auth, stripe));

    app.listen(PORT, () => {
      console.log(`MentorLagbe server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
