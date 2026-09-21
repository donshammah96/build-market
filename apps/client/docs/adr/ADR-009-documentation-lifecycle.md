# ADR-009: Documentation Lifecycle Policy

Status: Accepted
Owner: Client Architecture
Next review: 2026-12-03

**Status:** Accepted  
**Date:** 2026-05-07  
**Deciders:** Engineering team  
**Supersedes:** None  
**Related:** ADR-002, ADR-003, ADR-005

---

## Context

The `apps/client` codebase has accumulated several categories of documentation over time:

1. **Living architecture documents** — authoritative, updated as the system evolves (`API_ARCHITECTURE.md`, `.agent/API-TO-FRONTEND-ARCHITECTURE.md`, ADRs)
2. **Implementation progress tracking** — time-bounded documents recording refactoring progress (e.g., `PROGRESS-SUMMARY.md`, `MIGRATION-STATUS.md`)
3. **Ephemeral working notes** — temporary docs created during a specific work window and not maintained after the work is done

Without a clear policy, ephemeral documents accumulate in the repo alongside authoritative ones. Engineers cannot distinguish which documents are current truth vs. historical snapshots. This creates false confidence in stale guidance.

---

## Decision

### Living Documents

Living documents are authoritative sources of truth. They are updated whenever the system they describe changes and are never "done."

**Location:** `docs/` for ADRs, `app/lib/` for inline architecture docs  
**Examples:** All `ADR-*.md` files, `API_ARCHITECTURE.md`, `.agent/API-TO-FRONTEND-ARCHITECTURE.md`

**Rules:**

- Must include a `Last Updated` date that is updated on every material change
- Must not contradict the implementation — if they do, the implementation wins and the doc must be corrected
- Cannot be deleted, only superseded by a newer ADR
- A PR that changes architecture without updating the relevant ADR is **blocked at review**

### Implementation Plans and Progress Docs

Time-bounded documents that track the execution of a specific initiative. They are accurate during the work window but become historical after completion.

**Location:** `docs/progress/` (created in Phase 8 of the remediation plan)  
**Examples:** `PROGRESS-SUMMARY.md`, `MIGRATION-STATUS.md`, implementation plans

**Rules:**

- Must include a `Status` header: `In Progress`, `Complete`, or `Superseded`
- On completion, must be moved to `docs/archive/` within one sprint
- Must not be referenced as authoritative sources — link to the relevant ADR instead
- Completions should be summarized in the `CHANGELOG.md`

### Ephemeral Working Notes

Temporary documents created during a specific work window (debugging sessions, spike results, AI-assisted analysis).

**Location:** `docs/scratch/` if they need to be committed at all  
**Examples:** Spike results, AI autopsy outputs, temporary analysis docs

**Rules:**

- Must include a `Expires:` date or `Status: EPHEMERAL` at the top
- Must be deleted or archived at the end of the work window
- Must never be referenced from code, ADRs, or living documents
- Default: do not commit these to the repo at all

---

## Enforcement

| Check                               | Mechanism                                                            |
| ----------------------------------- | -------------------------------------------------------------------- |
| ADR cross-reference on arch changes | PR review checklist                                                  |
| `Last Updated` freshness            | Author responsibility — no automated check (low ROI)                 |
| Progress doc archival               | Sprint close checklist — move completed docs to `docs/archive/`      |
| Ephemeral doc cleanup               | PR review — reject PRs that add undated scratch docs to `docs/` root |

---

## Directory Structure (Target)

```markdown
apps/client/docs/
├── adr/ # Living ADRs — immutable except by supersession
│ ├── ADR-001-_.md
│ ├── ...
│ └── ADR-009-_.md
├── progress/ # In-flight implementation plans and migration status
│ └── (empty when no active migrations)
└── archive/ # Completed progress docs — read-only historical record
└── (populated as initiatives complete)
```

---

## Consequences

### Positive

- Engineers can identify authoritative docs immediately by location
- Completed work is summarized in the changelog, not left as stale progress docs
- ADRs remain trustworthy because they are kept current

### Negative

- Requires discipline at PR review time to enforce archival
- Moving docs creates git history interruption (mitigated by `git mv`)

### Neutral

- Existing progress docs (`PROGRESS-SUMMARY.md`, `MIGRATION-STATUS.md`) are grandfathered and should be moved to `docs/archive/` in Phase 8

---

## Alternatives Considered

**Option 1: Keep all docs at root level with a naming convention** — Rejected. Naming conventions are not enforced without tooling, and the root `docs/` becomes a flat pile of files of unclear provenance.

**Option 2: Delete all non-ADR docs on completion** — Rejected. Historical progress docs have value for onboarding and post-mortems. Archive is the right middle ground.
