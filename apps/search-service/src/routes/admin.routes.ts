import { Hono } from "hono";
import elasticsearchService from "../services/elasticsearch.service.js";
import cacheService from "../services/cache.service.js";
import { INDICES } from "../config/elasticsearch.js";

const adminRoutes = new Hono();

// Index a document
adminRoutes.post("/index/:type/:id", async (c) => {
  try {
    const { type, id } = c.req.param();
    const document = await c.req.json();
    
    const indexMap: Record<string, string> = {
      professional: INDICES.PROFESSIONALS,
      store: INDICES.STORES,
      product: INDICES.PRODUCTS,
      ideabook: INDICES.IDEA_BOOKS,
    };
    
    const index = indexMap[type];
    if (!index) {
      return c.json({ success: false, error: "Invalid type" }, 400);
    }
    
    await elasticsearchService.indexDocument(index, id, document);
    await cacheService.invalidate(type);
    
    return c.json({
      success: true,
      message: `Document indexed successfully`,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to index document",
      },
      500
    );
  }
});

// Bulk index documents
adminRoutes.post("/bulk-index/:type", async (c) => {
  try {
    const { type } = c.req.param();
    const documents = await c.req.json();
    
    if (!Array.isArray(documents)) {
      return c.json({ success: false, error: "Documents must be an array" }, 400);
    }
    
    const indexMap: Record<string, string> = {
      professional: INDICES.PROFESSIONALS,
      store: INDICES.STORES,
      product: INDICES.PRODUCTS,
      ideabook: INDICES.IDEA_BOOKS,
    };
    
    const index = indexMap[type];
    if (!index) {
      return c.json({ success: false, error: "Invalid type" }, 400);
    }
    
    const result = await elasticsearchService.bulkIndex(index, documents);
    await cacheService.invalidate(type);
    
    return c.json({
      success: true,
      message: `${documents.length} documents indexed successfully`,
      result,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to bulk index documents",
      },
      500
    );
  }
});

// Delete a document
adminRoutes.delete("/index/:type/:id", async (c) => {
  try {
    const { type, id } = c.req.param();
    
    const indexMap: Record<string, string> = {
      professional: INDICES.PROFESSIONALS,
      store: INDICES.STORES,
      product: INDICES.PRODUCTS,
      ideabook: INDICES.IDEA_BOOKS,
    };
    
    const index = indexMap[type];
    if (!index) {
      return c.json({ success: false, error: "Invalid type" }, 400);
    }
    
    await elasticsearchService.deleteDocument(index, id);
    await cacheService.invalidate(type);
    
    return c.json({
      success: true,
      message: `Document deleted successfully`,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to delete document",
      },
      500
    );
  }
});

// Update a document
adminRoutes.put("/index/:type/:id", async (c) => {
  try {
    const { type, id } = c.req.param();
    const document = await c.req.json();
    
    const indexMap: Record<string, string> = {
      professional: INDICES.PROFESSIONALS,
      store: INDICES.STORES,
      product: INDICES.PRODUCTS,
      ideabook: INDICES.IDEA_BOOKS,
    };
    
    const index = indexMap[type];
    if (!index) {
      return c.json({ success: false, error: "Invalid type" }, 400);
    }
    
    await elasticsearchService.updateDocument(index, id, document);
    await cacheService.invalidate(type);
    
    return c.json({
      success: true,
      message: `Document updated successfully`,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to update document",
      },
      500
    );
  }
});

// Clear cache
adminRoutes.post("/cache/clear", async (c) => {
  try {
    const { pattern } = await c.req.json();
    
    if (pattern) {
      await cacheService.invalidate(pattern);
    } else {
      await cacheService.clearAll();
    }
    
    return c.json({
      success: true,
      message: pattern
        ? `Cache cleared for pattern: ${pattern}`
        : "All cache cleared",
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to clear cache",
      },
      500
    );
  }
});

// Get cache stats
adminRoutes.get("/cache/stats", async (c) => {
  try {
    const stats = await cacheService.getStats();
    
    return c.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to get cache stats",
      },
      500
    );
  }
});

// Initialize indices
adminRoutes.post("/indices/initialize", async (c) => {
  try {
    await elasticsearchService.initializeIndices();
    
    return c.json({
      success: true,
      message: "Indices initialized successfully",
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to initialize indices",
      },
      500
    );
  }
});

export default adminRoutes;

