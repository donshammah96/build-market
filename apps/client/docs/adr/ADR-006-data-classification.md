# ADR-006: Client Data Classification and Handling Rules

Status: Accepted
Owner: Client Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

`apps/client` enforces strong adapter and domain boundaries, but data handling decisions are still made inconsistently across slices. Engineers can usually identify obvious secrets, yet there is no canonical classification model to decide how new fields should be logged, persisted, serialized, or excluded from browser storage.

This creates drift:

- one slice may expose sensitive fields in DTOs that another slice correctly masks
- browser persistence allowlists can accidentally include sensitive onboarding inputs
- log safety review depends on reviewer intuition instead of a shared contract

For a marketplace handling financial and identity flows, this ambiguity is operational and compliance risk.

## Decision

Adopt a four-class data classification model for all `apps/client` boundary decisions.

### Class A - Restricted

Examples:

- national ID numbers and equivalent identity credentials
- payment credentials, payout secrets, escrow account secrets
- Clerk tokens and equivalent credential material

Handling rules:

- never log under any circumstance
- never store unencrypted at rest
- never include in API responses beyond minimum-necessary surface
- do not use real Class A data in non-production environments

### Class B - Sensitive

Examples:

- email address, phone number, physical address
- NCA or EBK identifiers, licensing numbers, credential documents
- uploaded identity documents and verification artifacts

Handling rules:

- never log field values
- avoid URL parameters for these fields
- do not persist in browser storage (`localStorage`, `sessionStorage`)
- document minimum-necessary use at DTO boundaries

### Class C - Internal

Examples:

- `correlationId`, `operationName`, `actorRole`, `durationMs`
- UUID resource identifiers that are not user-chosen slugs

Handling rules:

- safe for structured operational logging per ADR-005
- allowed in API responses when required by application behavior
- do not combine these fields in a way that reconstructs direct identity

### Class D - Public

Examples:

- public profile display names
- public portfolio images and listing titles intended for discovery

Handling rules:

- no additional confidentiality controls beyond standard app security
- still subject to integrity and abuse protections (validation, authorization, anti-automation)

### Idempotency Replay Policy

Idempotency replay persistence is a separate data-handling boundary from the first successful HTTP or server-action response.

- replay payloads must be derived from the owning route or action's public DTO or response envelope
- raw provider payloads, raw ORM/domain objects, and exception objects must not be persisted for replay
- default replay policy allows only Class C and Class D fields
- if an existing public contract requires minimum-necessary Class B fields to preserve duplicate-request behavior, that scope must opt in explicitly in the `IdempotencyService` replay-policy registry and remain reviewable there
- Class A data is never allowed in replay persistence

## Required Application of This ADR

1. DTOs crossing HTTP or server-action boundaries must classify fields in slice docs or contracts comments when Class A or Class B fields are present.
2. Form-persistence allowlists must explicitly exclude Class A and Class B fields.
3. Idempotent mutation scopes must register a replay policy that maps persisted replay payloads to the allowed ADR-006 data classes for that scope.
4. Logs must follow ADR-005 plus this ADR classification model.
5. When uncertain, classify as more sensitive and require explicit downgrade rationale.

## Consequences

### Positive

- creates a deterministic review model for data handling decisions
- reduces accidental sensitive-data exposure in logs and browser storage
- aligns onboarding persistence, DTO shaping, and observability policy under one language

### Negative

- adds review overhead when introducing new DTOs carrying sensitive fields
- requires migration passes to annotate legacy slices that currently rely on implied classification

## Migration Notes

1. Apply immediately for all new DTO and form-persistence changes.
2. During normal slice work, annotate or adjust legacy DTOs and onboarding persistence to align with this ADR.
3. Keep classification references concise and colocated with boundary contracts.
