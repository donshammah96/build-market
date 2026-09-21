# @build/queue-server Changelog

## [Unreleased]

### Added - M-Pesa queue contracts

- Added typed STK, B2C, callback, and reconciliation job payloads with stable
  BullMQ job IDs and bounded retry defaults.
- Provider calls remain worker-only; this package exposes producers and queue
  contracts only.
