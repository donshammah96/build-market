---
description: "Use when editing apps/client hooks that fetch or mutate through React Query."
applyTo: "apps/client/hooks/**"
---

# Client Hook Query Rules

Last aligned with canonical on: 2026-06-05.

## Scope

- Applies to React hooks in apps/client/hooks.
- Enforces React Query and browser-boundary conventions.

## Rules

1. Hooks should call browser facades, not server actions or domain services.
2. Follow TanStack Query v5 signatures and options style.
3. Centralize envelope unwrapping and error handling in hook workflows.
4. Own query keys and invalidation behavior in hooks.
5. Preserve caller-provided mutation callbacks after internal invalidation.
6. Prefer app-level QueryClient staleTime defaults (`60_000` for read-heavy stable data), and override to `0` only for genuinely volatile data.

## Validation

- Confirm no server-only imports in hooks.
- Confirm query key and invalidation behavior is explicit.
- Confirm callback composition preserves caller behavior.
- Confirm staleTime behavior is intentional and aligned with data volatility.
