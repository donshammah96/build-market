# Onboarding Upload Migration: `fileUrl` → `assetId`

## Status: **Complete** (2026-03-16)

Staff-level audit confirms the staged-upload design is implemented and refined. Legacy URL-based persistence has been removed in favor of `uploadId` → `assetId` materialization.

---

## Original Problem

`/api/onboarding/uploads` previously stored files and returned URL strings. At upload time, the caller may be authenticated in Clerk but not yet exist in the app DB. Because `Asset` requires `uploaderId`, creating `Asset` at upload-time caused FK violations when onboarding completion wrote URLs to `assetId`.

---

## Implemented Design: Staged Upload References

### 1) Staging Table ✅

`OnboardingUpload` model exists (migration `20260301000131_staging_uploads`):

- `id`, `clerkId`, `tempUrl`, `originalName`, `mimeType`, `size`, `checksum`, `storageBucket`, `storageKey`
- `status` (`STAGED` | `CONSUMED` | `EXPIRED`)
- `expiresAt`, `consumedAt`, `consumedByUserId`
- Unique `(id, clerkId)`; indexed `clerkId`, `expiresAt`

### 2) Upload Response Contract ✅

`POST /api/onboarding/uploads` returns references, not raw URLs as persistence keys:

```json
{
  "success": true,
  "data": {
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
}
```

- `uploadId` is persisted in form state and submitted to onboarding completion.
- `previewUrl` is for UI preview only.

### 3) Onboarding Payload ✅

Professional onboarding uses `documents` array with `uploadId` (and optional `previewUrl`, `category`, `title`). Legacy `certificatesUrls` / `idDocumentsUrls` have been removed (`@build/types`).

### 4) Materialization ✅

Inside onboarding completion transactions:

1. Upsert DB user/profile first.
2. Fetch staged rows by `uploadId[]` + `clerkId` + `status=STAGED` + not expired.
3. Validate count matches request.
4. Create `Asset` with `uploaderId = user.id` and metadata from staging.
5. Create `ProfessionalDocument` with `assetId` only (no `fileUrl` for new records).
6. Mark staged rows as `CONSUMED`.

Implemented in:

- `app/lib/domains/user-profile/onboarding.ts` (main onboarding + professional complete)
- `app/lib/domains/professional-settings/service.ts` (profile complete)
- `app/lib/domains/uploads/service.ts` (`materializeOnboardingUpload`)

### 5) Backward Compatibility ✅

Legacy URL payloads (`certificatesUrls`, `idDocumentsUrls`) have been removed. All clients use `documents` with `uploadId`.

### 6) Security and Integrity ✅

- Staged upload ownership bound to `clerkId`.
- Single-consume semantics via `status` transition.
- Idempotency on `/api/onboarding` where applicable.
- `uploadService.cleanupExpiredStagedUploads()` called by scheduled BullMQ job (which marks expired rows via `uploadRepository.markStagedUploadsExpiredByIds()`).

### 7) TTL Cleanup Job ✅

A BullMQ job cleans up expired staged uploads daily (default 3 AM): deletes storage blobs via `getStorageProvider().delete(storageKey)` and marks records as `EXPIRED`. Configured via `ONBOARDING_UPLOAD_CLEANUP_CRON` (cron pattern, e.g. `0 3 * * *`). Implemented in `app/jobs/onboarding-upload-cleanup.ts`; orchestration in `uploadService.cleanupExpiredStagedUploads()` (finds expired, deletes storage, marks status); wired into central job orchestrator (`app/jobs/index.ts`). Tests in `__tests__/jobs/onboarding-upload-cleanup.test.ts` and `__tests__/lib/uploads/service.test.ts`.

---

## Refinement Checklist (API-TO-FRONTEND-ARCHITECTURE §8B)

### Boundary Refinement

- [x] Remove leftover client-side DTO repair — N/A (client uses `uploadId`/`previewUrl` from API)
- [x] Explicit DTO mappers — `StagedOnboardingUpload`, `MaterializedUpload` (assetId only)
- [x] No compatibility imports from `lib/services/*` — uploads domain is canonical

### UI Refinement

- [x] Dynamic components — `ProfessionalForm` uses `onboardingClient.uploadFiles`; no heavy inline UI
- [x] Extracted components — N/A (onboarding form is self-contained)
- [x] Skeletons/error surfaces — Route-level `loading.tsx`/`error.tsx` for onboarding segments

### Correctness Refinement

- [x] Hydration-sensitive rendering — Dates in upload responses are ISO strings
- [x] Route-aware refetch — Onboarding uses standard error handling
- [x] Idempotency, actor propagation — Enforced in domain and route adapters

### Documentation Refinement

- [x] `apps/client/docs/CHANGELOG.md` — Updated on refinement
- [x] `apps/client/docs/PROGRESS-SUMMARY.md` — N/A (slice complete)
- [ ] ADRs — N/A (slice-specific; no new architectural rules)

---

## Verification

- [x] `pnpm -C apps/client exec tsc --noEmit`
- [x] `__tests__/api/onboarding/uploads.test.ts`
- [x] `__tests__/lib/uploads/service.test.ts` (staging, materialization, expired rejection, cleanupExpiredStagedUploads)
- [x] `__tests__/jobs/onboarding-upload-cleanup.test.ts` (schedule, processor, error handling)
- [x] `__tests__/lib/non-dashboard-browser-clients.test.ts` (onboarding client)
