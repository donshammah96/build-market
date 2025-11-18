import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import searchRoutes from "./routes/search.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import webhookRoutes from "./routes/webhook.routes.js";
import elasticsearchService from "./services/elasticsearch.service.js";
import { testConnection } from "./config/elasticsearch.js";

const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// Health check
app.get("/health", async (c) => {
  const esHealthy = await testConnection();
  
  return c.json({
    status: esHealthy ? "healthy" : "unhealthy",
    service: "search-service",
    timestamp: new Date().toISOString(),
    elasticsearch: esHealthy ? "connected" : "disconnected",
  });
});

// Routes
app.route("/api/search", searchRoutes);
app.route("/api/admin", adminRoutes);
app.route("/api/webhook", webhookRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Not Found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json(
    {
      error: err.message || "Internal Server Error",
    },
    500
  );
});

// Start server
const PORT = parseInt(process.env.PORT || "3005");

const start = async () => {
  try {
    // Test Elasticsearch connection
    const esConnected = await testConnection();
    if (!esConnected) {
      console.warn("⚠️  Elasticsearch not connected. Some features may not work.");
    }

    // Initialize indices
    if (esConnected) {
      await elasticsearchService.initializeIndices();
    }

    // Start HTTP server
    serve({
      fetch: app.fetch,
      port: PORT,
    });

    console.log(`🚀 Search Service running on http://localhost:${PORT}`);
    console.log(`📚 API Endpoints:`);
    console.log(`\n🔍 Search Endpoints:`);
    console.log(`   - GET  /api/search/professionals`);
    console.log(`   - GET  /api/search/stores`);
    console.log(`   - GET  /api/search/products`);
    console.log(`   - GET  /api/search/idea-books`);
    console.log(`   - GET  /api/search/autocomplete`);
    console.log(`\n🔧 Admin Endpoints:`);
    console.log(`   - POST /api/admin/index/:type/:id`);
    console.log(`   - POST /api/admin/bulk-index/:type`);
    console.log(`   - POST /api/admin/indices/initialize`);
    console.log(`   - GET  /api/admin/cache/stats`);
    console.log(`   - POST /api/admin/cache/clear`);
    console.log(`\n🔗 Webhook Endpoints:`);
    console.log(`   - POST /api/webhook/professional/:action`);
    console.log(`   - POST /api/webhook/store/:action`);
    console.log(`   - POST /api/webhook/product/:action`);
    console.log(`   - POST /api/webhook/ideabook/:action`);
    console.log(`\n💚 Health:`);
    console.log(`   - GET  /health`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();

