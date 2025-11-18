import { Hono } from "hono";
import syncHandler from "../sync/sync-handler.js";

const webhookRoutes = new Hono();

// Webhook for professional events
webhookRoutes.post("/professional/:action", async (c) => {
  try {
    const action = c.req.param("action") as "create" | "update" | "delete";
    const data = await c.req.json();
    
    if (!["create", "update", "delete"].includes(action)) {
      return c.json({ success: false, error: "Invalid action" }, 400);
    }
    
    await syncHandler.syncProfessional(action, data);
    
    return c.json({
      success: true,
      message: `Professional ${action}d successfully`,
    });
  } catch (error: any) {
    console.error("Professional webhook error:", error);
    return c.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      500
    );
  }
});

// Webhook for store events
webhookRoutes.post("/store/:action", async (c) => {
  try {
    const action = c.req.param("action") as "create" | "update" | "delete";
    const data = await c.req.json();
    
    if (!["create", "update", "delete"].includes(action)) {
      return c.json({ success: false, error: "Invalid action" }, 400);
    }
    
    await syncHandler.syncStore(action, data);
    
    return c.json({
      success: true,
      message: `Store ${action}d successfully`,
    });
  } catch (error: any) {
    console.error("Store webhook error:", error);
    return c.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      500
    );
  }
});

// Webhook for product events
webhookRoutes.post("/product/:action", async (c) => {
  try {
    const action = c.req.param("action") as "create" | "update" | "delete";
    const data = await c.req.json();
    
    if (!["create", "update", "delete"].includes(action)) {
      return c.json({ success: false, error: "Invalid action" }, 400);
    }
    
    await syncHandler.syncProduct(action, data);
    
    return c.json({
      success: true,
      message: `Product ${action}d successfully`,
    });
  } catch (error: any) {
    console.error("Product webhook error:", error);
    return c.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      500
    );
  }
});

// Webhook for idea book events
webhookRoutes.post("/ideabook/:action", async (c) => {
  try {
    const action = c.req.param("action") as "create" | "update" | "delete";
    const data = await c.req.json();
    
    if (!["create", "update", "delete"].includes(action)) {
      return c.json({ success: false, error: "Invalid action" }, 400);
    }
    
    await syncHandler.syncIdeaBook(action, data);
    
    return c.json({
      success: true,
      message: `Idea book ${action}d successfully`,
    });
  } catch (error: any) {
    console.error("Idea book webhook error:", error);
    return c.json(
      {
        success: false,
        error: error.message || "Failed to process webhook",
      },
      500
    );
  }
});

export default webhookRoutes;

