import mongoose, { Schema, Document } from "mongoose";

export interface IReview extends Document {
  userId: string;
  userName: string;
  entityType: "professional" | "store" | "product";
  entityId: string;
  rating: number;
  title?: string;
  content: string;
  pros?: string[];
  cons?: string[];
  images?: string[];
  verified: boolean;
  helpful: number;
  helpfulBy: string[];
  flagged: boolean;
  moderationStatus: "pending" | "approved" | "rejected";
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    entityType: {
      type: String,
      enum: ["professional", "store", "product"],
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    title: String,
    content: {
      type: String,
      required: true,
      minlength: 10,
    },
    pros: [String],
    cons: [String],
    images: [String],
    verified: {
      type: Boolean,
      default: false,
    },
    helpful: {
      type: Number,
      default: 0,
    },
    helpfulBy: {
      type: [String],
      default: [],
    },
    flagged: {
      type: Boolean,
      default: false,
    },
    moderationStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
reviewSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, entityType: 1, entityId: 1 }, { unique: true });
reviewSchema.index({ moderationStatus: 1, createdAt: -1 });

export const Review = mongoose.model<IReview>("Review", reviewSchema);

