---
description: "Use when editing apps/client domain services or repositories under app/lib/domains."
applyTo: "apps/client/app/lib/domains/**"
---

# Client Domain Layer Rules

Last aligned with canonical on: 2026-08-15.

## Scope

- Applies to app/lib/domains services and repositories.
- Encodes service versus repository responsibilities.

## Rules

1. Services own business policy, actor-aware authorization, orchestration, and DTO shaping.
2. Repositories own Prisma reads and writes only.
3. Repositories must not own route semantics, response envelopes, or user-facing error strings.
4. Domain methods should return structured Result style outcomes using the canonical domain Result type.
5. Domain services and repositories must not own logging concerns.
6. Keep environment access out of domain code unless routed through typed infrastructure modules.
7. Domain services must not import other domain services or repositories directly.
8. Cross-domain reads go through the owning domain index exports, and multi-domain writes are lifted to shared orchestration surfaces.

## Validation

- Confirm authorization logic lives in services or policy helpers.
- Confirm repositories are persistence-only after changes.
- Confirm no adapter semantics or direct inter-domain service imports were introduced.
