import express, { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, AuthRequest } from "../middleware/auth.js";
import { z } from "zod";
import {
  encryptMessage,
  decryptMessage,
  encryptAttachment,
  decryptAttachment,
} from "../utils/encryption.js";

// Define schemas locally since @repo/types may not be built yet
const AttachmentSchema = z.object({
  url: z.string(),
  filename: z.string(),
  size: z.number(),
  mimeType: z.string(),
  encrypted: z.boolean().optional(),
});

const CreateMessageSchema = z.object({
  conversationId: z.string().min(1, 'Conversation ID is required'),
  senderId: z.string().min(1, 'Sender ID is required'),
  content: z.string().min(1, 'Message content is required'),
  type: z.enum(['text', 'image', 'file']).default('text'),
  attachments: z.array(AttachmentSchema).optional(),
});

const MarkAsReadSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const router = express.Router();

// All message routes require authentication
router.use(authMiddleware);

/**
 * GET /api/messages/conversation/:conversationId
 * Get messages for a conversation with pagination
 */
router.get(
  "/conversation/:conversationId",
  async (req: AuthRequest, res: Response) => {
    try {
      const { conversationId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = (page - 1) * limit;

      // Check if user is a participant in this conversation
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: "Conversation not found",
        });
      }

      if (!conversation.participants.includes(req.userId!)) {
        return res.status(403).json({
          success: false,
          error: "Forbidden - You are not a participant in this conversation",
        });
      }

      const messages = await prisma.message.findMany({
        where: {
          conversationId,
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      });

      const total = await prisma.message.count({
        where: {
          conversationId,
        },
      });

      // Decrypt messages before sending
      const decryptedMessages = messages.map((message: {
        id: string;
        content: string;
        attachments: any[];
        [key: string]: any;
      }) => {
        try {
          const decrypted = {
            ...message,
            content: decryptMessage(message.content),
            attachments: message.attachments.map((att: any) =>
              decryptAttachment(att)
            ),
          };
          return decrypted;
        } catch (error) {
          console.error("Error decrypting message:", error);
          // Return original if decryption fails (backward compatibility)
          return message;
        }
      });

      res.json({
        success: true,
        data: {
          items: decryptedMessages.reverse(), // Return in chronological order
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch messages",
      });
    }
  }
);

/**
 * POST /api/messages
 * Send a message
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const validationResult = CreateMessageSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const { conversationId, senderId, content, type, attachments } =
      validationResult.data;

    // Ensure authenticated user is the sender
    if (senderId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You can only send messages as yourself",
      });
    }

    // Check if conversation exists and user is a participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    if (!conversation.participants.includes(senderId)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You are not a participant in this conversation",
      });
    }

    // Encrypt message content and attachments
    const encryptedContent = encryptMessage(content);
    const encryptedAttachments = attachments
      ? attachments.map((att: { url: string; filename: string; size: number; mimeType: string }) => {
          const encrypted = encryptAttachment(att);
          // Remove 'encrypted' flag as it's not in Prisma schema
          return {
            url: encrypted.url,
            filename: encrypted.filename,
            size: encrypted.size,
            mimeType: encrypted.mimeType,
          };
        })
      : [];

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
        content: encryptedContent,
        type: type || "text",
        attachments: encryptedAttachments,
        readBy: [senderId], // Sender has read their own message
      },
    });

    // Update conversation
    const unreadCount = conversation.unreadCount as Record<string, number>;

    // Increment unread count for other participants
    conversation.participants.forEach((participantId: string) => {
      if (participantId !== senderId) {
        const currentCount = unreadCount[participantId] || 0;
        unreadCount[participantId] = currentCount + 1;
      }
    });

    await prisma.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessage: content, // Store preview as plaintext (or encrypted if preferred)
        lastMessageAt: new Date(),
        unreadCount,
      },
    });

    // Return decrypted message
    const decryptedMessage = {
      ...message,
      content: decryptMessage(message.content),
      attachments: message.attachments.map((att: any) =>
        decryptAttachment(att)
      ),
    };

    res.status(201).json({
      success: true,
      data: decryptedMessage,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to send message",
    });
  }
});

/**
 * POST /api/messages/:id/read
 * Mark message as read
 */
router.post("/:id/read", async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const validationResult = MarkAsReadSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const { userId } = validationResult.data;

    // Ensure user can only mark their own messages as read
    if (userId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You can only mark your own messages as read",
      });
    }

    const message = await prisma.message.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // Check if user is a participant in the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
    });

    if (!conversation || !conversation.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You are not a participant in this conversation",
      });
    }

    let updatedMessage = message;
    if (!message.readBy.includes(userId)) {
      updatedMessage = await prisma.message.update({
        where: {
          id: req.params.id,
        },
        data: {
          readBy: [...message.readBy, userId],
        },
      });
    }

    // Decrypt before sending
    const decryptedMessage = {
      ...updatedMessage,
      content: decryptMessage(updatedMessage.content),
      attachments: updatedMessage.attachments.map((att: any) =>
        decryptAttachment(att)
      ),
    };

    res.json({
      success: true,
      data: decryptedMessage,
      message: "Message marked as read",
    });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark message as read",
    });
  }
});

/**
 * GET /api/messages/:id
 * Get a single message by ID
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // Check if user is a participant in the conversation
    const conversation = await prisma.conversation.findUnique({
      where: { id: message.conversationId },
    });

    if (!conversation || !conversation.participants.includes(req.userId!)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You are not a participant in this conversation",
      });
    }

    // Decrypt before sending
    const decryptedMessage = {
      ...message,
      content: decryptMessage(message.content),
      attachments: message.attachments.map((att: any) => {
        const decrypted = decryptAttachment(att);
        // Remove 'encrypted' flag from response
        return {
          url: decrypted.url,
          filename: decrypted.filename,
          size: decrypted.size,
          mimeType: decrypted.mimeType,
        };
      }),
    };

    res.json({
      success: true,
      data: decryptedMessage,
    });
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch message",
    });
  }
});

/**
 * DELETE /api/messages/:id
 * Delete a message (only by sender)
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const message = await prisma.message.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        error: "Message not found",
      });
    }

    // Only the sender can delete their message
    if (message.senderId !== req.userId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You can only delete your own messages",
      });
    }

    await prisma.message.delete({
      where: {
        id: req.params.id,
      },
    });

    res.json({
      success: true,
      message: "Message deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete message",
    });
  }
});

export { router as messageRoutes };
