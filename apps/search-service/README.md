# Search Service

A high-performance search service powered by Elasticsearch and Redis, providing full-text search, autocomplete, and filtering capabilities for professionals, stores, products, and idea books.

## Features

- 🔍 **Full-text Search**: Elasticsearch-powered search with fuzzy matching and relevance scoring
- ⚡ **Redis Caching**: Sub-second response times with intelligent caching
- 🎯 **Advanced Filtering**: Location-based, rating, price range, and category filters
- 💡 **Autocomplete**: Real-time search suggestions
- 📍 **Geo-spatial Search**: Find professionals/stores near a location
- 📊 **Pagination**: Efficient result pagination
- 🔄 **Data Sync**: Real-time synchronization with other services

## Quick Start

### 1. Start Elasticsearch and Redis

```bash
cd apps/search-service
docker-compose up -d
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Create a `.env` file:

```env
PORT=3005
NODE_ENV=development

# Elasticsearch
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=changeme

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Cache
CACHE_TTL=3600
AUTOCOMPLETE_CACHE_TTL=300
```

### 4. Start the Service

```bash
pnpm run dev
```

The service will be available at `http://localhost:3005`

## API Endpoints

### Search Endpoints

#### Search Professionals

```bash
GET /api/search/professionals?q=architect&location=40.7128,-74.0060&radius=25&minRating=4
```

**Query Parameters:**
- `q` (required): Search query
- `page`: Page number (default: 1)
- `size`: Results per page (default: 20)
- `location`: Coordinates "lat,lon" for geo search
- `radius`: Search radius in miles (default: 25)
- `services`: Service types (comma-separated)
- `minRating`: Minimum rating (0-5)
- `verified`: Filter verified professionals
- `priceRange`: budget|moderate|premium|luxury
- `sort`: relevance|rating|reviews|distance
- `order`: asc|desc

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "page": 1,
    "size": 20,
    "results": [
      {
        "id": "prof_123",
        "name": "John Smith Architecture",
        "description": "Award-winning architect...",
        "services": ["architecture", "interior-design"],
        "location": { "lat": 40.7589, "lon": -73.9851 },
        "rating": 4.8,
        "reviewCount": 145,
        "verified": true,
        "priceRange": "premium"
      }
    ]
  }
}
```

#### Search Stores

```bash
GET /api/search/stores?q=furniture&category=home-decor&minRating=4&hasDelivery=true
```

**Query Parameters:**
- `q` (required): Search query
- `page`, `size`, `location`, `radius`: Same as professionals
- `category`: Store category
- `minRating`: Minimum rating
- `hasDelivery`: Filter stores with delivery
- `sort`: relevance|rating|reviews
- `order`: asc|desc

#### Search Products

```bash
GET /api/search/products?q=sofa&category=furniture&minPrice=500&maxPrice=2000&inStock=true
```

**Query Parameters:**
- `q` (required): Search query
- `page`, `size`: Pagination
- `category`: Product category
- `minPrice`, `maxPrice`: Price range
- `inStock`: Filter in-stock products
- `storeId`: Filter by store
- `sort`: relevance|rating|price
- `order`: asc|desc

#### Search Idea Books

```bash
GET /api/search/idea-books?q=modern kitchen&style=contemporary&room=kitchen&budget=moderate
```

**Query Parameters:**
- `q` (required): Search query
- `page`, `size`: Pagination
- `style`: Design style
- `room`: Room type
- `budget`: Budget range
- `professionalId`: Filter by professional
- `sort`: relevance|rating
- `order`: asc|desc

#### Autocomplete

```bash
GET /api/search/autocomplete?q=arch&type=professionals&limit=5
```

**Query Parameters:**
- `q` (required): Search query
- `type`: professionals|stores|products|idea_books|all (default: all)
- `limit`: Number of suggestions (default: 5, max: 10)

**Response:**
```json
{
  "success": true,
  "data": {
    "professionals": [
      { "id": "prof_1", "name": "Architects Inc", "rating": 4.8 }
    ],
    "stores": [
      { "id": "store_1", "name": "Architecture Supply Co", "rating": 4.5 }
    ]
  }
}
```

### Admin Endpoints

#### Index Document

```bash
POST /api/admin/index/:type/:id
Content-Type: application/json

