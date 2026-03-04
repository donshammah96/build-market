# Properties API

API routes for managing real estate property listings on the Build Market platform.
Routes follow a thin-adapter pattern: handlers own transport concerns (auth, validation,
rate limiting, idempotency, response mapping), while business and persistence logic
is delegated to `app/lib/domains/properties/service.ts`.

## Routes

| Method   | Route                                         | Auth          | Description                                       |
| -------- | --------------------------------------------- | ------------- | ------------------------------------------------- |
| `GET`    | `/api/properties`                             | Public        | List properties with filters, sorting, pagination |
| `POST`   | `/api/properties`                             | Professional  | Create single or batch properties                 |
| `GET`    | `/api/properties/[id]`                        | Public        | Get property detail with related listings         |
| `GET`    | `/api/properties/[id]/similar`                | Public        | Fetch related listings only                       |
| `PATCH`  | `/api/properties/[id]`                        | Owner         | Update property (optimistic locking)              |
| `DELETE` | `/api/properties/[id]`                        | Owner         | Soft-delete property (optimistic locking)         |
| `GET`    | `/api/properties/my-listings`                 | Authenticated | Dashboard widget for owner listings               |
| `GET`    | `/api/properties/[id]/attachments`            | Owner         | List property attachments                         |
| `POST`   | `/api/properties/[id]/attachments`            | Owner         | Create attachment                                 |
| `PATCH`  | `/api/properties/[id]/attachments`            | Owner         | Update attachment                                 |
| `DELETE` | `/api/properties/[id]/attachments`            | Owner         | Delete attachment                                 |
| `GET`    | `/api/properties/[id]/documents`              | Owner         | List property documents                           |
| `POST`   | `/api/properties/[id]/documents`              | Owner         | Create document                                   |
| `PATCH`  | `/api/properties/[id]/documents/[documentId]` | Owner         | Update/replace a document                         |
| `DELETE` | `/api/properties/[id]/documents/[documentId]` | Owner         | Delete a document                                 |

## Key Patterns

### Idempotency

Property create/update/delete endpoints support idempotency via:

- **`Idempotency-Key` header** — client-supplied key
- **Auto-generated key** — SHA-256 of `userId:operation:payload` when no header is provided

Duplicate requests return the cached response (HTTP 200) or `409` if the original is still in-flight.

### Optimistic Locking

`PATCH` and `DELETE` require an `If-Match` header containing the property's current `version`:

```http
PATCH /api/properties/abc123
If-Match: "3"
Content-Type: application/json

{ "title": "Updated Title" }
```

On conflict (version mismatch), the API returns `409 Conflict` with the current version in `X-Property-Version`.

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

### GDPR Consent

All mutations record a `ConsentRecord` entry for data protection compliance.

## Related Files

| File                                                      | Purpose                                             |
| --------------------------------------------------------- | --------------------------------------------------- |
| `app/lib/domains/properties/service.ts`                   | Canonical domain service used by route adapters     |
| `app/lib/domains/properties/contracts.ts`                 | Domain schemas/contracts exported to route adapters |
| `app/lib/validation/properties-validation.ts`             | Core Zod schemas/select objects                     |
| `app/lib/config/property.config.ts`                       | Domain constants (body size, TTL, retry config)     |
| `app/lib/services/property-operations.service.ts`         | Optimistic-lock update/delete operations            |
| `app/lib/services/idempotency.service.ts`                 | Shared idempotency (`property` scope)               |
| `app/lib/domains/properties/repository.ts`                | Domain-specific repository helpers                  |
| `app/api/properties/[id]/attachments/route.ts`            | Thin adapter for attachment endpoints               |
| `app/api/properties/[id]/documents/route.ts`              | Thin adapter for document list/create endpoints     |
| `app/api/properties/[id]/documents/[documentId]/route.ts` | Thin adapter for document patch/delete endpoints    |
| `app/api/properties/[id]/similar/route.ts`                | Thin adapter for similar listings endpoint          |
| `packages/db/prisma/schema.prisma`                        | Property model definition                           |
