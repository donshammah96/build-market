---
description: "Use when adding or updating apps/client tests for architecture, policy, or high-risk behavior changes."
applyTo: "apps/client/__tests__/**"
---

# Client Test Risk Coverage

Last aligned with canonical on: 2026-06-05.
Previous alignment: 2026-03-30.
Change rationale: Autopsy report 2026-04-11 identified two test contract
failures that allowed confirmed production defects to pass as clean: mock
AuthContext shapes that include fields not present in the production type
(masking dead-code and type drift), and test assertions that assert domain
message text in error responses (inverting the signal so the test passes when
the route leaks internals and fails when it is fixed).

## Scope

- Applies to test updates in apps/client/**tests**.
- Keeps testing strategy risk-centric across boundaries and authorization paths.

## Rules

1.  Choose test types based on risk: domain, adapter, hook or facade, contract, policy, and journey where relevant.
2.  Include policy or contract coverage when authorization, DTO edges, or service-repository boundaries change.
3.  For protected-route or authz-sensitive changes, include critical-journey validation as a blocking CI surface.
4.  Prefer targeted test commands aligned with root script aliases.
5.  Mandatory journey coverage includes unauthenticated redirect, onboarded professional access, non-professional denial, incomplete onboarding redirect, thread read authz, and thread send authz when affected.
6.  For any domain method accepting a resource ID, include policy coverage asserting non-owner or non-participant access returns not_found unless existence disclosure is explicitly required.

7.  Mock AuthContext shapes must exactly match the production AuthContext type
    from app/lib/api/api-middleware. Do not add fields that do not exist in the
    production type (such as userEmail). Do not omit required fields. Derive the
    mock from the TypeScript interface so that type changes produce compile-time
    errors in tests rather than silent drift:

    ```typescript
    import type { AuthContext } from "@/app/lib/api/api-middleware";
    import { UserRole } from "@build/db";

    const mockAuthContext: AuthContext = {
      clerkId: "clerk_123",
      dbUserId: "db_user_123",
      userRole: UserRole.PROFESSIONAL,
    };
    ```

    A mock that includes userEmail (which is not an AuthContext field) causes
    tests to verify behavior against a shape that production withAuth never
    produces. This masks route defects and creates false safety signals.

8.  Test assertions for error response payloads must use pre-approved static
    strings, not domain message text. If a route is correctly implemented,
    its error responses contain static strings like "Forbidden" or "Not found".
    If a test asserts domain message text (e.g., "Not authorized to access this
    conversation"), the test passes when the route leaks internals and fails
    when the route is fixed - inverting the correctness signal entirely.

    Correct form:

    ```typescript
    expect(payload.error).toBe("Forbidden");
    ```

    Incorrect form - fails when fixed, passes when broken:

    ```typescript
    expect(payload.error).toBe("Not authorized to access this conversation");
    ```

9.  Test assertions for domain service call arguments must include all actor
    fields that the route constructs, including clerkId when the route forwards
    it. An assertion that omits clerkId from the expected actor shape passes
    even when the route silently drops the field, masking a contract defect:

    Correct form - verifies the complete actor:

    ```typescript
    expect(mockService.updateCertificate).toHaveBeenCalledWith(
      { userId: "db_user_123", clerkId: "clerk_123", role: "PROFESSIONAL" },
      certificateId,
      updateData,
    );
    ```

    Incorrect form - omitting clerkId masks a real route defect:

    ```typescript
    expect(mockService.updateCertificate).toHaveBeenCalledWith(
      { userId: "db_user_123", role: "PROFESSIONAL" },
      certificateId,
      updateData,
    );
    ```

10. Tests for routes that call IdempotencyService.complete() must include a
    case where complete() throws, asserting that the route still returns the
    success response (not a 500), and that IdempotencyService.fail() was
    called. This verifies the isolated try-catch contract specified in
    API-TO-FRONTEND-ARCHITECTURE.md Section 5.A.

11. Tests for routes with recentAuth must assert that the test environment does
    not have BYPASS_AUTH set. A test that verifies freshness rejection behavior
    while BYPASS_AUTH is active will trivially pass for the wrong reason, since
    the bypass path skips recentAuth validation entirely. Add an explicit check:

        ```typescript
        it("returns 401 for stale session on Tier 1 mutation", () => {
        	// Precondition: BYPASS_AUTH must not be set in this test environment.
        	expect(process.env.BYPASS_AUTH).toBeFalsy();
        	...
        });
        ```

## Validation

- Confirm changed behavior is covered at the highest-risk boundary.
- Confirm policy-sensitive changes include authorization or policy matrix tests.
- Confirm critical-journey coverage is updated when protected auth or routing behavior changes.
- Confirm test commands are narrow and reproducible.
- Confirm IDOR-sensitive resource ID operations include non-owner not_found policy assertions.
- Confirm all withAuth mocks use the exact production AuthContext shape with no
  extra fields and no missing required fields.
- Confirm error response assertions use static strings, not domain message text.
- Confirm actor call assertions include all fields the route constructs,
  including clerkId when relevant.
- Confirm IdempotencyService.complete() throw case is tested for routes that
  use idempotency.
- Confirm recentAuth tests assert BYPASS_AUTH is absent in the test environment.
