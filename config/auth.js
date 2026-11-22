
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { getDB } from "./db.js";

export const createAuth = () => {
  return betterAuth({
    database: mongodbAdapter(getDB()),

    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,

    trustedOrigins: [process.env.CLIENT_URL],

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      autoSignIn: true,
    },

    user: {
      modelName: "users",
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "student",
          input: true,
        },
        plan: {
          type: "string",
          required: true,
          defaultValue: "free",
          input: false,
        },
        phone: {
          type: "string",
          required: false,
          input: false,
        },
        bio: {
          type: "string",
          required: false,
          input: false,
        },
      },
    },

    session: { modelName: "sessions" },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications" },
  });
};
