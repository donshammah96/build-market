import elasticsearchClient, { INDICES } from "../config/elasticsearch.js";
import cacheService from "./cache.service.js";
import type {
  ProfessionalSearchQuery,
  StoreSearchQuery,
  ProductSearchQuery,
  IdeaBookSearchQuery,
  AutocompleteQuery,
} from "../schemas/search.schemas.js";

export class SearchService {
  // Search professionals
  async searchProfessionals(query: ProfessionalSearchQuery) {
    const cacheKey = { professionals: query };
    const cached = await cacheService.get("professionals", cacheKey);
    
    if (cached) {
      return cached;
    }

    const { q, page, size, sort, order, location, radius, services, minRating, verified, priceRange } = query;
    
    const must: any[] = [
      {
        multi_match: {
          query: q,
          fields: ["name^3", "description^2", "services", "address"],
          fuzziness: "AUTO",
        },
      },
    ];

    const filter: any[] = [];

    if (minRating) {
      filter.push({ range: { rating: { gte: minRating } } });
    }

    if (verified !== undefined) {
      filter.push({ term: { verified } });
    }

    if (priceRange) {
      filter.push({ term: { priceRange } });
    }

    if (services) {
      const serviceList = Array.isArray(services) ? services : [services];
      filter.push({ terms: { services: serviceList } });
    }

    // Geo-distance query if location is provided
    if (location && radius) {
      filter.push({
        geo_distance: {
          distance: `${radius}mi`,
          location: location,
        },
      });
    }

    const sortOptions = this.getSortOptions(sort, order);

    const result = await elasticsearchClient.search({
      index: INDICES.PROFESSIONALS,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: sortOptions,
        from: (page - 1) * size,
        size,
      },
    });

    const response = {
      total: typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0,
      page,
      size,
      results: result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
    };

    await cacheService.set("professionals", cacheKey, response);
    
