import express, { Request, Response } from "express";
import { Review } from "../models/Review.js";

const router = express.Router();

// Get aggregate rating for an entity
router.get("/:entityType/:entityId", async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;

    const stats = await Review.aggregate([
      {
        $match: {
          entityType,
          entityId,
          moderationStatus: "approved",
        },
      },
      {
        $group: {
          _id: null,
          averageRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratingDistribution: {
            $push: "$rating",
          },
        },
      },
    ]);

    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          averageRating: 0,
          totalReviews: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      });
    }

    const { averageRating, totalReviews, ratingDistribution } = stats[0];

    // Calculate distribution
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    ratingDistribution.forEach((rating: number) => {
      distribution[rating as keyof typeof distribution]++;
    });

    res.json({
      success: true,
      data: {
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews,
        distribution,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch rating stats",
    });
  }
});

export { router as ratingRoutes };

