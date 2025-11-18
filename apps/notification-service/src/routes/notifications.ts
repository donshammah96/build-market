import express, { Request, Response } from "express";
import { Notification } from "../models/Notification.js";
import { sendEmail } from "../services/emailService.js";

const router = express.Router();

// Get notifications for a user
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { unreadOnly } = req.query;

    const query: any = { userId };
    if (unreadOnly === "true") {
      query.read = false;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      userId,
      read: false,
    });

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch notifications",
    });
  }
});

// Create notification
router.post("/", async (req: Request, res: Response) => {
  try {
    const { userId, type, category, title, content, data } = req.body;

    if (!userId || !type || !category || !title || !content) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    const notification = new Notification({
      userId,
      type,
      category,
      title,
      content,
      data: data || {},
    });

    await notification.save();

    // Send email if type is email
    if (type === "email") {
      // TODO: Get user email from user service
      const userEmail = data?.email || "user@example.com";
      await sendEmail(userEmail, title, content);
      notification.sent = true;
      notification.sentAt = new Date();
      await notification.save();
    }

    // TODO: Send push notification if type is push

    res.status(201).json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to create notification",
    });
  }
});

// Mark notification as read
router.patch("/:id/read", async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to mark notification as read",
    });
  }
});

// Mark all notifications as read for a user
router.patch("/user/:userId/read-all", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    res.json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to mark all notifications as read",
    });
  }
});

// Delete notification
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        error: "Notification not found",
      });
    }

    res.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to delete notification",
    });
  }
});

export { router as notificationRoutes };

