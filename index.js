import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { toNodeHandler } from "better-auth/node";
import { connectDB } from "./config/db.js";
import { createAuth } from "./config/auth.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    const auth = createAuth();

    // BetterAuth handler must come before express.json()
    app.all("/api/auth/*", toNodeHandler(auth));

    app.use(express.json());

    app.get("/", (req, res) => {
      res.send("Welcome to MentorLagbe API!");
    });

    app.get("/api/health", (req, res) => {
      res.json({
        success: true,
        message: "MentorLagbe server is running",
      });
    });

    app.listen(PORT, () => {
      console.log(`MentorLagbe server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server startup failed:", error);
    process.exit(1);
  }
};

startServer();
