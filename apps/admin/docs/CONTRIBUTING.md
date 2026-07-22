# Contributing to apps/admin

This guide is for engineers adding features, fixing bugs, or doing architectural work in `apps/admin`. It assumes familiarity with Next.js App Router, TypeScript, and Prisma. Read this document first; consult the ADRs for the _why_ behind each pattern.

---

## Table of Contents

1. [Architecture Quick Reference](#1-architecture-quick-reference)
2. [Adding a New Domain Slice](#2-adding-a-new-domain-slice)
3. [Adding a New Action](#3-adding-a-new-action)
4. [Adding a New Feature Flag](#4-adding-a-new-feature-flag)
5. [Writing Tests](#5-writing-tests)
6. [Observability Checklist](#6-observability-checklist)
7. [Security Checklist](#7-security-checklist)
8. [Before You Open a PR](#8-before-you-open-a-pr)

---

## 1. Architecture Quick Reference

```text
UI (app/*)
  ↓ imports
Actions (src/actions/admin/)    ← adapter: auth, validate, call domain, revalidate
  ↓ imports
Domains (src/lib/domains/)      ← business logic, Result<T, DomainError>
  ↓ imports
Repositories (in domains/)      ← Prisma only, no logic
  ↓ imports
Database (@build/db)
```

Cross-cutting (imported by any layer):

| Module             | Location                                   | Purpose                      |
| ------------------ | ------------------------------------------ | ---------------------------- |
| `adminEnvConfig`   | `src/lib/infrastructure/env.ts`            | All env access               |
| `getAdminLogger()` | `src/lib/infrastructure/logger.ts`         | Structured logging           |
| `safeAction`       | `src/actions/admin/shared.ts`              | Authenticated action wrapper |
| `AdminCapability`  | `src/lib/security/authorization-policy.ts` | Capability enum              |
| `Result<T, E>`     | `src/lib/errors/result.ts`                 | Typed error returns          |

**Golden rules:**

- Actions never import from other actions.
- Repositories never import from domains.
- Nothing imports from `src/actions/`.
- All env reads go through `adminEnvConfig`.
- All authenticated mutations go through `safeAction`.

---

## 2. Adding a New Domain Slice

A domain slice is the unit of business logic for a bounded concept (users, verification, leads, etc.).

### Step-by-step

```text
src/lib/domains/<slice>/
├── contracts.ts    ← types, domain error codes
├── repository.ts   ← Prisma queries only
├── service.ts      ← business logic, returns Result<T, DomainError>
├── index.ts        ← public re-exports
└── __tests__/
    └── <slice>.service.test.ts
```

**1. Define contracts first** (`contracts.ts`):

```ts
export type SliceDomainError =
  | { code: "SLICE_NOT_FOUND"; message: string }
  | { code: "SLICE_POLICY_DENIED"; message: string };

export type SliceActor = { dbUserId: string; adminRole: AdminRole };
export type SliceListItem = { ... };
```

**2. Write the repository** (`repository.ts`) — Prisma only:

```ts
import { db } from "@build/db";

export async function findSliceById(id: string) {
  return db.slice.findUnique({ where: { id } });
}
```

Never use `Result` in repositories. Throw on DB errors; the service catches them.

**3. Write the service** (`service.ts`) — business logic:

```ts
import { ok, err } from "@/lib/errors/result";
import {
  requireAdminCapability,
  AdminCapability,
} from "@/lib/security/authorization-policy";

export async function getSlice(
  actor: SliceActor,
  id: string,
): Promise<Result<SliceListItem, SliceDomainError>> {
  const cap = requireAdminCapability(actor, AdminCapability.VIEW_CONTENT);
  if (!cap.success) {
    return err({ code: "SLICE_POLICY_DENIED", message: cap.error.message });
  }

  try {
    const item = await repository.findSliceById(id);
    if (!item) return err({ code: "SLICE_NOT_FOUND", message: "Not found" });
    return ok(item);
  } catch (error) {
    return err({
      code: "SLICE_NOT_FOUND",
      message: error instanceof Error ? error.message : "Unknown",
    });
  }
}
```

**4. Export from `index.ts`**:

```ts
export { getSlice } from "./service";
export type { SliceListItem } from "./contracts";
```

**5. Add tests** (`__tests__/slice.service.test.ts`) covering:

- Happy path returns correct data.
- Capability denial returns `SLICE_POLICY_DENIED`.
- Repository error returns the correct error code.
- Input validation rejects invalid inputs.

---

## 3. Adding a New Action

Actions are the adapter layer. They own: actor resolution, input validation, domain call, cache revalidation, and serialization-safe response shaping.

### Step-by-step - Adding a New Action

**1. Add to the policy map** (`src/lib/security/authorization-policy.ts`):

```ts
export const ADMIN_ACTION_POLICY_MAP = {
  // existing entries...
  get_slice: lowRiskReadPolicy(AdminCapability.VIEW_CONTENT),
  delete_slice: strictMutationPolicy(AdminCapability.MANAGE_CONTENT, "content"),
} as const satisfies Record<string, AdminActionPolicy>;
```

> **Note:** Use snake_case for read operations and camelCase for legacy mutation names. New mutations should use snake_case.

**2. Write the action** in the relevant `src/actions/admin/<slice>.ts`:

```ts
"use server";

import { z } from "zod";
import { safeAction } from "./shared";
import { sliceService } from "@/lib/domains/<slice>";

export async function getSlice(id: string) {
  return safeAction("get_slice", async ({ actor }) => {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) throw new Error("Valid slice ID is required");

    const result = await sliceService.getSlice(actor, parsed.data);
    if (!result.ok) throw new Error(result.message);

    return result.data;
  });
}

export async function deleteSlice(id: string, idempotencyKey: string) {
  return safeAction(
    "delete_slice",
    async ({ actor, adminUserId }) => {
      const parsed = z.string().uuid().safeParse(id);
      if (!parsed.success) throw new Error("Valid slice ID is required");
      const parsedKey = z.string().min(1).safeParse(idempotencyKey);
      if (!parsedKey.success) throw new Error("Idempotency-Key is required");

      return runWithIdempotency({
        adminUserId,
        actionName: "delete_slice",
        idempotencyKey: parsedKey.data,
        resourceId: parsed.data,
        ttlHours: 0.25,
        run: async () => {
          const result = await sliceService.deleteSlice(actor, parsed.data);
          if (!result.ok) throw new Error(result.message);
          revalidatePath("/slices");
          return { deleted: true, id: parsed.data };
        },
      });
    },
    {
      auditLog: {
        operation: "DELETE_SLICE",
        resourceType: "slice",
        getTargetId: () => id,
        getDetails: () => ({ deleted: true }),
      },
    },
  );
}
```

**3. Export from `src/actions/admin/index.ts`**:

```ts
export { getSlice, deleteSlice } from "./slice";
```

**Rules:**

- Always use `safeAction`. Never use `assertAdmin` or `assertVerificationAdmin`.
- Use `.safeParse()` + throw pattern. Never `.parse()` directly.
- All mutations go through `runWithIdempotency`.
- High-risk mutations (delete, role change, export) require an `auditLog` option. See [`src/lib/security/high-risk-admin-registry.ts`](../src/lib/security/high-risk-admin-registry.ts) for the registry.

---

## 4. Adding a New Feature Flag

Feature flags live in `src/lib/config/feature-flags.ts` and are driven by env vars.

**1. Add the flag constant:**

```ts
export const AdminFeatureFlag = {
  // existing...
  MY_NEW_FLAG: "admin_my_new_flag",
} as const;
```

**2. Add the env key mapping:**

```ts
const FLAG_ENV_KEYS = {
  // existing...
  [AdminFeatureFlag.MY_NEW_FLAG]: "NEXT_PUBLIC_ADMIN_FF_MY_NEW_FLAG",
} as const satisfies Record<AdminFeatureFlag, keyof typeof adminEnvConfig>;
```

**3. Add the env variable to the schema** in `src/lib/infrastructure/env.ts`:

```ts
const adminEnvSchema = z.object({
  // existing...
  NEXT_PUBLIC_ADMIN_FF_MY_NEW_FLAG: booleanString,
});
```

**4. Add the env variable to all env templates:**

- `.env.example` — with a comment explaining the flag
- `.env.development` — set to `false` by default
- `.env.test` — set to `false` by default

**5. Document the retirement plan** in `ADR-ADMIN-009` and `ROLLBACK-CONTRACTS.md`.

---

## 5. Writing Tests

### Test file naming convention

| Type                      | Location                             | Naming                       |
| ------------------------- | ------------------------------------ | ---------------------------- |
| Action boundary tests     | `__tests__/actions/`                 | `<slice>-actions.test.ts`    |
| Domain service tests      | `src/lib/domains/<slice>/__tests__/` | `<slice>.service.test.ts`    |
| Repository contract tests | `src/lib/domains/<slice>/__tests__/` | `<slice>.repository.test.ts` |
| Security/policy tests     | `__tests__/security/`                | `<topic>.test.ts`            |
| Integration tests         | `__tests__/`                         | `<feature>.test.ts`          |

### What to test

**Action tests** must cover:

- Unauthenticated call → `UNAUTHORIZED` response
- Authenticated call with wrong capability → `FORBIDDEN` response
- Stale session on Tier 1/2 operations → `SESSION_STALE` response
- Happy path returns correct data shape
- Domain error is propagated as `ACTION_FAILED`

**Service tests** must cover:

- Capability denial
- Not-found error
- Invalid input error
- Happy path with correct output shape

### Running tests

```bash
# Run all tests
pnpm run admin:test:all

# Run a specific test file
pnpm -C apps/admin exec vitest run __tests__/actions/users-actions.test.ts

# Watch mode during development
pnpm -C apps/admin exec vitest --pool=threads --maxWorkers=1
```

---

## 6. Observability Checklist

Before merging any action or service change, confirm:

- [ ] The action name is registered in `src/lib/observability/operation-names.ts`
- [ ] `safeAction` emits the structured log (it does this automatically)
- [ ] No `console.log`, `console.warn`, or `console.error` in action or service code
- [ ] No PII fields (email, phone, nationalId, firstName, lastName, clerkId) in log metadata
- [ ] `pnpm run admin:report-security-drift:strict` exits 0

---

## 7. Security Checklist

Before merging any mutation action:

- [ ] Uses `safeAction` (never raw `assertAdmin`)
- [ ] Input is validated with `.safeParse()` before use
- [ ] Schema uses `.strict()` on mutation inputs to prevent mass-assignment
- [ ] Idempotency key is parsed and passed to `runWithIdempotency`
- [ ] High-risk operations have an `auditLog` option
- [ ] Tier 1 ops (delete, role change, export) use `recentAuth: { maxAgeSeconds: 180 }`
- [ ] Tier 2 ops (verify, content override) use `recentAuth: { maxAgeSeconds: 300 }`
- [ ] `pnpm run admin:report-security-drift:strict` exits 0
- [ ] `pnpm run admin:check-env-contract` exits 0 if env variables were added

---

## 8. Before You Open a PR

Run this sequence and confirm all pass:

```bash
pnpm run admin:check-types
pnpm run admin:lint
pnpm run admin:check-env-contract
pnpm run admin:report-security-drift:strict
pnpm run admin:test:all
```

Update `CHANGELOG.md` following the `/changelog-documentation` workflow.

If your change retires a feature flag or modifies session freshness windows, update `ROLLBACK-CONTRACTS.md` and the relevant ADR's Revision History table.
