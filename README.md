# Build Market Monorepo

Build Market is a Turborepo-based monorepo for a marketplace platform. This README is tuned for operations-first use: running the system safely, deploying changes, responding to incidents, and maintaining service health.

## Contents

- Operational Scope
- Repository and Service Map
- Prerequisites
- Environment and Secret Management
- Local and Shared Runtime Operations
- Build, Test, and Release Gates
- Deployment Procedure
- Rollback Procedure
- Incident Response Playbook
- Observability and Logging
- Security Operations
- Troubleshooting
- Change Management

## Operational Scope

Primary goals for operators and senior engineers:

- Keep production and non-production environments healthy.
- Reduce time-to-detect and time-to-recover during incidents.
- Enforce safe, repeatable release and rollback workflows.
- Preserve data integrity and security boundaries across services.

## Repository and Service Map

Monorepo structure:

```text
build-market/
|- apps/
|  |- client/
|  |- admin/
|  |- payment-service/
|  |- project-service/
|  \- review-service/
|- packages/
|  |- auth-server/
|  |- db/
|  |- enums/
|  |- eslint-config/
|  |- mail-server/
|  |- messaging-server/
|  |- nats/
|  |- queue-server/
|  |- redis/
|  |- resilience/
|  |- types/
|  |- typescript-config/
|  \- ui/
|- package.json
|- pnpm-workspace.yaml
\- turbo.json
```

Operational ownership model:

- `apps/*` own runtime behavior, APIs, and user-facing risk.
- `packages/*` own shared contracts and infrastructure integrations.
- Changes in `packages/*` should be treated as potentially multi-service impact.

## Prerequisites

- Node.js `>=20`
- pnpm `>=10`
- Access to environment secrets and backing services (database, cache, external providers)

Recommended baseline:

```bash
corepack enable
node --version
pnpm --version
```

## Environment and Secret Management

Environment variables are consumed at root and app/package scope. `turbo.json` defines globally relevant values for build/test pipelines.

Common categories used across workflows:

- Runtime: `NODE_ENV`
- Data: `DATABASE_URL`, `POSTGRES_URL`
- Internal auth: `INTERNAL_API_SECRET`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- Cache/rate-limit infra: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- Third-party provider credentials and callback URLs

Operational requirements:

- Never commit secrets.
- Use distinct credentials per environment.
- Rotate secrets on exposure suspicion or staff access changes.
- Prefer short-lived credentials where supported.

## Local and Shared Runtime Operations

Install dependencies:

```bash
pnpm install
```

Provision environment file:

```bash
cp .env.example .env
```

If `.env.example` is missing, request the approved template and populate values from your secret manager.

Run database migrations:

```bash
pnpm run db:migrate:deploy
```

Start runtime by scope:

```bash
# Entire workspace
pnpm run dev

# Frontend only
pnpm run dev:frontend
pnpm run dev:client
pnpm run dev:admin

# Services subset
pnpm run dev:services
```

Known local endpoints:

- Client: `http://localhost:3500`
- Admin: `http://localhost:3005`

Post-start smoke check:

- Confirm both frontends respond.
- Confirm DB migrations succeeded.
- Confirm logs show no startup authentication/configuration failures.

## Build, Test, and Release Gates

Standard quality gate sequence:

```bash
pnpm run format:check
pnpm run lint
pnpm run check-types
pnpm run test
```

Single command equivalent:

```bash
pnpm run validate
```

Before promoting a release candidate:

- Ensure no failing checks in CI.
- Ensure migrations are reviewed for backward compatibility.
- Ensure any shared package changes have downstream verification.

## Deployment Procedure

Use this procedure for controlled environment rollout:

1. Validate branch status and CI results.
2. Confirm target environment variables are complete.
3. Run migrations in a controlled step.
4. Deploy application/services.
5. Execute smoke tests on critical paths.
6. Watch logs and metrics for regression window.

Minimum post-deploy checks:

- Authentication flows
- Core read/write paths touching the database
- Payment/project/review critical endpoints (as applicable)
- Error-rate and latency trends against baseline

## Rollback Procedure

