
import { createRemoteJWKSet, jwtVerify } from "jose";
import { getDB } from "../config/db.js";

const AUTH_URL = process.env.BETTER_AUTH_URL?.replace(/\/+$/, "");

if (!AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is not configured.");
}

const JWKS = createRemoteJWKSet(
  new URL(`${AUTH_URL}/api/auth/jwks`)
);

/**
 * Verify the JWT supplied through the Authorization header.
 * Retrieve the current user from MongoDB so role changes
 * take effect without trusting an old role claim.
 */
export const verifyToken = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: AUTH_URL,
      audience: AUTH_URL,
    });

    if (!payload.sub || !payload.email) {
      console.error("JWT payload missing required fields:", {
        hasSub: Boolean(payload.sub),
        hasEmail: Boolean(payload.email),
      });

      return res.status(401).json({
        success: false,
        message: "Invalid token payload.",
      });
    }

    const db = getDB();

    const user = await db.collection("users").findOne({
      email: payload.email,
    });

    if (!user) {
      console.error("JWT verified, but user was not found:", payload.email);

      return res.status(401).json({
        success: false,
        message: "User account not found.",
      });
    }

    // Use the current MongoDB role, not an old JWT role claim.
    req.user = {
      id: user._id?.toString() || user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      plan: user.plan || "free",
    };

    req.auth = payload;

    next();
  } catch (error) {
    console.error("JWT verification failed:", {
      message: error.message,
      code: error.code,
      name: error.name,
    });

    return res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
};

/**
 * Allow students only.
 */
export const verifyStudent = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "student") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Students only.",
    });
  }

  next();
};

/**
 * Allow tutors only.
 */
export const verifyTutor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "tutor") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Tutors only.",
    });
  }

  next();
};

/**
 * Allow administrators only.
 */
export const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Administrators only.",
    });
  }

  next();
};
