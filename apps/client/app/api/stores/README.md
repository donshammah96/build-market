# Build Market Stores API

This folder contains API routes for creating, reading, updating, and deleting stores.

## Optimistic Concurrency

Store update and delete operations require an `If-Match` header with the current store version.

When a request conflicts with a newer version, the response includes:

- `X-Store-Version`: latest known store version for the resource

To allow server-side retry on conflicts for updates, clients can opt in with:

- `x-optimistic-retry: true`

### Examples

**Update with optimistic concurrency**

```bash
curl -X PATCH https://buildmarket.com/api/stores/<storeId> \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-H "If-Match: 7" \
	-d '{"name":"New Store Name"}'
```

**Update with retry opt-in**

```bash
curl -X PATCH https://buildmarket.com/api/stores/<storeId> \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-H "If-Match: 7" \
	-H "x-optimistic-retry: true" \
	-d '{"name":"New Store Name"}'
```

**Conflict response header (example)**

```http
HTTP/1.1 409 Conflict
X-Store-Version: 8
```

## Idempotency

POST requests to create stores support idempotency. Use an `Idempotency-Key`
header to ensure retries return the same response without duplicating stores.

### Example

```bash
curl -X POST https://buildmarket.com/api/stores \
	-H "Authorization: Bearer <token>" \
	-H "Content-Type: application/json" \
	-H "Idempotency-Key: 8f0c1f2a-9c67-4b7e-9a2f-7f9f4a3d6a91" \
	-d '{"name":"Test Store","address":"123 Main St","city":"Nairobi","county":"NAIROBI","categories":["HARDWARE"],"storeType":"RETAIL"}'
```

## Key Endpoints

- **GET /api/stores/[id]**: Fetch a store by id (public)
- **PATCH /api/stores/[id]**: Update a store (owner only)
- **DELETE /api/stores/[id]**: Soft delete a store (owner only)
