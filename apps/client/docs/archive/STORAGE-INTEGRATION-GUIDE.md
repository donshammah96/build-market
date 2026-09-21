# Storage Integration Guide

Canonical plan for `apps/client` uploads, private assets, and direct document
upload hardening.

Last updated: 2026-05-03

## Layer Ownership

Storage remains an infrastructure leaf:

```text
Browser / hooks
  -> app/api/uploads/**
  -> app/lib/domains/uploads/service.ts
  -> app/lib/infrastructure/storage.ts
```

Only the uploads domain imports `getStorageProvider()`. Routes stay thin and
browser code never imports storage. Domain consumers persist `assetId`, not
storage keys, bucket names, CDN URLs, or presigned URLs.

## Decision Table

| Upload class                   | Path                             | Visibility | Stored URL     | Notes                                                                |
| ------------------------------ | -------------------------------- | ---------- | -------------- | -------------------------------------------------------------------- |
| Property/listing images        | `POST /api/uploads` multipart    | `PUBLIC`   | `cdnUrl`       | Existing worker path remains authoritative.                          |
| Portfolio/profile images       | `POST /api/uploads` multipart    | `PUBLIC`   | `cdnUrl`       | Image processing, thumbnails, blurhash unchanged.                    |
| Credentials/documents/licenses | Direct upload                    | `PRIVATE`  | `assetId` only | Browser uploads to storage; server verifies before creating `Asset`. |
| Private downloads              | `GET /api/uploads/[id]/download` | `PRIVATE`  | never stored   | Returns a 15-minute presigned URL after owner/admin authorization.   |

Direct image upload is intentionally out of scope for this rollout.

## Direct Document Upload

1. Browser validates file type/size and computes SHA-256.
2. Browser calls `POST /api/uploads/presign`.
3. Server derives `visibility: PRIVATE`; clients cannot choose visibility.
4. Server creates a `DirectUpload` row with status `PRESIGNED`.
5. Browser PUTs bytes to `uploadUrl` with `requiredHeaders`.
6. Browser calls `POST /api/uploads/confirm` with `uploadId`.
7. Server verifies owner, pending status, expiry, object existence, exact size,
   MIME, SHA-256, and magic bytes.
8. Server creates a private `Asset`, marks the row `CONFIRMED`, and returns
   `{ assetId, visibility: "PRIVATE" }`.

Presign request:

```json
{
  "filename": "license.pdf",
  "mimeType": "application/pdf",
  "size": 12345,
  "checksumSha256": "64_hex_chars",
  "context": "document",
  "temporary": false,
  "tempExpiryHours": 24
}
```

Confirm request:

```json
{ "uploadId": "uuid" }
```

## Private Download

`GET /api/uploads/[id]/download` authorizes the current user as either:

- asset owner, or
- `ADMIN`.

Private assets return a 15-minute presigned URL. Public assets return their
stable CDN URL. Responses are emitted through authenticated API middleware with
private no-store headers.

The database never stores private presigned URLs.

## Schema Contract

- `Asset.visibility`: `PUBLIC` or `PRIVATE`, default `PUBLIC`.
- `Asset.cdnUrl`: nullable; private assets must keep it null.
- `Asset` dedupe is scoped by `(uploaderId, checksum, visibility)`.
- `DirectUpload.status`: `PRESIGNED`, `CONFIRMED`, `EXPIRED`, `FAILED`.
- `DirectUpload` owns the unconfirmed storage key until confirmation or cleanup.

## Environment Setup

Use canonical R2 names first; S3 aliases remain compatibility fallbacks.

```bash
STORAGE_PROVIDER=s3
S3_DISABLED=false

R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_REGION=auto
R2_ACCESS_KEY_ID=<secret>
R2_SECRET_ACCESS_KEY=<secret>

R2_ASSET_BUCKET=buildmarket-assets
R2_PRIVATE_BUCKET=buildmarket-private-assets
R2_PUBLIC_BASE_URL=https://cdn.buildmarket.app

# temporary aliases
S3_ASSET_BUCKET=buildmarket-assets
S3_PRIVATE_BUCKET=buildmarket-private-assets
CDN_URL=https://cdn.buildmarket.app
```

Production fails closed when remote storage is enabled without credentials,
endpoint, public bucket, private bucket, or a remote public CDN origin.

## Testing And Mocks

Use both override layers depending on test scope:

- `setStorageProviderForTests(provider)` for infrastructure-level storage tests.
- `setUploadServiceStorageProviderForTests(provider)` for upload domain tests.

Mocks must implement the full storage interface:

```ts
const provider: StorageProvider = {
  upload: vi.fn(),
  getPresignedUploadUrl: vi.fn(),
  getPresignedDownloadUrl: vi.fn(),
  putObject: vi.fn(),
  readObject: vi.fn(),
  delete: vi.fn(),
  exists: vi.fn(),
  getMetadata: vi.fn(),
};
```

Direct upload tests should cover auth, rate limits, required headers, TTL,
owner mismatch, missing object, expiry, checksum mismatch, MIME mismatch,
magic-byte rejection, duplicate confirmation, download authorization, and
cleanup of abandoned blobs.

## Operations

ADR-005 operation names:

- `presign_direct_upload`
- `confirm_direct_upload`
- `get_upload_download_url`
- `cleanup_expired_direct_uploads`

Do not log filenames, checksums, storage keys, bucket names, or presigned URLs.
Log only stable request metadata, outcome, role, correlation ID, and row/asset
IDs when needed for support.

## Cleanup

`cleanupExpiredDirectUploads()` deletes unconfirmed blobs whose `expiresAt` has
passed and marks their rows `EXPIRED`. It runs from the onboarding upload
cleanup scheduler alongside staged onboarding upload cleanup.

Cleanup is best effort for storage deletes, but status updates continue so stale
pending rows do not remain confirmable.

## Failure Modes

| Failure                           | Response                | Persistence outcome               |
| --------------------------------- | ----------------------- | --------------------------------- |
| Presign validation fails          | `400`                   | no row                            |
| Rate limit exceeded               | `429`                   | no row                            |
| Browser never PUTs                | cleanup marks `EXPIRED` | blob deleted if present           |
| Confirm after expiry              | `410`                   | row marked `EXPIRED`              |
| Wrong owner                       | `403`                   | no asset                          |
| Object missing                    | `400`                   | row remains pending until cleanup |
| Size/MIME/checksum/magic mismatch | `400`                   | row `FAILED`, blob deleted        |
| Duplicate confirm                 | `409`                   | existing asset retained           |

## Verification

Baseline commands for this surface:

```bash
pnpm -C packages/db exec prisma generate
pnpm -C apps/client exec vitest run __tests__/api/uploads __tests__/lib/uploads __tests__/lib/storage-config.test.ts __tests__/lib/upload-client.test.ts --pool=threads --maxWorkers=1
pnpm run client:tsc-noemit
pnpm run client:check-env-contract
pnpm run client:report-security-drift:strict
```
