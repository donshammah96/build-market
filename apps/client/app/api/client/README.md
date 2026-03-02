# Client API

Dashboard and data endpoints for authenticated client users.

## Architecture

```
GET /api/client/dashboard
     │
     ├─ withAuth (Clerk session + DB user verification)
     ├─ Rate limiting (READ tier)
     ├─ Correlation ID
     │
     └─ getResilientExecutor().execute()
          │
          └─ ClientRepository.getDashboardData(userId)
               │
               ├─ Promise.all([
               │    count(total projects),
               │    count(active projects),
               │    count(completed projects),
               │    count(idea books),
               │    findMany(recent projects),
               │    findMany(recent idea books)
               │  ])
               │
               └─ Transform → DashboardData
```

### Files

| File                                    | Purpose                                              |
| --------------------------------------- | ---------------------------------------------------- |
| `dashboard/route.ts`                    | HTTP handler — auth, rate limit, resilient execution |
| `lib/repositories/client.repository.ts` | Data access — Prisma queries, transformation, DTOs   |

---

## Endpoints

### GET `/api/client/dashboard`

Returns aggregated dashboard data for the authenticated client.

**Authentication:** Required (Clerk session + active DB user via `withAuth`)  
**Rate Limit:** READ tier, scoped to `client-dashboard:{identifier}`  
**Timeout:** 10 seconds

