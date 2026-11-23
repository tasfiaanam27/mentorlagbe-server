import express from "express";
import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { getDB } from "../config/db.js";

export default function adminRoutes(auth) {
  const router = express.Router();

  async function getAdmin(req) {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    const user = session?.user;

    if (!user) return { error: "unauthenticated" };
    if (user.role !== "admin") return { error: "forbidden" };

    return { user };
  }

  function sendAuthError(res, error) {
    if (error === "unauthenticated") {
      return res.status(401).json({
        success: false,
        message: "Please sign in to access the admin dashboard.",
      });
    }

    if (error === "forbidden") {
      return res.status(403).json({
        success: false,
        message: "Admin access only.",
      });
    }

    return null;
  }

  // GET /api/admin/overview
  router.get("/overview", async (req, res) => {
    try {
      const authResult = await getAdmin(req);
      const authError = sendAuthError(res, authResult.error);
      if (authError) return authError;

      const db = getDB();

      const [
        totalUsers,
        totalTutors,
        pendingTuitions,
        approvedTuitions,
        rejectedTuitions,
        revenueResult,
      ] = await Promise.all([
        db.collection("users").countDocuments(),
        db.collection("users").countDocuments({ role: "tutor" }),
        db.collection("tuitions").countDocuments({
          approvalStatus: "pending",
        }),
        db.collection("tuitions").countDocuments({
          approvalStatus: "approved",
        }),
        db.collection("tuitions").countDocuments({
          approvalStatus: "rejected",
        }),
        db.collection("payments")
          .aggregate([
            { $match: { paymentStatus: "paid" } },
            {
              $group: {
                _id: "$currency",
                totalRevenue: { $sum: "$amount" },
                transactionCount: { $sum: 1 },
              },
            },
          ])
          .toArray(),
      ]);

      return res.status(200).json({
        success: true,
        data: {
          totalUsers,
          totalTutors,
          tuitions: {
            pending: pendingTuitions,
            approved: approvedTuitions,
            rejected: rejectedTuitions,
          },
          revenueByCurrency: revenueResult.map((item) => ({
            currency: (item._id || "usd").toUpperCase(),
            totalRevenue: Number(item.totalRevenue || 0),
            transactionCount: item.transactionCount,
          })),
        },
      });
    } catch (error) {
      console.error("Admin overview error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load admin dashboard statistics.",
      });
    }
  });

  // GET /api/admin/users
  router.get("/users", async (req, res) => {
    try {
      const authResult = await getAdmin(req);
      const authError = sendAuthError(res, authResult.error);
      if (authError) return authError;

      const users = await getDB()
        .collection("users")
        .find(
          {},
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
        )
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (error) {
      console.error("Admin users fetch error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load users.",
      });
    }
  });

  // PATCH /api/admin/users/:id/role
  router.patch("/users/:id/role", async (req, res) => {
    try {
      const authResult = await getAdmin(req);
      const authError = sendAuthError(res, authResult.error);
      if (authError) return authError;

      const { id } = req.params;
      const { role } = req.body || {};

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID.",
        });
      }

      if (!["student", "tutor", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Role must be student, tutor, or admin.",
        });
      }

      const usersCollection = getDB().collection("users");
      const userId = new ObjectId(id);

      const targetUser = await usersCollection.findOne({ _id: userId });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      if (
        String(targetUser._id) === String(authResult.user.id) ||
        targetUser.email?.toLowerCase() ===
          authResult.user.email?.toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own admin role.",
        });
      }

      if (targetUser.role === "admin" && role !== "admin") {
        const adminCount = await usersCollection.countDocuments({
          role: "admin",
        });

        if (adminCount <= 1) {
          return res.status(400).json({
            success: false,
            message: "You cannot remove the last administrator.",
          });
        }
      }

      await usersCollection.updateOne(
        { _id: userId },
        { $set: { role, updatedAt: new Date() } }
      );

      const updatedUser = await usersCollection.findOne(
        { _id: userId },
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
        message: "User role updated successfully.",
        data: updatedUser,
      });
    } catch (error) {
      console.error("Admin role update error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update user role.",
      });
    }
  });

  // GET /api/admin/tuitions
  // Fetch every tuition post, regardless of approval or active status.
  router.get("/tuitions", async (req, res) => {
    try {
      const authResult = await getAdmin(req);
      const authError = sendAuthError(res, authResult.error);
      if (authError) return authError;

      const tuitions = await getDB()
        .collection("tuitions")
        .find({})
        .sort({ createdAt: -1 })
        .toArray();

      return res.status(200).json({
        success: true,
        count: tuitions.length,
        data: tuitions,
      });
    } catch (error) {
      console.error("Admin tuitions fetch error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to load tuition posts.",
      });
    }
  });

  // PATCH /api/admin/tuitions/:id/approval
  // Approve or reject a tuition post.
  router.patch("/tuitions/:id/approval", async (req, res) => {
    try {
      const authResult = await getAdmin(req);
      const authError = sendAuthError(res, authResult.error);
      if (authError) return authError;

      const { id } = req.params;
      const { approvalStatus } = req.body || {};

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid tuition ID.",
        });
      }

      if (!["approved", "rejected"].includes(approvalStatus)) {
        return res.status(400).json({
          success: false,
          message: "Approval status must be approved or rejected.",
        });
      }

      const tuitionsCollection = getDB().collection("tuitions");
      const tuitionId = new ObjectId(id);

      const tuition = await tuitionsCollection.findOne({
        _id: tuitionId,
      });

      if (!tuition) {
        return res.status(404).json({
          success: false,
          message: "Tuition post not found.",
        });
      }

      if (tuition.approvalStatus !== "pending") {
        return res.status(409).json({
          success: false,
          message: "Only pending tuition posts can be reviewed.",
        });
      }

      await tuitionsCollection.updateOne(
        {
          _id: tuitionId,
          approvalStatus: "pending",
        },
        {
          $set: {
            approvalStatus,
            reviewedAt: new Date(),
            reviewedBy: authResult.user.email,
          },
        }
      );

      const updatedTuition = await tuitionsCollection.findOne({
        _id: tuitionId,
      });

      return res.status(200).json({
        success: true,
        message: `Tuition ${approvalStatus} successfully.`,
        data: updatedTuition,
      });
    } catch (error) {
      console.error("Admin tuition approval error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update tuition approval status.",
      });
    }
  });

  return router;
}
