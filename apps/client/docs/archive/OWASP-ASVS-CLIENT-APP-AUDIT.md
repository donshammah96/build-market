# OWASP ASVS Audit — `apps/client` (Build Market)

**Document type:** Staff-Level Security Architecture Review  
**Standard:** OWASP Application Security Verification Standard v4.0  
**Target level:** L2 (with selected L3 controls for financial and identity flows)  
**Date:** 2026-03-30  
**Scope:** `apps/client` architecture documentation — ADR-001 through ADR-008, `API-TO-FRONTEND-ARCHITECTURE.md`, `copilot-instructions.md`, and scoped instruction files  
**Out of scope:** Infrastructure-layer controls (TLS termination, WAF, CDN configuration), Clerk-owned credential controls (password storage, TOTP, OOB verification)

---

## Out-of-Scope Coverage Model

The exclusions above are implementation-boundary exclusions, not risk-boundary exclusions.

These controls are not scored as `apps/client` code or architecture gaps in this document, but they still materially affect the security posture of `apps/client`. Where the client app depends on infrastructure or Clerk-managed controls, this audit treats them as external dependency assumptions that must be verified by the owning platform or identity review.

### Shared-Responsibility Matrix

| Excluded area                         | Typical ASVS families affected | Why excluded from direct `apps/client` scoring                             | What `apps/client` still depends on                                                                                                                                                            | Verification owner  | Required artifact                               |
| ------------------------------------- | ------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------- |
| TLS termination and HTTPS enforcement | V9, V14                        | Usually owned by edge platform, ingress, or hosting layer                  | Authenticated traffic, cookies, and PII must never traverse plaintext transport; redirect-to-HTTPS and certificate lifecycle must be enforced before traffic reaches the app                   | Platform / Infra    | Edge or ingress configuration review            |
| WAF and edge filtering                | V1, V10, V14                   | Usually implemented at CDN, API gateway, or reverse-proxy layer            | WAF is compensating control only; `apps/client` must still validate input and fail closed. The app must not assume WAF presence makes unsafe route behavior acceptable                         | Platform / Security | WAF rule inventory and exception register       |
| CDN configuration                     | V8, V12, V14                   | Cache and delivery behavior are controlled outside the repo                | Sensitive responses must not be cached at the edge; uploaded files must be served with the intended disposition and origin separation; public/private cache keys must align with app semantics | Platform / Infra    | CDN cache-policy and origin-policy review       |
| Clerk password storage and hashing    | V2                             | Credential material never enters this repo and is handled by Clerk         | `apps/client` assumes Clerk stores and rotates credential secrets correctly and that no local password fallback path exists                                                                    | Identity / Vendor   | Clerk configuration and vendor assurance review |
| Clerk TOTP / MFA secret handling      | V2, V3                         | TOTP seed issuance, storage, and verification are Clerk-managed            | The app must integrate only through Clerk session/auth primitives and must not create alternate MFA bypass paths in route or action logic                                                      | Identity / Vendor   | Clerk MFA configuration review                  |
| Clerk out-of-band verification flows  | V2, V3                         | Email/SMS verification challenge issuance and validation are Clerk-managed | `apps/client` still depends on correct verification state propagation into authorization-relevant app flows such as onboarding, role change, and account recovery                              | Identity / Vendor   | Clerk verification policy review                |

### Dependency Assumptions That Must Hold

- All production traffic to `apps/client` and its API routes is terminated over HTTPS with valid certificates and HTTP-to-HTTPS enforcement in front of the app.
- Edge or CDN caching must not store authenticated responses, identity documents, payout responses, or other user-specific sensitive payloads unless the cache policy is explicitly private and reviewed.
- Uploaded user content must not be made same-origin-safe merely by CDN presence; serving origin, content disposition, and content-type policy must still be reviewed as a separate control.
- Clerk must remain the sole credential authority. No alternate password, OTP, or recovery verifier may be introduced into `apps/client` without revisiting the audit scope.
- Clerk session, role, and verification claims used by `apps/client` must be treated as dependency inputs that require fail-closed behavior on retrieval, refresh, and privilege transitions.

### Canonical Review Rule

An item being out of scope for direct remediation tracking in this document does not mean it can be ignored during release review.

- If a finding in `apps/client` is only safe because an edge or Clerk control is assumed, that assumption must be named explicitly.
- If the assumption cannot be verified, the dependent `apps/client` flow must be treated as not production-ready.
- App-layer controls remain mandatory even when the infrastructure or identity provider offers compensating protection.

### Related In-Scope App-Layer Controls

The following controls remain fully in scope here even though they depend on out-of-scope systems being configured correctly:

- `withAuth` fail-closed behavior on Clerk unavailability or malformed session state
- cookie attribute verification at the integration boundary
- session freshness and role/verification claim refresh after privilege change
- anti-caching response policy for sensitive app responses
- file-upload serving policy, origin separation, and content-disposition enforcement
- CORS policy, CSRF protection, and authenticated route mutation controls

---

## Target Level Rationale

OWASP ASVS defines three assurance levels. **L1** is the minimum baseline for any internet-facing application. **L2** is required for applications that handle sensitive personal data, financial transactions, or professional credentials. **L3** applies to high-assurance systems where a breach causes severe harm.