**Response (200):**

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalProjects": 12,
      "activeProjects": 3,
      "completedProjects": 7,
      "savedProfessionals": 0,
      "ideaBooks": 4
    },
    "projects": [
      {
        "id": "uuid",
        "title": "Kitchen Renovation",
        "description": "Complete kitchen remodel...",
        "status": "IN_PROGRESS",
        "progress": 65,
        "budget": 450000.0,
        "milestoneCount": 5,
        "professional": {
          "id": "uuid",
          "name": "Don Shammah",
          "title": "Interior Designer"
        },
        "startDate": "2026-01-15T00:00:00.000Z",
        "estimatedEndDate": "2026-06-15T00:00:00.000Z"
      }
    ],
    "ideaBooks": [
      {
        "id": "uuid",
        "title": "Modern Kitchen Ideas",
        "category": "KITCHEN",
        "itemCount": 15,
        "attachmentCount": 8,
        "coverImage": "https://cdn.example.com/image.jpg",
        "updatedAt": "2026-02-14T12:00:00.000Z"
      }
    ],
    "savedProfessionals": []
  }
}
```

**Error Responses:**

| Status | Condition                         |
| ------ | --------------------------------- |
| `401`  | Not authenticated                 |
| `403`  | User suspended/banned/deactivated |
| `429`  | Rate limit exceeded               |
| `500`  | Internal error                    |

---

## Data Model

### DashboardStats

| Field                | Type     | Description                                      |
| -------------------- | -------- | ------------------------------------------------ |
| `totalProjects`      | `number` | All non-deleted projects (database-level count)  |
| `activeProjects`     | `number` | Projects with status `IN_PROGRESS` or `PLANNING` |
| `completedProjects`  | `number` | Projects with status `COMPLETED`                 |
| `savedProfessionals` | `number` | Always `0` — pending `SavedProfessional` model   |
| `ideaBooks`          | `number` | Total idea books owned by user                   |

### DashboardProject

| Field              | Type             | Description                                                                     |
| ------------------ | ---------------- | ------------------------------------------------------------------------------- |
| `id`               | `string`         | Project UUID                                                                    |
| `title`            | `string`         | Project title                                                                   |
| `description`      | `string \| null` | Project description                                                             |
| `status`           | `ProjectStatus`  | Enum: `PLANNING`, `IN_PROGRESS`, `PAUSED`, `COMPLETED`, `ARCHIVED`, `CANCELLED` |
| `progress`         | `number`         | 0-100 percentage (see progress algorithm below)                                 |
| `budget`           | `number \| null` | `agreedPrice` if set, else `budgetMin` (converted from Decimal)                 |
| `milestoneCount`   | `number`         | Number of project milestones                                                    |
| `professional`     | `object \| null` | Assigned professional with `id`, `name`, `title`                                |
| `startDate`        | `string \| null` | ISO 8601 start date                                                             |
| `estimatedEndDate` | `string \| null` | ISO 8601 end date                                                               |

### DashboardIdeaBook

| Field             | Type     | Description                                           |
| ----------------- | -------- | ----------------------------------------------------- |
| `id`              | `string` | IdeaBook UUID                                         |
| `title`           | `string` | IdeaBook title                                        |
| `category`        | `string` | `IdeaBookCategory` enum value                         |
| `itemCount`       | `number` | Sum of saved products + projects + images             |
| `attachmentCount` | `number` | Number of attachments                                 |
| `coverImage`      | `string` | Asset CDN URL → legacy `fileUrl` → `/placeholder.jpg` |
| `updatedAt`       | `string` | ISO 8601 last-updated timestamp                       |

---

## Progress Algorithm

`ClientRepository.calculateProgress(status, startDate, endDate)` computes a 0-100 progress value:

| Status                        | Progress | Logic                                                                    |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `COMPLETED`                   | 100      | Fixed                                                                    |
| `ARCHIVED`                    | 100      | Fixed                                                                    |
| `CANCELLED`                   | 0        | Fixed                                                                    |
| `PLANNING` (or no start date) | 10       | Fixed                                                                    |
| `IN_PROGRESS` / `PAUSED`      | 10-99    | Time-based interpolation: `elapsed / total * 100`, clamped to `[10, 99]` |

100% is reserved for `COMPLETED`/`ARCHIVED` — an in-progress project never shows 100%.

---

## Cross-Cutting Concerns

| Concern                   | Implementation                                                               |
| ------------------------- | ---------------------------------------------------------------------------- |
| **Authentication**        | `withAuth` middleware — verifies Clerk session, loads DB user, checks status |
| **Rate Limiting**         | READ tier, scoped key `client-dashboard:{identifier}`                        |
| **Resilience**            | `getResilientExecutor().execute()` with 10s timeout, circuit breaker         |
| **Correlation ID**        | Propagated to all log entries and error responses                            |
| **Data Minimization**     | Strict `select` objects on all Prisma queries                                |
| **Structured Logging**    | userId, project counts, and timing in all log entries                        |
| **Soft-Delete Filtering** | `deletedAt: null` on all project queries                                     |
| **Decimal Serialization** | Prisma `Decimal` → `number` conversion for JSON compatibility                |

---

## Query Optimization

The dashboard uses `Promise.all` to run **6 parallel queries** instead of sequential fetching:

1. `project.count(total)` — total non-deleted projects
2. `project.count(active)` — active projects (IN_PROGRESS + PLANNING)
3. `project.count(completed)` — completed projects
4. `ideaBook.count(total)` — total idea books
5. `project.findMany(recent 10)` — display data
6. `ideaBook.findMany(recent 6)` — display data

Stats are computed from **database-level counts**, not from the limited display results, ensuring accurate numbers regardless of how many projects the user has.

---

## Critical Bugs Fixed in This Refactor

| #   | Bug                                                                      | Impact                                                                                                                                 | Fix                                                                                               |
| --- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | **Stats derived from `take: 10` results**                                | `activeProjects` and `completedProjects` counts were wrong for users with > 10 projects (counted from limited slice, not full dataset) | Separate `count()` queries at database level                                                      |
| 2   | **Used `executeResilient` (legacy wrapper)**                             | No correlation ID in responses; `apiSuccess` called with wrong signature internally (headers object passed as correlationId string)    | Switched to `getResilientExecutor().execute()` + explicit `apiSuccess`                            |
| 3   | **No `deletedAt: null` filter** on projects                              | Soft-deleted projects appeared in dashboard and stats                                                                                  | Added filter to all project queries                                                               |
| 4   | **Decimal not serialized**                                               | `budget` field was `Prisma.Decimal` type — serializes to string in JSON, not number                                                    | Explicit `Number()` conversion                                                                    |
| 5   | **Missing correlation ID** in error responses                            | Error responses had no correlation ID for tracing                                                                                      | Passed to all `apiError` and `apiSuccess` calls                                                   |
| 6   | **Progress 20% for PLANNING** was arbitrary                              | CANCELLED returned non-zero; no distinction for ARCHIVED; 100% reachable for in-progress                                               | Revised algorithm: CANCELLED=0, PLANNING=10, IN_PROGRESS clamped to 10-99, COMPLETED/ARCHIVED=100 |
| 7   | **Unused imports** (`ProjectStatus` in route, `County`/`Prisma` in repo) | Dead code                                                                                                                              | Cleaned up                                                                                        |
| 8   | **`calculateProgress` was instance method**                              | Required unnecessary class instantiation to test                                                                                       | Changed to `static` method                                                                        |
| 9   | **No `category` on idea books**                                          | Dashboard didn't expose category for filtering/display                                                                                 | Added to select and DTO                                                                           |
