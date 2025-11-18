import mongoose, { Schema, Document } from "mongoose";

export interface IMessage extends Document {
  conversationId: string;
  senderId: string;
  content: string;
  type: "text" | "image" | "file";
  attachments?: Array<{
    url: string;
    filename: string;
    size: number;
    mimeType: string;
  }>;
  readBy: string[]; // User IDs who have read the message
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    conversationId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "file"],
      default: "text",
    },
    attachments: [
      {
        url: String,
        filename: String,
        size: Number,
        mimeType: String,
      },
    ],
    readBy: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1 });

export const Message = mongoose.model<IMessage>("Message", messageSchema);