Rollback should be explicit and time-bounded.

1. Declare rollback intent in incident/release channel.
2. Revert to last known good artifact/version.
3. Verify runtime recovers and error rate normalizes.
4. Assess schema compatibility before database rollback.
5. Publish timeline, root cause hypothesis, and next action owner.

Database note:

- Treat down-migrations as high risk.
- Prefer forward fixes unless rollback is required for safety.

## Incident Response Playbook

Severity handling baseline:

- Sev 1: production outage or critical data/security risk
- Sev 2: significant degradation with workaround
- Sev 3: localized issue with limited impact

Triage sequence:

1. Detect and acknowledge incident.
2. Scope affected services and user impact.
3. Stabilize system (rollback, feature disable, traffic reduction).
4. Communicate status and ETA at fixed intervals.
5. Recover and validate.
6. Run post-incident review with actions and owners.

Evidence to collect:

- Error logs and request IDs
- Recent deploy/change set
- Resource saturation signals
- Failed external dependency calls

## Observability and Logging

Operational baseline expectations:

- Structured logs with enough context for traceability.
- Request correlation IDs where available.
- Environment-specific dashboards for latency/error/saturation.
- Alert thresholds aligned with user-impacting symptoms.

Recommended metric categories:

- Availability and health status
- Request volume, latency percentiles, error rates
- Database query performance and connection pressure
- Queue/backlog trends for async workloads

## Security Operations

Minimum operational controls:

- Enforce least privilege for service accounts and API keys.
- Audit and rotate secrets regularly.
- Validate inputs and sanitize outputs at service boundaries.
- Avoid exposing internal implementation details in client errors.
- Track dependency vulnerabilities using `pnpm run deps:audit`.

On suspected compromise:

1. Contain access (revoke/rotate credentials).
2. Capture forensic logs and timeline.
3. Assess impact and required disclosures.
4. Restore secure baseline before full traffic recovery.

## Troubleshooting

Dependency or lockfile drift:

```bash
pnpm install --frozen-lockfile
```

If state remains inconsistent:

```bash
pnpm install
pnpm run clean:cache
```

Turbo cache issues:

```bash
pnpm run clean:cache
pnpm run dev
```

Type and build validation:

```bash
pnpm run check-types
pnpm run build
```

Operational checks during startup failures:

- Verify env vars for the specific app/service.
- Verify connectivity to DB/cache/providers.
- Verify secrets match the selected environment.

## Change Management

Expected PR standards:

- Keep changes scoped and reversible.
- Document operational and architectural impact.
- Include test evidence and rollout/rollback notes.
- Update docs and runbooks when behavior changes.

High-risk change classes (require additional review):

- Authentication/authorization logic
- Payment and financial workflows
- Data export/deletion pipelines
- Shared package changes consumed by multiple apps

## Appendix A: On-Call Runbook (Strict)

This appendix is prescriptive. If an active incident conflicts with this procedure, follow this runbook first and document deviations in the incident timeline.

### A1. On-Call Roles

- **Primary on-call:** first responder, owns triage and mitigation.
- **Secondary on-call:** joins on escalation or explicit request; owns parallel investigation tracks.
- **Incident commander (IC):** coordinates decisions, timeline, and communications for Sev 1 and Sev 2 incidents.
- **Scribe:** records timestamps, decisions, owners, and evidence links.

### A2. Severity and Response Targets

| Severity | Example impact                                           | Acknowledge | Engage Secondary | Update Cadence |
| -------- | -------------------------------------------------------- | ----------- | ---------------- | -------------- |
| Sev 1    | Full outage, data corruption risk, active security event | 5 min       | 10 min           | every 15 min   |
| Sev 2    | Major degradation, critical feature unavailable          | 10 min      | 20 min           | every 30 min   |
| Sev 3    | Limited blast radius, workaround exists                  | 30 min      | optional         | every 60 min   |

Rules:

- If severity is uncertain, start at **Sev 2** and downgrade later.
- If customer-facing trust or data integrity is at risk, classify **Sev 1**.
- If no mitigation is found within 30 minutes, escalate one severity level.

