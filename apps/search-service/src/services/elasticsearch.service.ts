import elasticsearchClient, { INDICES } from "../config/elasticsearch.js";

export class ElasticsearchService {
  // Initialize indices with mappings
  async initializeIndices() {
    try {
      await this.createProfessionalsIndex();
      await this.createStoresIndex();
      await this.createProductsIndex();
      await this.createIdeaBooksIndex();
      console.log("✅ All Elasticsearch indices initialized");
    } catch (error) {
      console.error("❌ Error initializing indices:", error);
      throw error;
    }
  }

  private async createProfessionalsIndex() {
    const exists = await elasticsearchClient.indices.exists({
      index: INDICES.PROFESSIONALS,
    });

    if (!exists) {
      await elasticsearchClient.indices.create({
        index: INDICES.PROFESSIONALS,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            analysis: {
              analyzer: {
                autocomplete_analyzer: {
                  type: "custom",
                  tokenizer: "standard",
                  filter: ["lowercase", "autocomplete_filter"],
                },
              },
              filter: {
                autocomplete_filter: {
                  type: "edge_ngram",
                  min_gram: 2,
                  max_gram: 20,
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              name: {
                type: "text",
                analyzer: "autocomplete_analyzer",
                fields: {
                  keyword: { type: "keyword" },
                },
              },
              description: { type: "text" },
              services: { type: "keyword" },
              location: {
                type: "geo_point",
              },
              address: {
                type: "text",
                fields: {
                  keyword: { type: "keyword" },
                },
              },
              city: { type: "keyword" },
              state: { type: "keyword" },
              country: { type: "keyword" },
              rating: { type: "float" },
              reviewCount: { type: "integer" },
              verified: { type: "boolean" },
              priceRange: { type: "keyword" },
              profileImage: { type: "keyword" },
              portfolio: { type: "keyword" },
              yearsOfExperience: { type: "integer" },
              createdAt: { type: "date" },
              updatedAt: { type: "date" },
            },
          },
        },
      });
      console.log(`✅ Created index: ${INDICES.PROFESSIONALS}`);
    }
  }

  private async createStoresIndex() {
    const exists = await elasticsearchClient.indices.exists({
      index: INDICES.STORES,
    });

    if (!exists) {
      await elasticsearchClient.indices.create({
        index: INDICES.STORES,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
            analysis: {
              analyzer: {
                autocomplete_analyzer: {
                  type: "custom",
                  tokenizer: "standard",
                  filter: ["lowercase", "autocomplete_filter"],
                },
              },
              filter: {
                autocomplete_filter: {
                  type: "edge_ngram",
                  min_gram: 2,
                  max_gram: 20,
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              name: {
                type: "text",
                analyzer: "autocomplete_analyzer",
                fields: {
                  keyword: { type: "keyword" },
                },
              },
              description: { type: "text" },
              category: { type: "keyword" },
              location: {
                type: "geo_point",
              },
              address: { type: "text" },
              city: { type: "keyword" },
              state: { type: "keyword" },
              rating: { type: "float" },
              reviewCount: { type: "integer" },
              hasDelivery: { type: "boolean" },
              storeImage: { type: "keyword" },
              createdAt: { type: "date" },
              updatedAt: { type: "date" },
            },
          },
        },
      });
      console.log(`✅ Created index: ${INDICES.STORES}`);
    }
  }

  private async createProductsIndex() {
    const exists = await elasticsearchClient.indices.exists({
      index: INDICES.PRODUCTS,
    });

    if (!exists) {
      await elasticsearchClient.indices.create({
        index: INDICES.PRODUCTS,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              name: {
                type: "text",
                fields: {
                  keyword: { type: "keyword" },
                },
              },
              description: { type: "text" },
              category: { type: "keyword" },
              price: { type: "float" },
              inStock: { type: "boolean" },
              storeId: { type: "keyword" },
              storeName: { type: "text" },
              images: { type: "keyword" },
              rating: { type: "float" },
              reviewCount: { type: "integer" },
              createdAt: { type: "date" },
              updatedAt: { type: "date" },
            },
          },
        },
      });
      console.log(`✅ Created index: ${INDICES.PRODUCTS}`);
    }
  }

  private async createIdeaBooksIndex() {
    const exists = await elasticsearchClient.indices.exists({
      index: INDICES.IDEA_BOOKS,
    });

    if (!exists) {
      await elasticsearchClient.indices.create({
        index: INDICES.IDEA_BOOKS,
        body: {
          settings: {
            number_of_shards: 1,
            number_of_replicas: 1,
          },
          mappings: {
            properties: {
              id: { type: "keyword" },
              title: {
                type: "text",
                fields: {
                  keyword: { type: "keyword" },
                },
              },
              description: { type: "text" },
              style: { type: "keyword" },
              room: { type: "keyword" },
              budget: { type: "keyword" },
              images: { type: "keyword" },
              professionalId: { type: "keyword" },
              professionalName: { type: "text" },
              likes: { type: "integer" },
              saves: { type: "integer" },
              createdAt: { type: "date" },
              updatedAt: { type: "date" },
            },
          },
        },
      });
      console.log(`✅ Created index: ${INDICES.IDEA_BOOKS}`);
    }
  }

  // Generic index document
  async indexDocument(index: string, id: string, document: any): Promise<any> {
    return await elasticsearchClient.index({
      index,
      id,
      document,
      refresh: true,
    });
  }

  // Generic bulk index
  async bulkIndex(index: string, documents: any[]): Promise<any> {
    const body = documents.flatMap((doc) => [
      { index: { _index: index, _id: doc.id } },
      doc,
    ]);

    return await elasticsearchClient.bulk({ body, refresh: true });
  }

  // Generic delete document
  async deleteDocument(index: string, id: string): Promise<any> {
    return await elasticsearchClient.delete({
      index,
      id,
      refresh: true,
    });
  }

  // Generic update document
  async updateDocument(index: string, id: string, document: any): Promise<any> {
    return await elasticsearchClient.update({
      index,
      id,
      doc: document,
      refresh: true,
    });
  }
}

export default new ElasticsearchService();

