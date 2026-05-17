---
description: "Use when editing apps/admin server actions, role checks, and admin workflows."
applyTo: "apps/admin/src/actions/admin/**"
---

# Admin Action Boundary

Last aligned with canonical on: 2026-15-05.

## Scope

- Applies to apps/admin action workflows.
- Do not use route-first conventions, middleware adapters, or client-side action wrappers in admin action workflows under any circumstances.

## Rules

When existing server action conventions conflict with rules here, follow this file and document the deviation in the change summary. If rules in this file conflict, resolve in this order: Role Enforcement, then Patterns, then Structure.

### Structure

1. Preserve apps/admin action structure under src/actions/admin.
2. Do not transplant apps/client route-adapter patterns into admin actions.

### Patterns

1. Use safeAction and assertAdmin patterns for protected flows.
2. Keep admin action implementations consistent with existing server action conventions.

### Role Enforcement

1. Keep role enforcement aligned with admin and verification_admin requirements.
2. Apply explicit checks before privileged admin operations.
3. If role checks are missing or misaligned, log an error and stop the specific admin action workflow until alignment is restored.
4. If alignment cannot be restored, escalate to an admin owner and do not proceed.

## Validation

- Confirm safeAction or equivalent guard is present where required.
- If safeAction or equivalent guard is not present where required, log an error and reject the action.
- Confirm role checks remain explicit and aligned to admin policy.
