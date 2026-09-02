# @build/resilience Changelog

## [Unreleased]

### Added — Datadog structured logging and resilience outcomes

- Added explicit operation outcomes (`success`, `cache_hit`, `fallback`, `timeout`, `circuit_open`, `error`) and bounded histogram sampling.
- Added stale-while-revalidate cache behavior, single-probe circuit breaker half-open transitions, and abort-aware timeout propagation.
- Added recursive sensitive-field redaction for structured logs, correlation identifiers, and an in-process Datadog batch sink with bounded queues, retries, and lifecycle flush/close APIs.
