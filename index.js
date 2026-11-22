import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { connectDB, getDB } from "./config/db.js";
import { createAuth } from "./config/auth.js";
import tuitionRoutes from "./routes/tuitions.js";
import applicationRoutes from "./routes/applications.js";

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

    const auth = createAuth();

    // BetterAuth handler must come before express.json()
    app.all("/api/auth/*", toNodeHandler(auth));

    app.use(express.json());

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

    app.listen(PORT, () => {
      console.log(`MentorLagbe server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
