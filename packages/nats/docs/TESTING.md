# Integration tests for `@build/nats`

## Why integration, not unit, tests

The behavior worth verifying here — redelivery on ack-wait timeout,
termination after `maxDeliver`, `msgId` deduplication windows, stream
idempotency — is implemented by the NATS server, not by this package's
TypeScript. Mocking the `nats` client would only prove our code calls a
mock the way we wrote the mock; it wouldn't catch a wrong `ack_wait`
value, a misconfigured `discard` policy, or a subject pattern that
doesn't actually match. These tests run against a real `nats-server`
process with JetStream enabled.

## Prerequisites

Install the `nats-server` binary and make sure it's on `PATH`:

```bash
# macOS
brew install nats-server

# Linux / manual — download the binary for your platform:
# https://github.com/nats-io/nats-server/releases
```

Verify it's reachable:

```bash
nats-server --version
```

Add the new dev dependencies (test-only — nothing here ships in the
built package):

```bash
pnpm add -D vitest @opentelemetry/sdk-metrics --filter @build/nats
```

## Running

```bash
pnpm test:integration
```

`test/integration/global-setup.ts` spawns one shared `nats-server -js` on
an ephemeral port for the whole run, and tears it down after. Test files
run sequentially against that one server (`fileParallelism: false` in
`vitest.integration.config.ts`) — JetStream stream/consumer names are
shared state, so parallel suites would race each other creating and
deleting the same test streams.

Set `NATS_TEST_VERBOSE=1` to see the server's own stdout/stderr if a test
is behaving unexpectedly:

```bash
NATS_TEST_VERBOSE=1 pnpm test:integration
```

## What's covered

| File                        | Covers                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `producer-consumer.test.ts` | Basic publish → consume → ack round trip, `publishWithRetry` happy path, `msgId` dedup within the duplicate window              |
| `dead-letter.test.ts`       | Redelivery via NAK when a handler throws, and termination (no further redelivery) once `maxDeliver` is exceeded                 |
| `streams.test.ts`           | `ensureStream` creates once then updates on a second call (no duplicate streams), `getStreamStats` reflects real message counts |
| `metrics.test.ts`           | `nats_client_messages_published_total` records success/error, `nats_client_connection_status` reflects live connection state    |

## What's deliberately not covered yet

- **Multi-node cluster failover** — the spawned test server is a single
  node. If you need to verify behavior across a real 3-node cluster
  losing quorum, that's a separate, heavier test suite (likely
  testcontainers with a real 3-node Docker Compose topology), not
  something to bolt onto this fast local suite.
- **Consumer lag gauge values** (`nats_client_consumer_pending_messages`)
  — these are read via `Consumer.info()` on an OTel batch callback that
  only fires on an actual metrics _collect_, same as the publish/consume
  counters, so they're straightforward to add here following the same
  pattern as `metrics.test.ts` — left out only to keep this initial pass
  focused on the highest-value paths (redelivery correctness first).

If you want, I can add the consumer-lag gauge test and a docker-compose-based
3-node cluster suite as a follow-up.
