# DOCUMENT-HIERARCHY.md

**Purpose:** This is the conflict-resolution algorithm for the Build Market repository. Consult it first whenever two documents appear to disagree. Follow the algorithm top-to-bottom; stop at the first rule that resolves the conflict.

---

## Tier Map

```text
┌─────────────────────────────────────────────────────────────┐
│  TIER 0 — Decision Rationale (immutable)                    │
│                                                             │
│  apps/client ADRs (scope: apps/client)                      │
│  apps/client/docs/adr/ADR-001-auth-model.md                 │
│  apps/client/docs/adr/ADR-002-client-layer-boundaries.md    │
│  apps/client/docs/adr/ADR-003-domain-structure-and-         │
│                         import-direction.md                 │
│  apps/client/docs/adr/ADR-004-canonical-env-access-         │
│                         boundary.md                         │
│  apps/client/docs/adr/ADR-005-cannonical-observability-     │
│                         contract.md                         │
│  apps/client/docs/adr/ADR-006-data-classification.md        │
│  apps/client/docs/adr/ADR-007-role-model-admin-sub-roles-   │
│                         and-actor-context-shape.md          │
│  apps/client/docs/adr/ADR-008-http-surface-security.md      │
│                                                             │
│  apps/admin ADRs (scope: apps/admin)                        │
│  apps/admin/docs/adr/ADR-ADMIN-001-admin-authentication-    │
│                         and-authorization-model.md          │
│  apps/admin/docs/adr/ADR-ADMIN-002-admin-action-boundary-   │
│                         and-layer-structure.md              │
│  apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-     │
│                         contract.md                         │
│  apps/admin/docs/adr/ADR-ADMIN-004-admin-data-              │
│                         classification-and-handling.md      │
│  apps/admin/docs/adr/ADR-ADMIN-005-admin-http-and-          │
│                         security-surface.md                 │
│  apps/admin/docs/adr/ADR-ADMIN-006-admin-environment-       │
│                         variable-access-boundary.md         │
│  apps/admin/docs/adr/ADR-ADMIN-007-admin-ui-component-      │
│                         contract.md                         │
│  apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-         │
│                         contract.md                         │
│  apps/admin/docs/adr/ADR-ADMIN-009-admin-strangler-fig-     │
│                         and-feature-flag-strategy.md        │
│                                                             │
│  Explain WHY a rule exists. Not edited for implementation   │
│  detail. When a standing rule changes, an ADR is added or   │
│  amended — the old one is superseded, not deleted.          │
└─────────────────────────────────────────────────────────────┘
                            │ governs
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 1 — Current Law (canonical rule files)                │
│                                                             │
│  .github/copilot-instructions.md                            │
│    → repo-wide baseline; cross-package hard rules           │
│                                                             │
│  .agent/API-TO-FRONTEND-ARCHITECTURE.md                     │
│    → all apps/client specifics; wins over                   │
│      copilot-instructions.md for apps/client questions      │
│                                                             │
│  .agent/ADMIN-ARCHITECTURE.md                               │
│    → all apps/admin specifics; wins over                    │
│      copilot-instructions.md for apps/admin questions       │
│                                                             │
│  What belongs here: rules engineers and agents read         │
│  before touching code. Kept in sync with Tier 0.            │
│  Drift from ADRs must be fixed, not encoded in code.        │
└─────────────────────────────────────────────────────────────┘
                            │ informs
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2 — Execution Lenses (agent prompts, derived)         │
│                                                             │
│  .github/prompts/staff-architecture-lens.prompt.md          │
│    → system-level review; defers to Tier 1 as canonical     │
│                                                             │
│  .github/prompts/ui-implementation-standard.prompt.md       │
│    → component-level review; expands Tier 1 Section 3       │
│                                                             │
│  What belongs here: specialized checklists and output       │
│  contracts that expand Tier 1 rules into concrete audit     │
│  steps. Must never override Tier 1 or Tier 0. Conflict      │
│  with a higher tier means the prompt is stale — surface     │
│  the drift, do not encode a one-off exception.              │
└─────────────────────────────────────────────────────────────┘
                            │ may reference
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 3 — Slice-Local Documentation                         │
│                                                             │
│  apps/client/app/lib/domains/README.md                      │
│  apps/client/docs/PROGRESS-SUMMARY.md                       │
│  apps/client/docs/CHANGELOG.md                              │
│  Any route-family README or domain-level doc                │
│                                                             │
│  What belongs here: implementation detail scoped to a       │
│  single vertical or module. May add specificity to          │
│  higher-tier rules but must not weaken them.                │
└─────────────────────────────────────────────────────────────┘
```

---

## Conflict-Resolution Algorithm

When two documents appear to disagree, apply these rules in order. Stop at the first rule that resolves the conflict.

### Rule 1 — Higher tier wins

A higher-tier document wins over a lower-tier document on any question both address.

```text
Tier 0 (ADR) > Tier 1 (rule file) > Tier 2 (prompt) > Tier 3 (slice doc)
```

