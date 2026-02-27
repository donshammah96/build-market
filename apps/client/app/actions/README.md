# Server Actions

Server actions provide a type-safe, server-side API for client components. They handle auth, validation, and delegate to service layers.

## Auth Flow: Clerk to Database User Resolution

Clerk provides `userId` (e.g. `user_2abc123`), but the database uses `User.id` (UUID). Actions that need to associate data with a user must resolve Clerk ID to DB user ID before calling services.

```typescript
async function resolveDbUserId(): Promise<string> {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) throw new Error("User not found");
  return user.id;
}
```

**Used in**: `projects.ts`, `messaging.ts`

---

## Projects Actions

### createProjectAction(data)

Creates a project for the authenticated user (as client).

| Input | Type | Description |
|-------|------|-------------|
| `data` | `CreateProjectActionInput` | Project fields; `clientId` is injected from auth; optional `idempotencyKey` for safe retries |

**Idempotency**: Uses `IdempotencyService` with scope `"project"`. Accepts optional `idempotencyKey`; otherwise generates SHA-256 key from user + payload. Duplicate requests return cached response; in-flight requests throw "Request is being processed. Please wait."

**Validation**: `CreateProjectActionSchema` (CreateProjectSchema without clientId) via `safeParse`. Throws on validation failure.

**Auth**: Resolves Clerk → DB user; uses resolved ID as `clientId`.

**Service**: `createProject` from `@/lib/services/projects`

**Schema alignment**: Fields map to Prisma Project model:
- `title`, `description`, `type`, `contractType`
- `budgetMin`, `budgetMax`, `agreedPrice` (not `budget`)
- `startDate`, `endDate`, `location`, `siteAddress`, `county`
- `status` defaults to `PLANNING`

---

### getProjectAction(id)

Returns a project if the authenticated user is the client or professional.

| Input | Type | Description |
|-------|------|-------------|
| `id` | `string` | Project UUID |

**Validation**: `isValidId(id)` — rejects empty/invalid IDs.

**Ownership**: User must be `clientId` or `professionalId`. Throws "Not authorized to view this project" otherwise.

**Service**: `getProject` from `@/lib/services/projects`

---

### getUserProjectsAction(role?)

Returns projects for the authenticated user.

| Input | Type | Description |
|-------|------|-------------|
| `role` | `'client' \| 'professional'` | Default `'client'` |

**Auth**: Resolves Clerk → DB user; filters by `clientId` (client) or `professionalId` (professional).

**Service**: `getUserProjects` from `@/lib/services/projects`

---

## Service Contract (Projects)

### CreateProjectInput

From `@/app/lib/validation/projects-validation`:

| Field | Type | Required | Default |
|-------|------|----------|---------|
| `clientId` | `string` (UUID) | Yes | — |
| `title` | `string` (3–200 chars) | Yes | — |
| `description` | `string` | No | — |
| `type` | `ProjectType` | No | `RESIDENTIAL` |
| `contractType` | `ContractType` | No | `FULL_CONTRACT` |
| `budgetMin` | `number` | No | — |
| `budgetMax` | `number` | No | — |
| `agreedPrice` | `number` | No | — |
| `startDate` | `string` (ISO datetime) | No | — |
| `endDate` | `string` (ISO datetime) | No | — |
| `status` | `ProjectStatus` | No | `PLANNING` |
| `location` | `string` | No | — |
| `siteAddress` | `string` | No | — |
| `county` | `County` | No | — |

### Ownership Rules

| Action | Who can call | Rule |
|--------|--------------|------|
| `createProjectAction` | Authenticated user | Creates as client; `clientId` = resolved user |
| `getProjectAction` | Client or professional | Must be `clientId` or `professionalId` |
| `getUserProjectsAction` | Authenticated user | Returns own projects by role |

---

## Validation

- **Create**: `CreateProjectSchema.omit({ clientId: true })` — validates action input before service call.
- **IDs**: `isValidId` from `@/app/lib/utils/validators` — non-empty string check for path params.

---

## Related

- **Validation schemas**: `@/app/lib/validation/projects-validation`
- **Config**: `@/app/lib/config/project.config` (PROJECT_CONFIG)
- **Service**: `@/lib/services/projects`
- **Project operations** (ownership, milestones): `@/app/lib/services/project-operations.service`
