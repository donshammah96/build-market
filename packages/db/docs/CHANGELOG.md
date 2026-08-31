# @build/db Changelog

## [Unreleased]

### Added - M-Pesa callback and idempotency schema

- Added callback receipt storage with provider-event uniqueness, payload hashes,
  redacted payloads, processing state, and correlation indexes.
- Added B2C idempotency/backfill fields and transaction callback metadata.
- Migration: `20260831060000_mpesa_hardening`.