    return response;
  }

  // Search stores
  async searchStores(query: StoreSearchQuery) {
    const cacheKey = { stores: query };
    const cached = await cacheService.get("stores", cacheKey);
    
    if (cached) {
      return cached;
    }

    const { q, page, size, sort, order, location, radius, category, minRating, hasDelivery } = query;
    
    const must: any[] = [
      {
        multi_match: {
          query: q,
          fields: ["name^3", "description^2", "category", "address"],
          fuzziness: "AUTO",
        },
      },
    ];

    const filter: any[] = [];

    if (minRating) {
      filter.push({ range: { rating: { gte: minRating } } });
    }

    if (category) {
      filter.push({ term: { category } });
    }

    if (hasDelivery !== undefined) {
      filter.push({ term: { hasDelivery } });
    }

    if (location && radius) {
      filter.push({
        geo_distance: {
          distance: `${radius}mi`,
          location: location,
        },
      });
    }

    const sortOptions = this.getSortOptions(sort, order);

    const result = await elasticsearchClient.search({
      index: INDICES.STORES,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: sortOptions,
        from: (page - 1) * size,
        size,
      },
    });

    const response = {
      total: typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0,
      page,
      size,
      results: result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
    };

    await cacheService.set("stores", cacheKey, response);
    
    return response;
  }

  // Search products
  async searchProducts(query: ProductSearchQuery) {
    const cacheKey = { products: query };
    const cached = await cacheService.get("products", cacheKey);
    
    if (cached) {
      return cached;
    }

    const { q, page, size, sort, order, category, minPrice, maxPrice, inStock, storeId } = query;
    
    const must: any[] = [
      {
        multi_match: {
          query: q,
          fields: ["name^3", "description^2", "category", "storeName"],
          fuzziness: "AUTO",
        },
      },
    ];

    const filter: any[] = [];

    if (category) {
      filter.push({ term: { category } });
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: any = { range: { price: {} } };
      if (minPrice !== undefined) priceFilter.range.price.gte = minPrice;
      if (maxPrice !== undefined) priceFilter.range.price.lte = maxPrice;
      filter.push(priceFilter);
    }

    if (inStock !== undefined) {
      filter.push({ term: { inStock } });
    }

    if (storeId) {
      filter.push({ term: { storeId } });
    }

    const sortOptions = this.getSortOptions(sort, order);

    const result = await elasticsearchClient.search({
      index: INDICES.PRODUCTS,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: sortOptions,
        from: (page - 1) * size,
        size,
      },
    });

    const response = {
      total: typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0,
      page,
      size,
      results: result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
    };

    await cacheService.set("products", cacheKey, response);
    
    return response;
  }

  // Search idea books
  async searchIdeaBooks(query: IdeaBookSearchQuery) {
    const cacheKey = { ideaBooks: query };
    const cached = await cacheService.get("ideaBooks", cacheKey);
    
    if (cached) {
      return cached;
    }

    const { q, page, size, sort, order, style, room, budget, professionalId } = query;
    
    const must: any[] = [
      {
        multi_match: {
          query: q,
          fields: ["title^3", "description^2", "style", "room", "professionalName"],
          fuzziness: "AUTO",
        },
      },
    ];

    const filter: any[] = [];

    if (style) {
      filter.push({ term: { style } });
    }

    if (room) {
      filter.push({ term: { room } });
    }

    if (budget) {
      filter.push({ term: { budget } });
    }

    if (professionalId) {
      filter.push({ term: { professionalId } });
    }

    const sortOptions = this.getSortOptions(sort, order);

    const result = await elasticsearchClient.search({
      index: INDICES.IDEA_BOOKS,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: sortOptions,
        from: (page - 1) * size,
        size,
      },
    });

    const response = {
      total: typeof result.hits.total === 'number' ? result.hits.total : result.hits.total?.value || 0,
      page,
      size,
      results: result.hits.hits.map((hit: any) => ({
        id: hit._id,
        score: hit._score,
        ...hit._source,
      })),
    };

    await cacheService.set("ideaBooks", cacheKey, response);
    
    return response;
  }

  // Autocomplete
  async autocomplete(query: AutocompleteQuery) {
    const autocompleteTTL = parseInt(process.env.AUTOCOMPLETE_CACHE_TTL || "300");
    const cacheKey = { autocomplete: query };
    const cached = await cacheService.get("autocomplete", cacheKey);
    
    if (cached) {
      return cached;
    }

    const { q, type, limit } = query;
    const results: any = {};

    if (type === "all" || type === "professionals") {
      const profResult = await elasticsearchClient.search({
        index: INDICES.PROFESSIONALS,
        body: {
          query: {
            match: {
              name: {
                query: q,
                operator: "and",
                fuzziness: "AUTO",
              },
            },
          },
          size: limit,
          _source: ["name", "services", "location", "rating"],
        },
      });

      results.professionals = profResult.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));
    }

    if (type === "all" || type === "stores") {
      const storeResult = await elasticsearchClient.search({
        index: INDICES.STORES,
        body: {
          query: {
            match: {
              name: {
                query: q,
                operator: "and",
                fuzziness: "AUTO",
              },
            },
          },
          size: limit,
          _source: ["name", "category", "rating"],
        },
      });

      results.stores = storeResult.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));
    }

    if (type === "all" || type === "products") {
      const productResult = await elasticsearchClient.search({
        index: INDICES.PRODUCTS,
        body: {
          query: {
            match: {
              name: {
                query: q,
                operator: "and",
                fuzziness: "AUTO",
              },
            },
          },
          size: limit,
          _source: ["name", "price", "storeName"],
        },
      });

      results.products = productResult.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));
    }

    if (type === "all" || type === "idea_books") {
      const ideaBookResult = await elasticsearchClient.search({
        index: INDICES.IDEA_BOOKS,
        body: {
          query: {
            match: {
              title: {
                query: q,
                operator: "and",
                fuzziness: "AUTO",
              },
            },
          },
          size: limit,
          _source: ["title", "style", "professionalName"],
        },
      });

      results.idea_books = ideaBookResult.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source,
      }));
    }

    await cacheService.set("autocomplete", cacheKey, results, autocompleteTTL);
    
    return results;
  }

  // Helper: Get sort options
  private getSortOptions(sort: string, order: string): any {
    const sortOrder: "asc" | "desc" = (order === "asc" || order === "desc" ? order : "desc") as "asc" | "desc";
    
    switch (sort) {
      case "rating":
        return [{ rating: { order: sortOrder } }] as any;
      case "reviews":
        return [{ reviewCount: { order: sortOrder } }] as any;
      case "price":
        return [{ price: { order: sortOrder } }] as any;
      case "distance":
        return [{ _geo_distance: { location: "0,0", order: sortOrder, unit: "mi" } }] as any;
      default:
        return ["_score"] as any; // relevance
    }
  }
}

export default new SearchService();

