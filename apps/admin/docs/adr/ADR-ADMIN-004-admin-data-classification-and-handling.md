# ADR-ADMIN-004: Admin Data Classification and Handling

## Status

Accepted on 2026-06-04 by Phase 12 validation in `security/admin-overhaul/hardening-pass`.

## Context

Admin operators can view and mutate sensitive user, verification, finance, audit, and export data. Phase 0 found logging and audit paths that include identity fields.

## Decision

Class A Restricted data includes credentials and payment secrets. It is never logged and is never exposed beyond minimum necessary UI surfaces.

Class B Sensitive data includes email, phone, ID numbers, uploaded documents, and user identity fields. Values are never logged and are not persisted in browser storage.

Class C Internal data includes operation metadata, correlation IDs, capability roles, UUID resource identifiers, and non-identity audit metadata.

Class D Public data includes public profile display data and listing titles.

Admin views of Class A and Class B data default to minimum necessary display. Bulk export paths require explicit audit log entries.

## Consequences

Logging, audit metadata, UI tables, and export tools must classify data before expanding fields.

## Verification

Drift tooling flags banned PII log keys. UI and export tests cover minimum-necessary surfaces for sensitive data.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-006-data-classification.md`
