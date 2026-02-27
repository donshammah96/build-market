# Clerk Webhook API

Handles Clerk user lifecycle events via signed webhooks. This is the primary entry point for all user data flowing from Clerk into the Build Market database.

## Architecture

```
Clerk Dashboard                POST /api/clerk-webhook
     │                                  │
     │  Svix-signed payload             │
     └──────────────────────────────────┤
                                        ├─ Body size guard (256 KB)
                                        ├─ Svix signature verification
                                        ├─ Rate limiting (post-verification)
                                        ├─ Zod payload validation
                                        ├─ Event routing (switch)
                                        │
                               ┌────────┴────────┐
                               │  Event Handlers  │
                    ┌──────────┼──────────┬───────┴──────┐
                    ▼          ▼          ▼              ▼
             user.created  user.updated  user.deleted  session.created
                    │          │          │              │
                    ▼          ▼          ▼              ▼
                 Upsert     Patch     Soft-delete    Track login
                  User       User     + GDPR audit    activity
```

### Files

| File                                         | Purpose                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| `route.ts`                                   | Webhook handler — signature verification, event routing, Prisma operations |
| `lib/validation/clerk-webhook-validation.ts` | Zod schemas, TypeScript interfaces, select objects, helpers                |

---

## Endpoint

### POST `/api/clerk-webhook`

**Authentication:** Svix signature verification (HMAC-SHA256) — not Clerk session auth  
**Rate Limit:** Webhook tier (post-verification)  
**Max Payload:** 256 KB

---

## Supported Events

### `user.created`

Creates a new user record or upserts on replay/duplicate delivery.

**Schema fields populated:**

| Field                   | Source                                   | Notes                                             |
| ----------------------- | ---------------------------------------- | ------------------------------------------------- |
| `clerkId`               | `data.id`                                | Unique Clerk user ID                              |
| `email`                 | `data.email_addresses[0].email_address`  | Primary email                                     |
| `firstName`, `lastName` | `data.first_name`, `data.last_name`      | Nullable                                          |
| `displayName`           | Computed                                 | `firstName + " " + lastName` or `null`            |
| `phone`                 | `data.phone_numbers[0].phone_number`     | Nullable                                          |
| `avatar`                | `data.image_url`                         | Nullable                                          |
| `role`                  | `data.public_metadata.role`              | Resolved to `UserRole` enum; defaults to `CLIENT` |
| `isEmailVerified`       | `email_addresses[0].verification.status` | Boolean                                           |
| `emailVerifiedAt`       | Computed                                 | Set to `now()` if email is verified at creation   |
| `isPhoneVerified`       | `phone_numbers[0].verification.status`   | Boolean                                           |
| `phoneVerifiedAt`       | Computed                                 | Set to `now()` if phone is verified at creation   |

**Idempotency:** Uses `prisma.user.upsert()` on `clerkId` — safe for Clerk webhook replays.

---

### `user.updated`

Patches user fields that changed. Detects verification state transitions for timestamp updates.

**Diff-aware behavior:**

- Fetches existing user to determine if `isEmailVerified` or `isPhoneVerified` transitioned from `false` → `true`
- Only sets `emailVerifiedAt` / `phoneVerifiedAt` on the transition, not on every update
- Recomputes `displayName` from updated or existing names

**Professional verification sync:**

- When `public_metadata.isVerified` changes, updates `ProfessionalProfile.verified`, `verificationStatus`, and `verifiedAt`
- Only writes if the value actually changed

---

### `user.deleted`

Soft-deletes the user with full GDPR audit trail.

**Schema fields set:**

| Field                 | Value                     | Purpose                                  |
| --------------------- | ------------------------- | ---------------------------------------- |
| `status`              | `DEACTIVATED`             | GDPR deletion requested (not `ARCHIVED`) |
| `deletedAt`           | `now()`                   | Soft-delete timestamp                    |
| `deletionRequestedAt` | `now()`                   | GDPR audit — when deletion was requested |
| `deletionReason`      | `"CLERK_ACCOUNT_DELETED"` | Source of deletion request               |
| `scheduledDeletionAt` | `now + 30 days`           | Data retention pipeline pickup date      |

**Why DEACTIVATED, not ARCHIVED?**  
Per the `UserStatus` enum: `DEACTIVATED` means "GDPR deletion requested, anonymization in progress" while `ARCHIVED` means "business completed, data frozen." Clerk account deletion is a GDPR deletion request.

