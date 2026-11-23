import express from "express";
import { ObjectId } from "mongodb";
import { getDB } from "../config/db.js";

const router = express.Router();

const escapeRegex = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// GET /api/tuitions
// Supports search, subject, classLevel, mode, legacy limit,
// and server-side pagination using page and perPage.
router.get("/", async (req, res) => {
  try {
    const db = getDB();
    const {
      search = "",
      subject = "",
      classLevel = "",
      mode = "",
      limit = "0",
      page,
      perPage,
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

    const collection = db.collection("tuitions");

    // Pagination is enabled when page or perPage is supplied.
    const paginationRequested = page !== undefined || perPage !== undefined;

    if (paginationRequested) {
      const parsedPage = Number.parseInt(page || "1", 10);
      const parsedPerPage = Number.parseInt(perPage || "6", 10);

      if (
        !Number.isInteger(parsedPage) ||
        parsedPage < 1 ||
        !Number.isInteger(parsedPerPage) ||
        parsedPerPage < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Page and perPage must be positive integers.",
        });
      }

      const safePerPage = Math.min(parsedPerPage, 100);
      const totalItems = await collection.countDocuments(filter);
      const totalPages = Math.ceil(totalItems / safePerPage);
      const currentPage = Math.min(
        parsedPage,
        Math.max(totalPages, 1)
      );
      const skip = (currentPage - 1) * safePerPage;

      const tuitions = await collection
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safePerPage)
        .toArray();

      return res.status(200).json({
        success: true,
        count: tuitions.length,
        data: tuitions,
        pagination: {
          currentPage,
          perPage: safePerPage,
          totalItems,
          totalPages,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      });
    }

    // Preserve the previous API behavior for existing consumers.
    const parsedLimit = Number.parseInt(limit, 10);
    const safeLimit =
      Number.isInteger(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : 0;

    let query = collection
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

