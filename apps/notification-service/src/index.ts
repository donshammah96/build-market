import "dotenv/config";
import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { notificationRoutes } from "./routes/notifications.js";
import {
  initializeEmailService,
  verifyEmailConnection,
  sendTemplatedEmail,
} from "./services/emailService.js";
import {
  initializeNatsConsumer,
  shutdownNatsConsumer,
} from "./services/natsConsumer.js";

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

// Test email endpoint (for development only)
app.post("/api/test-email", async (req: Request, res: Response) => {
  const { to, subject, message } = req.body;

  if (!to) {
    res.status(400).json({ error: "Email recipient (to) is required" });
    return;
  }

  const success = await sendTemplatedEmail(to, {
    subject: subject || "Test Email from Build Market",
    title: "Test Email",
    body: `<p>${message || "This is a test email from Build Market notification service."}</p>`,
    ctaText: "Visit Build Market",
    ctaLink: "https://buildmarket.com",
  });

  if (success) {
    res.json({ success: true, message: `Test email sent to ${to}` });
  } else {
    res.status(500).json({ success: false, error: "Failed to send email" });
  }
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
const emailInitialized = initializeEmailService();

// Verify email connection (non-blocking)
if (emailInitialized) {
  verifyEmailConnection().catch((err) => {
    console.error("Email verification failed:", err);
  });
}

// Initialize NATS consumer (async, non-blocking)
initializeNatsConsumer().catch((err) => {
  console.error("NATS initialization failed:", err);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM received, shutting down gracefully...");
  await shutdownNatsConsumer();
  await mongoose.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT received, shutting down gracefully...");
  await shutdownNatsConsumer();
  await mongoose.disconnect();
  process.exit(0);
});

const PORT = process.env.PORT || 3011;

app.listen(PORT, () => {
  console.log(`🚀 Notification service running on http://localhost:${PORT}`);
});

