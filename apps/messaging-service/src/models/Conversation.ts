import mongoose, { Schema, Document } from "mongoose";

export interface IConversation extends Document {
  participants: string[];
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [String],
      required: true,
      validate: {
        validator: (v: string[]) => v.length >= 2,
        message: "A conversation must have at least 2 participants",
      },
    },
    lastMessage: String,
    lastMessageAt: Date,
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });

export const Conversation = mongoose.model<IConversation>(
  "Conversation",
  conversationSchema
);

