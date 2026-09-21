---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

## Overview

Perform a structured, staff-level architectural and code quality review on code changes before merging, committing, or closing tasks.

**Core principle:** Review against Tier 0 ADRs early to prevent architectural drift and security regressions.

---

## When to Request / Perform Review

- After completing a task in an implementation plan
- After adding or modifying a domain slice in `apps/client` or `apps/admin`
- After touching authentication, authorization, or payments code
- Before merging any branch or opening a PR

---

## How to Review Changes

### 1. Inspect the Git Diff

```bash
git diff --stat HEAD~1..HEAD
git diff HEAD~1..HEAD
```

### 2. Review Against the Staff Architecture Lens

Use the template in [code-reviewer.md](code-reviewer.md) to audit:

- **`apps/client` Rules (ADR-001..008):**
  - Route handlers are thin (validation, auth, resilience, status codes).
  - Business logic is in domain services; persistence is in repositories.
  - Return types use `Result<T, AppError>`.
  - Client facades reside under `lib/facades/<domain>/`.
- **`apps/admin` Rules (ADR-ADMIN-001..009):**
  - All mutations use `safeAction` in `src/actions/admin/<slice>.ts`.
  - No direct Prisma in action files.
  - Validation uses `.safeParse()`, never `.parse()`.
  - Capabilities are verified via `AdminProfile` (not raw string roles).
  - High-risk operations include append-only declarative `auditLog`.
- **Observability & Security:**
  - No PII logged (no emails, phone numbers, national IDs, request/response bodies).
  - Environment variables read exclusively via `envConfig` or `adminEnvConfig`.

### 3. Act on Findings

- **Critical (Must Fix):** Boundary violations, missing audit logs, direct Prisma in actions, raw role checks, security leaks.
- **Important (Should Fix):** Missing edge-case tests, unhandled error variants, DTO leakage.
- **Minor:** Typographical or stylistic polish.
