# ADR-ADMIN-009: Admin Strangler Fig and Feature Flag Strategy

## Status

Proposed

## Context

The admin overhaul is too large to land as a single behavioral replacement. Existing routes must remain usable while new architecture is introduced and verified.

## Decision

New admin behavior is introduced behind typed `AdminFeatureFlag` values and retired only after verification. Feature flags are environment-driven for Phase 10 and may allow per-role overrides for staff testing.

During migration, new route surfaces coexist under explicit v2 route segments or flag-gated layouts. Old routes remain functional until a documented retirement step.

Rollback is performed by disabling the relevant feature flag. Any phase that cannot roll back by flag alone documents the irreversible data or schema state.

## Consequences

Later implementation phases must avoid coupling enabled and disabled behavior through incompatible schema assumptions.

## Verification

Progress docs record rollback variables, runtime/deploy requirements, and data-state caveats for each admin feature flag.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
