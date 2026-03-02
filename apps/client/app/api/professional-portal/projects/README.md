# Professional Portal — Projects API

Authenticated endpoints for managing professional projects.

## Endpoints

### GET /api/professional-portal/projects

List projects for the authenticated professional.

**Query parameters:**

- `page` (int, min 1, default: 1)
- `limit` (int, 1–50, default: 20)
- `status` — `PLANNING` | `IN_PROGRESS` | `PAUSED` | `COMPLETED` | `ARCHIVED` | `CANCELLED` | `active` (maps to PLANNING + IN_PROGRESS)

**Response:** `{ success, data: { projects, pagination } }`

### POST /api/professional-portal/projects

Create a new project.

**Body:** `CreateProjectSchema` — title, clientId, type, contractType, budget, dates, location, county, status.

**Response:** `{ success, data: Project }` (201)

### GET /api/professional-portal/projects/[id]

Get a single project by ID (owner only).

**Response:** `{ success, data: ProjectDetail }`

### PATCH /api/professional-portal/projects/[id]

Update a project (owner only).

**Body:** `UpdateProjectSchema` — all fields optional.

**Response:** `{ success, data: ProjectDetail }`

### DELETE /api/professional-portal/projects/[id]

Soft-delete a project (owner only, sets `deletedAt`).

**Response:** `{ success, data: { message, projectId, deletedAt } }`

## Schema alignment

- **Project** — UUID PK, `deletedAt` for soft delete, `professionalId` for ownership.
- Queries always include `deletedAt: null`.
- Idempotency via `IdempotencyService` (scope: `"project"`).

## Validation

- `app/lib/projects-validation.ts` — `CreateProjectSchema`, `UpdateProjectSchema`, `ProjectQuerySchema`, select objects.
- `app/lib/config/project.config.ts` — Domain constants.