Build Market operates at L2 by default given M-Pesa transactions, escrow flows, NCA/EBK professional credentials, and Kenya-resident PII. Selected L3 controls apply to escrow release, payout initiation, and professional verification state transitions — operations where a compromised session or bypassed authorization causes direct financial harm.

---

## What the Current Documentation Already Covers

The following ASVS controls are substantively addressed in the existing documentation. These are not gaps.

| ASVS Ref | Control Area                   | Existing Coverage                                                                     |
| -------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| V1.4     | Access Control Architecture    | ADR-001 actor-aware authz; domain policy checks over bare user IDs                    |
| V1.7     | Logging and Audit Architecture | ADR-005 structured log field contract; layer logging responsibilities                 |
| V1.8     | Data Protection Architecture   | ADR-005 PII exclusion rules; `actorRole` over identity in all log events              |
| V2.1     | Authentication Architecture    | ADR-001 Clerk as single IdP; NextAuth treated as legacy                               |
| V4.1     | General Access Control Design  | `withAuth`, `withRole`; authorization enforced in domain services not only middleware |
| V4.2     | Operation-Level Access Control | `forbidden` vs `not_found` distinction; ownership checks in domain service            |
| V5.1     | Input Validation               | Zod `.safeParse()` enforced; `.parse()` prohibited in route handlers                  |
| V7.1     | Log Content                    | ADR-005 required fields; PII exclusion as hard architectural rule                     |
| V7.2     | Log Processing                 | `getClientLogger()` wrapper; domain services prohibited from logging directly         |
| V11.1    | Business Logic                 | `IdempotencyService`; optimistic locking via `If-Match` / `ETag`                      |
| V14.2    | Dependency Configuration       | `envConfig` Zod validation at module load; fail-fast on missing variables             |

---

## Gap Analysis

### V1 — Architecture, Design and Threat Modeling

---

#### GAP-001 · No Explicit Trust Boundary Statement

**ASVS:** V1.1.2, V1.4.4  
**Level:** L1  
**Risk:** Without a documented trust boundary, engineers make implicit trust decisions inline. A route handler that trusts a caller-provided `actorId` field in the request body — rather than deriving it from the Clerk session — is a real failure mode that a trust boundary statement would make obviously wrong.

**Current state:** Layer ownership is well-defined (adapter, domain, repository) but no document states what each layer is untrusted with respect to. The adapter layer's implicit assumption — that all request input is untrusted — is never made explicit.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 2 (Layer Responsibilities):**

Add a "Trust Boundaries" subsection with the following statements:

- The presentation/adapter layer treats all request input (body, query parameters, path parameters, headers) as untrusted until Zod validates it.
- The domain layer treats `actor` context as trusted only after `withAuth` successfully resolves a Clerk session to a known DB user. An actor constructed from any other source must be treated as untrusted.
- The repository layer treats all inputs as potentially adversarial. Raw SQL construction from user-supplied values is prohibited. Prisma's parameterized query interface is the enforcement mechanism.
- The browser is always untrusted. No security decision may be delegated to client-side state alone.

---

#### GAP-002 · No CORS Policy Rule

**ASVS:** V14.4.1, V14.4.6  
**Level:** L1  
**Risk:** A CORS misconfiguration on any `app/api/**` route that accepts session cookies or `Authorization` headers allows attacker-controlled pages to make credentialed cross-origin requests on behalf of authenticated users. This is especially dangerous on payment initiation and escrow routes.

**Current state:** No CORS rule exists in any ADR, the architecture guide, or `copilot-instructions.md`. The architecture defines routes as adapters but says nothing about which origins are permitted to call them.

**Recommended changes:**

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 5 (Cross-Cutting Rules) — add "CORS Policy" subsection:**

- CORS must be configured via a shared middleware helper applied to all `app/api/**` routes — not inline per-route.
- The allowed origin list must be derived from `envConfig` (not hardcoded strings), reflecting `NEXT_PUBLIC_APP_URL` and any explicitly permitted partner origins.
- Wildcard `Access-Control-Allow-Origin: *` is prohibited on any route that accepts an `Authorization` header, session cookie, or returns user-specific data.
- CORS preflight responses must not cache allowed origins for longer than the session TTL.

**`copilot-instructions.md` Anti-Patterns Callout — add item:**

> Wildcard `*` in `Access-Control-Allow-Origin` on any authenticated route. CORS allowed origins must come from `envConfig` via the shared CORS helper.

---

### V2 — Authentication

> Note: Clerk owns credential storage, password hashing, TOTP issuance, and OOB verification. Those controls are excluded from direct `apps/client` implementation scoring, but they remain dependency assumptions under the shared-responsibility model above. The gaps below concern the application-layer contract between Clerk and `apps/client`.

---

#### GAP-003 · No Fail-Closed Policy for `withAuth` on Clerk Unavailability

**ASVS:** V2.2.1  
**Level:** L1  
**Risk:** If Clerk's service is degraded (timeout, 5xx response, malformed JWT), an undefined or fail-open `withAuth` implementation could pass the request through as unauthenticated-but-permitted. On any protected route, this is a complete authentication bypass.

**Current state:** `withAuth` is referenced throughout the architecture guide and `copilot-instructions.md` as the standard auth wrapper, but its failure behavior is not specified.

