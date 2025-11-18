import { Hono } from "hono";
import searchService from "../services/search.service.js";
import {
  professionalSearchSchema,
  storeSearchSchema,
  productSearchSchema,
  ideaBookSearchSchema,
  autocompleteSchema,
} from "../schemas/search.schemas.js";

const searchRoutes = new Hono();

// Search professionals
searchRoutes.get("/professionals", async (c) => {
  try {
    const rawQuery = c.req.query();
    const query = professionalSearchSchema.parse(rawQuery);
    
    const results = await searchService.searchProfessionals(query);
    
    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to search professionals",
      },
      400
    );
  }
});

// Search stores
searchRoutes.get("/stores", async (c) => {
  try {
    const rawQuery = c.req.query();
    const query = storeSearchSchema.parse(rawQuery);
    
    const results = await searchService.searchStores(query);
    
    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to search stores",
      },
      400
    );
  }
});

// Search products
searchRoutes.get("/products", async (c) => {
  try {
    const rawQuery = c.req.query();
    const query = productSearchSchema.parse(rawQuery);
    
    const results = await searchService.searchProducts(query);
    
    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to search products",
      },
      400
    );
  }
});

// Search idea books
searchRoutes.get("/idea-books", async (c) => {
  try {
    const rawQuery = c.req.query();
    const query = ideaBookSearchSchema.parse(rawQuery);
    
    const results = await searchService.searchIdeaBooks(query);
    
    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to search idea books",
      },
      400
    );
  }
});

// Autocomplete
searchRoutes.get("/autocomplete", async (c) => {
  try {
    const rawQuery = c.req.query();
    const query = autocompleteSchema.parse(rawQuery);
    
    const results = await searchService.autocomplete(query);
    
    return c.json({
      success: true,
      data: results,
    });
  } catch (error: any) {
    return c.json(
      {
        success: false,
        error: error.message || "Failed to autocomplete",
      },
      400
    );
  }
});

export default searchRoutes;

