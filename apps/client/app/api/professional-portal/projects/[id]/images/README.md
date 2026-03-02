# Project Images API

Sub-resource of `/api/professional-portal/projects/[id]`.

## Endpoints

### GET `/projects/[id]/images`

List project images with asset details (cdnUrl, thumbnailUrl, blurHash).

- **Auth**: Professional (project owner)
- **Rate limit**: READ
- **Query**: `?category=FOUNDATION&milestoneId=xxx`

### POST `/projects/[id]/images`

Upload image(s) linked to pre-uploaded Assets.

- **Auth**: Professional (project owner)
- **Rate limit**: WRITE
- **Limit**: 200 images per project, 10 per request
- **Single**: `{ assetId, caption?, category?, milestoneId? }`
- **Batch**: `{ images: [{ assetId, caption?, category?, milestoneId? }, ...] }`
- **Validations**: Asset ownership verified for all images
- **GDPR**: Consent record created

### DELETE `/projects/[id]/images?imageId=xxx`

Delete a project image. Asset soft-deleted via cleanup job.

- **Auth**: Professional (project owner)
- **Rate limit**: WRITE

## Image Categories

Uses `ProjectImageCategory` enum from Prisma schema (e.g., `SITE_PHOTO`, `PROGRESS`, `FOUNDATION`, `STRUCTURE`, `FINISHING`, `BEFORE`, `AFTER`, etc.).
