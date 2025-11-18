import { Client } from "@elastic/elasticsearch";

const elasticsearchClient = new Client({
  node: process.env.ELASTICSEARCH_NODE || "http://localhost:9200",
  auth: {
    username: process.env.ELASTICSEARCH_USERNAME || "elastic",
    password: process.env.ELASTICSEARCH_PASSWORD || "changeme",
  },
  maxRetries: 5,
  requestTimeout: 60000,
  sniffOnStart: true,
});

// Index names
export const INDICES = {
  PROFESSIONALS: "professionals",
  STORES: "stores",
  PRODUCTS: "products",
  IDEA_BOOKS: "idea_books",
  PROJECTS: "projects",
} as const;

// Test connection
export const testConnection = async () => {
  try {
    await elasticsearchClient.ping();
    console.log("✅ Elasticsearch connected successfully");
    return true;
  } catch (error) {
    console.error("❌ Elasticsearch connection failed:", error);
    return false;
  }
};

export default elasticsearchClient;

