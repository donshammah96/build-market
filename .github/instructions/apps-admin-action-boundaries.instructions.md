---
description: "Use when editing apps/admin server actions, role checks, and admin workflows."
applyTo: "apps/admin/src/actions/admin/**"
---

# Admin Action Boundary
Last aligned with canonical on: 2026-04-04.

## Scope

- Applies to apps/admin action workflows.
- Prevents accidental application of apps/client route-first conventions.

## Rules

1. Preserve apps/admin action structure under src/actions/admin.
2. Use safeAction and assertAdmin patterns for protected flows.
3. Keep role enforcement aligned with admin and verification_admin requirements.
4. Do not transplant apps/client route-adapter patterns into admin actions.

## Validation

- Confirm safeAction or equivalent guard is present where required.
- Confirm role checks remain explicit and aligned to admin policy.
