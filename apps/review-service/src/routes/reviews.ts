import express, { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { Review } from "../models/Review.js";

const router = express.Router();

const entityTypeSchema = z.enum(["professional", "store", "product"]);
const moderationStatusSchema = z.enum(["pending", "approved", "rejected"]);

const reviewListParamsSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().trim().min(1).max(200),
});

const reviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const reviewIdParamsSchema = z.object({
  id: z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
    message: "Invalid review id",
  }),
});

const createReviewBodySchema = z.object({
  userId: z.string().trim().min(1).max(128),
  userName: z.string().trim().min(1).max(128),
  entityType: entityTypeSchema,
  entityId: z.string().trim().min(1).max(200),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(10).max(5000),
  pros: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  cons: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
  images: z.array(z.string().trim().min(1).max(500)).max(20).optional(),
});

const helpfulBodySchema = z.object({
  userId: z.string().trim().min(1).max(128),
});

const moderateBodySchema = z.object({
  moderationStatus: moderationStatusSchema,
});

function getValidationMessage(error: z.ZodError): string {
  return error.issues[0]?.message || "Invalid request payload";
}

const reviewReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: "Too many review read requests. Please try again shortly.",
    });
  },
});

const reviewMutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: "Too many review write requests. Please try again shortly.",
    });
  },
});

// Get reviews for an entity
router.get(
  "/:entityType/:entityId",
  reviewReadLimiter,
  async (req: Request, res: Response) => {
  try {
    const paramsResult = reviewListParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(paramsResult.error),
      });
    }

    const queryResult = reviewListQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(queryResult.error),
      });
    }

    const { entityType, entityId } = paramsResult.data;
    const { page, limit } = queryResult.data;
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
  },
);

// Create review
router.post("/", reviewMutationLimiter, async (req: Request, res: Response) => {
  try {
    const bodyResult = createReviewBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(bodyResult.error),
      });
    }

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
    } = bodyResult.data;

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
router.post(
  "/:id/helpful",
  reviewMutationLimiter,
  async (req: Request, res: Response) => {
  try {
    const paramsResult = reviewIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(paramsResult.error),
      });
    }

    const bodyResult = helpfulBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(bodyResult.error),
      });
    }

    const { id } = paramsResult.data;
    const { userId } = bodyResult.data;
    const review = await Review.findById(id);

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
  },
);

// Flag review
router.post("/:id/flag", reviewMutationLimiter, async (req: Request, res: Response) => {
  try {
    const paramsResult = reviewIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(paramsResult.error),
      });
    }

    const { id } = paramsResult.data;
    const review = await Review.findByIdAndUpdate(
      id,
      { flagged: true },
      { new: true },
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
router.patch(
  "/:id/moderate",
  reviewMutationLimiter,
  async (req: Request, res: Response) => {
  try {
    const paramsResult = reviewIdParamsSchema.safeParse(req.params);
    if (!paramsResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(paramsResult.error),
      });
    }

    const bodyResult = moderateBodySchema.safeParse(req.body);
    if (!bodyResult.success) {
      return res.status(400).json({
        success: false,
        error: getValidationMessage(bodyResult.error),
      });
    }

    const { id } = paramsResult.data;
    const { moderationStatus } = bodyResult.data;

    const review = await Review.findByIdAndUpdate(
      id,
      { moderationStatus },
      { new: true },
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
  },
);

export { router as reviewRoutes };
