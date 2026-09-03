# MVP Launch Go / No-Go Scorecard

Status: No-go for public consumer acquisition until every required evidence item is complete, current, and approved by its named owner.
Scope: Kenya-first marketplace MVP public-launch decision; this scorecard does not authorize adjacent verticals, platform custody, or paid M-Pesa activation.
Evidence date: 2026-09-03
Git SHA: 38e18958c2eebb62fecdf260427c04e8974eaa18
Environment: Staging is the required evidence environment unless a row explicitly names a production drill.
Commands and results: Documentation-governance baseline is pending final CI verification; this page contains required evidence contracts rather than completed launch proof.
Owner: Marketplace Operations, with Engineering release approval
Known exclusions: Materials commerce, property transactions, CPD, wallets/escrow, and any platform custody model.
Next review: 2026-12-03 or before each launch-decision meeting.

## Required evidence

| Area            | Release threshold                                                                                                   | Owner                   | Required ADR and control evidence                                                                                         | Current decision                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Supply          | At least three eligible verified professionals for 90% of pilot intents across the selected trade/location matrix.  | Marketplace Operations  | ADR-010; Control: staging test-control `onboarding` E2E suite and verified-professional eligibility report.               | No-go — test-control authority established; awaiting live staging run receipt. |
| Responsiveness  | Median first qualified response is at or below two business hours.                                                  | Marketplace Operations  | ADR-005, ADR-010; Control: staging test-control `lead-routing` E2E suite and staffed-routing drill.                       | No-go — test-control authority established; awaiting live staging run receipt. |
| Verification    | P95 completion is at or below 24 hours with zero incorrect or expired public trust badges.                          | Verification Operations | ADR-006, ADR-010; Control: staging test-control `verification` E2E suite, expiry audit, and override sample.              | No-go — test-control authority established; awaiting live staging run receipt. |
| Lead experience | At least 65% mobile intake completion and zero known P0 disclosure defects.                                         | Product and Engineering | ADR-006, ADR-008; Control: staging test-control `02-routing-and-messaging.cy.ts` masked-disclosure test evidence.         | No-go — test-control authority established; awaiting live staging run receipt. |
| Safety          | Reporting, moderation, escalation, and emergency contact paths are tested end-to-end.                               | Trust and Safety        | ADR-ADMIN-014; Control: escalation and breach tabletop record.                                                            | No-go — evidence not attached.                                                 |
| Payments        | No paid flow is live until callback, replay, reconciliation, reversal, support, and disclosure drills pass.         | Finance and Engineering | ADR-008, ADR-ADMIN-012; Control: staging test-control `04-mpesa-replay-and-idempotency.cy.ts` drill and support runbook.  | No-go — test-control authority established; awaiting live staging run receipt. |
| Resilience      | Queue outage, NATS outage, regulator outage, bad upload, callback replay, and flag rollback drills pass in staging. | Platform Engineering    | ADR-010, ADR-ADMIN-012, ADR-ADMIN-016; Control: staging test-control `05-queue-failure-recovery.cy.ts` drill and runbook. | No-go — test-control authority established; awaiting live staging run receipt. |
| Compliance      | DPIA, data map, retention, processor inventory, registration assessment, and breach tabletop are approved.          | Privacy and Legal       | ADR-006, ADR-ADMIN-015; Control: signed privacy/compliance decision record.                                               | No-go — evidence not attached.                                                 |

## Evidence rules

Attach immutable build output or signed reports to each row before changing its decision. Every attachment must state the Git SHA, environment, command or drill, result, date, owner, known exclusions, and next review date. A completed engineering check cannot substitute for an operational, legal, privacy, or marketplace-outcome control.

For staging candidates, use the `Staging Release Evidence` CI artifact named `staging-release-evidence-<Git SHA>`. Its manifest is generated only from a clean checkout by `pnpm run release:evidence:generate`; `pnpm run validate` is not release evidence because it may format files.
