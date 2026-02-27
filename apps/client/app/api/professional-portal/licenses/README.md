# Professional Licenses API

Manages professional licenses issued by Kenyan regulatory authorities (NCA, EBK, BORAQS, etc.).

## Endpoints

### GET `/api/professional-portal/licenses`

List all licenses for the authenticated professional.

- **Auth**: Professional (owner)
- **Rate limit**: READ

### POST `/api/professional-portal/licenses`

Create a new license.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported (scope: `professional_license`)
- **Limit**: 20 licenses per professional
- **Unique constraint**: `(professionalId, authority, licenseNumber)` — duplicates rejected
- **Body**: `{ authority, licenseNumber, category?, validFrom, validUntil?, isAnnualRenewal?, assetId? }`
- **GDPR**: Consent record created; audit log

### GET `/api/professional-portal/licenses/[id]`

Get license detail with verification info.

- **Auth**: Professional (owner)
- **Rate limit**: READ

### PATCH `/api/professional-portal/licenses/[id]`

Update license metadata or replace the linked asset.

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Body**: `{ licenseNumber?, category?, validFrom?, validUntil?, isAnnualRenewal?, assetId? }`
- **Side effects**: When asset is replaced, resets `status` to `PENDING` and clears verification

### DELETE `/api/professional-portal/licenses/[id]`

Delete a license (hard delete — no `deletedAt` column on model).

- **Auth**: Professional (owner)
- **Rate limit**: WRITE
- **Idempotency**: Supported
- **Audit**: Deletion logged via ComplianceService

## License Authorities

Uses `LicenseAuthority` enum from Prisma schema:

- `NCA` — National Construction Authority (Contractors)
- `EBK` — Engineers Board of Kenya
- `BORAQS` — Board of Registration of Architects and Quantity Surveyors
- `EARB` — Estate Agents Registration Board
- `ERC` — Energy and Petroleum Regulatory Authority (Electricians)
- `ISK` — Institution of Surveyors of Kenya
- `NEMA` — National Environment Management Authority
- `KEBS` — Kenya Bureau of Standards
- `OTHER`

## Verification

Licenses use the shared `VerificationStatus` enum. Verification can be:

- `MANUAL` — Admin review
- `API_NCA` — Automated NCA API check
- `API_EBK` — Automated EBK API check
