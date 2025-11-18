import elasticsearchService from "../services/elasticsearch.service.js";
import cacheService from "../services/cache.service.js";
import { INDICES } from "../config/elasticsearch.js";

export class SyncHandler {
  // Sync professional data
  async syncProfessional(action: "create" | "update" | "delete", data: any) {
    try {
      switch (action) {
        case "create":
        case "update":
          await elasticsearchService.indexDocument(
            INDICES.PROFESSIONALS,
            data.id,
            {
              id: data.id,
              name: data.name,
              description: data.description || "",
              services: data.services || [],
              location: data.location || null,
              address: data.address || "",
              city: data.city || "",
              state: data.state || "",
              country: data.country || "",
              rating: data.rating || 0,
              reviewCount: data.reviewCount || 0,
              verified: data.verified || false,
              priceRange: data.priceRange || "moderate",
              profileImage: data.profileImage || "",
              portfolio: data.portfolio || "",
              yearsOfExperience: data.yearsOfExperience || 0,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          );
          await cacheService.invalidate("professionals");
          console.log(`✅ Synced professional: ${data.id}`);
          break;

        case "delete":
          await elasticsearchService.deleteDocument(INDICES.PROFESSIONALS, data.id);
          await cacheService.invalidate("professionals");
          console.log(`🗑️  Deleted professional: ${data.id}`);
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to sync professional ${data.id}:`, error);
      throw error;
    }
  }

  // Sync store data
  async syncStore(action: "create" | "update" | "delete", data: any) {
    try {
      switch (action) {
        case "create":
        case "update":
          await elasticsearchService.indexDocument(INDICES.STORES, data.id, {
            id: data.id,
            name: data.name,
            description: data.description || "",
            category: data.category || "",
            location: data.location || null,
            address: data.address || "",
            city: data.city || "",
            state: data.state || "",
            rating: data.rating || 0,
            reviewCount: data.reviewCount || 0,
            hasDelivery: data.hasDelivery || false,
            storeImage: data.storeImage || "",
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          await cacheService.invalidate("stores");
          console.log(`✅ Synced store: ${data.id}`);
          break;

        case "delete":
          await elasticsearchService.deleteDocument(INDICES.STORES, data.id);
          await cacheService.invalidate("stores");
          console.log(`🗑️  Deleted store: ${data.id}`);
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to sync store ${data.id}:`, error);
      throw error;
    }
  }

  // Sync product data
  async syncProduct(action: "create" | "update" | "delete", data: any) {
    try {
      switch (action) {
        case "create":
        case "update":
          await elasticsearchService.indexDocument(INDICES.PRODUCTS, data.id, {
            id: data.id,
            name: data.name,
            description: data.description || "",
            category: data.category || "",
            price: data.price || 0,
            inStock: data.inStock !== undefined ? data.inStock : true,
            storeId: data.storeId || "",
            storeName: data.storeName || "",
            images: data.images || [],
            rating: data.rating || 0,
            reviewCount: data.reviewCount || 0,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          await cacheService.invalidate("products");
          console.log(`✅ Synced product: ${data.id}`);
          break;

        case "delete":
          await elasticsearchService.deleteDocument(INDICES.PRODUCTS, data.id);
          await cacheService.invalidate("products");
          console.log(`🗑️  Deleted product: ${data.id}`);
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to sync product ${data.id}:`, error);
      throw error;
    }
  }

  // Sync idea book data
  async syncIdeaBook(action: "create" | "update" | "delete", data: any) {
    try {
      switch (action) {
        case "create":
        case "update":
          await elasticsearchService.indexDocument(INDICES.IDEA_BOOKS, data.id, {
            id: data.id,
            title: data.title,
            description: data.description || "",
            style: data.style || "",
            room: data.room || "",
            budget: data.budget || "",
            images: data.images || [],
            professionalId: data.professionalId || "",
            professionalName: data.professionalName || "",
            likes: data.likes || 0,
            saves: data.saves || 0,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          await cacheService.invalidate("ideaBooks");
          console.log(`✅ Synced idea book: ${data.id}`);
          break;

        case "delete":
          await elasticsearchService.deleteDocument(INDICES.IDEA_BOOKS, data.id);
          await cacheService.invalidate("ideaBooks");
          console.log(`🗑️  Deleted idea book: ${data.id}`);
          break;
      }
    } catch (error) {
      console.error(`❌ Failed to sync idea book ${data.id}:`, error);
      throw error;
    }
  }

  // Bulk sync
  async bulkSync(type: string, items: any[]) {
    try {
      const indexMap: Record<string, string> = {
        professional: INDICES.PROFESSIONALS,
        store: INDICES.STORES,
        product: INDICES.PRODUCTS,
        ideabook: INDICES.IDEA_BOOKS,
      };

      const index = indexMap[type];
      if (!index) {
        throw new Error(`Invalid sync type: ${type}`);
      }

      await elasticsearchService.bulkIndex(index, items);
      await cacheService.invalidate(type);
      
      console.log(`✅ Bulk synced ${items.length} ${type}s`);
      return { success: true, count: items.length };
    } catch (error) {
      console.error(`❌ Failed to bulk sync ${type}s:`, error);
      throw error;
    }
  }
}

export default new SyncHandler();

