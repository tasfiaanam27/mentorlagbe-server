
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dns from "node:dns";

dotenv.config();

// Fix Node.js MongoDB SRV DNS resolution
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const client = new MongoClient(process.env.MONGODB_URI);

let db;

export const connectDB = async () => {
  try {
    await client.connect();

    db = client.db(process.env.DB_NAME);

    await db.command({ ping: 1 });

    console.log("MongoDB connected successfully!");
    console.log(`Database: ${process.env.DB_NAME}`);

    return db;
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

export const getDB = () => {
  if (!db) {
    throw new Error("Database is not connected");
  }

  return db;
};