### A3. Escalation Matrix

1. Page Primary immediately.
2. If no acknowledgment within target, auto-page Secondary.
3. If no active owner by +15 minutes from target, notify engineering leadership.
4. If third-party provider is implicated, page provider contact and open vendor ticket.
5. For security indicators, notify security owner immediately and preserve forensic logs.

### A4. Incident Communication Protocol

Use one dedicated incident channel and one canonical incident document.

Required message fields for every update:

- Current severity
- User impact statement
- Current mitigation status
- Next milestone and owner
- Next update time (absolute timestamp, UTC preferred)

Status update template:

```text
[INCIDENT UPDATE]
Severity: Sev X
Impact: <who is affected and how>
Status: <investigating | mitigating | monitoring | resolved>
Actions in progress: <top 1-3 actions and owners>
Risks/unknowns: <open risks>
Next update: <YYYY-MM-DD HH:MM UTC>
```

Incident start template:

```text
[INCIDENT START]
Severity: Sev X
Start time: <YYYY-MM-DD HH:MM UTC>
Detected by: <alert/customer/internal>
Initial impact: <short statement>
IC: <name>
Primary: <name>
Secondary: <name or pending>
Incident doc: <link>
```

### A5. Triage and Mitigation Checklist

Complete in order:

1. Confirm user impact and blast radius.
2. Freeze unrelated deploys to impacted surfaces.
3. Identify last known good release and recent changes.
4. Decide fastest safe mitigation:
   - rollback
   - disable feature flag
   - traffic shift or throttling
   - dependency failover
5. Validate mitigation with smoke checks.
6. Move from mitigation to root-cause isolation only after stabilization.

### A6. Deployment Freeze and Recovery Criteria

During active Sev 1 or Sev 2 incidents:

- No non-incident deployments to impacted systems.
- No schema changes unless required for mitigation and approved by IC.
- No dependency upgrades as part of emergency mitigation.

Recovery criteria to close incident:

- Error rate and latency return to pre-incident baseline window.
- Critical user paths pass smoke checks.
- Monitoring shows stable trend for at least 30 minutes.
- Incident channel receives final summary and explicit resolved timestamp.

### A7. Handoff Protocol (Shift Change)

Handoffs must be synchronous for open Sev 1 and Sev 2 incidents.

Handoff minimum content:

- Current severity and impact
- Timeline summary (key timestamps)
- What has been ruled out
- Current hypothesis and next actions
- Open owners and deadlines

No incident is handed off without a written handoff note in the incident document.

### A8. Post-Incident Requirements

Postmortem SLA:

- Sev 1: draft within 24 hours, reviewed within 3 business days
- Sev 2: draft within 48 hours, reviewed within 5 business days
- Sev 3: summary within 5 business days (postmortem optional)

Required postmortem sections:

- Impact summary (user, duration, scope)
- Root cause and contributing factors
- Detection and response timeline (UTC)
- What worked, what failed
- Corrective actions with owners and due dates
- Prevention plan (runbook, alert, test, or architecture updates)

Post-incident policy:

- Action items are tracked to closure, not just creation.
- Repeated incident classes require a prevention owner at staff+ level.

## Appendix B: Incident Documentation Templates

Use these templates as-is during and after incidents. Keep timestamps in UTC.

### B1. Postmortem Template (Copy/Paste)