**Recommended change — `copilot-instructions.md` under "Auth Model":**

> `withAuth` must fail closed. Any failure to resolve a Clerk session — including network timeout, Clerk 5xx, expired JWT, or malformed token — must result in a 401 response. The handler must not proceed. This behavior must be covered by a mocked-Clerk-failure test in the critical-journey suite alongside the standard unauthenticated redirect journey.

---

#### GAP-004 · No Step-Up Authentication Requirement for Sensitive Operations

**ASVS:** V2.2.5, V3.7.1  
**Level:** L2 (L3 for escrow / payout)  
**Risk:** A stolen or hijacked session that has been idle for hours can initiate an escrow release or payout if the application only checks that a valid session exists. Step-up authentication (requiring the user to re-verify within a short window before a high-stakes operation) closes this window.

**Current state:** The architecture enforces actor-aware authorization (correct role, correct ownership) but makes no distinction between ambient session authentication and high-stakes operation authentication.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 5 (Cross-Cutting Rules) — add "Sensitive Operation Re-Authentication" subsection:**

Any route or server action handling the following operation classes must require a Clerk session freshness assertion before the domain service is called:

- Financial mutations: escrow release, payment initiation, payout request, M-Pesa callback handling
- Identity mutations: role change, professional credential update, verification document submission
- Account mutations: email change, phone change, account deletion

The domain contracts file for any slice containing these operations must declare the re-authentication requirement explicitly. The adapter layer is responsible for asserting session freshness; the domain service must not be called without it.

---

### V3 — Session Management

---

#### GAP-005 · No Cookie Security Attribute Requirements

**ASVS:** V3.4.1, V3.4.2, V3.4.3, V3.4.5  
**Level:** L1  
**Risk:** Session cookies without `HttpOnly`, `Secure`, or `SameSite` attributes are vulnerable to exfiltration via XSS, downgrade attacks over HTTP, and CSRF respectively. A marketplace handling financial flows requires all three.

**Current state:** Clerk issues session cookies, but the application-layer configuration (Next.js cookie settings, Clerk SDK configuration) is not governed by any architectural rule.

**Recommended change — `copilot-instructions.md` under "Auth Model":**

> Session cookies issued by Clerk (or any other session mechanism introduced in the future) must be verified to carry `HttpOnly`, `Secure` (enforced in production), and `SameSite=Lax` at minimum. Cookie configuration must be part of the Clerk integration audit checklist. `SameSite=None` is prohibited unless the route explicitly serves a cross-origin embedded context and the business justification is documented inline.

---

#### GAP-006 · No Session Invalidation Rule on Role Transition

**ASVS:** V3.3.1, V3.3.3  
**Level:** L2  
**Risk:** When a user's role changes (e.g., `pending_professional` → `professional` after verification approval), a stale Clerk session JWT still carries the old role in its claims. Any authorization decision made against cached session metadata will use the pre-transition role. In the reverse direction (role downgrade, suspension), this allows a demoted actor to continue operating with elevated privileges until their token expires.

**Current state:** ADR-001 correctly identifies Clerk as the single identity provider and treats database role state as domain state. However, it does not specify that role mutations must trigger Clerk session metadata refresh.

**Recommended change — ADR-001 (amendment to Migration Notes §2):**

Add the following constraint:

> Any domain operation that mutates `UserRole` must trigger a Clerk session metadata refresh via the Clerk Backend API as part of the domain service's post-mutation responsibility (or as an explicit side-effect orchestrated by the adapter layer immediately after a successful domain result). The API response confirming the role change must not be returned until the Clerk session reflects the new role. This prevents stale role claims from persisting in active sessions after a privilege change.

---

### V4 — Access Control

---

#### GAP-007 · IDOR Prevention Is Implicit, Not Systematic

**ASVS:** V4.2.1, V4.2.2  
**Level:** L1  
**Risk:** Ownership checks exist in current domain services, but there is no architectural rule that makes them mandatory for every method that accepts a resource ID. An engineer adding a new read or mutation method can omit the participant check without any forcing function in the current architecture.

**Current state:** The `forbidden` vs `not_found` distinction is documented (Section 7.3) and the pattern is demonstrated in the projects and properties examples. But the policy test standard does not make IDOR coverage a blocking requirement per domain method.

**Recommended changes:**

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 7.3 (Policy Tests) — add to "Matrix structure":**

> Every domain service method that accepts a resource ID and reads or mutates that resource must have a policy test asserting that a non-owner, non-participant actor receives `not_found` (not `forbidden`) for a resource they do not own. The absence of this test case for a resource-ID-accepting operation is a mandatory blocking review comment. Returning `forbidden` when the resource exists but access is denied is an information-disclosure vulnerability — the correct response is `not_found` (obscure existence) unless the domain has a specific business reason to confirm existence to the caller.

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 9 (Staff Architecture Review Checklist) — add to "Policy Coverage":**

> - [ ] Every domain service method accepting a resource ID has a policy test asserting non-owner access returns `not_found`, not `forbidden`

---

#### GAP-008 · No Mass Assignment Protection Rule