---

### `session.created`

Tracks login activity without polling Clerk's API.

**Schema fields updated:**

| Field              | Value          | Purpose                     |
| ------------------ | -------------- | --------------------------- |
| `lastLoginAt`      | `now()`        | Last login timestamp        |
| `lastActiveAt`     | `now()`        | Last activity timestamp     |
| `loginCount`       | `increment(1)` | Atomic counter              |
| `failedLoginCount` | `0`            | Reset on successful session |

**Graceful degradation:** If the user doesn't exist yet (race condition with `user.created`), the event is acknowledged without error — session tracking is non-critical.

---

## Request / Response Examples

### Successful user creation

```json
// Clerk sends → POST /api/clerk-webhook
// (payload is Svix-signed, not shown here)

// Response: 200
{
  "success": true,
  "data": {
    "userId": "a1b2c3d4-e5f6-...",
    "message": "User created successfully"
  }
}
```

### Signature verification failure

```json
// Response: 401
{
  "success": false,
  "error": "Invalid webhook signature"
}
```

### Missing Svix headers

```json
// Response: 400
{
  "success": false,
  "error": "Missing webhook signature headers"
}
```

### User not found on update

```json
// Response: 404
{
  "success": false,
  "error": "User not found",
  "details": { "clerkId": "user_..." }
}
```

### Duplicate email on creation (P2002)

```json
// Response: 409
{
  "success": false,
  "error": "User already exists with this identifier",
  "details": { "clerkId": "user_..." }
}
```

### Unhandled event type

```json
// Response: 200
{
  "success": true,
  "data": {
    "message": "Event organization.created acknowledged"
  }
}
```

---

## Validation Module

`apps/client/app/lib/validation/clerk-webhook-validation.ts`

### Zod Schemas

| Schema                      | Used For                                             |
| --------------------------- | ---------------------------------------------------- |
| `ClerkUserPayloadSchema`    | Validates `user.created` and `user.updated` payloads |
| `ClerkSessionPayloadSchema` | Validates `session.created` payloads                 |

### Helper Functions

| Function                          | Purpose                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `resolveUserRole(roleStr?)`       | Maps Clerk metadata role string to `UserRole` enum (`CLIENT`, `PROFESSIONAL`, `ADMIN`, `SUPPORT`) |
| `computeDisplayName(first, last)` | Computes `displayName` from first + last name                                                     |

### Select Objects

| Object                      | Fields                                 | Purpose                                     |
| --------------------------- | -------------------------------------- | ------------------------------------------- |
| `userWebhookSelect`         | `id, clerkId, email, role, status`     | Minimal response data after user operations |
| `professionalProfileSelect` | `userId, verified, verificationStatus` | For verification sync check                 |

---

## Cross-Cutting Concerns

| Concern                    | Implementation                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| **Signature Verification** | Svix HMAC-SHA256 via `new Webhook(secret).verify(payload, headers)`                           |
| **Body Size Guard**        | `checkBodySize(req, 256 KB)` — rejects oversized payloads before parsing                      |
| **Rate Limiting**          | Webhook tier, applied **after** signature verification to avoid penalizing Clerk retries      |
| **Zod Validation**         | Structured payload validation with field-level error reporting                                |
| **Correlation ID**         | `initializeCorrelationId(req)` — propagated through all log entries                           |
| **Data Minimization**      | `select` objects on all Prisma queries — only read/return required fields                     |
| **Structured Logging**     | Every event handler logs clerkId, userId, eventType, and relevant state transitions           |
| **Idempotency**            | `upsert` for creation; soft-delete is idempotent; session tracking tolerates duplicates       |
| **GDPR Compliance**        | Soft-delete with audit trail (`deletionRequestedAt`, `deletionReason`, `scheduledDeletionAt`) |

---

## Enums Reference

### UserRole

| Value          | Description                              |
| -------------- | ---------------------------------------- |
| `CLIENT`       | Default role for all new users           |
| `PROFESSIONAL` | Service provider / contractor            |
| `ADMIN`        | Full administrative access               |
| `SUPPORT`      | Limited support role (view tickets only) |

### UserStatus

| Value         | Description                                     |
| ------------- | ----------------------------------------------- |
| `ACTIVE`      | Normal operation                                |
| `SUSPENDED`   | Temporary ban (reversible)                      |
| `BANNED`      | Permanent ban                                   |
| `DEACTIVATED` | GDPR deletion requested (anonymization pending) |
| `ARCHIVED`    | Business completed, data frozen                 |

