# Properties API

API routes for managing real estate property listings on the Build Market platform.
Routes follow a thin-adapter pattern: handlers own transport concerns (auth, validation,
rate limiting, idempotency, optimistic-lock header parsing, structured adapter logging,
and response mapping). Business rules and DTO shaping live in
`app/lib/domains/properties/service.ts`, while Prisma access lives in
`app/lib/domains/properties/repository.ts`.

## Routes

| Method   | Route                                             | Auth          | Description                                       |
| -------- | ------------------------------------------------- | ------------- | ------------------------------------------------- |
| `GET`    | `/api/properties`                                 | Public        | List properties with filters, sorting, pagination |
| `POST`   | `/api/properties`                                 | Professional  | Create single or batch properties                 |
| `GET`    | `/api/properties/[id]`                            | Public        | Get property detail with related listings         |
| `GET`    | `/api/properties/[id]/similar`                    | Public        | Fetch related listings only                       |
| `PATCH`  | `/api/properties/[id]`                            | Owner         | Update property (optimistic locking)              |
| `DELETE` | `/api/properties/[id]`                            | Owner         | Soft-delete property (optimistic locking)         |
| `GET`    | `/api/properties/my-listings`                     | Authenticated | Dashboard widget for owner listings               |
| `GET`    | `/api/properties/[id]/attachments`                | Owner         | List property attachments                         |
| `POST`   | `/api/properties/[id]/attachments`                | Owner         | Create attachment                                 |
| `GET`    | `/api/properties/[id]/attachments/[attachmentId]` | Owner         | Get a single attachment                           |
| `PATCH`  | `/api/properties/[id]/attachments/[attachmentId]` | Owner         | Update attachment                                 |
| `DELETE` | `/api/properties/[id]/attachments/[attachmentId]` | Owner         | Delete attachment                                 |
| `GET`    | `/api/properties/[id]/documents`                  | Owner         | List property documents                           |
| `POST`   | `/api/properties/[id]/documents`                  | Owner         | Create document                                   |
| `DELETE` | `/api/properties/[id]/documents?documentId=...`   | Owner         | Deprecated compatibility shim for item delete     |
| `PATCH`  | `/api/properties/[id]/documents/[documentId]`     | Owner         | Update/replace a document                         |
| `DELETE` | `/api/properties/[id]/documents/[documentId]`     | Owner         | Delete a document                                 |

## Key Patterns

### Idempotency

Property create/update/delete endpoints support idempotency via:

- **`Idempotency-Key` header** — client-supplied key
- **Auto-generated key** — SHA-256 of `userId:operation:payload` when no header is provided

Duplicate requests return the cached response (HTTP 200) or `409` if the original is still in-flight.

### Optimistic Locking

`PATCH` and `DELETE` use `If-Match` as the canonical optimistic-lock input:

```http
PATCH /api/properties/abc123
If-Match: "3"
Content-Type: application/json

{ "title": "Updated Title" }
```

For backward compatibility, a body-level `version` field is still accepted as a temporary shim.

On conflict (version mismatch), the API returns `409 Conflict` with the current version in both
`X-Property-Version` and `ETag`.

Set `x-optimistic-retry: true` to auto-retry up to 3 times on conflict.

### Error Envelope

All route adapters map domain service results to a consistent envelope:

- Infra/runtime failure (`!result.success || !result.data`) -> `500`
- Domain failure (`result.data.ok === false`) -> mapped status + message
- Success (`result.data.ok === true`) -> `apiSuccess(...)`

Correlation IDs are propagated on success/error responses for traceability.

### Soft Deletes

Properties are never physically deleted. `DELETE` sets `deletedAt` and increments `version`. All queries filter by `deletedAt: null`.

### Validation

Request bodies are validated with Zod schemas from
`app/lib/validation/properties-validation.ts` and exported contracts in
`app/lib/domains/properties/contracts.ts`.

Collection routes are intentionally collection-only (`GET`/`POST`) while item-level
mutations use resource-scoped routes (`[attachmentId]`, `[documentId]`).
The one temporary exception is `DELETE /documents?documentId=...`, which now delegates to
the item-route semantics and is explicitly deprecated.

### Observability

Each adapter emits exactly one structured route log per outcome via `app/api/properties/shared.ts`
with:

- `correlationId`
- `operationName`
- `actorRole`
- `outcome`
- `httpStatus`
- `durationMs`
- optional `domainError`, `resourceType`, and `resourceId`

Route logs intentionally omit banned fields such as raw request bodies, raw response bodies,
`userId`, and `clerkId`.

### GDPR Consent

All mutations record a `ConsentRecord` entry for data protection compliance.

## Related Files

| File                                                          | Purpose                                                   |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `app/lib/domains/properties/service.ts`                       | Canonical domain service used by route adapters           |
| `app/lib/domains/properties/contracts.ts`                     | Domain schemas/contracts exported to route adapters       |
| `app/lib/validation/properties-validation.ts`                 | Core Zod schemas/select objects                           |
| `app/lib/config/property.config.ts`                           | Domain constants (body size, TTL, retry config)           |
| `app/api/properties/shared.ts`                                | Adapter logging, conflict responses, version parsing      |
| `app/lib/services/idempotency.service.ts`                     | Shared idempotency (`property` scope)                     |
| `app/lib/domains/properties/repository.ts`                    | Domain-specific repository helpers                        |
| `app/api/properties/[id]/attachments/route.ts`                | Thin adapter for attachment collection (`GET`/`POST`)     |
| `app/api/properties/[id]/attachments/[attachmentId]/route.ts` | Thin adapter for attachment item (`GET`/`PATCH`/`DELETE`) |
| `app/api/properties/[id]/documents/route.ts`                  | Thin adapter for document list/create endpoints           |
| `app/api/properties/[id]/documents/[documentId]/route.ts`     | Thin adapter for document patch/delete endpoints          |
| `app/api/properties/[id]/similar/route.ts`                    | Thin adapter for similar listings endpoint                |
| `packages/db/prisma/schema.prisma`                            | Property model definition                                 |
