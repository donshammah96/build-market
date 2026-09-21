# Admin Telemetry & SLO Contract

This document defines the Service-Level Objectives (SLOs), Service-Level Indicators (SLIs), dashboard structures, and alert matrix for `apps/admin` as required by ADR-ADMIN-011.

## Service-Level Objectives (SLOs)

We define the following SLO boundaries for core administrative workflows:

| Workflow / Capability          | Indicator (SLI)                                                                                                                                  | Target (SLO)                     | Severity | Escalation Owner |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | -------- | ---------------- |
| **Admin Route Availability**   | Route requests returning non-5xx status codes                                                                                                    | `>= 99.9%` availability over 30d | P1       | Platform Team    |
| **Admin Route Latency**        | HTTP GET request duration (excluding streaming)                                                                                                  | `95%` of requests `< 800ms`      | P2       | Platform Team    |
| **Server Action Success Rate** | Executions returning `success: true` or expected user error (domain/validation error). Excludes `unauthorized`, `forbidden`, or `internal_error` | `>= 99.5%` success over 30d      | P1       | Application Team |
| **Server Action Latency**      | safeAction execution duration (RSC payload return)                                                                                               | `90%` of mutations `< 500ms`     | P2       | Application Team |
| **High-Risk Audit Writes**     | Declarative audit records successfully persisted to the database on mutation                                                                     | `100%` (Fail-Closed)             | P0       | Security Team    |
| **Compliance Queue Lag**       | Delay between job enqueue and processing completion                                                                                              | `< 5 minutes` for 99% of jobs    | P1       | Compliance Team  |
| **GDPR Erasure Completion**    | Time to execute erasure request after account deactivation                                                                                       | `< 24 hours`                     | P1       | Compliance Team  |

---

## Metric Semantic Conventions

All metrics are emitted via the OpenTelemetry API using the following standardized names and attribute labels:

### 1. Route Request Outcomes

- **Name:** `admin.route.outcome`
- **Type:** Counter
- **Description:** Tracks total route authorization/resolution outcomes.
- **Labels:**
  - `operationName`: string (e.g. `get_compliance_queue_status`)
  - `adminRole`: string (e.g. `SUPER_ADMIN`, `unknown`)
  - `outcome`: string (`success` \| `unauthorized` \| `forbidden` \| `error`)

### 2. Server Action Executions

- **Name:** `admin.action.outcome`
- **Type:** Counter
- **Description:** Tracks server action execution outcomes.
- **Labels:**
  - `operationName`: string (e.g. `deleteUser`)
  - `adminRole`: string (e.g. `SUPER_ADMIN`)
  - `outcome`: string (`success` \| `domain_error` \| `validation_error` \| `forbidden` \| `unauthorized` \| `rate_limited` \| `session_stale` \| `internal_error`)
  - `errorCode`: string (optional, e.g. `SESSION_STALE`)

### 3. Server Action Latency

- **Name:** `admin.action.duration`
- **Type:** Histogram (Unit: milliseconds)
- **Description:** Measures duration of safeAction execution.
- **Labels:**
  - `operationName`: string (e.g. `deleteUser`)
  - `outcome`: string (`success` \| `internal_error`)

### 4. Audit Trail Writes

- **Name:** `admin.audit.write`
- **Type:** Counter
- **Description:** Tracks audit log persistence success/failures.
- **Labels:**
  - `operationName`: string (e.g. `deleteUser`)
  - `outcome`: string (`success` \| `internal_error`)
  - `status`: string (`SUCCESS` \| `FAILURE` \| `DENIED`)

### 5. Background Jobs and Workers

- **Name:** `admin.job.attempt`
- **Type:** Counter
- **Description:** Tracks execution status of background jobs.
- **Labels:**
  - `jobName`: string (e.g. `perform-user-erasure`)
  - `status`: string (`completed` \| `failed`)

- **Name:** `admin.job.duration`
- **Type:** Histogram (Unit: milliseconds)
- **Description:** Measures background job execution time.
- **Labels:**
  - `jobName`: string
  - `status`: string (`completed` \| `failed`)

- **Name:** `admin.queue.lag`
- **Type:** UpDownCounter
- **Description:** Tracks estimated active/pending items in BullMQ queues.
- **Labels:**
  - `queueName`: string (e.g. `gdpr-erasure`)

---

## Alert Rules & Escalation Matrix

Alerts trigger automatically when telemetry boundaries are breached, paging the respective owners:

### P0: Audit Write Failure (`admin.audit.write{outcome="internal_error"} > 0`)

- **Condition:** Any single failure to persist an audit log for high-risk operations.
- **Effect:** Mutation fails closed; operator block.
- **Alert Target:** PagerDuty Security On-Call.
- **Runbook:** [Audit Failure Runbook](JOBS-QUEUES-RUNBOOKS.md#runbook-failed-audit-writes)

### P1: Compliance Queue Lag (`admin.queue.lag{queueName="security-incidents"} > 10`)

- **Condition:** More than 10 jobs accumulated in the incident or notification queue.
- **Alert Target:** Slack `#admin-alerts-compliance`.
- **Runbook:** [Queue Backlog Runbook](JOBS-QUEUES-RUNBOOKS.md#runbook-queue-backlog-remediation)

### P1: High Server Action Failure Rate (`admin.action.outcome{outcome="internal_error"} / total > 5% over 5m`)

- **Condition:** Spikes in unhandled exceptions within server actions.
- **Alert Target:** PagerDuty Admin App On-Call.
- **Runbook:** Check Server Action Exception logs using correlationId search.

---

## Telemetry Privacy Constraints (PII Redaction)

As mandated by ADR-ADMIN-003, the following keys must **never** be injected into OpenTelemetry metric attributes or logging metadata maps:

- `userId` / `clerkId`
- `email` / `userEmail` / `adminEmail`
- `phone` / `userPhone`
- `firstName` / `lastName`
- `nationalId`

Any trace correlation or metric breakdown must utilize the transient **`correlationId`** or the broad **`adminRole`** to preserve data confidentiality.
