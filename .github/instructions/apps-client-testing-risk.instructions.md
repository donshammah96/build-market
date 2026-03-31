---
description: "Use when adding or updating apps/client tests for architecture, policy, or high-risk behavior changes."
applyTo: "apps/client/__tests__/**"
---

# Client Test Risk Coverage

Last aligned with canonical on: 2026-03-30.

## Scope

- Applies to test updates in apps/client/**tests**.
- Keeps testing strategy risk-centric across boundaries and authorization paths.

## Rules

1. Choose test types based on risk: domain, adapter, hook or facade, contract, policy, and journey where relevant.
2. Include policy or contract coverage when authorization, DTO edges, or service-repository boundaries change.
3. For protected-route or authz-sensitive changes, include critical-journey validation as a blocking CI surface.
4. Prefer targeted test commands aligned with root script aliases.
5. Mandatory journey coverage includes unauthenticated redirect, onboarded professional access, non-professional denial, incomplete onboarding redirect, thread read authz, and thread send authz when affected.
6. For any domain method accepting a resource ID, include policy coverage asserting non-owner or non-participant access returns not_found unless existence disclosure is explicitly required.

## Validation

- Confirm changed behavior is covered at the highest-risk boundary.
- Confirm policy-sensitive changes include authorization or policy matrix tests.
- Confirm critical-journey coverage is updated when protected auth or routing behavior changes.
- Confirm test commands are narrow and reproducible.
- Confirm IDOR-sensitive resource ID operations include non-owner not_found policy assertions.
