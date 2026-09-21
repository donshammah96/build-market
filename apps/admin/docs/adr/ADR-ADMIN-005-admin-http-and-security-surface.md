# ADR-ADMIN-005: Admin HTTP and Security Surface

Status: Accepted
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

Admin actions and route handlers carry session-cookie authentication and expose operational state. Phase 0 found route handlers under `src/actions/admin/*/route.ts` and shared API middleware with client-oriented helpers.

## Decision

State-changing admin routes and actions that carry session cookies require trusted-origin CSRF controls before mutation execution.

Admin responses exposing user data, financial data, audit logs, or operational state emit `Cache-Control: no-store, max-age=0`.

Admin security headers are configured in `next.config.ts` or equivalent Next.js middleware. Inbound webhooks and callbacks verify integrity before parsing trusted payloads.

The admin UI uses a strict operator-only CSP. Any CSP relaxation must be documented with the owning integration.

## Alternatives Considered

**SameSite=Strict cookies as the sole CSRF defence:** Modern browsers enforce `SameSite=Strict` reliably for cross-site POST requests. Relying solely on this attribute simplifies implementation. Rejected because admin actions that modify state are Next.js server actions submitted as `application/x-www-form-urlencoded` form POSTs, which are not blocked by `SameSite=Lax` (the default in most frameworks). `Strict` provides the protection, but it also breaks legitimate flows like OAuth redirects. A double-submit or origin-check approach provides defence-in-depth without UX side effects.

**Per-route manual header checks:** Embedding `origin` or `referer` validation inline in each route handler avoids a shared middleware dependency. Rejected because per-route checks are easy to forget and produce inconsistent coverage — exactly the pattern Phase 0 found.

**Disabling caching at the CDN/infrastructure level:** Configuring Vercel or an upstream proxy to strip caches from admin routes achieves the same result without HTTP headers in the response. Rejected as an infrastructure-only control because it creates invisible coupling between the application and its deployment environment. Explicit `Cache-Control: no-store` headers are portable and verifiable in integration tests.

## Consequences

Route handlers need a shared security wrapper instead of per-route ad hoc checks.

## Verification

HTTP tests cover CSRF rejection, anti-cache headers, webhook integrity rejection, and safe static error messages.

## Revision History

| Date       | Author        | Change                                                                |
| ---------- | ------------- | --------------------------------------------------------------------- |
| 2026-06-04 | Phase 12 impl | Initial acceptance. Branch: `security/admin-overhaul/hardening-pass`. |
| 2026-06-05 | Autopsy impl  | Added Alternatives Considered and Revision History (F-Doc1).          |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
- `apps/client/docs/adr/ADR-008-http-surface-security.md`
