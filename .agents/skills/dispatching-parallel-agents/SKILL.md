---
name: dispatching-parallel-agents
description: Use when facing 2+ independent tasks, test failures, or domain investigations that can be executed without shared state or sequential dependencies
---

# Partitioned & Parallel Investigation

## Overview

When investigating multiple unrelated test failures across separate domain slices or running concurrent background validation tasks in Build Market, partition the investigations into independent domains to preserve context and prevent cross-contamination.

**Core principle:** Isolate independent problem domains. Execute concurrent background tasks where appropriate.

---

## When to Partition Tasks

- **Multiple Unrelated Test Failures:** e.g., `apps/client` payment domain vs. `apps/admin` verification domain vs. `@build/resilience`.
- **Concurrent Tool Execution:** Running long-running test suites or typechecks in background tasks while investigating code.
- **UI / Visual Isolation:** Launching `browser_subagent` for front-end rendering validation while performing server-side route checks.

---

## The Partitioning Pattern

### 1. Group by Bounded Context & Slice

Categorize issues by architectural layer and domain:

- **Slice A:** `apps/client/app/lib/domains/projects/`
- **Slice B:** `apps/admin/src/actions/admin/users.ts`
- **Slice C:** `packages/nats/`

### 2. Parallel Background Execution

In Antigravity, launch long-running test commands asynchronously:

```powershell
# Run client test suite in background task
pnpm run client:test:all
# Run admin test suite in background task
pnpm run admin:test:all
```

### 3. Focused Investigation Protocol

For each partitioned domain:

1. Gather exact error traces and line numbers.
2. Isolate the failing test (`pnpm --filter client test <path>`).
3. Apply `systematic-debugging` without jumping between unrelated slices.
4. Verify the fix locally before integrating.
