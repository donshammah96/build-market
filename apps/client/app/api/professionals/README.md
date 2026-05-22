# Professionals API

Public read-only API for listing and viewing professional profiles.

Aligned with API-to-frontend architecture: Domain service → API routes (thin adapters).

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

- **Domain layer** — `app/lib/domains/professionals/` — contracts, repository entrypoint, service
- **Server Actions** — `app/actions/professionals.ts` — public compatibility adapters over the domain service
- **Client facade** — `lib/professionals-client.ts` — browser-safe REST client with explicit DTOs
- **Hooks** — `hooks/useProfessionals.ts` — `useProfessionals`, `useProfessional`
- **API routes** — Thin adapters: validate → call domain → respond

## Validation

- `app/lib/validation/professionals-validation.ts` — `ProfessionalQuerySchema` for query params
- `app/lib/config/professional.config.ts` — Domain constants

## Repository

- `app/lib/domains/professionals/repository.ts` — canonical repository entrypoint for the slice
- `app/lib/repositories/professional.repository.ts` — existing Prisma-backed implementation used by the domain repository entrypoint
