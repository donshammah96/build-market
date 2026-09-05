# Staging Test Identity Lifecycle & Runbook

## Overview & Scope

This runbook governs the operational lifecycle, health checks, metrics, and incident recovery procedures for resettable staging test identities used during automated E2E testing of the Onboarding and Professional Verification boundaries.

Under ADR-001 and ADR-002, production and staging Clerk/DB base identities are immutable. Test runs lease an identity slot, reset its mutable records and Clerk metadata to a clean baseline, and release the lease upon test conclusion.

---

## Pool Inventory

The staging environment maintains 6 dedicated, non-routable pool slots:

| Role           | Slot       | Primary Email Address                  | Target Scenarios             |
| :------------- | :--------- | :------------------------------------- | :--------------------------- |
| `PROFESSIONAL` | `pro-1`    | `e2e_pro_1@staging.buildmarket.app`    | `onboarding`, `verification` |
| `PROFESSIONAL` | `pro-2`    | `e2e_pro_2@staging.buildmarket.app`    | `onboarding`, `verification` |
| `PROFESSIONAL` | `pro-3`    | `e2e_pro_3@staging.buildmarket.app`    | `onboarding`, `verification` |
| `CLIENT`       | `client-1` | `e2e_client_1@staging.buildmarket.app` | `onboarding`                 |
| `CLIENT`       | `client-2` | `e2e_client_2@staging.buildmarket.app` | `onboarding`                 |
| `CLIENT`       | `client-3` | `e2e_client_3@staging.buildmarket.app` | `onboarding`                 |

> [!IMPORTANT]
> Test runs MUST NOT delete the base `User` or Clerk accounts. Only leased fixtures and mutable child entities owned by `userId` (licenses, documents, notifications, verification cases) are reset.

---

## Pre-provisioning Initial Identities (One-Time Setup)

### 1. Clerk Dashboard Metadata Configuration

In the Clerk Dashboard (`Users` -> select user -> `Metadata`):

**For Professionals (`e2e_pro_1`, `e2e_pro_2`, `e2e_pro_3`):**

```json
{
  "role": "PROFESSIONAL",
  "onboardingComplete": false,
  "isOnboarded": false,
  "isProfileComplete": false
}
```

**For Clients (`e2e_client_1`, `e2e_client_2`, `e2e_client_3`):**

```json
{
  "role": "CLIENT",
  "onboardingComplete": false,
  "isOnboarded": false,
  "isProfileComplete": false
}
```

### 2. Staging Database Seeding (`users` Table)

> [!NOTE]
> PostgreSQL enforces `"updatedAt" TIMESTAMP(3) NOT NULL` on `"users"`. Because Prisma's `@updatedAt` directive is managed client-side and does not declare a database-level `DEFAULT`, all direct raw SQL `INSERT` statements **must explicitly specify `"updatedAt" = NOW()`**.

```sql
INSERT INTO "users" (
  "id",
  "clerkId",
  "email",
  "role",
  "status",
  "isEmailVerified",
  "isProfileComplete",
  "updatedAt",
  "createdAt"
) VALUES
  (
    gen_random_uuid(),
    'user_3ItBP8JFyS2GsV7nVGxqyZRVbUD', -- Replace with Clerk User ID for pro-1
    'e2e_pro_1@staging.buildmarket.app',
    'PROFESSIONAL',
    'ONBOARDING',
    true,
    false,
    NOW(),
    NOW()
  )
ON CONFLICT ("clerkId") DO UPDATE SET
  "email" = EXCLUDED."email",
  "role" = EXCLUDED."role",
  "status" = EXCLUDED."status",
  "isEmailVerified" = EXCLUDED."isEmailVerified",
  "updatedAt" = NOW();
```

---

## State Machine & Transitions

```text
[Available Slot]
       │
       ▼ (leaseIdentity)
   [LEASED] ─── (restoreClerkIdentityBaseline) ──► [RESETTING]
                                                        │
                                                        ▼ (restoreIdentityBaseline)
                                                     [READY]
                                                        │
       ┌────────────────────────────────────────────────┴────────────────────────┐
       ▼ (cleanupRun / releaseIdentityLease)                                     ▼ (failure / exception)
   [RELEASED]                                                                 [FAILED]
       │                                                                         │
       └────────────────────────► [Available for next run] ◄─────────────────────┘
```

- **LEASED**: Slot locked exclusively to `stagingTestRunId`. Partial unique index prevents duplicate concurrent leases.
- **RESETTING**: Clerk metadata reset and active sessions revoked; database mutable entities being wiped.
- **READY**: Baseline clean (`ONBOARDING`, `NOT_STARTED`, `UNVERIFIED`). Single-use Clerk ticket minted for Cypress.
- **RELEASED**: Run completed cleanly; lease released and available for immediate reuse.
- **FAILED**: Reset or handoff failed; lease quarantined until swept by emergency cleanup or admin action.

**Lease TTL:** 15 minutes (`MAX_LEASE_LIFETIME_SECONDS = 900`). Expired leases are automatically treated as eligible for reclamation.

---

## Metrics & Alerting Rules

### 1. Stuck Resetting Alert

- **Metric:** `bm.staging.test_control.identity_lease.stuck_resetting`
- **Condition:** `sum(staging_test_identity_leases{state="RESETTING"}) by (slot) > 0 for 5m`
- **Severity:** High (P2)
- **Impact:** Slot cannot be reused; indicates network failure to Clerk API or stuck database transaction.
- **Action:** Run emergency cleanup script or manually release lease:

  ```sql
  UPDATE staging_test_identity_leases
  SET state = 'FAILED', "releasedAt" = NOW()
  WHERE state = 'RESETTING' AND "updatedAt" < NOW() - INTERVAL '5 minutes';
  ```

### 2. Identity Lease Pool Exhaustion

- **Metric:** `bm.staging.test_control.identity_lease.exhaustion`
- **Condition:** `count(staging_test_identity_leases{state IN ('LEASED', 'RESETTING', 'READY')}) by (role) == 3`
- **Severity:** Medium (P3)
- **Impact:** Subsequent test runs will receive `IDENTITY_LEASE_EXHAUSTED` (HTTP 409).
- **Action:** Check GitHub Actions concurrency. Verify previous workflow finished and invoked `cleanup-run`.

---

## Emergency Rollback & Disaster Recovery

If test control behaves erratically or a security incident is suspected:

1. **Immediate Revocation (kill switch):**
   - Disable environment flag in staging: `ENABLE_STAGING_TEST_CONTROL=false`.
   - Rotate or clear `TEST_CONTROL_SECRET` and `INTERNAL_SERVICE_SECRET`.
   - This immediately causes `/api/internal/test-control` to return `404 Not Found`.

2. **Database Sweep:**
   Execute emergency cleanup:

   ```bash
   node scripts/emergency-staging-cleanup.mjs
   ```

   Or via direct SQL:

   ```sql
   UPDATE staging_test_identity_leases
   SET state = 'RELEASED', "releasedAt" = NOW()
   WHERE state IN ('LEASED', 'RESETTING', 'READY');
   ```

3. **Clerk Verification:**
   Ensure all active sessions for staging pool emails are revoked in the Clerk Dashboard.
