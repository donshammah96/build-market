import express, { Request, Response } from "express";
import { Review } from "../models/Review.js";

const router = express.Router();

// Get reviews for an entity
router.get("/:entityType/:entityId", async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const reviews = await Review.find({
      entityType,
      entityId,
      moderationStatus: "approved",
    })
      .sort({ helpful: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Review.countDocuments({
      entityType,
      entityId,
      moderationStatus: "approved",
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch reviews",
    });
  }
});

// Create review
router.post("/", async (req: Request, res: Response) => {
  try {
    const {
      userId,
      userName,
      entityType,
      entityId,
      rating,
      title,
      content,
      pros,
      cons,
      images,
    } = req.body;

    if (!userId || !userName || !entityType || !entityId || !rating || !content) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Check if user already reviewed this entity
    const existing = await Review.findOne({
      userId,
      entityType,
      entityId,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: "You have already reviewed this",
      });
    }

    const review = new Review({
      userId,
      userName,
      entityType,
      entityId,
      rating,
      title,
      content,
      pros: pros || [],
      cons: cons || [],
      images: images || [],
    });

    await review.save();

    // TODO: Update entity rating in search-service

    res.status(201).json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to create review",
    });
  }
});

// Mark review as helpful
router.post("/:id/helpful", async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const review = await Review.findById(req.params.id);

    if (!review) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    if (review.helpfulBy.includes(userId)) {
      return res.status(400).json({
        success: false,
        error: "Already marked as helpful",
      });
    }

    review.helpful += 1;
    review.helpfulBy.push(userId);
    await review.save();

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to mark review as helpful",
    });
  }
});

// Flag review
router.post("/:id/flag", async (req: Request, res: Response) => {
  try {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { flagged: true },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to flag review",
    });
  }
});

// Moderate review (admin)
router.patch("/:id/moderate", async (req: Request, res: Response) => {
  try {
    const { moderationStatus } = req.body;

    if (!["pending", "approved", "rejected"].includes(moderationStatus)) {
      return res.status(400).json({
        success: false,
        error: "Invalid moderation status",
      });
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { moderationStatus },
      { new: true }
    );

    if (!review) {
      return res.status(404).json({
        success: false,
        error: "Review not found",
      });
    }

    res.json({
      success: true,
      data: review,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to moderate review",
    });
  }
});

export { router as reviewRoutes };

