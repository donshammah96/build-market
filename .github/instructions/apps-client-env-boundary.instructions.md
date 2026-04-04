---
description: "Use when code in apps/client reads environment variables or config values."
applyTo: "apps/client/**"
---

# Client Environment Access Boundary
Last aligned with canonical on: 2026-04-04.

## Scope

- Applies to environment variable access in apps/client.
- Keeps env access consistent with the canonical infrastructure boundary.

## Rules

1. New code reads env values through app/lib/infrastructure/env.ts.
2. Do not add direct process.env reads in routes, services, hooks, or UI code.
3. Bootstrap-only exceptions must include an env-bootstrap-exception comment with reason.
4. Existing unmigrated direct reads should be tagged env-migration-pending when touched.

## Validation

- Confirm changed files avoid direct process.env where policy forbids it.
- Confirm exceptions are narrow, documented, and bootstrap-only.
