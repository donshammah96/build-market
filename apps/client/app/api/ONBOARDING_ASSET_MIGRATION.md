# Onboarding upload migration: `fileUrl` -> `assetId`

## Problem

`/api/onboarding/uploads` currently stores files and returns a URL string (`/uploads/...`).
At this point in the flow, the caller is authenticated in Clerk but may not exist in the app DB yet.

Because `Asset` requires DB-owned metadata (`uploaderId`, `checksum`, etc.), creating `Asset` at upload-time is not always possible.
If onboarding completion blindly writes the URL string to `assetId`, Prisma FK constraints fail.

## Recommended design: staged upload references

Use a two-phase flow:

1. **Stage files during onboarding upload** (no DB user dependency).
2. **Materialize staged files into `Asset` records** during onboarding completion transaction (after user upsert).

### 1) Add a staging table

Add a table (example name: `OnboardingUpload`) that is independent from `User` FK:

- `id` (UUID)
- `clerkId` (string, indexed)
- `tempUrl` (string)
- `originalName` (string)
- `mimeType` (string)
- `size` (int)
- `checksum` (string)
- `storageBucket` (string)
- `storageKey` (string, unique)
- `status` (`STAGED | CONSUMED | EXPIRED`)
- `expiresAt` (DateTime, indexed)
- `consumedAt` (DateTime?)
- `consumedByUserId` (string?)

**Important constraints**

- Unique `(id, clerkId)` or enforce authorization on read.
- TTL cleanup job removes `EXPIRED`/old staged files.
- Never trust client-provided file metadata at completion time.

### 2) Change onboarding upload response contract

`/api/onboarding/uploads` should return **references**, not raw URLs as persistence keys:

```json
{
  "uploaded": {
    "certificates": [
      {
        "uploadId": "uuid",
        "previewUrl": "/uploads/...",
        "originalName": "cert.pdf"
      }
    ]
  }
}
```

- Keep `previewUrl` only for UI preview/download.
- Persist `uploadId` in form state and submit it to `/api/onboarding`.

### 3) Update onboarding payload

Replace:

- `certificatesUrls: string[]`
- `idDocumentsUrls: string[]`

With:

- `certificateUploadIds: string[]`
- `idDocumentUploadIds: string[]`

### 4) Materialize staged uploads in `/api/onboarding`

Inside the existing transaction:

1. Upsert DB user/profile first.
2. Fetch staged rows by `uploadId[]` + `clerkId` + `status=STAGED` + not expired.
3. Validate count matches request (prevent missing/foreign IDs).
4. Create `Asset` rows with `uploaderId = user.id` and metadata from staging.
5. Create `ProfessionalDocument` rows with `assetId` (not `fileUrl`).
6. Mark staged rows as `CONSUMED` in same transaction.

If any step fails, transaction rolls back and staged uploads remain reusable until TTL.

### 5) Backward compatibility window

For a short migration period:

- Accept both `*Urls` and `*UploadIds` payloads.
- If only URLs are provided, map URL -> staged record by `clerkId + storageKey`.
- Log usage of legacy URL mode and remove after clients are upgraded.

### 6) Security and data integrity

- Bind staged upload ownership to `clerkId` to prevent cross-user consumption.
- Enforce single-consume semantics (`status` transition with optimistic condition).
- Add idempotency key to `/api/onboarding` if retries are common.
- Run periodic cleanup for orphaned staged files.

## Why this works

- Avoids FK violations because `assetId` is only set after an actual `Asset` exists.
- Preserves onboarding UX (upload before DB user exists).
- Creates a clean migration path from URL-based docs to normalized asset management.
- Keeps future storage provider changes isolated from API consumers.
