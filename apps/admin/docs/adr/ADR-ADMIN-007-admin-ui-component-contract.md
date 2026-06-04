# ADR-ADMIN-007: Admin UI Component Contract

## Status

Accepted on 2026-06-04 by Phase 6 implementation in `feat/admin-overhaul/ui-tokens` and subsequent UI hardening.

## Context

Admin has a useful Radix/shadcn component base and route-level loading/error files for many sections. Phase 0 did not find a canonical admin design-token or state contract.

## Decision

Every interactive admin component supports default, hover, focus-visible, active, disabled, loading, error, and success states.

All colors use admin CSS custom properties. Hardcoded hex values are prohibited outside token definitions.

Accessibility invariants are semantic HTML, programmatic labels, ARIA error wiring, 44 by 44 CSS pixel touch targets, and visible focus indicators.

Material route segments require `loading.tsx` and `error.tsx`. Admin visual direction prioritizes operational authority, clarity, density, and hierarchy over decorative polish.

## Consequences

Component refactors must preserve operator workflows and avoid broad visual churn without state/accessibility coverage.

## Verification

Component tests and visual review cover state variants, labels, error wiring, focus behavior, and reduced-motion behavior.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
