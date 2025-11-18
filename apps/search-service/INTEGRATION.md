# Search Service Integration Guide

This guide explains how to integrate the Search Service with other services in the Build Market monorepo.

## Integration Methods

### Method 1: Webhook Integration (Recommended)

When data changes in other services, send a webhook to the search service to keep indices updated.

#### From Project Service

```typescript
// apps/project-service/src/services/professional.service.ts
import fetch from "node-fetch";

const SEARCH_SERVICE_URL = process.env.SEARCH_SERVICE_URL || "http://localhost:3005";

export async function createProfessional(data: ProfessionalData) {
  // Create professional in database
  const professional = await db.professional.create({ data });
  
  // Sync to search service
  try {
    await fetch(`${SEARCH_SERVICE_URL}/api/webhook/professional/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: professional.id,
        name: professional.name,
        description: professional.description,
        services: professional.services,
        location: professional.location,
        address: professional.address,
        city: professional.city,
        state: professional.state,
        rating: professional.rating,
        reviewCount: professional.reviewCount,
        verified: professional.verified,
        priceRange: professional.priceRange,
      }),
    });
  } catch (error) {
    console.error("Failed to sync to search service:", error);
    // Don't fail the main operation if search sync fails
  }
  
  return professional;
}

export async function updateProfessional(id: string, data: Partial<ProfessionalData>) {
  const professional = await db.professional.update({ where: { id }, data });
  
  // Sync update to search service
  await fetch(`${SEARCH_SERVICE_URL}/api/webhook/professional/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(professional),
  });
  
  return professional;
}

export async function deleteProfessional(id: string) {
  await db.professional.delete({ where: { id } });
  
  // Sync deletion to search service
  await fetch(`${SEARCH_SERVICE_URL}/api/webhook/professional/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  });
}
```

#### From Client/Admin Apps

```typescript
// apps/client/app/lib/search.ts
export async function searchProfessionals(query: string, filters?: SearchFilters) {
  const params = new URLSearchParams({
    q: query,
    ...(filters?.location && { location: filters.location }),
    ...(filters?.radius && { radius: filters.radius.toString() }),
    ...(filters?.minRating && { minRating: filters.minRating.toString() }),
    ...(filters?.services && { services: filters.services.join(",") }),
  });
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL}/api/search/professionals?${params}`
  );
  
  return response.json();
}

export async function autocomplete(query: string, type: string = "all") {
  const params = new URLSearchParams({
    q: query,
    type,
    limit: "5",
  });
  
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL}/api/search/autocomplete?${params}`
  );
  
  return response.json();
}
```

### Method 2: Kafka Event Integration

Listen to Kafka events from other services for real-time synchronization.

```typescript
// apps/search-service/src/kafka/consumer.ts
import { createConsumer, createKafkaClient } from "@repo/kafka";
import syncHandler from "./sync/sync-handler.js";

const kafka = createKafkaClient("search-service");
const consumer = createConsumer(kafka, "search-service");

export async function startKafkaConsumer() {
  await consumer.connect();
  
  await consumer.subscribe([
    {
      topicName: "professional.created",
      topicHandler: async (message) => {
        await syncHandler.syncProfessional("create", message.value);
      },
    },
    {
      topicName: "professional.updated",
      topicHandler: async (message) => {
        await syncHandler.syncProfessional("update", message.value);
      },
    },
    {
      topicName: "professional.deleted",
      topicHandler: async (message) => {
        await syncHandler.syncProfessional("delete", message.value);
      },
    },
    {
      topicName: "store.created",
      topicHandler: async (message) => {
        await syncHandler.syncStore("create", message.value);
      },
    },
    {
      topicName: "store.updated",
      topicHandler: async (message) => {
        await syncHandler.syncStore("update", message.value);
      },
    },
    {
      topicName: "product.created",
      topicHandler: async (message) => {
        await syncHandler.syncProduct("create", message.value);
      },
    },
    {
      topicName: "product.updated",
      topicHandler: async (message) => {
        await syncHandler.syncProduct("update", message.value);
      },
    },
  ]);
  
  console.log("✅ Kafka consumer started for search sync");
}
```

### Method 3: Scheduled Batch Sync

Use cron jobs for periodic full synchronization.

```typescript
// apps/search-service/src/sync/batch-sync.ts
import { CronJob } from "cron";
import syncHandler from "./sync-handler.js";

// Sync all professionals every night at 2 AM
export const professionalSyncJob = new CronJob("0 2 * * *", async () => {
  console.log("🔄 Starting professional batch sync...");
  
  try {
    const response = await fetch(
      `${process.env.PROJECT_SERVICE_URL}/api/professionals/export`
    );
    const professionals = await response.json();
    
    await syncHandler.bulkSync("professional", professionals);
    console.log(`✅ Synced ${professionals.length} professionals`);
  } catch (error) {
    console.error("❌ Professional batch sync failed:", error);
  }
});

