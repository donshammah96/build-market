# Professional Certificates API

Category-scoped convenience endpoints over the `ProfessionalDocument` model, restricted to `EDUCATION_CERT` and `AWARD_OR_RECOGNITION` categories. The original `Certificate` model was migrated into `ProfessionalDocument`.

Certificates share the same document count limit as other professional documents.

## Endpoints

### `GET /api/professional-portal/certificates`

List certificates for the authenticated professional.

**Query Parameters:**

| Parameter  | Type                                       | Description                   |
| ---------- | ------------------------------------------ | ----------------------------- |
| `category` | `EDUCATION_CERT` \| `AWARD_OR_RECOGNITION` | Filter by certificate type    |
| `status`   | `VerificationStatus`                       | Filter by verification status |

**Response:** `200 OK` — Array of certificate documents with linked asset details.

### `POST /api/professional-portal/certificates`

Create a new certificate linked to a pre-uploaded Asset.

**Body:**

| Field        | Type                                       | Required | Default          |
| ------------ | ------------------------------------------ | -------- | ---------------- |
| `title`      | `string` (1–200 chars)                     | Yes      | —                |
| `category`   | `EDUCATION_CERT` \| `AWARD_OR_RECOGNITION` | No       | `EDUCATION_CERT` |
| `assetId`    | `UUID`                                     | Yes      | —                |
| `issuer`     | `string` (max 200)                         | No       | —                |
| `issueDate`  | ISO 8601 datetime                          | No       | —                |
| `expiryDate` | ISO 8601 datetime                          | No       | —                |

**Response:** `201 Created` — The created certificate.

### `GET /api/professional-portal/certificates/[id]`

Get details of a specific certificate (includes verifiedBy info).

**Response:** `200 OK` — Certificate detail. Returns 404 if the document is not a certificate category.

### `PATCH /api/professional-portal/certificates/[id]`

Update a certificate. All fields optional. Resets verification status to `PENDING` if the asset is replaced.

**Response:** `200 OK` — The updated certificate.

### `DELETE /api/professional-portal/certificates/[id]`

Soft-delete a certificate (sets `deletedAt`).

**Response:** `200 OK` — `{ message: "Certificate deleted successfully" }`

## Migration Note

The original `Certificate` model was consolidated into `ProfessionalDocument` with the following category mappings:

- Degrees/Diplomas → `EDUCATION_CERT`
- Awards → `AWARD_OR_RECOGNITION`

The old `fileUrl`/`fileKey` fields are deprecated. New certificates must use the `assetId` field, linking to the centralized `Asset` model.

## Cross-Cutting Concerns

- **Authentication**: All endpoints require Clerk authentication via `withAuth`.
- **Rate Limiting**: Scoped keys (`certificates-read`, `certificates-write`, `certificate-*`).
- **Resilience**: All database operations wrapped in `getResilientExecutor().execute()`.
- **Idempotency**: POST and PATCH mutations use `IdempotencyService` (SHA-256 keyed).
- **Validation**: Zod schemas restrict `category` to certificate-only values.
- **Data Minimization**: Prisma `select` objects (`certificateListSelect`, `certificateDetailSelect`).
- **GDPR Compliance**: `ConsentRecord` on creation, `ComplianceService` audit logging on create/delete.
- **Soft Delete**: DELETE sets `deletedAt` on the underlying `ProfessionalDocument`.
- **Body Size**: POST/PATCH enforce 1 MB body size limit.
- **ID Validation**: `[id]` routes validate UUID format via `isValidId`.