```markdown
# Incident Postmortem

## 1) Metadata

- Incident ID:
- Severity:
- Status: Closed
- Start time (UTC):
- End time (UTC):
- Duration:
- Incident commander:
- Primary on-call:
- Secondary on-call:
- Scribe:
- Related incident channel:
- Related incident doc:
- Related PRs/commits:

## 2) Executive Summary

- What happened:
- User impact summary:
- Business impact summary:
- Resolution summary:

## 3) Impact Assessment

- Affected systems/services:
- Affected user segments:
- Approximate number of impacted requests/users:
- Data integrity impact:
- Security/privacy impact:
- Financial/compliance impact:

## 4) Detection and Escalation

- Detection source (alert/customer/internal):
- First signal timestamp (UTC):
- Time to acknowledge:
- Time to mitigate:
- Time to recover:
- Escalation path followed:

## 5) Timeline (UTC)

| Time (UTC)       | Event              | Owner | Notes/Evidence |
| ---------------- | ------------------ | ----- | -------------- |
| YYYY-MM-DD HH:MM | Incident detected  | name  | link/log/query |
| YYYY-MM-DD HH:MM | Severity declared  | name  | link           |
| YYYY-MM-DD HH:MM | Mitigation started | name  | link           |
| YYYY-MM-DD HH:MM | Service stabilized | name  | link           |
| YYYY-MM-DD HH:MM | Incident resolved  | name  | link           |

## 6) Root Cause Analysis

- Primary root cause:
- Contributing factors:
- Why existing controls did not prevent this:
- Why detection was/was not fast enough:

## 7) What Worked / What Did Not

### Worked

-
-

### Did Not Work

-
-

## 8) Corrective and Preventive Actions

| Action | Type (Corrective/Preventive) | Owner | Priority | Due Date (UTC) | Status |
| ------ | ---------------------------- | ----- | -------- | -------------- | ------ |
|        |                              |       | P0/P1/P2 | YYYY-MM-DD     | Open   |
|        |                              |       | P0/P1/P2 | YYYY-MM-DD     | Open   |

## 9) Validation Plan

- How fixes will be tested:
- Monitoring/alerts added or updated:
- Rollback criteria for follow-up releases:

## 10) Communications and Follow-ups

- Customer/internal communication sent:
- Required stakeholder reviews:
- Lessons shared with engineering org:

## 11) Sign-off

- Incident commander sign-off:
- Service owner sign-off:
- Engineering manager sign-off:
- Date (UTC):
```

### B2. Incident Timeline Template (Copy/Paste)

```markdown
# Incident Timeline

## Incident Header

- Incident ID:
- Severity:
- Status: Investigating / Mitigating / Monitoring / Resolved
- Start time (UTC):
- Incident commander:
- Primary on-call:
- Secondary on-call:
- Scribe:
- Incident channel:
- Incident doc:

## Impact Statement

- Current user impact:
- Current service impact:
- Current business impact:

## Live Timeline (UTC)

| Time (UTC)       | Category | Event                         | Owner | Evidence/Link | Next Step           |
| ---------------- | -------- | ----------------------------- | ----- | ------------- | ------------------- |
| YYYY-MM-DD HH:MM | detect   | Alert fired / report received | name  | link          | validate impact     |
| YYYY-MM-DD HH:MM | declare  | Severity set to Sev X         | name  | link          | start triage        |
| YYYY-MM-DD HH:MM | mitigate | Rollback/flag/traffic action  | name  | link          | confirm recovery    |
| YYYY-MM-DD HH:MM | verify   | Smoke checks passed/failed    | name  | link          | continue monitoring |
| YYYY-MM-DD HH:MM | resolve  | Incident resolved             | name  | link          | prepare postmortem  |

## Open Action Tracker

| Action | Owner | Priority | ETA (UTC)        | Status |
| ------ | ----- | -------- | ---------------- | ------ |
|        |       | P0/P1/P2 | YYYY-MM-DD HH:MM | open   |
|        |       | P0/P1/P2 | YYYY-MM-DD HH:MM | open   |

## Update Log (for status broadcasts)

| Time (UTC)       | Message Summary              | Posted By | Audience          |
| ---------------- | ---------------------------- | --------- | ----------------- |
| YYYY-MM-DD HH:MM | Initial incident declaration | name      | internal          |
| YYYY-MM-DD HH:MM | Mitigation in progress       | name      | internal/external |
| YYYY-MM-DD HH:MM | Resolved and monitoring      | name      | internal/external |

## Resolution Criteria Checklist

- [ ] Error rate returned to baseline
- [ ] Latency returned to baseline
- [ ] Critical user paths validated
- [ ] No active regressions observed for 30 minutes
- [ ] Final incident summary posted
- [ ] Postmortem owner assigned
```

## License

This repository is private. Usage and distribution are governed by internal policy unless otherwise specified.
