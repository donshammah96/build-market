# Client API Reference

## Purpose

This document is the top-level reference for the `apps/client` API surface.

It is intentionally architectural and route-family oriented, not an exhaustive replacement for each vertical README. Use it to understand the API contract shape, auth model, endpoint families, and the current ownership model. For route-by-route behavior inside a vertical, defer to the slice README in that folder.

## Core API Rules

- All route handlers return the shared success or error envelope.
- Clerk is the runtime authentication source for authenticated requests.
- Domain services, not routes, own resource authorization and business rules.
- Authenticated adapters should pass full actor context into the domain layer.
- Mutations should use shared idempotency and rate-limit primitives where the slice requires them.

## Base Response Contract

### Success

```json
{
  "success": true,
  "data": {},
  "timestamp": "2026-03-11T00:00:00.000Z",
  "correlationId": "abc-123"
}
```

### Error

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2026-03-11T00:00:00.000Z",
  "correlationId": "abc-123"
}
```

Notes:

- `correlationId` should be present on both success and error responses for operational tracing.
- some routes may include `details` for validation or structured adapter failures, but the envelope stays consistent.

## Authentication Modes

### Public

No authenticated actor is required.

Examples:

- health checks
- public professionals and property discovery
- public lead submission and public lead status

### Authenticated

Uses Clerk session identity plus database user resolution.

Examples:

- user profile and compliance
- messaging
- professional portal routes
- authenticated CRM flows

### Clerk-Authenticated Pre-Materialization

Some onboarding routes allow a valid Clerk user before the database user is fully materialized.

Examples:

- `/api/onboarding/**`
- `/api/onboarding/uploads`

These routes are intentionally Clerk-first so onboarding is not blocked by webhook timing.

### Internal or Webhook

Uses internal secret or signature verification rather than Clerk session auth.

Examples:

- `/api/internal/**`
- `/api/clerk-webhook`

## Endpoint Families

This section groups the primary route families by responsibility and ownership model.

### Health and Diagnostics

- `/api/health`
- `/api/metrics`

Purpose:

- service health
- dependency checks
- runtime diagnostics

### Identity, Profile, and Compliance

- `/api/user/profile`
- `/api/user/profile/complete`
- `/api/user/consent`
- `/api/user/export`
- `/api/user/rectification`
- `/api/user/deletion`

Ownership model:

- thin adapters over `app/lib/domains/user-profile/**`

### Onboarding

- `/api/onboarding`
- `/api/onboarding/skip`
- `/api/onboarding/skip-professional`
- `/api/onboarding/professional/complete`
- `/api/onboarding/uploads`

Ownership model:

- routes own Clerk-first auth, rate limiting, idempotency, and request parsing
- domain orchestration lives in `app/lib/domains/user-profile/onboarding.ts`

### Public Discovery

- `/api/professionals/**`
- `/api/properties/**`
- `/api/stores/**`
- `/api/idea-books/**`

Purpose:

- public or semi-public read models for marketplace discovery

Implementation note:

- even public reads should preserve thin-adapter patterns and avoid route-local business logic

### Professional Portal

- `/api/professional-portal/profile/**`
- `/api/professional-portal/projects/**`
- `/api/professional-portal/portfolio/**`
- `/api/professional-portal/leads/**`
- `/api/professional-portal/inquiries/**`
- `/api/professional-portal/pipeline`
- `/api/professional-portal/finance/**`
- `/api/professional-portal/calendar/**`
- `/api/professional-portal/licenses/**`
- `/api/professional-portal/certificates/**`

Ownership model:

- actor-aware domain services
- domain-owned role and ownership checks
- explicit `403`, `404`, and `409` mappings where needed

### CRM

- `/api/leads`
- `/api/leads/[id]`
- `/api/professional-portal/leads/**`
- `/api/professional-portal/inquiries/**`
- `/api/professional-portal/pipeline`

Ownership model:

- `app/lib/domains/leads/**`
- `app/lib/domains/inquiries/**`
- `app/lib/domains/pipeline/**`

Important behavior:

- public lead submission stays anonymous-safe
- professional CRM routes require actor-aware domain enforcement
- pipeline is a read model but still authorization-sensitive

### Messaging

- `/api/messaging`
- `/api/messaging/conversations/**`
- `/api/messaging/messages/**`

Ownership model:

- `app/lib/domains/messaging/**`

Important behavior:

- conversation membership and sender checks live in the domain
- route adapters should preserve `forbidden` versus `not_found` semantics when the domain distinguishes them

### Uploads and Assets

- `/api/uploads`
- `/api/onboarding/uploads`

Purpose:

- authenticated and onboarding-safe asset ingestion

Implementation note:

- onboarding upload behavior is intentionally less strict about pre-existing DB user materialization than standard authenticated uploads

### Shared Projects API

- `/api/projects`
- `/api/projects/[id]`

Status:

- implemented but rollout-gated through the generic projects flags

Important note:

- gating must be enforced both in the canonical projects client and in `lib/projects-client.ts`

## Auth and Rate-Limit Matrix

| Family                       | Auth Mode                   | Common Rate Tier                     |
| ---------------------------- | --------------------------- | ------------------------------------ |
| Public discovery             | Public                      | `READ`                               |
| Authenticated reads          | Clerk + DB actor            | `READ`                               |
| Authenticated mutations      | Clerk + DB actor            | `WRITE`                              |
| Onboarding                   | Clerk-first                 | `AUTH` or `WRITE` depending on route |
| Exports and heavy compliance | Clerk + DB actor            | `EXPORT`                             |
| Webhooks                     | Signature / internal secret | `WEBHOOK`                            |

Current shared tiers:

- `AUTH`: 5 requests per minute
- `EXPORT`: 5 requests per hour
- `WRITE`: 10 requests per minute
- `READ`: 100 requests per minute
- `WEBHOOK`: 100 requests per minute

## Domain Ownership Expectations

For migrated slices, the following should be true:

- routes do not implement resource policy inline
- routes do not directly orchestrate Prisma for business behavior
- server actions use `secureAction` for validation and actor resolution
- domains return normalized result contracts
- repositories stay persistence-only

If a slice does not yet follow this pattern, treat it as migration debt rather than precedent.

## Status Codes

| Code | Meaning                                                        |
| ---- | -------------------------------------------------------------- |
| 200  | successful read or mutation                                    |
| 201  | resource created                                               |
| 207  | partial success for bulk operations where explicitly supported |
| 400  | validation or malformed request                                |
| 401  | unauthenticated                                                |
| 403  | authenticated but forbidden                                    |
| 404  | resource not found                                             |
| 409  | idempotency or optimistic-lock conflict                        |
| 429  | rate limited                                                   |
| 500  | unexpected server failure                                      |
| 503  | dependency or service unavailable                              |

## What This Document Does Not Do

This file does not attempt to enumerate every single route parameter or payload across the app. The vertical READMEs remain the source of truth for slice-specific behavior.

Start here, then drill into the relevant slice documentation:

- `app/api/messaging/README.md`
- `app/api/properties/README.md`
- `app/api/stores/README.md`
- `app/api/professional-portal/projects/README.md`
- `app/api/leads/README.md`

## Summary

The top-level API contract in `apps/client` is no longer best understood as a list of independent route handlers. It is a set of transport adapters over canonical domain slices with shared auth, resilience, error, and result semantics. This file is the index to that model.
