#!/bin/bash

# Search Service API Test Requests
BASE_URL="http://localhost:3005"

echo "🧪 Testing Search Service API"
echo "=============================="
echo ""

# Health Check
echo "1️⃣ Health Check"
curl -s "$BASE_URL/health" | jq
echo -e "\n"

# Initialize Indices
echo "2️⃣ Initialize Elasticsearch Indices"
curl -s -X POST "$BASE_URL/api/admin/indices/initialize" | jq
echo -e "\n"

# Seed Professional Data
echo "3️⃣ Seed Professional Data"
curl -s -X POST "$BASE_URL/api/admin/index/professional/prof_001" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Modern Architecture Studio",
    "description": "Award-winning architectural firm",
    "services": ["architecture", "interior-design"],
    "location": {"lat": 40.7589, "lon": -73.9851},
    "address": "123 Design Ave, New York, NY 10001",
    "city": "New York",
    "state": "NY",
    "rating": 4.8,
    "reviewCount": 145,
    "verified": true,
    "priceRange": "premium"
  }' | jq
echo -e "\n"

# Search Professionals
echo "4️⃣ Search Professionals"
curl -s "$BASE_URL/api/search/professionals?q=architect&minRating=4" | jq
echo -e "\n"

# Search with Location
echo "5️⃣ Search Professionals Near Location"
curl -s "$BASE_URL/api/search/professionals?q=architect&location=40.7128,-74.0060&radius=25" | jq
echo -e "\n"

# Autocomplete
echo "6️⃣ Autocomplete Test"
curl -s "$BASE_URL/api/search/autocomplete?q=arch&type=professionals&limit=5" | jq
echo -e "\n"

# Search Products
echo "7️⃣ Search Products"
curl -s "$BASE_URL/api/search/products?q=sofa&minPrice=500&maxPrice=2000" | jq
echo -e "\n"

# Cache Stats
echo "8️⃣ Cache Statistics"
curl -s "$BASE_URL/api/admin/cache/stats" | jq
echo -e "\n"

echo "✅ All tests completed!"

