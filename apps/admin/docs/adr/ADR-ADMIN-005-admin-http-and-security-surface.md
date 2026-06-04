# ADR-ADMIN-005: Admin HTTP and Security Surface

## Status

Accepted on 2026-06-04 by Phase 12 validation in `security/admin-overhaul/hardening-pass`.

## Context

Admin actions and route handlers carry session-cookie authentication and expose operational state. Phase 0 found route handlers under `src/actions/admin/*/route.ts` and shared API middleware with client-oriented helpers.

## Decision

State-changing admin routes and actions that carry session cookies require trusted-origin CSRF controls before mutation execution.

Admin responses exposing user data, financial data, audit logs, or operational state emit `Cache-Control: no-store, max-age=0`.

Admin security headers are configured in `next.config.ts` or equivalent Next.js middleware. Inbound webhooks and callbacks verify integrity before parsing trusted payloads.

The admin UI uses a strict operator-only CSP. Any CSP relaxation must be documented with the owning integration.

## Consequences

Route handlers need a shared security wrapper instead of per-route ad hoc checks.

## Verification

HTTP tests cover CSRF rejection, anti-cache headers, webhook integrity rejection, and safe static error messages.

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-008-http-surface-security.md`
