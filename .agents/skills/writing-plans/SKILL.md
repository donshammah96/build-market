---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive, staff-level implementation plans for Build Market assuming the engineer needs explicit architectural boundaries, exact file locations, and rigorous test designs.

Document everything required: which domain slices to touch, interfaces consumed/produced, DTO boundaries, error-handling contracts, and exact verification commands. Structure the work as bite-sized, test-driven tasks that honor repo ADRs (ADR-001 through ADR-008 for `apps/client`, ADR-ADMIN-001 through ADR-ADMIN-009 for `apps/admin`).

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Plan Artifact:**
In Antigravity Planning Mode, write the plan directly to the implementation plan artifact (`implementation_plan.md`) with `RequestFeedback: true`. When saving persistent plans to the repository, save to: `docs/plans/YYYY-MM-DD-<feature-name>.md`.

---

## Architectural & Boundary Check

Before defining tasks, verify how the proposal aligns with Build Market's Tier 0 / Tier 1 rules:

1. **`apps/client` Slice Boundaries (ADR-002, ADR-003)**:
   - Routes (`app/api/<slice>/**`) are thin HTTP adapters (validation, auth, resilience, status codes).
   - Business logic lives in `app/lib/domains/<slice>/service.ts` using `Result<T, AppError>`.
   - Repositories (`app/lib/domains/<slice>/repository.ts`) are persistence-only Prisma adapters.
   - Client facades (`lib/facades/<domain>/<name>-client.ts`) provide the typed interface for browser components and hooks.
2. **`apps/admin` Mutation Boundaries (ADR-ADMIN-001, ADR-ADMIN-002, ADR-ADMIN-008)**:
   - All admin mutations go through `safeAction` in `src/actions/admin/<slice>.ts`.
   - Never use direct Prisma in actions. Never use `.parse()` (use `.safeParse()`).
   - Admin capabilities are resolved from database `AdminProfile`, not raw string comparisons.
   - High-risk operations (Tier 1: 180s freshness, Tier 2: 300s freshness) require declarative append-only `auditLog` entries.
3. **DTO & Serialization Boundaries**:
   - Explicitly separate database models from wire DTOs crossing server/client boundaries.

---

## Task Right-Sizing & Granularity

A task is the smallest unit that carries its own test cycle and produces an independently verifiable deliverable.

**Each step within a task is one clear action (2-5 minutes):**

1. **RED:** Write the failing test (unit, domain service, or route integration).
2. **VERIFY RED:** Run test command to observe the exact expected failure.
3. **GREEN:** Write the minimal implementation code to satisfy the test.
4. **VERIFY GREEN:** Run test command to confirm it passes without regressions.
5. **REFACTOR / COMMIT:** Clean up code, verify typechecks, and record commit/checkpoint.

---

## Plan Structure

When writing plans for Build Market, use this standard structure:

````markdown
# [Feature Name] Implementation Plan

**Goal:** [One sentence describing what this builds or refactors]

**Architecture & Tier Alignment:**

- Target App/Package: `apps/client` | `apps/admin` | `packages/<name>`
- Domain Slices: `<slice-name>`
- Relevant ADRs: [e.g. ADR-002, ADR-ADMIN-008]

## User Review Required

[Breaking changes, security boundaries, migration requirements, or critical architectural trade-offs]

## Proposed Changes

### [Component / Domain Slice]

#### [NEW/MODIFY] `apps/client/app/lib/domains/<slice>/service.ts`

- **Interfaces Consumed:** `findUserById(id: string)` from `authRepository`
- **Interfaces Produced:** `executeOperation(input: OperationInput): Promise<Result<OperationResult, DomainError>>`

- [ ] **Step 1: Write the failing domain test**

```typescript
it("rejects unverified vendor payout request", async () => {
  const result = await payoutService.requestPayout(unverifiedActor, {
    amount: 1000,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.error.code).toBe("VENDOR_NOT_VERIFIED");
  }
});
```

- [ ] **Step 2: Verify RED failure**
      Run: `pnpm --filter client test app/lib/domains/<slice>/service.test.ts`
      Expected: FAIL with `VENDOR_NOT_VERIFIED` or method undefined.

- [ ] **Step 3: Implement minimal domain logic**

```typescript
export async function requestPayout(
  actor: ClientActor,
  input: PayoutInput,
): Promise<Result<Payout, DomainError>> {
  if (!actor.isVerified) {
    return err(
      new DomainError(
        "VENDOR_NOT_VERIFIED",
        "Vendor is not verified for payouts",
      ),
    );
  }
  // ... minimal persistence delegation ...
}
```

- [ ] **Step 4: Verify GREEN pass**
      Run: `pnpm --filter client test app/lib/domains/<slice>/service.test.ts`
      Expected: PASS with 0 failures.

- [ ] **Step 5: Typecheck and lint check**
      Run: `pnpm run client:tsc-noemit`

---

## Verification Plan

### Automated Tests

- `pnpm run client:test:all`
- `pnpm run admin:test:all`
- `pnpm run admin:report-security-drift:strict`

### Manual / Browser Verification

- Use `browser_subagent` to test the UI flow if UI components were added/modified.
````

---

## Self-Review Checklist Before Submitting Plan

1. **No Placeholders:** Search for "TBD", "TODO", "add appropriate validation", or vague steps. Every code step must show concrete signatures or logic.
2. **Domain Layering:** Ensure route handlers don't have inline business logic and admin actions use `safeAction`.
3. **Exact Verification Commands:** Every task lists the exact `pnpm` command to run.
4. **Type Consistency:** Method names, error codes, and parameters in earlier tasks match what later tasks consume.
