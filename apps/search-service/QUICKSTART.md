# Search Service - Quick Start Guide

Get the search service up and running in 5 minutes!

## Prerequisites

- Node.js 18+
- pnpm
- Docker & Docker Compose

## Step-by-Step Setup

### 1️⃣ Start Elasticsearch & Redis (2 minutes)

```bash
cd apps/search-service
docker-compose up -d
```

Wait for services to be healthy:
```bash
# Check Elasticsearch
curl http://localhost:9200

# Check Redis
redis-cli ping
```

### 2️⃣ Install Dependencies (1 minute)

```bash
# From project root
pnpm install
```

### 3️⃣ Start Search Service (1 minute)

```bash
# From project root
pnpm run dev:search

# Or directly
cd apps/search-service
pnpm run dev
```

You should see:
```
✅ Elasticsearch connected successfully
✅ Redis connected successfully
✅ All Elasticsearch indices initialized
🚀 Search Service running on http://localhost:3005
```

### 4️⃣ Test the Service (1 minute)

#### Initialize Indices
```bash
curl -X POST http://localhost:3005/api/admin/indices/initialize
```

#### Add Sample Data
```bash
curl -X POST http://localhost:3005/api/admin/index/professional/prof_001 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Modern Architecture Studio",
    "description": "Award-winning architectural firm",
    "services": ["architecture", "interior-design"],
    "location": {"lat": 40.7589, "lon": -73.9851},
    "rating": 4.8,
    "verified": true
  }'
```

#### Search
```bash
curl "http://localhost:3005/api/search/professionals?q=architect"
```

#### Autocomplete
```bash
curl "http://localhost:3005/api/search/autocomplete?q=arch&type=professionals"
```

### 5️⃣ Load Test Data (Optional)

Use the provided seed data:

```bash
cd apps/search-service

# Load professionals
curl -X POST http://localhost:3005/api/admin/bulk-index/professional \
  -H "Content-Type: application/json" \
  -d @examples/seed-data.json
```

## Verify Everything Works

### Health Check
```bash
curl http://localhost:3005/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "search-service",
  "elasticsearch": "connected"
}
```

### Cache Stats
```bash
curl http://localhost:3005/api/admin/cache/stats
```

## Common Commands

```bash
# Start just the search service
pnpm run dev:search

# Start all backend services (includes search)
pnpm run dev:services

# Stop Elasticsearch & Redis
cd apps/search-service
docker-compose down

# View logs
docker-compose logs -f elasticsearch
docker-compose logs -f redis

# Clear cache
curl -X POST http://localhost:3005/api/admin/cache/clear
```

## Troubleshooting

### Elasticsearch won't start
```bash
# Check if port 9200 is already in use
lsof -i :9200

# Check Docker logs
docker logs search-elasticsearch

# Try recreating containers
docker-compose down -v
docker-compose up -d
```

### Redis connection fails
```bash
# Check if Redis is running
docker ps | grep redis

# Test connection
redis-cli ping

# Restart Redis
docker-compose restart redis
```

### Service won't start
```bash
# Check if port 3005 is available
lsof -i :3005

# Check TypeScript errors
cd apps/search-service
pnpm run check-types

# View detailed logs
pnpm run dev
```

## Next Steps

1. **Read the full documentation**: [README.md](./README.md)
2. **Learn about integration**: [INTEGRATION.md](./INTEGRATION.md)
3. **Explore API examples**: [examples/test-requests.sh](./examples/test-requests.sh)
4. **See implementation details**: [SUMMARY.md](./SUMMARY.md)

## Integration with Other Services

### From Project Service
```typescript
// When creating a professional
await fetch('http://localhost:3005/api/webhook/professional/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(professionalData)
});
```

### From Client App
```typescript
// Search from Next.js
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SEARCH_SERVICE_URL}/api/search/professionals?q=architect`
);
const { data } = await response.json();
```

## Production Checklist

Before deploying to production:

- [ ] Configure environment variables
- [ ] Set up managed Elasticsearch (AWS OpenSearch, Elastic Cloud)
- [ ] Set up managed Redis (AWS ElastiCache, Redis Cloud)
- [ ] Add authentication to admin/webhook endpoints
- [ ] Enable HTTPS
- [ ] Set up monitoring and alerting
- [ ] Configure backups
- [ ] Test failover scenarios
- [ ] Set up CI/CD pipeline
- [ ] Load test the service

## Support

- **Documentation**: See README.md and INTEGRATION.md
- **Examples**: Check examples/ directory
- **Issues**: Report in the project's issue tracker

---

🎉 **Congratulations!** Your search service is now running!

Try searching for "architect", "furniture", or any other term to see it in action.

