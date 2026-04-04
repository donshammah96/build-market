---
description: "Use when editing apps/client server actions for authenticated mutations, forms, and cache revalidation."
applyTo: "apps/client/app/actions/**"
---

# Client Server Action Boundary
Last aligned with canonical on: 2026-04-04.

## Scope

- Applies to server actions in apps/client/app/actions.
- Keeps server actions aligned with canonical domain boundaries.

## Rules

1. Use secureAction for validated authenticated action flows that require a signed-in actor.
2. Keep actions focused on orchestration, validation, and revalidation, not domain policy.
3. Pass full actor context `{ userId, clerkId, role }` into domain methods for authorization-sensitive operations.
4. Keep action return shapes explicit and serialization-safe with DTOs.
5. Do not import or invoke server actions from client hooks or browser facades.
6. Keep logging in adapters only; services and repositories should return structured outcomes.
7. Prefer revalidateTag for fine-grained invalidation when tags exist; use revalidatePath for full route-segment invalidation.
8. Preserve secureAction contract behavior: auth resolution failures return typed validation outcomes rather than throwing.

## Validation

- Confirm secureAction is present where auth is required.
- Confirm cache invalidation choice (revalidateTag or revalidatePath) matches scope of invalidation.
- Confirm business rules remain in app/lib/domains.
