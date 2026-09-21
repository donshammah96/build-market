# ADR-ADMIN-010: Admin Browser Security Headers and CSP

Status: Accepted
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

`apps/admin` is an operator-only surface that renders privileged data and executes high-risk mutations through App Router pages, server actions, and route handlers. ADR-ADMIN-005 already requires admin security headers and a strict operator-only CSP, but the production-readiness audit found no dedicated, implementation-backed contract for the exact headers, rollout mode, tests, and integration ownership.

The current `apps/admin/next.config.ts` configures image origins and package optimization, but it does not define a central `headers()` policy. The admin UI depends on Clerk, Cloudinary-hosted images, Next.js runtime assets, and internal API/action traffic; these origins must be declared explicitly rather than expanded ad hoc by individual pages.

This ADR narrows ADR-ADMIN-005 into a browser hardening contract aligned with the Next.js production checklist and the admin production-readiness audit.

## Decision

Admin responses must emit a centrally owned browser security header bundle from `apps/admin/next.config.ts` or an equivalent shared Next.js adapter:

- `Content-Security-Policy` for enforced mode after report-only soak; report-only mode is allowed only during rollout.
- `Content-Security-Policy-Report-Only` during the initial staging/production observation window.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: strict-origin-when-cross-origin` or stricter.
- `Permissions-Policy` denying unused browser capabilities by default.
- `Strict-Transport-Security` for production HTTPS domains.
- `frame-ancestors 'none'` in CSP; `X-Frame-Options: DENY` may remain as legacy defense-in-depth.

The CSP must default to `default-src 'self'` and add the smallest approved origin set for Clerk, Cloudinary images, Next.js static/runtime assets, API/action endpoints, and telemetry/reporting endpoints. Any new third-party origin requires an owner, purpose, data classification, and removal criteria in `apps/admin/docs/ROLLBACK-CONTRACTS.md` or the relevant integration documentation.

Inline scripts/styles must use framework-compatible nonces, hashes, or narrowly documented exceptions. Permanent broad exceptions such as unrestricted `unsafe-inline`, unrestricted `unsafe-eval`, wildcard script origins, or wildcard connect origins are not allowed for production without a new ADR revision.

Security header tests must cover dashboard, auth, unauthorized, not-found, and representative API/admin route responses. The tests must assert both presence and materially secure values, not only that headers exist.

### Rollout Sequence

1. Add a header policy builder module or constants co-located with `next.config.ts`.
2. Ship CSP in report-only mode for staging and production preview while keeping all non-CSP headers enforced.
3. Add violation reporting and review the report stream for Clerk, Cloudinary, and Next.js runtime false positives.
4. Add route/header tests and a drift check that fails when the header bundle is removed.
5. Switch production from report-only to enforced CSP after the violation window is clean.
6. Update ADR-ADMIN-005 to cross-reference this ADR once implementation is accepted.

### Implemented

- Central `headers()` policy configured in `apps/admin/next.config.ts`.
- Security headers and CSP report-only mode validated.
- Header assertion tests added in `__tests__/config/security-headers.test.ts`.

## Consequences

Browser hardening becomes a release gate rather than deployment-specific proxy configuration. New integrations must account for CSP and header constraints before landing. Development and preview environments may need narrowly scoped CSP differences, but those differences must be encoded by deployment profile rather than by manual config edits.

The CSP may initially surface missing origin declarations for Clerk satellite sign-in, Cloudinary assets, server action submissions, or telemetry. These violations are expected rollout inputs and must be resolved through explicit allowlist review.

## Verification

After implementation, run:

```bash
pnpm --filter admin test -- __tests__/config/security-headers.test.ts
pnpm --filter admin build
```

The security drift report should also include a deterministic check for the presence of the central header policy:

```bash
pnpm --filter admin check-security-drift
```

## Related Documentation

- `apps/admin/docs/ADMIN-PRODUCTION-READINESS-AUDIT-2026-07-22.md`
- `apps/admin/docs/adr/ADR-ADMIN-005-admin-http-and-security-surface.md`
- `apps/admin/docs/ROLLBACK-CONTRACTS.md`
- Next.js Production Checklist: <https://nextjs.org/docs/app/guides/production-checklist>
