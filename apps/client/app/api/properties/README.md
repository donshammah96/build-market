# Properties API

API routes for managing real estate property listings on the Build Market platform.

## Routes

| Method   | Route                              | Auth          | Description                                       |
| -------- | ---------------------------------- | ------------- | ------------------------------------------------- |
| `GET`    | `/api/properties`                  | Public        | List properties with filters, sorting, pagination |
| `POST`   | `/api/properties`                  | Professional  | Create single or batch properties                 |
| `GET`    | `/api/properties/[id]`             | Public        | Get property detail with similar listings         |
| `PATCH`  | `/api/properties/[id]`             | Owner         | Update property (optimistic locking)              |
| `DELETE` | `/api/properties/[id]`             | Owner         | Soft-delete property (optimistic locking)         |
| `GET`    | `/api/properties/my-listings`      | Authenticated | Dashboard widget — agent's own listings           |
| `GET`    | `/api/properties/[id]/attachments` | Owner         | List property attachments                         |
| `POST`   | `/api/properties/[id]/attachments` | Owner         | Upload attachment                                 |
| `PATCH`  | `/api/properties/[id]/attachments` | Owner         | Update attachment                                 |
| `DELETE` | `/api/properties/[id]/attachments` | Owner         | Remove attachment                                 |
| `GET`    | `/api/properties/[id]/documents`   | Owner         | List property documents                           |
| `POST`   | `/api/properties/[id]/documents`   | Owner         | Upload document                                   |
| `PATCH`  | `/api/properties/[id]/documents`   | Owner         | Update document                                   |
| `DELETE` | `/api/properties/[id]/documents`   | Owner         | Remove document                                   |

## Key Patterns

### Idempotency

All mutation endpoints (`POST`, `PATCH`, `DELETE`) support idempotency via:

- **`Idempotency-Key` header** — client-supplied key
- **Auto-generated key** — SHA-256 of `userId:operation:payload` when no header is provided

Duplicate requests return the cached response (HTTP 200) or a 409 if the original is still in-flight.

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

### Soft Deletes

Properties are never physically deleted. `DELETE` sets `deletedAt` and increments `version`. All queries filter by `deletedAt: null`.

### Validation

Request bodies are validated with Zod schemas from `app/lib/properties-validation.ts`. The schemas align 1:1 with the Prisma `Property` model fields and use `@prisma/client` enums.

### GDPR Consent

All mutations record a `ConsentRecord` entry for data protection compliance.

## Related Files

| File                                              | Purpose                                              |
| ------------------------------------------------- | ---------------------------------------------------- |
| `app/lib/properties-validation.ts`                | Zod schemas and Prisma select objects                |
| `app/lib/config/property.config.ts`               | Domain constants (body size, TTL, retry config)      |
| `app/lib/services/property-operations.service.ts` | Business logic (ownership, payload, optimistic lock) |
| `app/lib/services/idempotency.service.ts`         | Shared idempotency (supports `property` scope)       |
| `app/lib/repositories/property.repository.ts`     | Data access layer                                    |
| `packages/db/prisma/schema.prisma`                | Property model definition                            |
