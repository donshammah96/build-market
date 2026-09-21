# Client Current Status

Status: Not public-launch ready; documentation-governance snapshot only.
Scope: `apps/client` current architecture, capability-boundary, and release-evidence documentation; this is not an approval of marketplace, payment, privacy, or production readiness.
Evidence date: 2026-09-03
Git SHA: 38e18958c2eebb62fecdf260427c04e8974eaa18
Environment: Repository checkout; no deployed environment was exercised for this snapshot.
Commands and results: No client release command was executed for this baseline document; release evidence must be attached before a go decision.
Owner: Client Engineering
Known exclusions: Isolated onboarding/verification mutation remains a no-go control because the application has no resettable per-run identity adapter. Project-linked review eligibility and bounded queue-recovery flows now have implementation coverage but still require a protected staging execution artifact. A deployment has not been exercised for this snapshot; staging artifact evidence is still required.
Next review: 2026-12-03 or before any public-launch decision.

## Authority and evidence

The current client ADR index is [`ADR-001` through `ADR-010`](adr/). ADR-009 governs documentation lifecycle; historical plans, audits, and progress documents remain context rather than current readiness evidence. The launch decision is tracked in the repository-wide [`GO / NO-GO scorecard`](../../../docs/launch/GO_NO_GO.md).