### VerificationStatus

| Value              | Description            |
| ------------------ | ---------------------- |
| `PENDING`          | Awaiting review        |
| `IN_REVIEW`        | Under review           |
| `VERIFIED`         | Approved               |
| `NEEDS_CORRECTION` | Requires fixes         |
| `REJECTED`         | Denied                 |
| `EXPIRED`          | Verification expired   |
| `SUSPENDED`        | Verification suspended |

---

## Clerk Dashboard Setup

1. Navigate to **Clerk Dashboard → Webhooks**
2. Create a new endpoint pointing to `https://buildmarket.co.ke/api/clerk-webhook`
3. Subscribe to events:
   - `user.created`
   - `user.updated`
   - `user.deleted`
   - `session.created`
4. Copy the **Signing Secret** and set it as `CLERK_WEBHOOK_SECRET` in your environment
5. Verify delivery using the "Send test webhook" button

### Required Environment Variables

| Variable                            | Required | Description                                                    |
| ----------------------------------- | -------- | -------------------------------------------------------------- |
| `CLERK_WEBHOOK_SECRET`              | **Yes**  | Svix signing secret from Clerk Dashboard                       |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes      | Clerk publishable key (for auth, not directly used by webhook) |
| `CLERK_SECRET_KEY`                  | Yes      | Clerk secret key (for auth, not directly used by webhook)      |

---

## Critical Bugs Fixed in This Refactor

| #   | Bug                                                                     | Impact                                                                                     | Fix                                                                    |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| 1   | **`any` type for update payload** (`updateData: any`)                   | No type safety on user updates — could write invalid fields to database                    | Replaced with `Record<string, unknown>` and typed field assembly       |
| 2   | **Redundant `prisma.$connect()`** before every operation                | Added ~50ms latency to every webhook — Prisma lazy-connects automatically                  | Removed entirely                                                       |
| 3   | **`"ARCHIVED"` string literal** for soft-delete status                  | Not using the `UserStatus` enum — bypasses type checking and could drift from schema       | Changed to `UserStatus.DEACTIVATED` (correct GDPR semantics)           |
| 4   | **Wrong soft-delete status** — used `ARCHIVED` instead of `DEACTIVATED` | `ARCHIVED` = "business completed, data frozen"; Clerk deletion is a GDPR request           | Changed to `DEACTIVATED` per schema documentation                      |
| 5   | **Missing `emailVerifiedAt` / `phoneVerifiedAt`** timestamps            | Schema has these fields but webhook never set them — verification timestamps always `null` | Set on creation and on verified state transitions                      |
| 6   | **Missing `displayName`** computation                                   | Schema has `displayName` field but webhook never computed it — always `null`               | Computed from `firstName + lastName` on create and update              |
| 7   | **Missing GDPR deletion audit fields**                                  | `deletionRequestedAt`, `deletionReason`, `scheduledDeletionAt` never populated             | Set on `user.deleted` with 30-day retention schedule                   |
| 8   | **No `session.created` tracking**                                       | `lastLoginAt`, `loginCount` fields in schema never updated                                 | Added `session.created` handler with atomic increment                  |
| 9   | **Rate limiting before signature verification**                         | Legitimate Clerk retries could be rate-limited before proving authenticity                 | Moved rate limiting after Svix verification                            |
| 10  | **No body size guard**                                                  | Oversized/malicious payloads parsed without limit                                          | Added `checkBodySize` with 256 KB limit                                |
| 11  | **No Zod validation** of webhook payloads                               | Relied on manual null checks — missed structural issues                                    | Added `ClerkUserPayloadSchema` and `ClerkSessionPayloadSchema`         |
| 12  | **Missing Svix header pre-check**                                       | Svix verification would throw an opaque error on missing headers                           | Added explicit check for `svix-id`, `svix-timestamp`, `svix-signature` |
| 13  | **`resolveUserRole` didn't handle `SUPPORT`** role                      | Only mapped `PROFESSIONAL` and `ADMIN` from metadata — `SUPPORT` was silently dropped      | Added complete role mapping for all `UserRole` values                  |
| 14  | **`failedLoginCount` never reset**                                      | Schema tracks failed logins but counter was never reset on successful login                | Reset to `0` on `session.created`                                      |
