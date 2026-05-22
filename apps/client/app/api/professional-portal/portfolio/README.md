# Professional Portfolio API

Manages professional portfolio items — showcase projects with images, descriptions, client testimonials, and metadata.

## Route Structure

```text

/api/professional-portal/portfolio/
  route.ts                    (GET list, POST create)
  [id]/
    route.ts                  (GET detail, PATCH update, DELETE)
    images/
      route.ts                (GET list, POST add)
      [imageId]/route.ts      (PATCH update, DELETE remove)
```

## Endpoints

### GET `/api/professional-portal/portfolio`

List portfolio items for the authenticated professional.

- **Auth**: Professional (owner)
- **Rate limit**: READ
- **Query**: `?page=1&limit=20&projectType=RESIDENTIAL`
- **Soft-delete aware**: Excludes `deletedAt` records
- **Response**: Paginated list with preview images (up to 5) and image counts

### POST `/api/professional-portal/portfolio`

Create a new portfolio item.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported (scope: `portfolio`)
- **Limit**: 50 portfolios per professional
- **Body**: `{ title, description?, projectType?, tags?, location?, county?, budget?, currency?, durationValue?, durationUnit?, completionDate?, clientTestimonial?, clientName?, linkedProjectId? }`
- **Slug**: Auto-generated from title with random suffix for uniqueness
- **GDPR**: Consent record created

### GET `/api/professional-portal/portfolio/[id]`

Get portfolio detail with all images.

- **Auth**: Professional (owner)
- **Rate limit**: READ

### PATCH `/api/professional-portal/portfolio/[id]`

Update portfolio metadata.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Body**: All create fields optional; `completionDate` and `linkedProjectId` accept `null` to clear

### DELETE `/api/professional-portal/portfolio/[id]`

Soft-delete a portfolio item.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Audit**: Logged via ComplianceService

## Images Sub-Resource

### GET `/portfolio/[id]/images`

List all images for a portfolio.

- **Query**: `?category=FINISHED_WORK`
- **Ordering**: Main image first, then by sortOrder

### POST `/portfolio/[id]/images`

Add image(s) linked to pre-uploaded Assets.

- **Limit**: 30 images per portfolio, 20 per request
- **Single**: `{ assetId, caption?, category?, isMain?, sortOrder? }`
- **Batch**: `{ images: [...] }`
- **Auto-main**: If no main image exists, first image is promoted

### PATCH `/portfolio/[id]/images/[imageId]`

Update image metadata (caption, category, isMain, sortOrder).

- Setting `isMain: true` automatically unsets previous main image

### DELETE `/portfolio/[id]/images/[imageId]`

Remove an image. If main image is deleted, next image is promoted.

## Image Categories

Uses `PortfolioImageCategory` enum:

- `FINISHED_WORK` — Completed project photos (default)
- `BEFORE_STATE` — Before renovation/construction
- `WORK_IN_PROGRESS` — During construction
- `BLUEPRINT_OR_PLAN` — Architectural plans
- `MATERIAL_BOARD` — Material selections

## Duration Units

Uses `ProjectDurationUnit` enum: `DAYS`, `WEEKS`, `MONTHS`, `YEARS`
