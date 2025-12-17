# Build Market Client API Documentation

## Overview

This document describes the REST API endpoints available in the Build Market client application. All endpoints follow RESTful conventions and return consistent JSON responses.

## Base Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2025-12-15T10:00:00.000Z",
  "correlationId": "abc-123-def-456"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "details": { ... },
  "timestamp": "2025-12-15T10:00:00.000Z",
  "correlationId": "abc-123-def-456"
}
```

---

## Authentication

Most endpoints require authentication via Clerk. Pass the session token in requests. Unauthenticated requests return `401 Unauthorized`.

---

## Endpoints

### Health Check

| Method | Path | Auth | Rate Limit |
|--------|------|------|------------|
| GET | `/api/health` | No | - |

Returns service health with database and messaging service status.

---

### User Profile

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/user/profile` | Yes | READ | Get authenticated user's profile |
| PATCH | `/api/user/profile` | Yes | WRITE | Update basic profile fields |
| PATCH | `/api/user/profile/complete` | Yes | WRITE | Complete/update full profile |

---

### Professionals

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/professionals` | No | READ | List verified professionals |
| GET | `/api/professionals/[id]` | No | READ | Get professional details |

**Query Parameters (GET /api/professionals):**
- `search` - Search by name/company (max 100 chars)
- `category` - Filter by service category
- `sortBy` - `rating` | `experience` | `reviews`

---

### Properties

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/properties` | No | READ | List available properties |
| GET | `/api/properties/[id]` | No | READ | Get property details with similar listings |

**Query Parameters (GET /api/properties):**
- `type` - Filter by type: `SALE` | `RENT` | `LEASE`
- `category` - Filter by category: `RESIDENTIAL` | `COMMERCIAL` | `LAND` | `INDUSTRIAL`
- `location` - Search by location (max 100 chars)
- `minPrice` - Minimum price filter
- `maxPrice` - Maximum price filter
- `beds` - Minimum bedrooms filter
- `featured` - Filter featured properties: `true`
- `sortBy` - `price_asc` | `price_desc` | `newest` | `oldest`
- `limit` - Results per page (default: 20, max: 50)
- `offset` - Pagination offset

---

### Professional Portal

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/professional-portal/profile` | Yes | READ | Get professional profile |
| PATCH | `/api/professional-portal/profile` | Yes | WRITE | Update professional profile |
| GET | `/api/professional-portal/projects` | Yes | READ | List professional's projects |
| POST | `/api/professional-portal/projects` | Yes | WRITE | Create new project |
| GET | `/api/professional-portal/leads` | Yes | READ | List leads |
| POST | `/api/professional-portal/leads` | Yes | WRITE | Create lead |
| GET | `/api/professional-portal/calendar` | Yes | READ | Get calendar events |
| GET | `/api/professional-portal/finance/stats` | Yes | READ | Get financial statistics |
| GET | `/api/professional-portal/finance/transactions` | Yes | READ | List transactions |
| POST | `/api/professional-portal/finance/withdraw` | Yes | WRITE | Request withdrawal |

---

### Messaging

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| GET | `/api/messaging` | No | - | Health check |
| GET | `/api/messaging/conversations` | Yes | API | List user's conversations |
| POST | `/api/messaging/conversations` | Yes | API | Create conversation |
| GET | `/api/messaging/conversations/[id]` | Yes | API | Get conversation |
| POST | `/api/messaging/messages` | Yes | API | Send message |

---

### Leads (Public)

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/leads` | No | WRITE | Submit inquiry to professional |

---

### Uploads

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/uploads` | Yes | WRITE | Upload files (multipart/form-data) |

---

### Onboarding

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/onboarding` | Yes | AUTH | Complete user onboarding |

---

### Webhooks

| Method | Path | Auth | Rate Limit | Description |
|--------|------|------|------------|-------------|
| POST | `/api/clerk-webhook` | HMAC | WEBHOOK | Clerk user sync webhook |

---

## Rate Limits

| Tier | Limit | Window |
|------|-------|--------|
| AUTH | 5 requests | 1 minute |
| API | 30 requests | 1 minute |
| READ | 100 requests | 1 minute |
| WRITE | 10 requests | 1 minute |
| WEBHOOK | 100 requests | 1 minute |

Exceeded limits return `429 Too Many Requests`.

---

## HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 409 | Conflict |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |
