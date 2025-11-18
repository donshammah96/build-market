import express, { Request, Response } from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { prisma } from "./lib/prisma.js";
import { conversationRoutes } from "./routes/conversations.js";
import { messageRoutes } from "./routes/messages.js";
import { setupSocketHandlers } from "./websocket/socketHandler.js";
import { authMiddleware } from "./middleware/auth.js"


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3002",
    methods: ["GET", "POST"],
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "messaging-service",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);

// WebSocket setup
setupSocketHandlers(io);

// Database connection
async function connectToDatabase() {
  try {
    await prisma.$connect();
    console.log("Connected to MongoDB via Prisma");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 3010;

// Start server
async function startServer() {
  await connectToDatabase();
  
  httpServer.listen(PORT, () => {
    console.log(`Messaging service running on http://localhost:${PORT}`);
    console.log(`WebSocket server ready`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

export { io };

