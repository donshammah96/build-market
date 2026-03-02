# Professionals API

Public read-only API for listing and viewing professional profiles.

Aligned with API-to-frontend architecture: Service → API routes (thin adapters).

## Endpoints

### GET /api/professionals

List verified professionals with filtering, sorting, and pagination.

**Query parameters:**

- `search` (string, max 100 chars) — Search in name, company, bio, services
- `category` (string) — Category slug (e.g. `architecture`, `plumbing`, `all`)
- `profession` (Profession enum) — Filter by profession (e.g. `PLUMBER`)
- `county` (County enum) — Filter by county
- `city` (string) — Filter by city
- `sortBy` — `rating` | `experience` | `reviews` | `newest` (default: `rating`)
- `includeUnverified` — `true` | `false` (default: `false`, dev/admin only)
- `limit` (1–100, default: 50)
- `offset` (default: 0)

**Response:** `{ success, data: { professionals, total, hasMore } }`

### GET /api/professionals/[id]

Get detailed professional profile by user ID.

**Response:** `{ success, data: ProfessionalDetailResult }`

## Architecture

- **Service layer** — `lib/services/professionals.ts` — `getProfessionals`, `getProfessionalById`
- **Server Actions** — `app/actions/professionals.ts` — `getProfessionalsAction`, `getProfessionalByIdAction` (public, no auth)
- **Client facade** — `lib/professionals-client.ts` — ResilientExecutor, bulkhead
- **Hooks** — `hooks/useProfessionals.ts` — `useProfessionals`, `useProfessional`
- **API routes** — Thin adapters: validate → call service → respond

## Validation

- `app/lib/validation/professionals-validation.ts` — `ProfessionalQuerySchema` for query params
- `app/lib/config/professional.config.ts` — Domain constants

## Repository

- `app/lib/repositories/professional.repository.ts` — `findMany`, `findByUserId` (used by service)
