# Idea Books API

Client-facing idea books for saving, organizing, and sharing inspiration — products, projects, images, and file attachments.

## Architecture

```
Frontend
  └── /api/idea-books                      → GET list, POST create
  └── /api/idea-books/[id]                 → GET detail, PATCH update, DELETE, POST attachment
  └── /api/idea-books/[id]/attachments     → GET list
  └── /api/idea-books/[id]/attachments/[x] → GET detail, PATCH caption, DELETE
        └── Prisma (IdeaBook + IdeaBookAttachment + IdeaBookCollaborator)
```

## Schema Models

### IdeaBook

```
IdeaBook {
  id           UUID
  clientId     FK → User
  title        String
  slug         String (unique, auto-generated)
  description  Text?
  category     IdeaBookCategory (LIVING_ROOM, KITCHEN, BATHROOM, ...)
  privacy      IdeaBookPrivacy (PUBLIC, SHARED_LINK, PRIVATE)
  viewCount    Int
  likes        Int
  createdAt    DateTime
  updatedAt    DateTime

  Relations: collaborators[], savedProducts[], savedProjects[], savedImages[], attachments[]
}
```

### IdeaBookAttachment

```
IdeaBookAttachment {
  id            UUID
  ideaBookId    FK → IdeaBook
  sourceUrl     String?
  caption       String?

  // Legacy file fields (migrating to Asset)
  fileKey       String? (unique)
  fileUrl       String?
  mimeType      String?
  size          Int?
  width         Int?
  height        Int?

  // Centralized asset reference (preferred)
  assetId       FK → Asset?
  uploadedById  FK → User?

  createdAt     DateTime
  updatedAt     DateTime
}
```

## Cross-Cutting Concerns

- **Authentication**: `withAuth` middleware (all endpoints require auth)
- **Rate Limiting**: Scoped keys (`idea-books-read:`, `idea-books-write:`)
- **Resilience**: `getResilientExecutor().execute()` with circuit breaker
- **Validation**: Zod schemas from `idea-books-validation.ts` with Prisma enum types
- **Body Size Limits**: `checkBodySize` on all mutations
- **ID Validation**: `isValidId` on all path parameters
- **Ownership Verification**: Every operation checks `clientId` matches authenticated user
- **Idempotency**: `IdempotencyService` on idea book creation

## Endpoints

### Idea Books

| Method | Path                    | Description                             |
| ------ | ----------------------- | --------------------------------------- |
| GET    | `/api/idea-books`       | List books (paginated, searchable)      |
| POST   | `/api/idea-books`       | Create book (with idempotency)          |
| GET    | `/api/idea-books/:id`   | Get book detail + attachments + collabs |
| PATCH  | `/api/idea-books/:id`   | Update title/desc/category/privacy      |
| DELETE | `/api/idea-books/:id`   | Delete (cascades all children)          |
| POST   | `/api/idea-books/:id`   | Add attachment to book                  |

### Attachments

| Method | Path                                              | Description               |
| ------ | ------------------------------------------------- | ------------------------- |
| GET    | `/api/idea-books/:id/attachments`                 | List attachments (paged)  |
| GET    | `/api/idea-books/:id/attachments/:attachmentId`   | Get attachment detail     |
| PATCH  | `/api/idea-books/:id/attachments/:attachmentId`   | Update caption            |
| DELETE | `/api/idea-books/:id/attachments/:attachmentId`   | Delete attachment         |

## Request/Response Examples

### Create Idea Book

```json
POST /api/idea-books
{
  "title": "Dream Kitchen Ideas",
  "description": "Inspiration for my kitchen renovation",
  "category": "KITCHEN",
  "privacy": "PRIVATE"
}
```

Response (201): Full idea book object with select fields.

### Add Attachment (Asset-based)

```json
POST /api/idea-books/{id}
{
  "assetId": "asset-uuid",
  "caption": "Marble countertop inspiration"
}
```

### Add Attachment (Legacy file fields)

```json
POST /api/idea-books/{id}
{
  "fileUrl": "https://storage.example.com/photo.jpg",
  "fileKey": "uploads/photo.jpg",
  "mimeType": "image/jpeg",
  "size": 245000,
  "width": 1920,
  "height": 1080,
  "caption": "Kitchen island concept"
}
```

### List Idea Books

```
GET /api/idea-books?page=1&limit=20&search=kitchen&category=KITCHEN
```

## Enums

| Enum             | Values                                                                              |
| ---------------- | ----------------------------------------------------------------------------------- |
| IdeaBookCategory | LIVING_ROOM, KITCHEN, BATHROOM, BEDROOM, OUTDOOR_LANDSCAPING, COMMERCIAL_OFFICE, RETAIL_SHOP, WHOLE_HOUSE |
| IdeaBookPrivacy  | PUBLIC, SHARED_LINK, PRIVATE                                                        |

## Critical Bugs Fixed in This Refactor

1. **`sharedWith` → `collaborators`**: The old code referenced `sharedWith` which does not exist on the `IdeaBook` model. The correct relation is `collaborators` (via `IdeaBookCollaborator`). Every `_count` and `include` call would have thrown a Prisma runtime error.

2. **`items` field removed**: The old code used `items: []` in create and `items: z.array(z.any())` in update, but `IdeaBook` has no `items` JSON field. Content is organized through `savedProducts`, `savedProjects`, and `savedImages` relations.

3. **Attachment fields corrected**: The old code used `url`, `key`, `filename` which don't exist on `IdeaBookAttachment`. Corrected to use `sourceUrl`, `fileKey`, `fileUrl` (legacy) plus `assetId` (centralized Asset reference).

4. **Missing `category` and `privacy`**: Now exposed in create/update schemas with proper enum validation.

5. **`apiError()` inside `executeResilient` callback**: Caused double-wrapping (error response wrapped in success). Fixed by switching to `getResilientExecutor().execute()` with `_error` sentinel pattern.

## Validation Module

Schemas in `app/lib/validation/idea-books-validation.ts`:

- `IdeaBookQuerySchema` — GET query params with search and category filter
- `CreateIdeaBookSchema` — POST body with category and privacy enums
- `UpdateIdeaBookSchema` — PATCH body
- `AddAttachmentSchema` — POST body supporting both Asset-based and legacy file modes
- `UpdateAttachmentSchema` — PATCH body for caption
- `ideaBookListSelect` / `ideaBookDetailSelect` / `attachmentListSelect` — Prisma select objects
