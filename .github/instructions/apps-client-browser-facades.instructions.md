---
description: "Use when editing apps/client browser facades in lib/*-client.ts that call API routes."
applyTo: "apps/client/lib/*-client.ts"
---

# Client Browser Facade Contract

Last aligned with canonical on: 2026-08-15.

## Scope

- Applies to browser-facing facades under apps/client/lib.
- Governs HTTP boundary contracts between browser code and API adapters.

## Rules

1. Browser facades use fetch or apiFetch against /api paths.
2. Parse normalized ApiResponse envelopes explicitly.
3. Define explicit DTO interfaces at the network boundary.
4. Do not import server actions, repositories, or domain services into browser facades.
5. Keep error mapping predictable so hooks can handle failures consistently.

## Validation

- Confirm transport is HTTP, not direct server imports.
- Confirm response and error parsing is explicit.
- Confirm DTO types are stable and serialization-safe.
