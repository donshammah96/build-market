# Staging E2E Test Suite Troubleshooting Runbook

## Overview

This document describes troubleshooting steps for common failure modes in the Staging E2E Cypress test suite and test control automation.

---

## Failure Modes & Diagnostic Procedures

### 1. `IDENTITY_LEASE_EXHAUSTED` (HTTP 409)

**Symptom:**
Test run fails during setup with:
`resetIdentityBaseline failed with status 409: All staging identity slots for role "PROFESSIONAL" are currently leased`

**Root Cause:**
All 3 pool slots (`pro-1`, `pro-2`, `pro-3`) are actively held in `LEASED`, `RESETTING`, or `READY` states, likely due to an unhandled exception or CI job cancellation before `cleanupStagingRun()` executed.

**Remediation:**

1. Check running GitHub Actions jobs: [Staging E2E Workflow Runs](https://github.com/donshammah96/build-market/actions/workflows/staging-e2e.yml).
2. Run the emergency sweep script:

   ```bash
   node scripts/emergency-staging-cleanup.mjs
   ```

3. Verify available slots via database query:

   ```sql
   SELECT slot, role, state, "leaseExpiresAt" FROM staging_test_identity_leases
   WHERE state IN ('LEASED', 'RESETTING', 'READY');
   ```

---

### 2. `CLERK_BASELINE_RESET_FAILED` or `NON_POOL_CLERK_USER`

**Symptom:**
Test control responds with HTTP 502 or HTTP 403 when attempting to reset baseline.

**Root Cause:**

- **403:** The Clerk ID or email address in the database slot does not match the strict allowlist `STAGING_TEST_IDENTITY_SLOTS`. Guard prevents touching any real users.
- **502:** Clerk API is unreachable or rate-limited.

**Remediation:**

1. Confirm Clerk environment keys match the target staging Clerk instance.
2. Confirm the user exists in Clerk Dashboard under `e2e_pro_<slot>@staging.buildmarket.app`.
3. Check network egress from the staging cluster to `api.clerk.com`.

---

### 3. Missing `x-test-control-grant` or HTTP 404 on Protected Routes

**Symptom:**
Cypress task fails with:
`failed with status 404: Not Found`

**Root Cause:**
The test control route returns 404 for all invalid HMAC tokens, missing secrets, or scenario-action mismatches (e.g. attempting to call `reset-identity-baseline` on a `lead-routing` scenario run).

**Remediation:**

1. Verify scenario in `initStagingRun(scenario)` matches: `onboarding` or `verification`.
2. Confirm `TEST_CONTROL_SECRET` and `INTERNAL_SERVICE_SECRET` environment variables are set in GitHub Actions / environment secrets.

---

## Reference Links

- [Staging Test Identity Lifecycle Runbook](./staging-test-identity-lifecycle.md)
- [Architecture Decision Record: Client Layer Boundaries (ADR-002)](../adr/ADR-002-client-layer-boundaries.md)
