# Professional Portal — Profile API

Endpoints for managing and viewing professional profiles.

## Endpoints

### GET /api/professional-portal/profile

Get the authenticated professional's own profile. Includes `offeredServices`, user info.

**Auth:** Required (`withAuth`)

**Response:** `{ success, data: ProfessionalProfile }`

### PATCH /api/professional-portal/profile

Update the authenticated professional's profile.

**Auth:** Required (`withAuth`)

**Body:** `UpdateProfileSchema` — firstName, lastName, companyName, profession, bio, location, services, etc.

**Response:** `{ success, data: ProfessionalProfile }`

### GET /api/professional-portal/profile/[id]

Get a professional's public profile by user ID.

**Auth:** None (public)

**Response:** `{ success, data: ProfessionalProfileDetail }` — includes services, licenses, portfolios, documents, reviews, counts.

## Schema alignment

- **ProfessionalProfile** — Uses `userId` as PK (same as User.id).
- Uses `offeredServices` (ProfessionalService junction) — not the deprecated `services` relation.
- Uses `documents` (ProfessionalDocument) — not `certificates`.
- Uses `licenses` (ProfessionalLicense) for regulatory licenses (NCA, EBK, BORAQS, etc.).
- Idempotency via `IdempotencyService` (scope: `"profile"`) for PATCH.

## Validation

- `app/lib/profile-validation.ts` — `UpdateProfileSchema`.
- `app/lib/config/professional.config.ts` — Domain constants.
