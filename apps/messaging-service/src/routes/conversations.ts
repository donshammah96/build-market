import express, { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, AuthRequest, checkConversationAccess } from "../middleware/auth.js";
import { z } from "zod";

// Define schemas locally since @repo/types may not be built yet
const CreateConversationSchema = z.object({
  participants: z.array(z.string()).min(2, 'At least 2 participants required'),
  projectId: z.string().optional(),
});

const MarkAsReadSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
});

const router = express.Router();

// All conversation routes require authentication
router.use(authMiddleware);

/**
 * GET /api/conversations/user/:userId
 * Get all conversations for a user
 */
router.get(
  "/user/:userId",
  checkConversationAccess(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            has: userId,
          },
        },
        orderBy: {
          lastMessageAt: "desc",
        },
        take: 50,
      });

      res.json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch conversations",
      });
    }
  }
);

/**
 * POST /api/conversations
 * Create or get a conversation
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    // Validate request body
    const validationResult = CreateConversationSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.issues,
      });
    }

    const { participants, projectId } = validationResult.data;

    // Ensure the authenticated user is one of the participants
    if (!participants.includes(req.userId!)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You must be a participant in the conversation",
      });
    }

    // Check if conversation already exists (same participants)
    const existing = await prisma.conversation.findFirst({
      where: {
        AND: participants.map((p: string) => ({
          participants: { has: p },
        })),
      },
    });

    if (existing && existing.participants.length === participants.length) {
      return res.json({
        success: true,
        data: existing,
        message: "Conversation already exists",
      });
    }

    // Create new conversation with unreadCount initialized for each participant
    const unreadCount: Record<string, number> = {};
    participants.forEach((p: string) => {
      unreadCount[p] = 0;
    });

    const conversation = await prisma.conversation.create({
      data: {
        participants,
        unreadCount,
        ...(projectId && { projectId }),
      },
    });

    res.status(201).json({
      success: true,
      data: conversation,
      message: "Conversation created successfully",
    });
  } catch (error) {
    console.error("Error creating conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create conversation",
    });
  }
});

/**
 * GET /api/conversations/:id
 * Get conversation by ID
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Check if user is a participant
    if (!conversation.participants.includes(req.userId!)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You are not a participant in this conversation",
      });
    }

    res.json({
      success: true,
      data: conversation,
    });
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch conversation",
    });
  }
});

/**
 * POST /api/conversations/:id/read
 * Mark conversation as read
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

    const conversation = await prisma.conversation.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Check if user is a participant
    if (!conversation.participants.includes(userId)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You are not a participant in this conversation",
      });
    }

    // Update unreadCount
    const unreadCount = conversation.unreadCount as Record<string, number>;
    unreadCount[userId] = 0;

    const updatedConversation = await prisma.conversation.update({
      where: {
        id: req.params.id,
      },
      data: {
        unreadCount,
      },
    });

    // Mark all messages in this conversation as read for this user
    const messages = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        senderId: {
          not: userId,
        },
      },
    });

    // Update each message to add userId to readBy array if not already present
    await Promise.all(
      messages.map((message: { id: string; readBy: string[] }) => {
        if (!message.readBy.includes(userId)) {
          return prisma.message.update({
            where: { id: message.id },
            data: {
              readBy: [...message.readBy, userId],
            },
          });
        }
        return Promise.resolve();
      })
    );

    res.json({
      success: true,
      data: updatedConversation,
      message: "Conversation marked as read",
    });
  } catch (error) {
    console.error("Error marking conversation as read:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark as read",
    });
  }
});

/**
 * DELETE /api/conversations/:id
 * Delete a conversation (soft delete - removes user from participants)
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: {
        id: req.params.id,
      },
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: "Conversation not found",
      });
    }

    // Check if user is a participant
    if (!conversation.participants.includes(req.userId!)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden - You are not a participant in this conversation",
      });
    }

    // Remove user from participants
    const updatedParticipants = conversation.participants.filter(
      (p: string) => p !== req.userId
    );

    // If no participants left, delete the conversation and all messages
    if (updatedParticipants.length === 0) {
      await prisma.message.deleteMany({
        where: {
          conversationId: req.params.id,
        },
      });

      await prisma.conversation.delete({
        where: {
          id: req.params.id,
        },
      });

      return res.json({
        success: true,
        message: "Conversation deleted successfully",
      });
    }

    // Update participants
    await prisma.conversation.update({
      where: {
        id: req.params.id,
      },
      data: {
        participants: updatedParticipants,
      },
    });

    res.json({
      success: true,
      message: "You have left the conversation",
    });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete conversation",
    });
  }
});

export { router as conversationRoutes };