// Start all sync jobs
export function startBatchSyncJobs() {
  professionalSyncJob.start();
  console.log("✅ Batch sync jobs started");
}
```

## Client-Side Integration

### React Hook for Search

```typescript
// apps/client/hooks/useSearch.ts
import { useState, useEffect } from "react";

export function useSearch(query: string, filters: SearchFilters) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    
    const searchTimeout = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: query,
          ...filters,
        });
        
        const response = await fetch(
          `/api/search/professionals?${params}`
        );
        const data = await response.json();
        
        setResults(data.data.results);
      } catch (err) {
        setError(err);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce
    
    return () => clearTimeout(searchTimeout);
  }, [query, filters]);
  
  return { results, loading, error };
}
```

### React Component with Autocomplete

```typescript
// apps/client/components/SearchBar.tsx
"use client";

import { useState, useEffect } from "react";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      const response = await fetch(
        `/api/search/autocomplete?q=${encodeURIComponent(query)}&type=all&limit=5`
      );
      const data = await response.json();
      
      if (data.success) {
        const allSuggestions = [
          ...(data.data.professionals || []),
          ...(data.data.stores || []),
          ...(data.data.products || []),
        ];
        setSuggestions(allSuggestions);
        setShowSuggestions(true);
      }
    }, 200); // Debounce autocomplete
    
    return () => clearTimeout(timeout);
  }, [query]);
  
  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder="Search professionals, stores, products..."
        className="w-full px-4 py-2 border rounded-lg"
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 z-50">
          {suggestions.map((item: any, index) => (
            <div
              key={index}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={() => {
                setQuery(item.name || item.title);
                setShowSuggestions(false);
              }}
            >
              <div className="font-medium">{item.name || item.title}</div>
              {item.rating && (
                <div className="text-sm text-gray-500">
                  ⭐ {item.rating}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

## Environment Variables

Add these to your services:

### Search Service (.env)
```env
PORT=3005
ELASTICSEARCH_NODE=http://localhost:9200
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Client/Admin Apps (.env.local)
```env
NEXT_PUBLIC_SEARCH_SERVICE_URL=http://localhost:3005
```

### Project Service (.env)
```env
SEARCH_SERVICE_URL=http://localhost:3005
```

## Testing Integration

### 1. Start all services

```bash
# Terminal 1: Start Elasticsearch & Redis
cd apps/search-service
docker-compose up

# Terminal 2: Start search service
pnpm run dev:search

# Terminal 3: Start other services
pnpm run dev:client
```

### 2. Test webhook integration

```bash
# Create a professional via project service
curl -X POST http://localhost:3004/api/professionals \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Professional", ...}'

# Verify it's searchable
curl "http://localhost:3005/api/search/professionals?q=Test"
```

### 3. Test search from client

```bash
# Search from client app
curl "http://localhost:3000/api/search?q=architect"
```

## Performance Considerations

1. **Use Caching**: The search service caches results for 1 hour
2. **Debounce Autocomplete**: Wait 200-300ms before making requests
3. **Limit Results**: Use pagination (20-50 results per page)
4. **Async Sync**: Don't block main operations waiting for search sync
5. **Error Handling**: Gracefully handle search service downtime

## Monitoring

```bash
# Check search service health
curl http://localhost:3005/health

# Check cache stats
curl http://localhost:3005/api/admin/cache/stats

# Monitor Elasticsearch
curl http://localhost:9200/_cluster/health
```

## Troubleshooting

### Search returns no results

1. Check if indices are initialized:
   ```bash
   curl -X POST http://localhost:3005/api/admin/indices/initialize
   ```

2. Verify data is indexed:
   ```bash
   curl http://localhost:9200/professionals/_search
   ```

### Slow search performance

1. Check cache hit rate
2. Verify Elasticsearch health
3. Consider reducing result size
4. Add more specific filters

### Sync failures

1. Check service connectivity
2. Verify webhook URLs are correct
3. Check logs for errors
4. Try manual sync via admin endpoints

## Production Deployment

### Scaling Considerations

- Run multiple search service instances behind a load balancer
- Use managed Elasticsearch (AWS OpenSearch, Elastic Cloud)
- Use managed Redis (AWS ElastiCache, Redis Cloud)
- Set up proper monitoring and alerting
- Configure backups for Elasticsearch indices

### Security

- Add authentication to admin endpoints
- Use API keys for service-to-service communication
- Enable Elasticsearch security features
- Use HTTPS in production
- Rate limit search endpoints

## Next Steps

1. Implement Kafka integration for real-time sync
2. Add authentication middleware
3. Set up monitoring and alerting
4. Add more search filters
5. Implement faceted search
6. Add search analytics

