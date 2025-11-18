import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { notificationRoutes } from "./routes/notifications.js";
import { initializeEmailService } from "./services/emailService.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "notification-service",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/notifications", notificationRoutes);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/notifications";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✓ Connected to MongoDB");
  })
  .catch((error) => {
    console.error("✗ MongoDB connection error:", error);
  });

// Initialize services
initializeEmailService();

const PORT = process.env.PORT || 3011;

app.listen(PORT, () => {
  console.log(`🚀 Notification service running on http://localhost:${PORT}`);
});