{
  "name": "Jane Doe Interiors",
  "description": "Modern interior design",
  "services": ["interior-design", "renovation"],
  "location": { "lat": 40.7128, "lon": -74.0060 },
  "rating": 4.9,
  "verified": true
}
```

Types: `professional`, `store`, `product`, `ideabook`

#### Bulk Index

```bash
POST /api/admin/bulk-index/:type
Content-Type: application/json

[
  {
    "id": "prof_1",
    "name": "Professional 1",
    ...
  },
  {
    "id": "prof_2",
    "name": "Professional 2",
    ...
  }
]
```

#### Delete Document

```bash
DELETE /api/admin/index/:type/:id
```

#### Update Document

```bash
PUT /api/admin/index/:type/:id
Content-Type: application/json

{
  "rating": 4.9,
  "reviewCount": 200
}
```

#### Clear Cache

```bash
POST /api/admin/cache/clear
Content-Type: application/json

{
  "pattern": "professionals"  // Optional, clears all if not provided
}
```

#### Get Cache Stats

```bash
GET /api/admin/cache/stats
```

#### Initialize Indices

```bash
POST /api/admin/indices/initialize
```

## Data Syncing

### Syncing from Other Services

The search service needs to stay in sync with data from other microservices. Here are recommended approaches:

#### 1. Event-Driven Sync (Recommended)

Listen to Kafka events from other services:

```typescript
// Example: Sync when professional is created/updated
kafka.consume('professional.created', async (data) => {
  await searchService.indexDocument('professional', data.id, data);
});

kafka.consume('professional.updated', async (data) => {
  await searchService.updateDocument('professional', data.id, data);
});
```

#### 2. API Webhooks

Other services can call the search service's admin endpoints:

```typescript
// In project-service after creating a professional
await fetch('http://search-service:3005/api/admin/index/professional/prof_123', {
  method: 'POST',
  body: JSON.stringify(professionalData)
});
```

#### 3. Scheduled Batch Sync

Run periodic full syncs:

```bash
# Cron job to sync all professionals
0 2 * * * curl -X POST http://search-service:3005/api/admin/bulk-index/professional \
  -H "Content-Type: application/json" \
  -d @professionals-dump.json
```

## Performance

### Caching Strategy

- **Search Results**: Cached for 1 hour (configurable via `CACHE_TTL`)
- **Autocomplete**: Cached for 5 minutes (configurable via `AUTOCOMPLETE_CACHE_TTL`)
- **Cache Invalidation**: Automatic on data updates

### Optimization Tips

1. **Use Filters**: Combine filters with search queries for better performance
2. **Limit Page Size**: Keep page size reasonable (20-50 results)
3. **Use Autocomplete Wisely**: Debounce autocomplete requests on the client
4. **Monitor Cache Hit Rate**: Check `/api/admin/cache/stats` regularly

## Monitoring

### Health Check

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "service": "search-service",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "elasticsearch": "connected"
}
```

### Elasticsearch Health

```bash
curl http://localhost:9200/_cluster/health
```

### Redis Health

```bash
redis-cli ping
```

## Development

### Running Tests

```bash
pnpm run test
```

### Type Checking

```bash
pnpm run check-types
```

### Building

```bash
pnpm run build
```

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│  Search Service │
│    (Hono API)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────────┐
│ Redis  │ │Elasticsearch │
│ Cache  │ │   Indices    │
└────────┘ └──────────────┘
```

## Troubleshooting

### Elasticsearch not connecting

1. Check if Elasticsearch is running:
   ```bash
   docker ps | grep elasticsearch
   ```

2. Check logs:
   ```bash
   docker logs search-elasticsearch
   ```

3. Verify connection:
   ```bash
   curl http://localhost:9200
   ```

### Redis not caching

1. Check Redis connection:
   ```bash
   redis-cli ping
   ```

2. Check cache stats:
   ```bash
   curl http://localhost:3005/api/admin/cache/stats
   ```

### Poor search results

1. Rebuild indices:
   ```bash
   curl -X POST http://localhost:3005/api/admin/indices/initialize
   ```

2. Re-index data:
   ```bash
   curl -X POST http://localhost:3005/api/admin/bulk-index/professional \
     -H "Content-Type: application/json" \
     -d @your-data.json
   ```

## License

MIT

