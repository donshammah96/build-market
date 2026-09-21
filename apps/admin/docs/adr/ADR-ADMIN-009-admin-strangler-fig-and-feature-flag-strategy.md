# ADR-ADMIN-009: Admin Strangler Fig and Feature Flag Strategy

Status: Accepted
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

The admin overhaul is too large to land as a single behavioral replacement. Existing routes must remain usable while new architecture is introduced and verified.

## Decision

New admin behavior is introduced behind typed `AdminFeatureFlag` values and retired only after verification. Feature flags are environment-driven for Phase 10 and may allow per-role overrides for staff testing.

During migration, new route surfaces coexist under explicit v2 route segments or flag-gated layouts. Old routes remain functional until a documented retirement step.

Rollback is performed by disabling the relevant feature flag. Any phase that cannot roll back by flag alone documents the irreversible data or schema state.

## Alternatives Considered

**Branch-by-abstraction without feature flags:** Introduce a new service layer behind an interface and switch the interface implementation in a single deployment. Rejected because the admin app's route segments and UI components are tightly coupled to data shapes — switching the implementation without a UI gate would require a big-bang UI change that cannot be rolled back independently.

**Dark-launch via separate deploy target:** Running the v2 admin as a separate Vercel deployment under a different URL and gradually migrating operators. Rejected because it doubles the operational surface (two admin apps to maintain, two auth configurations, two deploy pipelines) and complicates the transition — operators would need to know which URL to use.

**Rollout via database-driven flags:** Storing flag values in the database and reading them per request allows sub-second toggles without redeployment. Deferred — the current env-driven flags require a redeploy to toggle in hosted environments, which is acceptable for a low-traffic internal admin tool. Database flags add a read dependency on every request and a migration step when the flag is retired.

## Migration Criteria and Retirement Checklist

Each v2 route must meet these criteria before the v1 route can be retired:

1. **30-day stability window:** v2 flag has been enabled in production for at least 30 days with no P0/P1 incidents attributed to the v2 route.
2. **Feature parity confirmed:** All functionality present in the v1 route is present and tested in v2.
3. **Test coverage:** v2 route has action-boundary, domain, and (where applicable) UI tests.
4. **Observability:** v2 operations emit structured logs and audit entries equivalent to v1.

Retirement steps:

1. Remove the feature flag env variable from all environment configurations.
2. Delete the v1 route segment directory.
3. Remove the flag entry from `AdminFeatureFlag` and `FLAG_ENV_KEYS`.
4. Remove the flag from `adminEnvSchema` in `env.ts`.
5. Update `ROLLBACK-CONTRACTS.md` to mark the flag as retired.
6. Add a changelog entry under the relevant phase.

| Flag                                  | v2 Route            | Retirement Owner      | Status      |
| ------------------------------------- | ------------------- | --------------------- | ----------- |
| `admin_v2_user_management`            | `/users-v2`         | admin-platform-team   | Retired     |
| `admin_v2_verification_queue`         | `/verifications-v2` | admin-platform-team   | Retired     |
| `admin_v2_finance_dashboard`          | `/analytics-v2`     | admin-platform-team   | Retired     |
| `admin_v2_audit_log_ui`               | `/audit-v2`         | admin-platform-team   | Retired     |
| `admin_v2_structured_logging`         | N/A (behaviour)     | admin-platform-team   | In progress |
| `admin_ff_license_verification_queue` | N/A (behaviour)     | admin-compliance-team | In progress |

## Consequences

Later implementation phases must avoid coupling enabled and disabled behavior through incompatible schema assumptions.

## Verification

Progress docs record rollback variables, runtime/deploy requirements, and data-state caveats for each admin feature flag. Phase 10 tests cover default-disabled behavior and v2 route switching.

## Revision History

| Date       | Author        | Change                                                                                                            |
| ---------- | ------------- | ----------------------------------------------------------------------------------------------------------------- |
| 2026-05-18 | Phase 10 impl | Initial acceptance. Branch: `feat/admin-overhaul/feature-flags`.                                                  |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered, Migration Criteria, Retirement Checklist, and Revision History (F-Doc1, F-D3).     |
| 2026-09-02 | Governance    | Retired 4 strangler-fig v2 shadow routes (`users`, `verifications`, `finance`, `audit`) per retirement checklist. |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/admin/docs/ROLLBACK-CONTRACTS.md`
