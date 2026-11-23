
import express from "express";
import { getDB } from "../config/db.js";
import { verifyToken } from "../middleware/auth.js";

export default function profileRoutes() {
  const router = express.Router();

  router.use(verifyToken);

  async function uploadToImgBB(base64Image) {
    const apiKey = process.env.IMGBB_API_KEY;

    if (!apiKey) {
      throw new Error("ImgBB API key is not configured.");
    }

    const imageData = base64Image.includes(",")
      ? base64Image.split(",")[1]
      : base64Image;

    const formData = new FormData();
    formData.append("image", imageData);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success || !result.data?.url) {
      throw new Error(
        result.error?.message || "Profile image upload failed."
      );
    }

    return result.data.url;
  }

  // GET /api/profile
  // Retrieve the currently signed-in user's profile.
  router.get("/", async (req, res) => {
    try {
      const user = req.user;

      const profile = await getDB().collection("users").findOne(
        { email: user.email },
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            role: 1,
            plan: 1,
            phone: 1,
            bio: 1,
            createdAt: 1,
          },
        }
      );

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "User profile not found.",
        });
      }

      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      console.error("Fetch profile error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to load profile.",
      });
    }
  });

  // PATCH /api/profile
  // Update the currently signed-in user's profile.
  router.patch("/", async (req, res) => {
    try {
      const user = req.user;

      const {
        name,
        phone,
        bio,
        imageBase64,
        imageUrl,
      } = req.body || {};

      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Name is required.",
        });
      }

      if (name.trim().length > 100) {
        return res.status(400).json({
          success: false,
          message: "Name must be 100 characters or fewer.",
        });
      }

      if (phone !== undefined && typeof phone !== "string") {
        return res.status(400).json({
          success: false,
          message: "Phone must be text.",
        });
      }

      if (bio !== undefined && typeof bio !== "string") {
        return res.status(400).json({
          success: false,
          message: "Bio must be text.",
        });
      }

      if (String(phone || "").trim().length > 30) {
        return res.status(400).json({
          success: false,
          message: "Phone must be 30 characters or fewer.",
        });
      }

      if (String(bio || "").trim().length > 500) {
        return res.status(400).json({
          success: false,
          message: "Bio must be 500 characters or fewer.",
        });
      }

      if (imageBase64 && imageUrl) {
        return res.status(400).json({
          success: false,
          message: "Provide an image upload or an image URL, not both.",
        });
      }

      const updateFields = {
        name: name.trim(),
        phone: String(phone || "").trim(),
        bio: String(bio || "").trim(),
        updatedAt: new Date(),
      };

      if (imageBase64) {
        if (typeof imageBase64 !== "string") {
          return res.status(400).json({
            success: false,
            message: "Invalid profile image.",
          });
        }

        if (imageBase64.length > 8 * 1024 * 1024) {
          return res.status(413).json({
            success: false,
            message:
              "Profile image is too large. Please choose a smaller image.",
          });
        }

        if (!imageBase64.startsWith("data:image/")) {
          return res.status(400).json({
            success: false,
            message: "Please upload a valid image file.",
          });
        }

        updateFields.image = await uploadToImgBB(imageBase64);
      } else if (imageUrl !== undefined) {
        if (imageUrl === "") {
          updateFields.image = "";
        } else {
          if (typeof imageUrl !== "string") {
            return res.status(400).json({
              success: false,
              message: "Invalid image URL.",
            });
          }

          try {
            const parsedUrl = new URL(imageUrl);

            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
              throw new Error("Invalid protocol");
            }
          } catch {
            return res.status(400).json({
              success: false,
              message:
                "Please provide a valid HTTP or HTTPS image URL.",
            });
          }

          updateFields.image = imageUrl.trim();
        }
      }

      const db = getDB();

      const updateResult = await db.collection("users").updateOne(
        { email: user.email },
        { $set: updateFields }
      );

      if (updateResult.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User profile not found.",
        });
      }

      const updatedProfile = await db.collection("users").findOne(
        { email: user.email },
        {
          projection: {
            name: 1,
            email: 1,
            image: 1,
            role: 1,
            plan: 1,
            phone: 1,
            bio: 1,
            createdAt: 1,
          },
        }
      );

      return res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        data: updatedProfile,
      });
    } catch (error) {
      console.error("Update profile error:", error);

      return res.status(500).json({
        success: false,
        message: error.message || "Failed to update profile.",
      });
    }
  });

  return router;
}