**Example:** An ADR says repositories must not perform role checks. A slice README says the repository "may perform ownership validation for convenience." The ADR wins. The README is stale and must be updated.

---

### Rule 2 — Within the same tier, narrower scope wins

When two documents occupy the same tier and both address the same question, the document with the narrower scope wins — provided the rules are compatible (i.e., the narrower rule adds specificity without contradicting the broader one).

```text
API-TO-FRONTEND-ARCHITECTURE.md  (apps/client only)
  wins over
copilot-instructions.md           (repo-wide)
  for apps/client questions
```

**Example:** `copilot-instructions.md` says "use `getResilientExecutor().execute()` for client-app API operations." `API-TO-FRONTEND-ARCHITECTURE.md` specifies the exact import path and wrapping pattern for a migrated route. The architecture guide's narrower rule applies; `copilot-instructions.md` provides the backup intent.

---

### Rule 3 — Within the same tier and same scope, stricter rule wins

When two documents occupy the same tier, cover the same scope, and both address the same question with incompatible rules, the stricter architectural boundary wins.

**Example:** An older section of `copilot-instructions.md` permits a `lib/services/*` module to own business logic for an unmigrated slice. A newer section of the same file says all new work must land in `app/lib/domains/*`. The stricter rule wins. The older section is legacy guidance and should be removed or annotated.

---

### Rule 4 — When rules are compatible, both apply

If two rules address different aspects of the same question without contradicting each other, both apply. Do not use an apparent conflict as grounds to ignore one.

**Example:** An ADR defines import direction. A prompt checklist defines ARIA wiring rules. Neither contradicts the other. Both apply in a review of an onboarding form.

---

### Rule 5 — When genuinely ambiguous, follow the principle

If the algorithm does not resolve the conflict — because the documents are at the same tier, same scope, and the rules are genuinely incompatible — apply these principles in order:

1. Prefer the rule that protects a harder-to-reverse invariant (security boundary, data integrity, auth model).
2. Prefer the rule that minimizes blast radius if copy-pasted across the codebase.
3. Prefer the rule that was established more recently (reflects more current architectural thinking).

Then surface the ambiguity. Do not silently encode a one-off exception in code. Add a note to the relevant Tier 1 document or open an ADR if the question is structural.

---

## Drift Protocol

When a lower-tier document contradicts a higher-tier document:

1. Follow the higher-tier document for the current task.
2. Do not encode the drift as an in-code comment or workaround.
3. Surface it explicitly — in a PR description, a review comment, or an inline `// STALE: conflicts with ADR-XXX` annotation — so it is visible and actionable.
4. The drift should be resolved in the docs before the affected slice is considered stable.

---

## Ownership Map

| Question                                           | Primary Document                                           |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Why does a rule exist?                             | Tier 0 ADR (client or admin scope as applicable)           |
| What are the repo-wide rules?                      | `.github/copilot-instructions.md`                          |
| How should I structure a new `apps/client` domain? | `.agent/API-TO-FRONTEND-ARCHITECTURE.md`                   |
| What UI invariants apply to a form or component?   | `.agent/API-TO-FRONTEND-ARCHITECTURE.md` Section 3         |
| How should I structure a new `apps/admin` domain?  | `.agent/ADMIN-ARCHITECTURE.md`                             |
| What are the admin auth and capability rules?      | `ADR-ADMIN-001` + `.agent/ADMIN-ARCHITECTURE.md` Section 2 |
| What are the admin layer boundary rules?           | `ADR-ADMIN-002` + `.agent/ADMIN-ARCHITECTURE.md` Section 3 |
| What is the current admin overhaul status?         | `apps/admin/docs/PROGRESS-SUMMARY.md`                      |
| What admin milestones have shipped?                | `apps/admin/docs/CHANGELOG.md`                             |
| How do I review a system-level proposal?           | `staff-architecture-lens.prompt.md`                        |
| How do I audit a component or form implementation? | `ui-implementation-standard.prompt.md`                     |
| What is the current client migration status?       | `apps/client/docs/PROGRESS-SUMMARY.md`                     |
| What client architectural milestones have shipped? | `apps/client/docs/CHANGELOG.md`                            |
| How does a specific domain slice work?             | Domain-local `README.md`                                   |

---

## Related Documents

- `.github/copilot-instructions.md` — repo-wide baseline rules
- `.agent/API-TO-FRONTEND-ARCHITECTURE.md` — `apps/client` canonical architecture
- `.agent/ADMIN-ARCHITECTURE.md` — `apps/admin` canonical architecture
- `apps/client/docs/adr/` — all accepted client ADRs
- `apps/admin/docs/adr/` — all accepted admin ADRs
- `apps/client/docs/PROGRESS-SUMMARY.md` — current client migration queue and slice status
- `apps/client/docs/CHANGELOG.md` — client architectural milestones and hardening history
- `apps/admin/docs/PROGRESS-SUMMARY.md` — current admin overhaul phase and slice status
- `apps/admin/docs/CHANGELOG.md` — admin overhaul milestones and hardening history
