import express, { Request, Response } from "express";
import cors from "cors";
import mongoose from "mongoose";
import { reviewRoutes } from "./routes/reviews.js";
import { ratingRoutes } from "./routes/ratings.js";

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "healthy",
    service: "review-service",
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use("/api/reviews", reviewRoutes);
app.use("/api/ratings", ratingRoutes);

// Database connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/reviews";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✓ Connected to MongoDB");
  })
  .catch((error) => {
    console.error("✗ MongoDB connection error:", error);
  });

const PORT = process.env.PORT || 3012;

app.listen(PORT, () => {
  console.log(`🚀 Review service running on http://localhost:${PORT}`);
});