**ASVS:** V4.2.1, V5.1.3  
**Level:** L1  
**Risk:** A `PATCH` route that accepts a partially-validated body and forwards it to the domain service can allow a caller to set system-owned fields (`isVerified`, `role`, `createdAt`, `version`) if the Zod schema uses `.passthrough()` or overly broad typing. This is a privilege escalation vector.

**Current state:** Zod validation is enforced, but there is no rule specifying that mutation schemas must explicitly allowlist writable fields. `.passthrough()` is not prohibited.

**Recommended changes:**

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 5 (Cross-Cutting Rules) — add "Mass Assignment Protection" subsection:**

- Zod schemas for all mutation routes (`POST`, `PATCH`, `PUT`) must use `.strict()` or explicit `.pick()` to define the allowed writable fields. `.passthrough()` is prohibited on mutation input schemas.
- Domain service input DTOs must not accept fields representing system-owned state: `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, `isVerified`, `role`, or any field set exclusively by the domain service or repository.
- These fields are set by the domain layer only. The adapter layer must strip or reject them if present in the request body.

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 6 (Anti-Patterns) — add item 24:**

> `.passthrough()` used on a Zod schema for a mutation route body. All mutation schemas must use `.strict()` or `.pick()` to explicitly allowlist writable fields.

---

### V5 — Validation, Sanitization and Encoding

---

#### GAP-009 · No Output Encoding / XSS Prevention Rule for User-Generated Content

**ASVS:** V5.3.3, V5.3.4  
**Level:** L1  
**Risk:** Professional bios, project descriptions, portfolio notes, and store listings are user-generated content. If this content reaches the browser through `dangerouslySetInnerHTML` or an unsanitized rich-text renderer, it becomes a stored XSS vector. A stored XSS on a marketplace affecting other users' sessions or payment flows is a critical vulnerability.

**Current state:** The architecture enforces input validation via Zod but has no output encoding rule. Section 3 (UI & Presentation-Layer Standards) does not address rendering user-generated content safely.

**Recommended changes:**

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 3 — add to Section 3.4 (Accessibility Invariants) or as a new Section 3.7 "Rendering Safety":**

- `dangerouslySetInnerHTML` is prohibited in any component that renders user-generated content.
- All user-generated text fields must be rendered through React's default text interpolation (`{value}`), which HTML-escapes by default.
- Where rich-text rendering is a business requirement (e.g., formatted project descriptions), the content must be passed through a server-side allowlist sanitizer before storage. Client-side sanitization alone is insufficient. The sanitizer and allowlist must be documented at the component level.
- Any use of `dangerouslySetInnerHTML` anywhere in the codebase requires an inline comment citing: (1) the sanitization function applied, (2) the content source, and (3) a reviewer sign-off in the PR.

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 6 (Anti-Patterns) — add item 25:**

> `dangerouslySetInnerHTML` used to render user-generated content without a documented server-side sanitization step. React's default text interpolation must be used for all user-provided strings.

---

#### GAP-010 · No File Upload Security Rules

**ASVS:** V12.1.1, V12.2.1, V12.3.1, V12.3.3, V12.5.1  
**Level:** L2  
**Risk:** ADR-003's projects example references document uploads and image uploads. Without file validation rules, an attacker can upload crafted SVG or HTML files as "project documents," achieving stored XSS. Path traversal in storage key construction can expose or overwrite arbitrary stored files.

**Current state:** File uploads are referenced as a feature but have no security architecture. `checkBodySize()` is mentioned in the adapter responsibilities but only as a generic guard.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 5 — add "File Upload Security" subsection:**

All file upload routes must enforce the following, in order, before any storage operation:

1. **Size limit:** `checkBodySize()` must be called before reading the file stream. The limit must come from `envConfig`, not inline constants.
2. **MIME type allowlist:** The server must validate the file's MIME type against an explicit allowlist (e.g., `image/jpeg`, `image/png`, `application/pdf`). The client-provided `Content-Type` header must not be trusted — MIME type must be derived from file magic bytes using a server-side library.
3. **Storage key construction:** Storage keys (S3 object keys, or equivalent) must never be derived from user-provided filenames or request parameters. Keys must be generated server-side (UUID-based) with a structured prefix. User-provided filenames may be stored as metadata only.
4. **Serving:** Uploaded files must be served with `Content-Disposition: attachment` to prevent inline rendering in the browser. Files must be served from a separate origin or CDN — never from the same origin as the application.
5. **Image processing:** If image resizing or format conversion is required, it must occur in an isolated worker process, never in the main application process. Malformed images can exploit image processing library vulnerabilities.

---

### V7 — Error Handling and Logging

---

#### GAP-011 · No Safe Error Message Constraint on `apiError()`

**ASVS:** V7.4.1, V7.4.2  
**Level:** L1  
**Risk:** `apiError()` is called throughout the route handler examples, but there is no constraint on what string can be passed as the message argument. A developer calling `apiError(prismaError.message, 500)` or `apiError(error.stack, 500)` exposes internal implementation details (query structure, file paths, library versions) to the client — a direct information disclosure vulnerability.

**Current state:** The architecture shows correct usage in examples but does not prohibit incorrect usage. The rule "internal details go to the logger, not the client" is implied but never stated.

**Recommended changes:**

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 4, Step 4 — add callout after the route handler example:**

> `apiError()` must only be called with a message string drawn from a shared constants module (`DomainErrorMessages` or equivalent). Stack traces, Prisma error messages, exception `.message` properties, and any string that could reveal internal implementation details must never be passed to `apiError()`. Internal error detail is emitted via `logger.error()` to the structured log (which goes to the observability backend only) and must not appear in the HTTP response body.

**`API-TO-FRONTEND-ARCHITECTURE.md` Section 6 (Anti-Patterns) — add item 26:**

> `apiError(error.message, ...)` or `apiError(error.stack, ...)` where `error` is a caught exception. Error response bodies must contain only pre-approved message strings. Internal detail belongs in the structured log, not the response.

---

#### GAP-012 · No Log Injection Prevention Rule

**ASVS:** V7.3.1, V7.3.2  
**Level:** L2  
**Risk:** ADR-005 prohibits logging request body values, which closes most injection surface. However, log injection can occur through `operationName` if it is ever derived from user input rather than a compile-time constant, or through `resourceId` if it accepts arbitrary strings rather than validated UUIDs. Injected newlines or control characters in a log event can corrupt log parsing or spoof structured fields.

**Current state:** ADR-005 Section 3 defines `operationName` stability requirements but does not explicitly prohibit deriving it from runtime user input. `resourceId` is documented as safe for UUID-keyed resources but has no validation rule.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 5.6.4 (`operationName` Convention) — add:**

> `operationName` must always be a compile-time string literal or a value drawn from a slice-level enum of known operation names. It must never be derived from request parameters, path segments, body fields, or any runtime user input.

> `resourceId` in log events must be validated as a UUID before inclusion. If the value does not match UUID format, log `resourceId: "[invalid-format]"` instead of the raw value. This prevents log injection via crafted resource ID values in path parameters.

---

### V8 — Data Protection

---

#### GAP-013 · No Data Classification Scheme

**ASVS:** V8.1.1, V8.2.1, V8.3.4  
**Level:** L2  
**Risk:** ADR-005's PII logging rules correctly identify what not to log, but without a classification scheme, engineers have no consistent mental model for deciding whether a new field is PII, sensitive business data, or public. This leads to inconsistent handling across slices — one slice encrypts a field at rest, another exposes it freely in API responses.

**Current state:** PII is treated as a binary (log it / don't log it) rather than a spectrum of sensitivity levels with different handling requirements at each level.

**Recommended change — create `ADR-006-data-classification.md` (or incorporate into ADR-005 as Section 5):**

Define four data classes with explicit handling rules per class:

**Class A — Restricted**  
Examples: NIN/national ID numbers, M-Pesa transaction credentials, Clerk tokens, payment card data, escrow account details.  
Rules: Never logged under any circumstance. Never stored unencrypted at rest. Never returned in API responses beyond the minimum necessary surface. Access requires explicit domain-level justification. Non-production environments must not contain real Class A data.

**Class B — Sensitive**  
Examples: User email address, phone number, physical address, NCA registration number, EBK license number, professional certifications, user-uploaded identity documents.  
Rules: Never logged. Encrypted at rest where stored in isolation. Masked or excluded in non-production data exports. Must not appear in URL parameters or log entries. API responses returning Class B fields must declare this in the DTO documentation.

**Class C — Internal**  
Examples: `actorRole`, resource UUIDs, `correlationId`, operation outcomes, `durationMs`.  
Rules: Safe to log per ADR-005 rules. May appear in API responses. Must not be used to reconstruct identity.

**Class D — Public**  
Examples: Professional display name, portfolio images, publicly listed project titles, store names.  
Rules: No special handling required. May appear in logs, responses, and URLs.

Once defined, reference this classification in `copilot-instructions.md` under "DTO Boundary Rules":

> Any DTO that crosses an HTTP or server action boundary must document the data class of each field it carries. DTOs containing Class A or Class B fields require an explicit review comment confirming the minimum-necessary-surface principle is satisfied.

---

#### GAP-014 · `sessionStorage` Exclusion Rule Is Too Vague

**ASVS:** V8.3.3, V8.3.6  
**Level:** L2  
**Risk:** Section 3.1 of `API-TO-FRONTEND-ARCHITECTURE.md` states "credentials and payment fields excluded" from `sessionStorage` persistence, but this is ambiguous for a marketplace where professional certifications, physical addresses, and phone numbers are collected during onboarding. These are Class B fields under the classification proposed in GAP-013.

**Current state:** The exclusion is stated but not grounded in a definition. Engineers applying the rule have no consistent basis for deciding whether a new onboarding field is excluded.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 3.1 (Form Persistence) — replace the current exclusion language with:**

> Any field classified as Class A (Restricted) or Class B (Sensitive) per the data classification scheme (ADR-006) must never be written to `sessionStorage`, `localStorage`, or URL parameters. The allowed field list for each multi-step form's draft persistence must be explicitly declared in the form component's module-level JSDoc comment, reviewed against the data classification, and signed off in the PR. When in doubt, exclude the field from persistence and require re-entry.

---

### V11 — Business Logic

---

#### GAP-015 · Anti-Automation Requirements Are Absent for Sensitive Flows

**ASVS:** V11.1.4, V11.1.5  
**Level:** L2  
**Risk:** Without per-actor rate limiting on sensitive flows, an attacker can enumerate project or property IDs through the API, retry professional verification submissions indefinitely, or brute-force resource IDs. IP-based rate limiting is insufficient for a mobile-first Kenya market where many users share mobile carrier NAT addresses.

**Current state:** Rate limiting is mentioned in the adapter layer responsibilities as a general concern but is not specified as a mandatory requirement for any specific flow type or operation class.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 5 (Cross-Cutting Rules) — add "Anti-Automation Requirements" subsection:**

Per-actor rate limiting (keyed on `actor.userId`, not request IP) is mandatory for the following operation classes:

- Professional onboarding submission and document upload
- Payment initiation and escrow operations
- Verification document submission
- Any `GET` route that accepts a resource ID parameter and could be used for sequential enumeration

IP-based rate limiting must not be the sole anti-automation control for any of the above. In shared mobile network environments (common in Kenya's market), IP-based limiting will over-fire against legitimate users and under-fire against attackers who rotate IPs.

Per-actor rate limit keys must be derived from `actor.userId` after successful auth resolution. Rate limit state must be stored in Redis (via `@build/redis`) to survive process restarts and horizontal scaling.

---

#### GAP-016 · Multi-Step Flow Sequencing Is Client-Side Only

**ASVS:** V11.1.6, V11.1.7  
**Level:** L2  
**Risk:** The onboarding architecture enforces step order client-side via the wizard component. A caller can POST directly to the step 3 endpoint without having completed step 1, potentially triggering NCA verification workflows or payment setup flows in an invalid state.

**Current state:** Section 3.1 requires step persistence and focus management but makes no mention of server-side step sequencing enforcement.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 3.1 (Onboarding Architecture) — add "Server-Side Step Sequencing" paragraph:**

> Any multi-step onboarding or verification flow that has server-side consequences (database writes, verification workflow triggers, payment setup) must have step sequencing enforced in the domain service, not only in the UI. The domain service must validate that the actor's persisted state permits the submitted step before processing it. The current step position must be derived from the database (e.g., a `onboardingStep` field or a state enum on the user record), never from a client-supplied parameter. Server-side step gating must be covered by a policy test asserting that submitting an out-of-order step returns a domain error (e.g., `invalid_state`).

---

### V13 — API and Web Service

---

#### GAP-017 · HTTP Method Semantics Are Not Enforced by Rule

**ASVS:** V13.1.1, V13.2.1  
**Level:** L1  
**Risk:** The architecture describes correct method usage in examples but does not prohibit incorrect usage. A `GET` handler that reads and processes a request body, or a `DELETE` that accepts body-encoded parameters, violates HTTP semantics and can lead to caching or logging systems forwarding sensitive data unexpectedly.

**Current state:** Route handler examples use correct method semantics, but no rule prohibits deviation.

**Recommended change — `API-TO-FRONTEND-ARCHITECTURE.md` Section 4, Step 4 — add note:**

> `GET` handlers must not read or process a request body. Query parameters are the only permitted input surface for `GET` routes. `DELETE` handlers for versioned resources must require `If-Match` (already specified in versioning rules) and must not accept body-encoded delete parameters. These are enforced by code review and, where feasible, a lint rule that warns on `req.json()` calls inside exported `GET` functions.

---

### V14 — Configuration

---

#### GAP-018 · Security Headers Are Completely Absent

**ASVS:** V14.4.1, V14.4.3, V14.4.4, V14.4.6, V14.4.7  
**Level:** L1  
**Risk:** Without security headers, the application is vulnerable to clickjacking (`X-Frame-Options`), MIME sniffing attacks (`X-Content-Type-Options`), referrer leakage (`Referrer-Policy`), and a broad XSS attack surface (`Content-Security-Policy`). These are one-time configuration changes in `next.config.ts` with high ASVS coverage per hour of work.

**Current state:** No security header configuration exists in any architectural document. `next.config.ts` is mentioned only as a bootstrap-only exception for `process.env` access (ADR-004).

**Recommended change — `copilot-instructions.md` under "Project-Specific Conventions" — add "Security Headers" section (or create `ADR-008-http-surface-security.md` for rationale preservation):**

`next.config.ts` must define the following response headers for all routes:

```
X-Content-Type-Options: nosniff
X-Frame-Options: SAMEORIGIN
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Content-Security-Policy: [see below]
```

The `Content-Security-Policy` must:

- Define a `default-src 'self'` baseline
- Allowlist only known and justified script, style, image, and font origins
- Prohibit `unsafe-inline` for scripts; use nonces or hashes for any inline script requirements
- Prohibit `unsafe-eval`
- Be defined via `envConfig` for any origin that varies between environments

Changes to the CSP allowlist must include an inline comment documenting why the new origin is trusted and whether it is first-party or third-party. CSP violations should be reported to a dedicated endpoint (or Sentry) to detect injection attempts in production.

---

#### GAP-019 · No Dependency Vulnerability Audit Gate

**ASVS:** V14.2.1  
**Level:** L1  
**Risk:** The monorepo specifies `pnpm 10.20` as the package manager but has no CI gate for dependency vulnerability scanning. A critical CVE in a direct dependency (e.g., an HTTP parsing library, an image processing package, a cryptographic primitive) will not be caught until it is exploited or manually discovered.

**Current state:** No `pnpm audit` step exists in the documented CI workflow or `MAINTENANCE.md`.

**Recommended change — `MAINTENANCE.md` — add to "Drift prevention checks":**

> `pnpm audit --audit-level=high` must pass as a required CI gate on every PR. Critical CVEs in direct or first-level transitive dependencies must be addressed within 7 calendar days of public disclosure. High-severity CVEs must be addressed within 30 calendar days. The SLA applies from the date the CVE appears in the `pnpm audit` output, not from the date of the PR. If a patch is not yet available, a documented mitigation (e.g., feature flag disable, firewall rule, compensating control) is required within the SLA window.

---

## Prioritized Implementation Sequence

### Tier 1 — Implement Immediately (L1 Gaps, High Blast Radius)

These controls are blocking for a production financial marketplace. They require low implementation effort relative to the risk they close.

| #   | Gap                                           | Target Document                                        | ASVS Ref         |
| --- | --------------------------------------------- | ------------------------------------------------------ | ---------------- |
| 1   | GAP-018: Security headers in `next.config.ts` | `copilot-instructions.md` or new ADR                   | V14.4.1–7        |
| 2   | GAP-002: CORS policy rule                     | `API-TO-FRONTEND-ARCHITECTURE.md` §5 + anti-patterns   | V14.4.1, V14.4.6 |
| 3   | GAP-008: Mass assignment protection           | `API-TO-FRONTEND-ARCHITECTURE.md` §5 + anti-pattern 24 | V4.2.1, V5.1.3   |
| 4   | GAP-011: `apiError()` safe message strings    | `API-TO-FRONTEND-ARCHITECTURE.md` §4 + anti-pattern 26 | V7.4.1, V7.4.2   |
| 5   | GAP-010: File upload validation               | `API-TO-FRONTEND-ARCHITECTURE.md` §5 new subsection    | V12.1.1–V12.5.1  |
| 6   | GAP-019: `pnpm audit` CI gate                 | `MAINTENANCE.md`                                       | V14.2.1          |
| 7   | GAP-001: Trust boundary statement             | `API-TO-FRONTEND-ARCHITECTURE.md` §2                   | V1.1.2, V1.4.4   |
| 8   | GAP-003: Fail-closed `withAuth` rule          | `copilot-instructions.md` auth section                 | V2.2.1           |

### Tier 2 — Implement in the Next Sprint (L2 Gaps, Required for B2B Professional Platform)

| #   | Gap                                           | Target Document                                        | ASVS Ref               |
| --- | --------------------------------------------- | ------------------------------------------------------ | ---------------------- |
| 9   | GAP-007: IDOR policy test requirement         | `API-TO-FRONTEND-ARCHITECTURE.md` §7.3 + §9            | V4.2.1, V4.2.2         |
| 10  | GAP-009: Output encoding / XSS rule           | `API-TO-FRONTEND-ARCHITECTURE.md` §3 + anti-pattern 25 | V5.3.3, V5.3.4         |
| 11  | GAP-013: Data classification scheme           | New `ADR-006`                                          | V8.1.1, V8.2.1, V8.3.4 |
| 12  | GAP-014: `sessionStorage` exclusion (precise) | `API-TO-FRONTEND-ARCHITECTURE.md` §3.1                 | V8.3.3, V8.3.6         |
| 13  | GAP-015: Per-actor rate limiting mandate      | `API-TO-FRONTEND-ARCHITECTURE.md` §5                   | V11.1.4, V11.1.5       |
| 14  | GAP-016: Server-side step sequencing          | `API-TO-FRONTEND-ARCHITECTURE.md` §3.1                 | V11.1.6, V11.1.7       |
| 15  | GAP-005: Cookie security attributes           | `copilot-instructions.md` auth section                 | V3.4.1–V3.4.5          |
| 16  | GAP-012: Log injection prevention             | `API-TO-FRONTEND-ARCHITECTURE.md` §5.6.4               | V7.3.1, V7.3.2         |
| 17  | GAP-017: HTTP method enforcement              | `API-TO-FRONTEND-ARCHITECTURE.md` §4, Step 4           | V13.1.1, V13.2.1       |

### Tier 3 — Implement Before Financial Features Ship (L2/L3 for Escrow and Payout)

| #   | Gap                                              | Target Document                      | ASVS Ref       |
| --- | ------------------------------------------------ | ------------------------------------ | -------------- |
| 18  | GAP-004: Step-up auth for sensitive operations   | `API-TO-FRONTEND-ARCHITECTURE.md` §5 | V2.2.5, V3.7.1 |
| 19  | GAP-006: Session invalidation on role transition | `ADR-001` amendment                  | V3.3.1, V3.3.3 |

---

## Document Placement Summary

| Document                                                        | Changes Required                                                                                                                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADR-001-auth-model.md`                                         | Amendment: session invalidation on role change (GAP-006)                                                                                                                        |
| New `ADR-006-data-classification.md`                            | New ADR: four-tier data classification with handling rules per class (GAP-013)                                                                                                  |
| `ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md` | New ADR: canonical role model, admin sub-role capability boundary, and actor context typing                                                                                     |
| `ADR-008-http-surface-security.md`                              | Consolidated ADR for CORS, CSRF, anti-caching, security headers, and webhook/callback integrity                                                                                 |
| `API-TO-FRONTEND-ARCHITECTURE.md` §2                            | Trust boundary statement (GAP-001)                                                                                                                                              |
| `API-TO-FRONTEND-ARCHITECTURE.md` §3.1                          | Server-side step sequencing (GAP-016); precise `sessionStorage` exclusion (GAP-014)                                                                                             |
| `API-TO-FRONTEND-ARCHITECTURE.md` §3.4 / new §3.7               | Output encoding / XSS rule (GAP-009)                                                                                                                                            |
| `API-TO-FRONTEND-ARCHITECTURE.md` §4, Step 4                    | `apiError()` safe messages (GAP-011); HTTP method semantics (GAP-017)                                                                                                           |
| `API-TO-FRONTEND-ARCHITECTURE.md` §5                            | CORS policy (GAP-002); mass assignment protection (GAP-008); file upload security (GAP-010); step-up auth (GAP-004); per-actor rate limiting (GAP-015); log injection (GAP-012) |
| `API-TO-FRONTEND-ARCHITECTURE.md` §6                            | Anti-patterns 24–26 (GAP-008, GAP-009, GAP-011)                                                                                                                                 |
| `API-TO-FRONTEND-ARCHITECTURE.md` §7.3                          | IDOR policy test requirement (GAP-007)                                                                                                                                          |
| `API-TO-FRONTEND-ARCHITECTURE.md` §9                            | IDOR checklist item (GAP-007)                                                                                                                                                   |
| `copilot-instructions.md` auth section                          | Fail-closed `withAuth` (GAP-003); cookie security attributes (GAP-005); step-up auth reference (GAP-004)                                                                        |
| `copilot-instructions.md` anti-patterns                         | CORS wildcard prohibition (GAP-002)                                                                                                                                             |
| `copilot-instructions.md` conventions                           | Security headers mandate (GAP-018)                                                                                                                                              |
| `MAINTENANCE.md`                                                | `pnpm audit` CI gate (GAP-019)                                                                                                                                                  |

