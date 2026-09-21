# @build/db Changelog

## [Unreleased]

### Added - M-Pesa reconciliation leases, phone search index, and settlement uniqueness schema

- Added reconciliation claim lease fields (`reconciliationAttempts`, `reconciliationNextAttemptAt`, `reconciliationClaimedAt`, `reconciliationClaimId`, `lastProviderQueryAt`, `lastProviderQueryCode`) and `phoneSearchHash` index to `MpesaTransaction`.
- Added unique `settlementKey` constraint to `LeadCreditLedgerEntry` and `EscrowTransaction` for replay-safe financial ledger settlement.
- Migration: `20260831090000_mpesa_reconciliation_and_settlement_uniqueness`.

### Added - M-Pesa callback and idempotency schema

- Added callback receipt storage with provider-event uniqueness, payload hashes,
  redacted payloads, processing state, and correlation indexes.
- Added B2C idempotency/backfill fields and transaction callback metadata.
- Migration: `20260831060000_mpesa_hardening`.
