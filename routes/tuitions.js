import express from "express";
import { getDB } from "../config/db.js";

const router = express.Router();

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/tuitions
// Supports search, subject, classLevel, mode and limit
router.get("/", async (req, res) => {
  try {
    const db = getDB();

    const {
      search = "",
      subject = "",
      classLevel = "",
      mode = "",
      limit = "0",
    } = req.query;

    const filter = {
      approvalStatus: "approved",
      isActive: true,
    };

    if (search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), "i");
      filter.$or = [
        { title: searchRegex },
        { subject: searchRegex },
      ];
    }

    if (subject.trim()) {
      filter.subject = subject.trim();
    }

    if (classLevel.trim()) {
      filter.classLevel = classLevel.trim();
    }

    if (mode.trim()) {
      if (!["Online", "Offline"].includes(mode.trim())) {
        return res.status(400).json({
          success: false,
          message: "Mode must be Online or Offline.",
        });
      }

      filter.mode = mode.trim();
    }

    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit =
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 0;

    let query = db
      .collection("tuitions")
      .find(filter)
      .sort({ createdAt: -1 });

    if (safeLimit) {
      query = query.limit(safeLimit);
    }

    const tuitions = await query.toArray();

    return res.status(200).json({
      success: true,
      count: tuitions.length,
      data: tuitions,
    });
  } catch (error) {
    console.error("Get tuitions error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tuitions.",
    });
  }
});

// GET /api/tuitions/:id
router.get("/:id", async (req, res) => {
  try {
    const { ObjectId } = await import("mongodb");

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid tuition ID.",
      });
    }

    const tuition = await getDB()
      .collection("tuitions")
      .findOne({
        _id: new ObjectId(req.params.id),
        approvalStatus: "approved",
        isActive: true,
      });

    if (!tuition) {
      return res.status(404).json({
        success: false,
        message: "Tuition not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: tuition,
    });
  } catch (error) {
    console.error("Get tuition details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch tuition details.",
    });
  }
});

export default router;
