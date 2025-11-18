import mongoose, { Schema, Document } from "mongoose";

export interface INotification extends Document {
  userId: string;
  type: "email" | "push" | "in_app";
  category: "order" | "message" | "project" | "review" | "system";
  title: string;
  content: string;
  data?: Record<string, any>;
  read: boolean;
  sent: boolean;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["email", "push", "in_app"],
      required: true,
    },
    category: {
      type: String,
      enum: ["order", "message", "project", "review", "system"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    sent: {
      type: Boolean,
      default: false,
      index: true,
    },
    sentAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ sent: 1, type: 1 });

export const Notification = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

