
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDB } from "./config/db.js";

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

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

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`MentorLagbe server running on port ${PORT}`);
  });
};

startServer();
