# ADR: BullMQ and NATS JetStream both stay — split by role, not migrate

**Status:** Accepted
**Date:** 2026-09-02
**Renumber to fit your ADR sequence.**

## Context

Build Market's `apps/workers` runs both BullMQ (Redis-backed) and NATS JetStream
side by side, with `@build/queue-server` holding shared queue contracts.

BullMQ handles discrete task execution: newsletter sends, Cloudmersive
malware rescans, M-Pesa subscription-renewal jobs, webhook processing.

NATS JetStream handles cross-service domain events: lead-qualification
routing, verification-ops signals, anything multiple consumers react to
independently.

The question came up: consolidate the remaining BullMQ queues onto
JetStream, or keep BullMQ as a permanent second standard.

Driver for asking: NATS server 2.12 (native `AllowMsgSchedules`, one-shot
delayed delivery) and 2.14 (recurring/cron-style schedules via the same
header) closed BullMQ's historically strongest differentiator — delayed
and repeatable jobs are now native to JetStream, not a workaround.

## Decision

**Do not migrate BullMQ queues onto JetStream. Keep both, permanently, split
by role:**

- **BullMQ** — anything that is a discrete task needing retry/backoff,
  delay, priority, or job-dependency semantics.
- **NATS JetStream** — anything that is a domain event multiple services
  need to observe or fan out to.

If a workload doesn't clearly fit one bucket, default to BullMQ unless it
specifically needs multi-consumer fan-out.

**Separately:** migrate BullMQ's backend from Redis to Postgres (BullMQ v6's
`IQueueBackend` abstraction, shipped ~July 2026), once staged and verified
against the malware-scan gate and webhook flows. This is the real
infra-reduction move — it removes Redis as a dependency entirely without
touching queue call sites, retry logic, or `@build/queue-server` contracts.
Do this on its own timeline, independent of the queue-split decision above.

## Why not full JetStream consolidation

Even with 2.12/2.14 scheduling, JetStream has no equivalent for:

- **Job dependencies** — no FlowProducer analog; chains like malware-scan →
  verification-ops would need hand-rolled orchestration.
- **Rate limiting per queue** — JetStream offers `max_ack_pending` and pull-batch
  sizing, not a per-duration limiter.
- **Job priority** — 2.12's prioritized pull-consumer policy is not the same
  model as BullMQ's numeric job priority; would need re-validating against
  existing routing logic.
- **Operational visibility** — no Bull Board equivalent; would mean building
  a custom job inspector for newsletter/renewal/malware-scan queues.

Rebuilding these on streaming primitives is discretionary engineering cost
with no user-facing payoff, carried by a solo maintainer, against a stack
with a stated high bar for security and fault tolerance.

## Consequences

- Two systems stay in production. `@build/queue-server` contracts remain
  the shared interface; no change to that package from this decision.
- Redis may eventually disappear (via the Postgres backend migration) but
  BullMQ as the task-execution API does not.
- Anyone extending the worker picks the target by workload shape (task vs.
  event), not by which system is "in favor" this quarter.

## Revisit triggers

Reopen this decision only if:

- JetStream ships native equivalents for job dependencies, per-queue rate
  limiting, and priority ordering that map cleanly onto BullMQ's model —
  not just closer feature parity.
- Running both systems becomes an operational cost problem on Render
  specifically (not a hypothetical one).
- The BullMQ Postgres backend proves unstable in production and Redis
  removal has to be reconsidered — that's a backend question, not a reason
  to revisit this split.

Absent one of these, the answer to "should we move X off BullMQ onto NATS"
is no.
