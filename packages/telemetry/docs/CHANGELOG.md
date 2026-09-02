# @build/telemetry Changelog

## [Unreleased]

### Changed — Tracing-only package boundary

- Removed the duplicate `createLogger`/`LoggerConfig` API and logger implementation.
- `@build/telemetry` now exports only `initTracing` and `InitTracingOptions`; structured logging is provided by `@build/resilience`.