---

## Appendix — ASVS Reference Index

| ASVS Ref      | Description                                       | Gap              |
| ------------- | ------------------------------------------------- | ---------------- |
| V1.1.2        | Components identified and threat-modeled          | GAP-001          |
| V1.4.4        | Trust boundaries defined for all components       | GAP-001          |
| V2.2.1        | Authentication failures handled securely          | GAP-003          |
| V2.2.5        | Step-up auth for sensitive operations             | GAP-004          |
| V3.3.1        | Session invalidation on logout and timeout        | GAP-006          |
| V3.3.3        | Session invalidation on privilege change          | GAP-006          |
| V3.4.1–V3.4.5 | Cookie security attributes                        | GAP-005          |
| V3.7.1        | Re-authentication before sensitive transactions   | GAP-004          |
| V4.2.1        | Direct object reference access control            | GAP-007, GAP-008 |
| V4.2.2        | No IDOR via enumeration                           | GAP-007          |
| V5.1.3        | No mass assignment                                | GAP-008          |
| V5.3.3        | Output encoding in HTML context                   | GAP-009          |
| V5.3.4        | Output encoding for user-controlled data          | GAP-009          |
| V7.3.1        | Log injection protection                          | GAP-012          |
| V7.3.2        | Log data sanitization                             | GAP-012          |
| V7.4.1        | Generic error messages to clients                 | GAP-011          |
| V7.4.2        | No debug output in production responses           | GAP-011          |
| V8.1.1        | Sensitive data minimization                       | GAP-013          |
| V8.2.1        | Client-side cache protection for sensitive data   | GAP-013          |
| V8.3.3        | Sensitive data not in browser storage             | GAP-014          |
| V8.3.4        | Sensitive data not in URL parameters              | GAP-013, GAP-014 |
| V8.3.6        | Sensitive fields excluded from persistent storage | GAP-014          |
| V11.1.4       | Anti-automation for sensitive flows               | GAP-015          |
| V11.1.5       | High-value business logic abuse prevention        | GAP-015          |
| V11.1.6       | Business flow sequential step enforcement         | GAP-016          |
| V11.1.7       | Business logic state machine enforcement          | GAP-016          |
| V12.1.1       | File size limits enforced                         | GAP-010          |
| V12.2.1       | File type validation via magic bytes              | GAP-010          |
| V12.3.1       | Storage path not from user input                  | GAP-010          |
| V12.3.3       | File path traversal prevention                    | GAP-010          |
| V12.5.1       | Uploaded files served with correct disposition    | GAP-010          |
| V13.1.1       | HTTP method semantics enforced                    | GAP-017          |
| V13.2.1       | No unsafe HTTP methods                            | GAP-017          |
| V14.2.1       | Component dependency vulnerability scanning       | GAP-019          |
| V14.4.1       | HTTP security headers present                     | GAP-018          |
| V14.4.3       | Content-Type header on all responses              | GAP-018          |
| V14.4.4       | X-Content-Type-Options: nosniff                   | GAP-018          |
| V14.4.6       | CORS policy not permissive                        | GAP-002, GAP-018 |
| V14.4.7       | Content-Security-Policy defined                   | GAP-018          |
