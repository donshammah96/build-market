import { Server, Socket } from "socket.io";
import { prisma } from "../lib/prisma.js";
import {
  encryptMessage,
  decryptMessage,
  encryptAttachment,
  decryptAttachment,
} from "../utils/encryption.js";
import jwt from "jsonwebtoken";

interface SocketData {
  userId: string;
  email?: string;
}

export function setupSocketHandlers(io: Server) {
  // Store online users
  const onlineUsers = new Map<string, string>(); // userId -> socketId

  io.on("connection", async (socket: Socket) => {
    console.log("Client connected:", socket.id);

    // Authenticate user via token
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.substring(7);
    
    if (!token) {
      console.log("No authentication token provided");
      socket.disconnect();
      return;
    }

    try {
      // Verify token
      const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
      if (!secret) {
        console.log("Server configuration error: missing secret");
        socket.disconnect();
        return;
      }

      const decoded = jwt.verify(token, secret) as {
        sub?: string;
        email?: string;
      };

      if (!decoded || !decoded.sub) {
        console.log("Invalid token");
        socket.disconnect();
        return;
      }

      const userId = decoded.sub;
      socket.data.userId = userId;
      socket.data.email = decoded.email;
      onlineUsers.set(userId, socket.id);

      // Join rooms for all user's conversations
      const conversations = await prisma.conversation.findMany({
        where: {
          participants: { has: userId },
        },
      });

      conversations.forEach((conv: { id: string }) => {
        socket.join(`conversation:${conv.id}`);
      });

      console.log(`User ${userId} authenticated and connected`);

      // Emit online status to all users
      io.emit("user:online", userId);

      // Send connection confirmation
      socket.emit("authenticated", {
        userId,
        conversationCount: conversations.length,
      });
    } catch (error) {
      console.error("Socket authentication error:", error);
      socket.disconnect();
      return;
    }

    // Legacy authentication event (for backward compatibility)
    socket.on("authenticate", async (data: { userId?: string; token?: string }) => {
      if (socket.data.userId) {
        // Already authenticated
        return;
      }

      const authToken = data.token;
      if (!authToken) {
        socket.emit("error", { message: "Authentication token required" });
        return;
      }

      try {
        const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
        if (!secret) {
          socket.emit("error", { message: "Server configuration error" });
          return;
        }

        const decoded = jwt.verify(authToken, secret) as {
          sub?: string;
          email?: string;
        };

        if (!decoded || !decoded.sub) {
          socket.emit("error", { message: "Invalid authentication token" });
          return;
        }

        const userId = decoded.sub;
        socket.data.userId = userId;
        socket.data.email = decoded.email;
        onlineUsers.set(userId, socket.id);

        // Join rooms for all user's conversations
        const conversations = await prisma.conversation.findMany({
          where: {
            participants: { has: userId },
          },
        });

        conversations.forEach((conv: { id: string }) => {
          socket.join(`conversation:${conv.id}`);
        });

        console.log(`User ${userId} authenticated via event`);
        io.emit("user:online", userId);
        socket.emit("authenticated", { userId });
      } catch (error) {
        console.error("Authentication error:", error);
        socket.emit("error", { message: "Authentication failed" });
      }
    });

    // Join a conversation room
    socket.on("join:conversation", (conversationId: string) => {
      socket.join(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on("leave:conversation", (conversationId: string) => {
      socket.leave(`conversation:${conversationId}`);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Send message
    socket.on("message:send", async (data: {
      conversationId: string;
      senderId: string;
      content: string;
      type?: "text" | "image" | "file";
      attachments?: any[];
    }) => {
      try {
        // Verify sender is authenticated user
        if (!socket.data.userId || socket.data.userId !== data.senderId) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        // Verify user is participant in conversation
        const conversation = await prisma.conversation.findUnique({
          where: { id: data.conversationId },
        });

        if (!conversation) {
          socket.emit("error", { message: "Conversation not found" });
          return;
        }

        if (!conversation.participants.includes(data.senderId)) {
          socket.emit("error", { message: "Forbidden - Not a participant" });
          return;
        }

        // Encrypt message content and attachments
        const encryptedContent = encryptMessage(data.content);
        const encryptedAttachments = data.attachments
          ? data.attachments.map((att) => encryptAttachment(att))
          : [];

        // Create message
        const message = await prisma.message.create({
          data: {
            conversationId: data.conversationId,
            senderId: data.senderId,
            content: encryptedContent,
            type: data.type || "text",
            attachments: encryptedAttachments,
            readBy: [data.senderId],
          },
        });

        // Update conversation
        const unreadCount = conversation.unreadCount as Record<string, number>;

        // Increment unread count for other participants
        conversation.participants.forEach((participantId: string) => {
          if (participantId !== data.senderId) {
            const currentCount = unreadCount[participantId] || 0;
            unreadCount[participantId] = currentCount + 1;
          }
        });

        const updatedConversation = await prisma.conversation.update({
          where: { id: data.conversationId },
          data: {
            lastMessage: data.content, // Store preview as plaintext
            lastMessageAt: new Date(),
            unreadCount,
          },
        });

        // Decrypt message before emitting
        const decryptedMessage = {
          ...message,
          content: decryptMessage(message.content),
          attachments: message.attachments.map((att: any) =>
            decryptAttachment(att)
          ),
        };

        // Emit to conversation room
        io.to(`conversation:${data.conversationId}`).emit("message:new", {
          message: decryptedMessage,
          conversation: updatedConversation,
        });

        // Send push notification to offline users
        conversation.participants.forEach((participantId: string) => {
          if (participantId !== data.senderId && !onlineUsers.has(participantId)) {
            // TODO: Integrate with notification-service
            console.log(`Send push notification to ${participantId}`);
          }
        });
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Typing indicator
    socket.on("typing:start", (data: {
      conversationId: string;
      userId: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:start", {
        conversationId: data.conversationId,
        userId: data.userId,
      });
    });

    socket.on("typing:stop", (data: {
      conversationId: string;
      userId: string;
    }) => {
      socket.to(`conversation:${data.conversationId}`).emit("typing:stop", {
        conversationId: data.conversationId,
        userId: data.userId,
      });
    });

    // Mark messages as read
    socket.on("messages:read", async (data: {
      conversationId: string;
      userId: string;
    }) => {
      try {
        // Verify user is authenticated and matches
        if (!socket.data.userId || socket.data.userId !== data.userId) {
          socket.emit("error", { message: "Unauthorized" });
          return;
        }

        // Verify user is participant in conversation
        const conversation = await prisma.conversation.findUnique({
          where: { id: data.conversationId },
        });

        if (!conversation || !conversation.participants.includes(data.userId)) {
          socket.emit("error", { message: "Forbidden - Not a participant" });
          return;
        }

        // Find messages that need to be marked as read
        const messages = await prisma.message.findMany({
          where: {
            conversationId: data.conversationId,
            senderId: { not: data.userId },
          },
        });

        // Filter messages where userId is not in readBy
        const unreadMessages = messages.filter(
          (msg: any) => !msg.readBy.includes(data.userId)
        );

        // Update each unread message
        await Promise.all(
          unreadMessages.map((message: any) =>
            prisma.message.update({
              where: { id: message.id },
              data: {
                readBy: [...message.readBy, data.userId],
              },
            })
          )
        );

        // Update conversation unread count
        const unreadCount = conversation.unreadCount as Record<string, number>;
        unreadCount[data.userId] = 0;

        await prisma.conversation.update({
          where: { id: data.conversationId },
          data: { unreadCount },
        });

        // Notify other participants
        socket.to(`conversation:${data.conversationId}`).emit("messages:read", {
          conversationId: data.conversationId,
          userId: data.userId,
        });
      } catch (error) {
        console.error("Error marking messages as read:", error);
        socket.emit("error", { message: "Failed to mark messages as read" });
      }
    });

    // Disconnect
    socket.on("disconnect", () => {
      const userId = socket.data.userId;
      if (userId) {
        onlineUsers.delete(userId);
        io.emit("user:offline", userId);
        console.log(`User ${userId} disconnected`);
      }
      console.log("Client disconnected:", socket.id);
    });
  });
}

