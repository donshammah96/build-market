# Professional Portal — Profile API

Endpoints for managing and viewing professional profiles.

## Endpoints

### GET /api/professional-portal/profile

Get the authenticated professional's own profile as the normalized `OwnProfessionalProfile` DTO.

**Auth:** Required (`withAuth`)

**Response:** `{ success, data: OwnProfessionalProfile }`

Normalized DTO fields:

- `id`, `userId`, `companyName`, `profession`, `bio`, `city`, `county`
- `website`, `portfolioUrl`, `yearsExperience`, `licenseNumber`
- `verified`, `createdAt`, `updatedAt`
- `services: { id, name, slug, icon? }[]`
- `user: { firstName, lastName, email, avatar }`
- `images?: { id, url, caption, isMain }[]`

### PATCH /api/professional-portal/profile

Update the authenticated professional's profile and return the refreshed normalized `OwnProfessionalProfile` DTO.

**Auth:** Required (`withAuth`)

**Body:** `UpdateProfileSchema` — firstName, lastName, companyName, profession, bio, location, services, etc.

**Response:** `{ success, data: OwnProfessionalProfile }`

### GET /api/professional-portal/profile/[id]

Get a professional's public profile by user ID.

**Auth:** None (public)

**Response:** `{ success, data: PublicProfessionalProfile }`

Normalized DTO adds:

- `avgRating`
- `portfolios: { id, title, description, projectType, completedAt, images[] }[]`
- `reviews: { id, rating, comment, createdAt, reviewer }[]`
- `certificates: { id, name, issuer, issueDate, expiryDate }[]`
- `_count: { reviews, projects, portfolios, stores?, properties? }`

## Schema alignment

- **ProfessionalProfile** — Uses `userId` as PK (same as User.id).
- API adapters normalize internal relations into the shared DTOs in `lib/profile-contracts.ts`.
- `offeredServices` is flattened to `services` for client consumers.
- verified `documents` are exposed as presentation-safe `certificates` in the public DTO.
- `licenses` are reduced to the public-facing `licenseNumber` field.
- Idempotency via `IdempotencyService` (scope: `"profile"`) for PATCH.

## Validation

- `app/lib/profile-validation.ts` — `UpdateProfileSchema`.
- `app/lib/config/professional.config.ts` — Domain constants.
- `lib/profile-contracts.ts` — shared normalized own/public profile DTOs.
