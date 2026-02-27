# Professional Documents API

Manages professional verification documents (IDs, certificates, tax compliance, insurance, etc.).

## Endpoints

### GET `/api/professional-portal/documents`

List all documents for the authenticated professional.

- **Auth**: Professional (owner)
- **Rate limit**: READ
- **Query**: `?category=EDUCATION_CERT&status=VERIFIED`
- **Soft-delete aware**: Excludes `deletedAt` records

### POST `/api/professional-portal/documents`

Create a document linked to a pre-uploaded Asset.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported (scope: `professional_document`)
- **Limit**: 50 documents per professional
- **Body**: `{ title, category, assetId, issuer?, issueDate?, expiryDate? }`
- **Side effects**: Sets profile `verificationStatus` to `PENDING`
- **GDPR**: Consent record created; audit log for sensitive categories (ID_OR_PASSPORT, TAX_COMPLIANCE, INSURANCE_POLICY)

### GET `/api/professional-portal/documents/[id]`

Get document detail with verification info.

- **Auth**: Professional (owner)
- **Rate limit**: READ
- **GDPR**: Audit-logged access for sensitive document categories

### PATCH `/api/professional-portal/documents/[id]`

Update document metadata or replace the linked asset.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Body**: `{ title?, category?, assetId?, issuer?, issueDate?, expiryDate? }`
- **Side effects**: When asset is replaced, resets `status` to `PENDING` and resets profile `verificationStatus`

### DELETE `/api/professional-portal/documents/[id]`

Soft-delete a document.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Audit**: Deletion logged via ComplianceService

## Document Categories

Uses `DocumentCategory` enum from Prisma schema:

- `ID_OR_PASSPORT` — Identity documents
- `EDUCATION_CERT` — Degrees, diplomas
- `AWARD_OR_RECOGNITION` — Professional awards
- `TAX_COMPLIANCE` — KRA TCC
- `INSURANCE_POLICY` — Professional indemnity
- `CV_OR_RESUME`
- `OTHER`

## Verification Status Flow

```
PENDING -> IN_REVIEW -> VERIFIED
                     -> NEEDS_CORRECTION -> PENDING (resubmit)
                     -> REJECTED
VERIFIED -> EXPIRED (automatic, based on expiryDate)
         -> SUSPENDED (admin action)
```
