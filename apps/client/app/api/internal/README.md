# Internal API

Service-to-service endpoints used by middleware and admin remediation flows.
These routes are not public browser APIs.

## Security Model

- All routes require `x-internal-secret` and fail closed when the header is missing or invalid.
- All routes apply rate limiting.
- All routes return static-safe error messages (no provider or raw exception passthrough).
- Internal routes emit structured adapter logs with correlation metadata.

## Routes

### GET `/api/internal/system-settings`

Returns minimal runtime flags used by internal consumers.

- Auth: `x-internal-secret`
- Rate limit: `internal-system-settings:${getRateLimitIdentifier(req)}` (`200` per `60_000` ms)
- Response:

```json
{
  "maintenanceMode": false,
  "maintenanceMessage": "",
  "publicSignup": true,
  "allowProfessionalSignup": true,
  "allowedIPs": []
}
```

### GET `/api/internal/user-status?clerkId=...`

Middleware fallback for onboarding role/status when Clerk metadata is not yet visible in session claims.

- Auth: `x-internal-secret`
- Rate limit: `internal-user-status:${getRateLimitIdentifier(req)}` (`200` per `60_000` ms)
- Success response:

```json
{
  "isOnboarded": true,
  "role": "CLIENT",
  "status": "ACTIVE"
}
```

- Fallback behavior: on lookup failure, returns a non-onboarded shape so middleware can degrade safely.

### POST `/api/internal/onboarding-remediation/reconcile`

Compares DB onboarding state against Clerk `publicMetadata` and reports drift.

- Auth: `x-internal-secret`
- Rate limit: `internal-onboarding-remediation:${getRateLimitIdentifier(req)}` (`60` per `60_000` ms)
- Request:

```json
{
  "userId": "db_user_id",
  "actor": {
    "userId": "admin_user_id",
    "adminRole": "SUPER_ADMIN"
  }
}
```

- Success response includes DB vs Clerk snapshots, mismatch fields, and pending onboarding idempotency key count.

### POST `/api/internal/onboarding-remediation/clerk-sync`

Forces Clerk onboarding metadata to match the DB onboarding state.

- Auth: `x-internal-secret`
- Rate limit: `internal-onboarding-remediation:${getRateLimitIdentifier(req)}` (`60` per `60_000` ms)
- Request shape: same actor contract as reconcile endpoint
- Success response:

```json
{
  "success": true,
  "data": {
    "userId": "db_user_id",
    "clerkId": "clerk_user_id",
    "metadata": {
      "role": "CLIENT",
      "isOnboarded": true,
      "status": "ACTIVE",
      "isProfileComplete": true
    },
    "synced": true
  }
}
```

### POST `/api/internal/onboarding-remediation/idempotency-reconcile`

Recovers stuck onboarding replay state by moving a safe-to-recover onboarding idempotency key from `PENDING` to `FAILED`.

- Auth: `x-internal-secret`
- Rate limit: `internal-onboarding-remediation:${getRateLimitIdentifier(req)}` (`60` per `60_000` ms)
- Request:

```json
{
  "key": "idempotency_key",
  "actor": {
    "userId": "admin_user_id",
    "adminRole": "SUPER_ADMIN"
  }
}
```

- Conflict safety: reconciliation is blocked when mutation completion signals already exist.

## Notes

- These endpoints are consumed by internal operational tooling and admin remediation actions.
- For public onboarding mutation behavior, see `app/api/onboarding/README.md`.
