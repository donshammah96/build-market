# ADR-ADMIN-004: Admin Data Classification and Handling

## Status

Accepted

## Context

Admin operators can view and mutate sensitive user, verification, finance, audit, and export data. Phase 0 found logging and audit paths that include identity fields.

## Decision

Class A Restricted data includes credentials and payment secrets. It is never logged and is never exposed beyond minimum necessary UI surfaces.

Class B Sensitive data includes email, phone, ID numbers, uploaded documents, and user identity fields. Values are never logged and are not persisted in browser storage.

Class C Internal data includes operation metadata, correlation IDs, capability roles, UUID resource identifiers, and non-identity audit metadata.

Class D Public data includes public profile display data and listing titles.

Admin views of Class A and Class B data default to minimum necessary display. Bulk export paths require explicit audit log entries.

## Alternatives Considered

**No formal classification:** Treating all data as equally sensitive with a blanket "never log anything" policy is simpler to communicate. Rejected because it is unenforceable at the type level — `Record<string, unknown>` audit metadata fields would accept PII silently. The four-class model enables enforcement at both the type level (`AdminLogEvent` prohibits Class A/B keys) and at the runtime scrub layer in the structured logger.

**GDPR data categories only:** Using the GDPR personal data / special category distinction as the classification system aligns with the regulatory frame. Rejected because GDPR categories are legal definitions, not engineering enforcement points. The internal A/B/C/D model maps to engineering controls (never log, never browser-persist, safe to log, safe to display) which are more actionable.

## Consequences

Logging, audit metadata, UI tables, and export tools must classify data before expanding fields.

## Verification

Drift tooling flags banned PII log keys. UI and export tests cover minimum-necessary surfaces for sensitive data.

## Revision History

| Date       | Author        | Change                                                                |
| ---------- | ------------- | --------------------------------------------------------------------- |
| 2026-06-04 | Phase 12 impl | Initial acceptance. Branch: `security/admin-overhaul/hardening-pass`. |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered and Revision History (F-Doc1).          |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-006-data-classification.md`
