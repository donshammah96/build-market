# API-to-Frontend Architecture Guidelines

This document defines the canonical architecture for adding or refactoring an API-backed vertical in `apps/client`.

Use it when:

- adding a new domain such as professionals, calendar, idea books, or notifications
- refactoring a route or action that still owns business logic inline
- fixing frontend data-flow bugs caused by boundary leakage between hooks, server actions, routes, and domain logic

This is not a generic pattern library. It is the repo-specific source of truth for how `apps/client` should be structured now.

## Scope And Precedence

This guide refines `.github/copilot-instructions.md` for `apps/client` API-to-frontend work.

Use it when a task touches:

- `app/api/**`
- `app/actions/**`
- `app/lib/domains/**`
- `lib/*-client.ts`
- `hooks/use*.ts`
- migration planning for legacy `lib/services/*` slices

Do not apply it mechanically to:

- `apps/admin` — for admin-specific architecture, use `.agent/ADMIN-ARCHITECTURE.md` (parallel Tier 1 doc)
- standalone backend services outside `apps/client`
- tasks that do not change API, domain, action, or browser-facade boundaries

Conflict rules:

1. `.github/copilot-instructions.md` remains the repo-wide baseline.
2. This guide wins for narrower `apps/client` API-to-frontend architecture questions.
3. Slice-local contracts or domain READMEs can add detail, but they must not weaken the hard boundaries defined here.
4. If two docs disagree, follow the narrower or stricter rule for the current task and update the drift rather than encoding a one-off exception in code.

The canonical server-side business layer lives under `app/lib/domains/*`.

`lib/services/*` is now legacy or compatibility-oriented. New business logic should not land there unless the slice has an explicit temporary exception.

### Primary Browser Flow

```text
UI Component / Page
  -> React Query hook
  -> browser-safe client facade (lib/<domain>-client.ts)
  -> API route (app/api/<domain>/**)
  -> domain service (app/lib/domains/<domain>/service.ts)
  -> repository (app/lib/domains/<domain>/repository.ts)
  -> @build/db
```

### Server-Side Form / Action Flow

```text
Server Component / form action
  -> server action (app/actions/<domain>.ts)
  -> secureAction wrapper
  -> domain service (app/lib/domains/<domain>/service.ts)
  -> repository (app/lib/domains/<domain>/repository.ts)
  -> @build/db
```

### Architectural Rules

1. `app/api/*` and `app/actions/*` are adapters only.
2. `app/lib/domains/*` is the canonical home for business rules, actor checks, and orchestration.
3. Repositories are persistence-only. They do not perform authorization, response shaping, or HTTP/action semantics.
4. Hooks and client components do not import server actions or domain services directly.
5. Browser-safe facades under `lib/facades/<domain>/*-client.ts` talk to HTTP routes with `fetch`-based clients, not direct server imports.
6. Authorization-sensitive domain methods accept full actor context, not bare user IDs.
7. Expected control flow should use structured `Result<T, DomainError>` outcomes instead of route-local sentinels or stringly typed exceptions.
8. Domain services must not import from other domain service or repository modules directly. Cross-domain reads must go through the owning domain's public `index.ts` surface. Cross-domain orchestration that requires writing to two domains must be lifted into a dedicated orchestration service under `app/lib/domains/shared/` or handled explicitly in the adapter layer with compensation logic. Direct inter-domain service imports are one of the fastest paths to coupling that defeats the domain-first migration.

---

## 2. Layer Responsibilities

### Presentation / Adapter Layer

Files:

- `app/api/**`
- `app/actions/**`
- `app/**/page.tsx`
- `lib/facades/<domain>/use<Domain>.ts`
- `lib/facades/<domain>-client.ts`
- `app/api/<domain>/shared.ts` — route-family shared utilities (see below)

Responsibilities:

- auth extraction
- rate limiting
- schema validation
- idempotency handling
- resilience wrappers
- HTTP or action response mapping
- cache invalidation and revalidation

Must not own:

- role or ownership policy
- multi-step domain orchestration
- Prisma-heavy business logic
- transport-independent DTO shaping rules

**Route-family shared utilities (`shared.ts`).** When a domain has multiple route handlers (collection, item, sub-resources), extract shared adapter utilities into a co-located `app/api/<domain>/shared.ts`. This file owns:

- The ADR-005 logging helper (`logRouteOutcome`) called by every handler in the family
- `domainErrorCodeToStatus()` — the single source of truth for error code → HTTP status mapping
- `domainErrorToResponse()` — constructs safe `NextResponse` from a domain error
- A client-safe message table mapping each error code to a pre-approved string
- Timing and role label helpers (`now()`, `actorRoleLabel()`)
- `conflictResponse()` — builds `409` response with `ETag`/`X-{Resource}-Version` headers
- `safeIdempotencyComplete()` — or import from `app/lib/services/idempotency-helpers.ts`

This keeps individual route handlers thin and ensures all operations on the same resource type use identical error mapping and logging shape.

### Domain Layer

Files:

- `app/lib/domains/<domain>/contracts.ts` — actor types, input DTOs, output DTOs, error code union, `Result<T, E>` aliases
- `app/lib/domains/<domain>/service.ts` — actor-aware business logic, orchestration, `ok()`/`err()` outcomes
- `app/lib/domains/<domain>/mappers.ts` — pure DTO construction functions; the **only** place for `Decimal → number` and `Date → string` normalization
- `app/lib/domains/<domain>/repository.ts` — Prisma reads and writes; see Repository Layer below
- `app/lib/domains/<domain>/operations.ts` — complex Prisma input builders (e.g. `buildPropertyUpdatePayload`) and optimistic-lock helpers that are too large to live inline in the service but are not repository queries
- `app/lib/domains/<domain>/index.ts` — public surface; exports contracts, the service singleton, and the repository singleton only

Responsibilities:

- actor-aware authorization
- business rules and invariants
- orchestration across repositories and side effects
- normalized `Result<T, DomainError>` contracts for all expected failures
- canonical DTO shaping via mapper functions before payloads cross any HTTP or action boundary

**The mapper split.** Domain services call mapper functions (`toPropertyListItemDto`, `toPropertyDetailDto`, etc.) from `mappers.ts` before returning data. Mappers are pure functions with no imports from infrastructure. They accept loose Prisma-shaped inputs and return strict domain DTOs. This separation means the service owns _when_ to shape data and the mapper owns _how_.

### Repository Layer

Files:

- `app/lib/domains/<domain>/repository.ts`

Responsibilities:

- Prisma reads and writes
- persistence-oriented helper queries
- transaction participation when directed by the domain service

Must not own:

- authz checks
- response envelopes
- route/action branching
- user-facing error messages

### Browser Client Facade

Files:

- `lib/<domain>-client.ts`

Responsibilities:

- browser-safe HTTP access
- DTO-safe `ApiResponse<T>` parsing
- concurrency limiting or bulkheads when appropriate
- rollout flag handling where a compatibility transition exists

Must not:

- import `app/actions/*`
- import `app/lib/domains/*/service.ts`
- rely on implicit Prisma or Server Action return types across network boundaries

### Trust Boundaries

Treat trust assumptions as explicit architecture, not route-local intuition.

- The presentation and adapter layer treats all request input (`body`, query params, path params, headers, and cookies) as untrusted until schema and guard validation succeeds.
- The domain layer treats actor context as trusted only when it is resolved through canonical auth wrappers (`withAuth`, `withRole`, or `secureAction`) and mapped to a known DB user.
- Any actor object constructed from request body fields, client storage, or query parameters is untrusted and must not be used for authorization decisions.
- The repository layer treats all query inputs as potentially adversarial and must only use Prisma parameterized query APIs. Raw SQL with user-controlled interpolation is prohibited.
- The browser is always untrusted. Client-side state may improve UX, but it never authorizes access or mutates privileged state without server-side policy checks.

---

## 3. UI & Presentation-Layer Standards

Apply this section whenever the task touches onboarding flows, forms, UI components, or any presentation-layer work in the Build Market client app. These are hard invariants, not style preferences. They apply at the same review bar as the data-flow boundaries above.

### 3.1 Onboarding Architecture

**Progressive Profiling.** Never generate monolithic forms. Break data collection into modular, single-intent screens. The decision rule for "single intent" is: one screen collects data that serves one identifiable goal the user has in this moment (e.g., "create your identity," "describe what you're selling," "set how you get paid"). If the screen's data would answer two different user questions, split it.

**One Primary CTA per view.** Each view must expose exactly one primary Call to Action. Secondary actions must be visually de-prioritized (ghost or text variant, never a competing filled button). If a view has two equally weighted actions, that is a design decision that requires explicit justification — not a default.

**Context over tutorials.** Prefer contextual empty states and inline guidance over mandatory onboarding carousels. A carousel is only justified when the concept is genuinely novel and cannot be communicated in a single sentence of inline copy.

**Form persistence.** Multi-step onboarding forms must persist draft state across back-navigation and accidental refresh. Use `sessionStorage` or URL-encoded step state as the persistence layer. Do not rely on React component state alone — it does not survive navigation. Loss of form state is a conversion failure, not a UX inconvenience.

Persistence exclusions are strict: any field classified as Class A (Restricted) or Class B (Sensitive) by `ADR-006-data-classification.md` must not be written to `sessionStorage`, `localStorage`, or URL parameters. Each multi-step form must declare its allowed persisted field list in module-level JSDoc and keep that list aligned with ADR-006.

Any file that intentionally writes onboarding/profile/payment draft state to browser storage must carry a `SECURITY_PERSISTENCE_ALLOWLIST` marker with a nearby rationale comment so drift tooling can track and review exceptions.

**Server-side step sequencing.** Any onboarding or verification flow with server-side consequences (DB writes, verification workflow triggers, payment setup, role transitions) must enforce step order in the domain service. Step eligibility is derived from persisted server state (for example `onboardingStep` or a state enum), not a client-provided step number. Out-of-order submissions must fail with a structured domain error (for example `invalid_state`) and have policy-test coverage.

### 3.2 Form Validation State Machine

Model form field validation as an explicit state machine. The valid states are:

- `untouched` → field has never received focus. No validation is run. No error is shown.
- `touched` → field has received and lost focus at least once (`blur` event). Run validation once on blur transition.
- `validating` → async validation (e.g., email availability check) is in flight. Show an inline spinner inside the input. Block submission.
- `valid` → all validation passes. Show a success indicator only for fields with non-trivial validation logic the user must actively satisfy (password strength, username availability). Do not show success state on simple presence or format checks — it adds noise without signal.
- `invalid` → validation failed. Switch from blur-triggered to change-triggered re-validation immediately. Clear the error state the moment the input transitions to valid. Do not wait for the next blur.

On `submit`: run full validation across all fields regardless of `touched` state. Halt submission if any field is `invalid` or `validating`. Programmatically shift DOM focus to the first invalid input.

**Async validation rules:**

- Debounce 300ms–500ms before firing the network request.
- Display an inline spinner inside the input during the pending state.
- On network failure: do not silently pass or silently block. Surface an inline error message: "Couldn't verify — please try again." Provide a visible retry affordance. Do not block the user from continuing if the check cannot complete after one retry.

### 3.3 Component State Contract

Every interactive component (Button, Input, Checkbox, Dropdown, Toggle) must explicitly implement and visually distinguish all of the following states. Omitting a state is a bug, not a design choice.

| State           | Trigger                         | Required Visual Treatment                                                                                                                                                                                       |
| --------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default`       | Base resting state              | Standard border, background, label                                                                                                                                                                              |
| `hover`         | `:hover` (pointer devices)      | Subtle background shift or shadow elevation                                                                                                                                                                     |
| `focus-visible` | `:focus-visible` (keyboard nav) | High-contrast focus ring using design token `--color-focus-ring`; `outline-offset: 2px`. **Never** `outline: none` without a custom replacement.                                                                |
| `active`        | `:active` on click/tap          | Visual depression: `transform: scale(0.98)` or deeper shadow                                                                                                                                                    |
| `disabled`      | `disabled` attribute            | Opacity `0.5`, `cursor: not-allowed`. Must still meet 3:1 contrast minimum for legibility.                                                                                                                      |
| `loading`       | Async action in flight          | Disable to prevent double-submission. Replace label with spinner or prepend spinner. Preserve original dimensions to prevent layout shift. Scope to the triggered action only — do not disable the entire form. |
| `error`         | Validation failure              | Semantic error color via token `--color-error`. Include error icon alongside error text — never rely on color alone (colorblind users).                                                                         |
| `success`       | Non-trivial validation passes   | Subtle checkmark or border highlight via token `--color-success`. Use only for fields the user must actively satisfy — not for simple presence checks.                                                          |

**Design tokens are mandatory.** Do not hardcode hex values. All color references must use CSS custom properties (e.g., `--color-primary`, `--color-error`, `--color-focus-ring`) sourced from the design token file. Hardcoded values are architectural debt in the presentation layer.

### 3.4 Accessibility Invariants (WCAG 2.1 AA Minimum)

These are non-negotiable. Treat any violation as equivalent to a failing test.

- **Color contrast:** 4.5:1 minimum for normal text. 3:1 minimum for large text and UI boundaries (input borders, component outlines).
- **Semantic HTML:** Use native `<button>`, `<input>`, `<label>`, `<form>`. Do not use `<div>` or `<span>` with `onClick` for interactive elements unless building a fully custom component with complete ARIA polyfilling — and document why the native element was insufficient.
- **Labels:** Every input must have a programmatic `<label>` with a matching `for`/`id` pairing. If the visual label breaks the design, hide it with `.sr-only`. Never rely on `placeholder` as the only label — placeholders disappear on input and fail contrast requirements.
- **Error wiring:** Error text must be injected into an `aria-live="polite"` container. Failing inputs must carry `aria-invalid="true"` and `aria-describedby="{error-element-id}"`.
- **Touch targets:** Minimum 44×44 CSS pixels for all interactive elements. Minimum spacing between adjacent interactive elements must also be sufficient to prevent accidental activation (WCAG 2.5.8) — do not pack icon buttons into tight rows even if individual sizes pass.
- **Focus management on step transitions:** When a multi-step form advances to a new step, programmatically move focus to the new step's heading (`h2`, `h3`) or its first interactive element. Do not leave focus stranded at the previous step's DOM position.

### 3.5 Conversion Instrumentation

Onboarding flows must instrument the following events as first-class concerns, not analytics afterthoughts:

- **Step completion rate:** Fire an event on each step's successful advance, keyed by step name and user segment.
- **Field-level abandonment:** Fire an event when a user focuses a field and navigates away without completing the form. Key by field name.
- **Validation error frequency by field:** Track which fields generate the most errors. High-error fields are a signal that the label, placeholder copy, or input type is wrong — not that users are failing.
- **Async validation failure rate:** Track network failures on availability checks separately from validation failures.

Instrumentation hooks must be defined at the component boundary, not scattered inline. Use a consistent event-firing abstraction that can be swapped between analytics providers without touching component code.

### 3.6 Visual Direction and In-Scope Delivery Completion

This section converts visual quality expectations into enforceable policy language. It applies to frontend design tasks, route-level UI implementation, and refactors that materially reshape page composition.

**No generic output by default.** Do not ship safe, interchangeable, template-like layouts when the task asks for a designed experience. UI should present a clear visual point of view while preserving product consistency.

**Typography direction.** Use purposeful type choices for hierarchy and tone. Avoid default fallback stacks (for example Inter, Roboto, Arial, or generic system stacks) unless an existing route-level or package-level design system explicitly requires them.

**Color direction and bias controls.** Establish a clear visual direction through semantic design tokens and CSS variables. Avoid accidental purple-on-white defaults and avoid dark-mode-first assumptions that degrade light-mode quality. Validate contrast and readability in both light and dark themes.

**Motion discipline.** Prefer a small number of meaningful transitions (for example initial content reveal, staged section entrance, or state transition emphasis). Do not apply broad micro-animation patterns that add motion noise without improving comprehension.

**Background and atmosphere.** Avoid flat single-color canvases for primary surfaces when the page intent requires visual framing. Use gradients, shape systems, pattern texture, or depth treatments that preserve readability and do not reduce accessibility.

**Desktop and mobile readiness.** A UI task is not complete until the implemented surface is verified on desktop and mobile breakpoints with functional navigation and interaction behavior.

**In-scope completion rule.** Finish the requested page or flow to a runnable, testable, end-to-end working state within the agreed scope. Do not pad delivery by adding adjacent features or new services that were not requested.

**Compatibility rule.** If the touched slice already has an established visual language, preserve and extend that system rather than introducing novelty that conflicts with existing product patterns.

### 3.7 Rendering Safety

User-generated content rendering is a security boundary, not only a UI concern.

- `dangerouslySetInnerHTML` is prohibited for user-generated content unless a server-side allowlist sanitizer is applied before persistence.
- Default rendering path for user-generated text is React interpolation (`{value}`), which applies HTML escaping.
- Client-side sanitization alone is insufficient for stored rich-text content. Sanitization policy must be enforced server-side before storage.
- Any allowed `dangerouslySetInnerHTML` usage must include an inline comment naming: the sanitization function, content source, and reviewer sign-off reference in the PR.

---

## 4. Reference Implementation Blueprint

Use the following order when creating or refactoring a vertical slice.

### Step 1: Define Contracts First

Create domain-owned contracts before wiring routes or hooks.

Recommended files:

- `app/lib/domains/<domain>/contracts.ts`
- `app/lib/config/<domain>.config.ts` when the slice has shared constants
- `app/lib/validation/<domain>-validation.ts` or the established validation location for the slice

Contracts should define:

- actor shapes for authorization-sensitive operations
- input DTOs for commands and queries
- output DTOs that are safe to serialize across HTTP or action boundaries
- `DomainError` unions or equivalent structured failures

Example from the properties reference implementation:

```typescript
// app/lib/domains/properties/contracts.ts

import type { DomainError, Result } from "@/app/lib/errors/result";

// ① Actor shape — userId + role; clerkId present for browser requests,
//    absent for internal service-to-service calls with no Clerk session.
export type PropertyActor = {
  userId: string;
  role: AppRole | string;
};

// ② Error code union — domain-oriented names, never HTTP status codes.
//    The adapter layer is responsible for mapping codes to HTTP statuses
//    via domainErrorCodeToStatus() in shared.ts.
export type PropertyDomainErrorCode =
  | "not_found"
  | "forbidden"
  | "conflict"
  | "invalid_input"
  | "internal_error" // infrastructure failure (Prisma, network)
  | "suspended_account"
  | "not_professional"
  | "slug_conflict"
  | "asset_not_found"
  | "asset_unauthorized"
  | "document_not_found"
  | "attachment_not_found";

// ③ Typed error and Result aliases — import Result from the canonical module,
//    never re-define it locally.
export type PropertyDomainError = DomainError<PropertyDomainErrorCode>;
export type PropertyResult<T> = Result<T, PropertyDomainError>;

// ④ Output DTOs — all Date fields are string (ISO 8601),
//    all Decimal/Prisma.Decimal fields are number.
//    Normalization happens in mappers.ts, not here.
export type PropertyCreateResultDto = {
  id: string;
  title: string;
  slug: string;
  price: number; // Decimal → number (normalized in mapper)
  createdAt: string; // Date → string  (normalized in mapper)
  version: number;
};
```

`DomainError<TCode>` is defined in `app/lib/errors/result.ts` as:

```typescript
export type DomainError<TCode extends string = string> = {
  error: TCode;
  message?: string;
  status?: number;
  details?: unknown;
};
```

Domain errors are **structured objects**, not plain strings. The `error` field holds the code; `message` and `details` are for internal logging only and must never be forwarded to `apiError()` as the client-facing message.

### Step 2: Keep Repositories Persistence-Only

Repositories are thin database adapters. The properties reference implementation uses a **plain object literal** (not a class), exported as a singleton:

```typescript
// app/lib/domains/properties/repository.ts
export const propertyRepository = {
  // ① Soft-delete guard is mandatory on every read — never omit deletedAt: null
  async findPropertyDetailById(propertyId: string) {
    return prisma.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: propertyDetailSelect,
    });
  },

  // ② Optimistic-lock writes use updateMany + version check.
  //    Returns { count, property } so the service can detect
  //    a conflict without a second round-trip.
  async updatePropertyWithVersion(
    propertyId: string,
    expectedVersion: number,
    data: Prisma.PropertyUpdateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<{ count: number; property: PropertyDetailRecord | null }> {
    const db = tx ?? prisma;
    const result = await db.property.updateMany({
      where: { id: propertyId, version: expectedVersion, deletedAt: null },
      data: { ...data, version: { increment: 1 } },
    });
    if (result.count === 0) return { count: 0, property: null };
    const property = await db.property.findFirst({
      where: { id: propertyId, deletedAt: null },
      select: propertyDetailSelect,
    });
    return { count: result.count, property };
  },

  // ③ Transaction participation — repositories accept an optional
  //    Prisma.TransactionClient so the domain service can coordinate
  //    multiple operations atomically without the repository knowing
  //    about business rules.
  async withTransaction<T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<T> {
    return prisma.$transaction(callback, options);
  },
};
```

If the repository starts checking roles or returning HTTP-shaped structures, the boundary has already drifted.

### Step 3: Put Business Logic in the Domain Service

Domain services own policy, orchestration, and DTO shaping. The properties reference implementation shows several canonical patterns:

**The `propertyError()` factory** — wraps `err()` with the domain's structured error type:

```typescript
// Private helper — eliminates repetition across the service
function propertyError(
  error: PropertyDomainErrorCode,
  message: string,
  details?: PropertyErrorDetails,
): PropertyResult<never> {
  return err<PropertyDomainError>({
    error,
    message,
    ...(details ? { details } : {}),
  });
}
```

**Authorization guard helpers** — checked once, re-used across operations:

```typescript
async function ensureOwnedProperty(propertyId: string, actor: PropertyActor) {
  const property = await propertyRepository.findPropertyOwnerState(propertyId);
  if (!property) return propertyError("not_found", "Property not found");
  if (property.agentId !== actor.userId) {
    return propertyError(
      "forbidden",
      "You do not have permission to access this property",
    );
  }
  return ok(property);
}
```

**Complete mutation method with transaction, optimistic lock, mapper call, and `Result` outcome:**

```typescript
export const propertiesService = {
  async updateProperty(
    propertyId: string,
    actor: PropertyActor,
    data: UpdatePropertyData,
    context: PropertyOperationContext,
    expectedVersion: number,
  ): Promise<PropertyResult<PropertyUpdateResultDto>> {
    try {
      return await propertyRepository.withTransaction(
        async (tx) => {
          // ① Check existence and ownership inside the transaction
          const property = await propertyRepository.findPropertyMutationState(
            propertyId,
            tx,
          );
          if (!property)
            return propertyError("not_found", "Property not found");
          if (property.agentId !== actor.userId) {
            return propertyError("forbidden", "You do not have permission");
          }

          // ② Optimistic-lock check
          if (property.version !== expectedVersion) {
            return propertyError("conflict", "Property has been modified", {
              currentVersion: property.version,
              expectedVersion,
            });
          }

          // ③ Build Prisma update payload in operations.ts helper
          const updatePayload = buildPropertyUpdatePayload(data, actor.userId);
          const updated = await propertyRepository.updatePropertyWithVersion(
            propertyId,
            expectedVersion,
            updatePayload,
            tx,
          );
          if (!updated.property) {
            return propertyError("conflict", "Property has been modified", {
              currentVersion:
                (await propertyRepository.findPropertyVersion(propertyId)) ??
                expectedVersion,
              expectedVersion,
            });
          }

          // ④ Map to explicit DTO using mappers.ts — never return raw Prisma shape
          return ok({
            property: toPropertyDetailDto(updated.property), // ← mapper call
            version: expectedVersion + 1,
          });
        },
        { isolationLevel: "Serializable" },
      );
    } catch {
      return propertyError("internal_error", "Failed to update property");
    }
  },
};
```

Use domain services to:

- enforce role and ownership policy via guard helpers
- coordinate repositories and side effects within transactions
- map persistence shapes into canonical DTOs using `mappers.ts` functions
- return `PropertyResult<T>` (`Result<T, DomainError>`) for all expected failures — **never throw** for `forbidden`, `not_found`, or `conflict`

### Step 3.5: Write Mappers for Every DTO Boundary

**Mappers live at `app/lib/domains/<domain>/mappers.ts`.** They are pure functions that normalize raw Prisma shapes into explicit browser-safe DTOs. This is the canonical and only location for:

- `Decimal → number` via a `toNumber()` helper
- `Date → ISO string` via a `toIsoString()` helper
- Null coalescing for optional fields
- Nested shape normalization (assets, agents, images)

```typescript
// app/lib/domains/properties/mappers.ts

type DecimalLike = number | { toNumber?: () => number } | null | undefined;
type DateLike = Date | string | null | undefined;

function toNumber(value: DecimalLike): number {
  if (typeof value === "number") return value;
  if (
    value &&
    typeof value === "object" &&
    typeof value.toNumber === "function"
  ) {
    return value.toNumber();
  }
  return value == null ? 0 : Number(value);
}

function toIsoString(value: DateLike): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export function toPropertyListItemDto(raw: {
  /* loose Prisma shape */
}): PropertyListItem {
  return {
    id: raw.id,
    price: toNumber(raw.price), // Decimal → number
    createdAt: toIsoString(raw.createdAt) ?? new Date(0).toISOString(), // Date → string
    // ... all fields explicitly mapped
  };
}
```

**Mappers must never:**

- Import from `app/api/**`, `app/actions/**`, or `app/lib/infrastructure/**`
- Call `getClientLogger()` or any side-effecting function
- Silently drop fields — every output field must be explicitly assigned

### Step 4: Keep API Routes Transport-Only

Routes should parse, validate, authorize, and map. They should not become mini-services.

Recommended route responsibilities:

- capture `startedAt = now()` as the **absolute first statement** (before auth, parsing, validation)
- initialize correlation IDs
- apply rate limiting — actor-scoped for authenticated routes, IP-scoped for public routes
- run request guards such as `checkBodySize()` and `isValidId()`
- parse JSON and validate with Zod's `.safeParse()` — **never `.parse()`**
- enforce `If-Match` for PATCH/DELETE on versioned resources — header-only, no body fallback
- call the resilient executor
- map `Result` outcomes to HTTP responses using `domainResultToErrorResponse()` from `shared.ts`
- handle idempotency (wrap `complete()` in `safeIdempotencyComplete()`)
- set `ETag` on success for versioned resources

HTTP method semantics are part of the adapter contract:

- `GET` handlers must not parse or process request bodies; query parameters are the only input surface.
- `DELETE` handlers for versioned resources must use `extractExpectedVersionFromIfMatch()` exclusively — the body-fallback `extractExpectedVersion()` is prohibited (GAP-017).

`apiError()` response messages must come from the slice's client-safe message table in `shared.ts`. **Never pass `error.message`, `err.message`, `data.message`, `result.data.message`, or any rebinding of those fields** to `apiError()`. Internal detail belongs only in structured logs.

The properties collection route (`app/api/properties/route.ts`) is the reference for GET + authenticated POST. The item route (`app/api/properties/[id]/route.ts`) is the reference for PATCH + DELETE with full idempotency and optimistic locking.

**Canonical authenticated POST handler** (properties collection, showing the full sequence):

```typescript
// app/api/properties/route.ts
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";
import {
  actorRoleLabel,
  domainErrorCodeToStatus,
  domainResultToErrorResponse,
  logPropertiesRouteOutcome,
  now,
} from "@/app/api/properties/shared";

export const POST = withAuth(
  async (req: NextRequest, { dbUserId, userRole }) => {
    // ① Timing — must be the first statement
    const startedAt = now();
    const correlationId = initializeCorrelationId(req);
    const operationName = "create_property";
    const actorRole = actorRoleLabel(userRole);

    // ② Rate limiting — actor-scoped for authenticated routes
    const identifier = getActorRateLimitIdentifier(dbUserId, "property-write");
    const rateLimitResult = await checkRateLimit(
      identifier,
      RateLimits.WRITE.limit,
      RateLimits.WRITE.window,
    );
    if (!rateLimitResult.success) {
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "rate_limited",
        httpStatus: HttpStatus.TOO_MANY_REQUESTS,
        durationMs: now() - startedAt,
        resourceType: "property",
      });
      return apiError(
        "Too many requests. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
        undefined,
        correlationId,
      );
    }

    // ③ Body size guard
    const sizeError = checkBodySize(req, PROPERTY_CONFIG.MAX_BODY_SIZE);
    if (sizeError) {
      /* log + return sizeError */
    }

    // ④ JSON parse + Zod validation — safeParse, never parse()
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      /* log validation_error + return 400 */
    }

    const validation = CreatePropertySchema.safeParse(body);
    if (!validation.success) {
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "validation_error",
        httpStatus: HttpStatus.BAD_REQUEST,
        durationMs: now() - startedAt,
        resourceType: "property",
      });
      return apiError(
        "Invalid property data",
        HttpStatus.BAD_REQUEST,
        validation.error.issues,
        correlationId,
      );
    }

    // ⑤ Idempotency — Class C/D summary key, never full payload spread
    const idempotencyKey =
      req.headers.get("Idempotency-Key") ||
      IdempotencyService.generateKey(dbUserId, "POST", {
        domain: "property",
        titleHash: validation.data.title.slice(0, 32), // Class C summary only
      });

    checkOrCreate API:
    // Signature:
    static async checkOrCreate<T = unknown>(
      key: string,
      scope: string,
      userId: string,
      operation: string,
      options?: {
        entityConnect?: Record<string, { connect: { id: string } }>;
        ttlHours?: number;
      },
    ): Promise<IdempotencyCheckResult<T>>

    // Returns { status: "new" | "completed" | "pending", response?: T }
    // Never returns null — callers must NOT null-guard the result.

    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "property",
      dbUserId,
      "POST",
      {
        entityConnect: { property: { connect: { id: propertyId } } },
        ttlHours: PROPERTY_CONFIG.IDEMPOTENCY_KEY_TTL_HOURS,
      },
    );

    // ✅ No entity — just ttlHours
    const idempotencyCheck = await IdempotencyService.checkOrCreate(
      idempotencyKey,
      "onboarding",
      dbUserId,
      "PATCH",
      { ttlHours: 24 },
    );

    // ✅ Default TTL, no entity
    const idempotencyCheck = await IdempotencyService.checkOrCreate(key, scope, userId, op);

    if (idempotencyCheck?.status === "completed") {
      return apiSuccess(
        idempotencyCheck.response,
        HttpStatus.OK,
        correlationId,
      );
    }
    if (idempotencyCheck?.status === "pending") {
      return apiError(
        "A request with this idempotency key is already being processed",
        HttpStatus.CONFLICT,
        undefined,
        correlationId,
      );
    }

    // ⑥ Domain call via resilient executor
    const result = await getResilientExecutor().execute(
      () =>
        propertiesService.createProperty(
          { userId: dbUserId, role: userRole },
          validation.data,
          options,
        ),
      { operationName },
    );

    // ⑦ Two-level unwrap: outer = infra failure, inner = domain failure
    if (!result.success || !result.data) {
      await IdempotencyService.fail(idempotencyKey);
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "internal_error",
        httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
        durationMs: now() - startedAt,
        resourceType: "property",
      });
      return apiError(
        "Failed to create property",
        HttpStatus.INTERNAL_SERVER_ERROR,
        undefined,
        correlationId,
      );
    }

    const domainResult = result.data;
    if (!domainResult.ok) {
      await IdempotencyService.fail(idempotencyKey);
      logPropertiesRouteOutcome({
        correlationId,
        operationName,
        actorRole,
        outcome: "domain_error",
        httpStatus: domainErrorCodeToStatus(domainResult.error),
        durationMs: now() - startedAt,
        domainError: domainResult.error,
        resourceType: "property",
      });
      return domainResultToErrorResponse(domainResult, correlationId)!;
    }

    // ⑧ Idempotency completion — safeIdempotencyComplete never rethrows
    await safeIdempotencyComplete(idempotencyKey, domainResult.data, {
      correlationId,
      operationName,
      actorRole,
      httpStatus: HttpStatus.CREATED,
      durationMs: now() - startedAt,
    });

    // ⑨ Success
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "success",
      httpStatus: HttpStatus.CREATED,
      durationMs: now() - startedAt,
      resourceType: "property",
    });
    return apiSuccess(domainResult.data, HttpStatus.CREATED, correlationId);
  },
);
```

**Key corrections vs. earlier examples in this doc:**

- `result.data.ok` is the correct discriminant — **not** `result.data.success` (which was a bug in prior examples)
- `domainResultToErrorResponse()` from `shared.ts` replaces inline switch/case error mapping
- `safeIdempotencyComplete()` from `idempotency-helpers.ts` replaces inline try-catch
- `now()` from `shared.ts` replaces `Date.now()` inline
- `logPropertiesRouteOutcome()` from `shared.ts` replaces direct `getClientLogger()` calls in handlers
- Actor-scoped `getActorRateLimitIdentifier()` replaces IP-scoped `getRateLimitIdentifier()` for authenticated routes

### Step 5: Use Server Actions Only for Server-Side Workflows

Server actions remain valid for:

- server component form submissions
- action-only workflows that need `revalidatePath()` or `revalidateTag()`
- authenticated mutations that stay server-side

Server actions are not the browser data-fetching layer.

**`secureAction` — definition and contract.** `secureAction` is a higher-order wrapper defined at `app/lib/actions/secure-action.ts`. It must be used for every server action that requires an authenticated actor. It: (1) validates that a Clerk session is active and resolves to a known DB user, (2) constructs and forwards a typed `DomainActor` to the wrapped action body, (3) emits a structured `validation_error` log event and returns a typed error result if session resolution fails — it does not throw. Domain errors that occur inside the wrapped action are the action's own responsibility. `secureAction` does not swallow them.

**`revalidatePath` vs `revalidateTag`.** Use `revalidatePath` only when you need to invalidate a full route segment and all its data. Prefer `revalidateTag` for fine-grained cache invalidation when the Next.js cache has been instrumented with tags — it avoids over-invalidation on high-traffic routes. Document which tag a slice uses in the slice's domain README.

Requirements:

- wrap them in `secureAction`
- validate action input explicitly
- pass full actor context into the domain
- keep cache revalidation in the action layer
- do not import them into hooks or browser client facades

### Step 6: Build a Browser-Safe Client Facade

The client facade is the only browser-facing transport abstraction.

Requirements:

- use `fetch` or established `apiFetch` helpers against `/api/...`
- normalize `ApiResponse<T>`
- define DTOs explicitly instead of inferring from Prisma or server-only returns
- use rollout flags when replacing a legacy route family incrementally

Example:

```typescript
export class PropertiesClient {
  private readonly bulkhead = new ConcurrencyLimiter(BULKHEAD_CONCURRENCY);

  async getProperty(id: string): Promise<ApiResponse<PropertyDetailDTO>> {
    if (!isValidId(id)) {
      return { success: false, error: "Invalid property ID" };
    }

    return this.bulkhead.run(() =>
      apiFetch<PropertyDetailDTO>(`/api/properties/${id}`),
    );
  }
}
```

### Step 7: Keep Hooks Thin and Deterministic

Hooks own cache keys, invalidation, and mutation lifecycle composition.

Requirements:

- centralize `unwrapApiResponse()`
- use stable query-key factories
- always invalidate the affected detail and list keys on mutation success unless there is a strong reason not to
- preserve caller-provided `onSuccess` handlers after internal invalidations
- follow TanStack Query v5 callback signatures exactly

**Query caching defaults.** React Query v5 defaults to `staleTime: 0`, which means every focus event or route transition triggers a background refetch. Set `staleTime` deliberately:

- Read-heavy queries on data that changes infrequently (properties, profiles, portfolio items): `staleTime: 60_000` (60 seconds) as the app-wide default on the `QueryClient`.
- Real-time or user-action-dependent data (messaging threads, notification counts): override with `staleTime: 0` at the query level.
- Establish the app-wide default in the root `QueryClient` configuration rather than repeating it per-query. Per-query overrides are acceptable when the data volatility genuinely differs from the default.

Example:

```typescript
export function useUpdateProperty(
  options?: UseMutationOptions<PropertyDetailDTO, Error, UpdatePropertyInput>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: async (input) =>
      unwrapApiResponse(await propertiesClient.updateProperty(input)),
    // TanStack Query v5: onSuccess receives (data, variables, context) — three arguments only.
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: propertyKeys.lists() });
      options?.onSuccess?.(data, variables, context);
    },
  });
}
```

---

## 5. Cross-Cutting Rules

### Actor-Aware Authorization

If a route can return `403` versus `404`, the domain service should receive full actor context.

Do this:

- pass `{ userId, clerkId, role }` or the slice-specific actor equivalent
- let the domain determine ownership, admin override, and policy decisions

Do not do this:

- pass only `dbUserId` and rely on caller discipline
- duplicate authz checks in multiple routes and actions

### DTO Boundaries Across Network Edges

Do not rely on implicit `ReturnType<typeof action>` or Prisma model inference across HTTP or Server Action boundaries when the payload contains `Date`, enums, unions, or nested objects.

Prefer:

- explicit DTO interfaces
- `Date -> string` normalization
- explicit `ApiResponse<T>` generics at the facade boundary
- explicit type assertions only at the outer boundary when the runtime shape is already normalized

### Structured Domain Results

Import the canonical `Result` type — do not re-define it locally:

```typescript
import type { Result, DomainError } from "@/app/lib/errors/result";
// Shape: { ok: true; data: T } | ({ ok: false } & E)
// The discriminant is `ok`, not `success`.
```

If the import path differs in your slice, check `app/lib/domains/README.md` for the current canonical location. Re-defining `Result` inline risks diverging from the canonical union shape if a third member is ever added.

**Two-level unwrap from `getResilientExecutor().execute()`.** The executor wraps the domain result in its own envelope:

```typescript
const result = await getResilientExecutor().execute(
  () => propertiesService.updateProperty(...),
  { operationName },
);

// Level 1: infrastructure failure (circuit open, timeout, executor error)
if (!result.success || !result.data) {
  // infra failure — return 500
}

// Level 2: domain failure — result.data is Result<T, DomainError>
const domainResult = result.data;
if (!domainResult.ok) {
  // domainResult.error is the PropertyDomainErrorCode string
  // domainResult.message is for logging only — never forward to apiError()
  return domainResultToErrorResponse(domainResult, correlationId)!;
}

// domainResult.data is the success payload
```

Avoid:

- throwing exceptions for expected business failures such as `forbidden`, `not_found`, or `conflict`
- route-local `_error` sentinel objects
- string matching on exception messages to determine status codes
- using `result.data.success` — the canonical discriminant is `result.data.ok`

### Idempotency and Optimistic Concurrency

`IdempotencyService` lives at `app/lib/services/idempotency.service.ts` and is an adapter-layer concern. It is called by route handlers and server actions — never by domain services or repositories. It accepts an idempotency key (typically from the `Idempotency-Key` request header), operation scope metadata, and a TTL. It records the first execution state and can replay completed responses for duplicate requests within the TTL window.

Replay persistence is scope-governed, not best-effort JSON caching.

- Every idempotent mutation scope must register an explicit replay policy in `IdempotencyService` before it can persist completed responses.
- Replay payloads must be derived from the owning route or action's public DTO or response envelope, not raw provider payloads, ORM records, or exception objects.
- Default replay policy allows only ADR-006 Class C and Class D data. If an existing public contract requires minimum-necessary Class B fields, that scope must opt in explicitly and stay reviewable in the replay policy registry.
- Class A data is never allowed in replay persistence.

**Idempotency key generation must use Class C/D summaries only (ADR-006).** Never spread the full request body into `generateKey()` — that fans Class B fields (email, phone, address) into the key derivation context:

```typescript
// ✅ Correct — Class C/D summary fields only
const idempotencyKey =
  req.headers.get("Idempotency-Key") ||
  IdempotencyService.generateKey(dbUserId, "POST", {
    domain: "property",
    titleHash: validation.data.title.slice(0, 32),
    fieldsCount: Object.keys(validation.data).length,
  });

// ❌ Wrong — spreads full body including potential Class B fields
const idempotencyKey = IdempotencyService.generateKey(dbUserId, "POST", body);
const idempotencyKey = IdempotencyService.generateKey(dbUserId, "PATCH", {
  domain,
  resourceId,
  ...updateData,
});
```

For mutation routes:

- use `IdempotencyService` where retries or duplicate submissions are possible
- require `If-Match` for PATCH and DELETE on versioned entities
- return `ETag` on successful reads or writes of versioned entities
- keep optimistic-lock conflict mapping in the adapter via `conflictResponse()` from `shared.ts`

### React Error Boundaries Within Pages

Route-level `error.tsx` catches errors from the full route segment. It is not sufficient for routes that contain multiple independently fetchable surfaces — a dashboard where a single widget failure should not blank the entire page.

When a route contains multiple independently failable data surfaces, wrap each independently failable widget in a React error boundary scoped to that surface. The route-level `error.tsx` remains as a last-resort fallback, but it should not be the primary recovery surface for isolated widget failures.

### TypeScript Narrowing Discipline

When handling structured unions:

- narrow with `if (!domainResult.ok)` before accessing `domainResult.error`
- keep the success path in an explicit `else` or after an early return
- never access `domainResult.data` before confirming `domainResult.ok === true`

The canonical discriminant is **`ok`**, not `success`. Using `success` is a bug — it will silently be `undefined` on the Result type and fail at runtime.

```typescript
// ✅ Correct
if (!domainResult.ok) {
  return domainResultToErrorResponse(domainResult, correlationId)!;
}
// here domainResult.data is safely narrowed

// ❌ Wrong — 'success' does not exist on Result<T,E>
if (domainResult.success === false) { ... }
```

This avoids the recurring union-access errors previously seen in optimistic-lock route handlers.

### CORS Policy

CORS rules are centralized security policy and must not drift route-by-route.

- Apply CORS through a shared adapter helper across `app/api/**`; do not hand-roll headers in individual handlers.
- Allowed origins must come from `envConfig` (`app/lib/infrastructure/env.ts`) and explicit allowlists, not inline strings.
- `Access-Control-Allow-Origin: *` is prohibited on routes that accept session cookies, `Authorization` headers, or return user-specific data.
- Preflight cache duration must not exceed session TTL for authenticated surfaces.

### CSRF And Trusted-Origin Mutation Policy

Cookie-authenticated unsafe methods (`POST`, `PATCH`, `PUT`, `DELETE`) must enforce trusted-origin checks before domain execution.

- Validate `Origin` against `envConfig` allowlists and fail closed on missing or untrusted origins for cookie-authenticated mutations.
- Apply the same trusted-origin requirement to server actions through `secureAction` when the action mutates privileged state.
- Cross-origin mutation exceptions require explicit justification, CSRF token enforcement, and review notes in the adapter.

### Anti-Caching Policy For Sensitive Responses

Sensitive responses must be non-cacheable by default.

- Authenticated and user-specific responses must return `Cache-Control: no-store, private` unless a documented exception is approved.
- Callback and webhook responses that include user-linked or security-sensitive state must also use non-cacheable headers.
- Any route intentionally marked cacheable must document why the payload is safe for caching and which cache scope is allowed.

### Callback And Webhook Integrity

Callback and webhook handlers are security boundaries and must verify integrity before business logic.

- Verify provider signatures before trusting payload content.
- Enforce replay-window and duplicate-delivery suppression using durable event identifiers.
- Acknowledge duplicate deliveries idempotently without re-applying side effects.
- Fail closed in production when signature verification or replay-protection dependencies are unavailable.

### Mass Assignment Protection

Mutation input validation must enforce explicit write allowlists.

- `POST`, `PATCH`, and `PUT` body schemas must use `.strict()` or explicit `.pick()` boundaries.
- `.passthrough()` is prohibited on mutation body schemas.
- Domain mutation DTOs must not accept system-owned fields such as `id`, `createdAt`, `updatedAt`, `deletedAt`, `version`, `isVerified`, or `role`.
- Adapters must reject or strip any system-owned fields present in request bodies before calling domain services.

### File Upload Security

All upload adapters must enforce these controls before storage operations:

1. Call `checkBodySize()` before fully reading file payloads, using limits sourced from `envConfig`.
2. Validate MIME type against an explicit allowlist using file magic bytes server-side. Do not trust client `Content-Type`.
3. Generate storage keys server-side (UUID plus controlled prefix). Never derive keys from user-provided filename or path input.
4. Serve uploaded files with safe disposition (`Content-Disposition: attachment`) and from a separate origin or CDN, not the app origin.
5. Run image transformation and transcoding in isolated worker processes, not in the main app request process.

### Sensitive Operation Re-Authentication

High-risk mutations require explicit session freshness checks before domain execution.

- Financial mutations: escrow release, payment initiation, payout requests, and payment callback-sensitive mutations.
- Identity mutations: role changes, credential updates, and verification document submission.
- Account mutations: email changes, phone changes, and account deletion.

The adapter layer enforces freshness assertions before calling domain services. Domain contracts for these operations must declare freshness as a precondition.

### 5.A Idempotency Completion Fail-Safe Contract

`IdempotencyService.complete()` can throw after a domain mutation has already succeeded.
When that happens, rethrowing from the adapter returns a 500 for a successful mutation
and can leave the idempotency key in `PENDING`.

**The canonical approach is `safeIdempotencyComplete()` from `app/lib/services/idempotency-helpers.ts`.**
This shared helper encapsulates the isolated try-catch, calls `fail()`, logs the structured event,
and never rethrows — without requiring every route to repeat the boilerplate:

```typescript
import { safeIdempotencyComplete } from "@/app/lib/services/idempotency-helpers";

// After successful domain call — pass context for structured logging
await safeIdempotencyComplete(idempotencyKey, domainResult.data, {
  correlationId,
  operationName,
  httpMethod: "POST",
  routePattern: "/api/properties",
  actorRole,
  httpStatus: HttpStatus.CREATED,
  durationMs: now() - startedAt,
  resourceType: "property",
});
// Never rethrows — the mutation already succeeded regardless
return apiSuccess(domainResult.data, HttpStatus.CREATED, correlationId);

// ❌ WRONG — double-wrapping defeats the isolation guarantee
try {
  await safeIdempotencyComplete(idempotencyKey, result.data);
} catch {
  /* ... */
}
```

For routes that cannot use the shared helper (e.g. if context fields differ), the inline pattern remains valid — but the contract is identical:

```typescript
try {
  await IdempotencyService.complete(idempotencyKey, domainResult.data);
} catch (completionError) {
  await IdempotencyService.fail(idempotencyKey).catch(() => undefined);
  logger.error(
    "Idempotency completion failed",
    completionError instanceof Error
      ? completionError
      : new Error(String(completionError)),
    {
      correlationId,
      operationName,
      httpMethod: req.method,
      routePattern: ROUTE_PATTERN,
      actorRole,
      outcome: "idempotency_complete_failed",
      httpStatus: HttpStatus.CREATED,
      durationMs: now() - startedAt,
    },
  );
  // Do not rethrow. Domain mutation already succeeded.
}
return apiSuccess(domainResult.data, HttpStatus.CREATED, correlationId);
```

Reject this anti-pattern: `complete()` inside an outer catch that rethrows unconditionally.

### 5.B Tiered recentAuth Windows

The default `withAuth` freshness window is 300 seconds. Tier 1 operations require 180.

| Tier                           | Operations                                                          | maxAgeSeconds |
| ------------------------------ | ------------------------------------------------------------------- | ------------- |
| Tier 1 - Critical financial    | Payout initiation, payout cancellation, escrow fund/release/dispute | 180           |
| Tier 1 - Identity destruction  | User export, user deletion, user rectification                      | 180           |
| Tier 2 - Identity verification | Professional document/license/certificate create, update, delete    | 300           |
| Tier 2 - Account transitions   | Onboarding submit, onboarding skip                                  | 300           |
| Tier 3 - Profile mutations     | Profile and contact updates                                         | 300 (default) |

Rule: Tier 1 routes must not rely on default freshness. Verify assigned constant values,
not only constant-name presence.

### 5.C Actor Context Completeness at Adapter Boundaries

`withAuth` provides `clerkId`, `dbUserId`, `userRole`, and optional `adminRole`.
Verification and identity-transition routes must destructure `clerkId` and include it
in the actor object when the domain contract accepts it.

```typescript
// Correct
async (req, { dbUserId, userRole, clerkId }, params) => {
  const actorRole = normalizeRole(String(userRole));
  const actor = { userId: dbUserId, clerkId, role: actorRole };
  await certificatesService.updateCertificate(actor, id, updateData);
};
```

### 5.D High-Risk Registry Governance

The high-risk registry is a first-class security artifact. Every Tier 1 and Tier 2
mutation route or server action must be represented in
`HIGH_VALUE_ROUTE_GUARD_RULES` or `HIGH_VALUE_SERVER_ACTION_GUARD_RULES`.

Completeness is mandatory for:

- Payout initiation and cancellation
- Escrow fund, release, and dispute
- User data rights: export, deletion, rectification
- Verification document, license, and certificate mutations
- Onboarding submit and skip transitions
- Financial operations in `app/actions/finance.ts` and `app/api/finance/**`

Clean drift output is not proof of safety for unregistered routes.

### 5.E Security-Relevant Utility Deprecation Pattern

When a shared helper includes a path incompatible with hardened policy, annotate it
as security-deprecated and enforce usage through drift checks.

```typescript
/**
 * @deprecated-security The body-version fallback path is incompatible with
 * GAP-017 header-only DELETE semantics. Use extractExpectedVersionFromIfMatch()
 * in DELETE handlers.
 */
export function extractExpectedVersion(req: NextRequest, body: unknown): number | null {
  ...
}
```

Drift checks must flag DELETE handlers calling `extractExpectedVersion(` unless the
route appears in `scripts/gap017-delete-exceptions.json`.

### Anti-Automation Requirements

IP-only throttling is insufficient for protected marketplace workflows.

- Use per-actor rate limiting keyed on `actor.userId` for onboarding submission, document upload, payment operations, and verification submission.
- Any `GET` route taking a resource ID that could be sequentially enumerated must apply anti-automation controls.
- Derive actor-bound rate-limit keys after successful auth resolution.
- Persist rate-limit state in Redis (`@build/redis`) so controls survive restarts and horizontal scaling.

### Canonical Environment Variable Access

All runtime environment variable reads must go through the canonical infrastructure module:

**`app/lib/infrastructure/env.ts`**

Route handlers, domain services, repositories, server actions, and config modules must import from this module. Direct `process.env` reads outside the module boundary are a layer violation equivalent to a repository performing role checks - they move behavior that belongs in one place into many.

**Correct usage:**

```typescript
import { envConfig } from "@/app/lib/infrastructure/env";

// in a route handler or domain service
const client = new StripeClient(envConfig.stripeSecretKey);
```

**Incorrect usage - reject in review:**

```typescript
// WRONG - direct process.env in a route handler or domain service
const client = new StripeClient(process.env.STRIPE_SECRET_KEY!);
```

**Bootstrap-only exceptions** (callsites where the Next.js module graph is not yet initialized):

- `next.config.ts`
- `instrumentation.ts`
- `sentry.*.config.ts`
- Edge-runtime `proxy.ts` where module initialization is unavailable

Each exception must carry a co-located comment:

```typescript
// bootstrap-only: module graph not initialized at this callsite
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
```

**Import direction:** `app/lib/infrastructure/env.ts` is a leaf-level module. It may be imported by domains, routes, actions, and config files. It must not import from presentation or domain layers.

**Why this matters for `apps/client` specifically:** `envConfig` validates all variables at module load time. A missing secret fails fast at server startup with a clear diagnostic rather than propagating `undefined` into a Stripe, Clerk, or database call at runtime under specific traffic conditions.

For the full rationale and migration sequence, see `ADR-004-cannonical-env-access-boundary.md`.

### Observability and Operational Readiness Checks

Observability is part of the adapter contract, not an afterthought. Every route handler, server action, and resilience executor that can fail in production must emit structured, machine-readable log events. Ad-hoc `console.log` or string-interpolated messages are not observable - they cannot be queried, aggregated, or correlated to a specific request or user session without manual grep work.

The existing primitives - `getClientLogger()`, `initializeCorrelationId()`, and the `operationName` field on `getResilientExecutor().execute()` - are the foundation. This section standardizes how they must be used.

#### 5.6.1 Structured Log Contract

Every log event emitted from the adapter layer must carry this minimum field set:

```typescript
type StructuredLogEvent = {
  // Tracing
  correlationId: string; // from initializeCorrelationId(req) - thread across request lifecycle
  operationName: string; // stable snake_case identifier, e.g. "update_property", "send_message"

  // Request context - safe non-PII routing fields
  httpMethod: string; // e.g. "PATCH", "GET" — enables grouping errors by method
  routePattern: string; // e.g. "/api/properties/[id]" — use the Next.js route pattern, NOT the raw URL (raw URLs expose resource IDs in path params)

  // Actor context - role only, never userId or clerkId in logs
  actorRole: UserRole; // for aggregation by role without logging PII

  // Outcome
  outcome:
    | "success"
    | "domain_error"
    | "validation_error"
    | "rate_limited"
    | "internal_error";
  domainError?: string; // the DomainError union value, e.g. "forbidden", "not_found", "conflict"
  httpStatus: number; // the actual status code returned

  // Performance
  // IMPORTANT: durationMs must be measured from the very first statement of the handler
  // (before auth resolution, body parsing, and Zod validation) to the point of response.
  // Capturing start after any of those steps understates total request time and makes
  // p95 comparisons unreliable across deploys.
  durationMs: number;

  // Optional - add when meaningful, never when speculative
  resourceType?: string; // e.g. "project", "property", "message_thread"
  resourceId?: string; // safe to log for non-PII resource IDs (UUIDs)
};
```

**PII exclusions - hard rules:**

- Never log `userId`, `clerkId`, `userEmail`, or any field that identifies a natural person.
- Never log request body payloads. Log the validated field names that failed Zod parsing, not the values.
- Never log response body content. Log the DTO type name and the outcome, not the data.
- `actorRole` is safe to log. It is an enum value with no identifying information.
- `resourceId` is safe to log for UUID-keyed resources. It is not safe for resources keyed on user-controlled slugs or names.

**Why role-only actor context.** Knowing that `forbidden` errors are spiking for `homeowner` actors but not `professional` actors identifies a regression in role gating without exposing who the homeowners are. PII in logs creates compliance surface that outlives the debugging value.

#### 5.6.2 Layer-Specific Logging Responsibilities

**Route handlers** are responsible for:

- Emitting one structured event per request at the point of response.
- Including `correlationId`, `operationName`, `actorRole`, `outcome`, `httpStatus`, and `durationMs`.
- Logging domain errors at `warn` level (expected failures - `forbidden`, `not_found`) and infrastructure errors at `error` level (resilience executor failures, unexpected throws).

**The resilience executor** (`getResilientExecutor().execute()`) already captures `operationName`. Routes must not re-implement retry or circuit-breaker logging inline - the executor emits those events. Routes log the final outcome only.

**Domain services** must not call `getClientLogger()` directly. Domain services return structured `Result<T, DomainError>` outcomes. The adapter layer that receives them is responsible for logging. Logging inside a domain service couples a pure business layer to an infrastructure dependency.

**Server actions** follow the same rule as route handlers. `secureAction` wrappers should emit a structured event on validation failure or actor-context error. The action itself logs the final outcome.

**Repositories** do not log. Persistence errors propagate as thrown exceptions caught by the resilience executor.

**Correct pattern for a route handler:**

The properties domain uses `logPropertiesRouteOutcome()` from `shared.ts` rather than calling `getClientLogger()` directly in each handler. This is the recommended approach for any route family with multiple handlers — it ensures all operations on the same resource type emit a consistent log shape.

```typescript
// app/api/properties/[id]/route.ts — using shared.ts helpers
import {
  now,
  actorRoleLabel,
  logPropertiesRouteOutcome,
  domainResultToErrorResponse,
} from "@/app/api/properties/shared";

export const PATCH = withAuth(async (req, { dbUserId, userRole }, params) => {
  const startedAt = now(); // ← now() from shared.ts, not Date.now() inline
  const correlationId = initializeCorrelationId(req);
  const operationName = "update_property";
  const actorRole = actorRoleLabel(userRole);

  // actor construction — userId and role; clerkId added for verification routes
  const actor = {
    userId: dbUserId, // used for domain authz - not logged
    role: userRole,
  };

  // ... rate limiting, If-Match, safeParse validation, resilience execution ...
  // See Step 4 in Section 4 for the complete route handler sequence.

  if (!domainResult.ok) {
    // ← domainResult.ok is the correct discriminant, not domainResult.success
    logPropertiesRouteOutcome({
      correlationId,
      operationName,
      actorRole,
      outcome: "domain_error",
      domainError: domainResult.error,
      httpStatus: domainErrorCodeToStatus(domainResult.error),
      resourceType: "property",
      resourceId: params.id,
      durationMs: now() - startedAt,
    });
    return domainResultToErrorResponse(domainResult, correlationId)!;
  }

  logPropertiesRouteOutcome({
    correlationId,
    operationName,
    actorRole,
    outcome: "success",
    httpStatus: 200,
    resourceType: "property",
    resourceId: domainResult.data.property.id,
    durationMs: now() - startedAt,
  });
  const response = apiSuccess(domainResult.data, HttpStatus.OK, correlationId);
  response.headers.set("ETag", `"${domainResult.data.version}"`);
  return response;
});
```

For route families that do not yet have a `shared.ts`, call `getClientLogger()` **inside the handler function** — never at module level — and emit the full ADR-005 field set directly.

#### 5.6.3 Metrics Are Derived from Structured Logs

Do not add a separate metrics instrumentation pass. The structured log event is the source. Metrics are aggregations computed by the observability backend (Datadog, Grafana Loki, CloudWatch Logs Insights, or equivalent) over the structured event stream.

This means metrics are only as good as the log field contract. A metric that depends on a field not in the contract is not a metric - it is a guess.

**Four metric surfaces required for operational readiness:**

Each metric below names the log field it is derived from and the failure mode it detects.

| Metric                                 | Derived from                                                                                                                                                                              | Failure mode it detects                                                                                                                                                                         |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth redirect rate**                 | `outcome: "domain_error"` + `domainError: "unauthenticated"` from middleware, grouped by route prefix                                                                                     | Spike indicates middleware misconfiguration or broken Clerk session handling on a specific route family                                                                                         |
| **Auth fallback rate**                 | `outcome: "domain_error"` + `domainError: "forbidden"` grouped by `actorRole`                                                                                                             | `forbidden` spike for a specific role after a deploy indicates a regression in the role-gating model; `forbidden` spike across all roles indicates a broader authz failure                      |
| **Action error class distribution**    | `outcome` field grouped by `operationName`, tracked over a rolling 24-hour window                                                                                                         | Unexpected `internal_error` spike on a specific operation after a deploy is a regression signal; `validation_error` spike on an operation indicates a schema mismatch between client and server |
| **p95 latency of critical operations** | `durationMs` at p95, grouped by `operationName`, for the following operations: `send_message`, `create_project`, `submit_professional_onboarding`, `create_property`, `authenticate_user` | p95 regression on these operations directly degrades conversion and user experience on the highest-traffic paths                                                                                |

**Alert thresholds are operational configuration, not architecture.** They belong in the observability platform config, not in this document. When a threshold needs to change, it changes in the platform config without requiring a code review or an ADR.

#### 5.6.4 The `operationName` Convention

`operationName` is the join key between the code and the observability platform. It must be:

- **Stable.** Renaming an `operationName` without updating the dashboard query that aggregates it silently breaks the metric. Treat it like a public API name.
- **Globally unique within `apps/client`.** Use `<verb>_<resource>` format: `create_project`, `update_property`, `send_message`, `delete_portfolio_item`.
- **Defined once per operation.** If a route and a server action both trigger the same domain operation, they use the same `operationName` so metrics aggregate across both entry points.
- **Documented at the slice level.** New operations must be added to the slice's domain README or contracts file with a comment marking them as observable operation names.

`operationName` must be compile-time static (string literal or enum value) and must not be derived from request params, body input, or runtime user content.

`resourceId` values added to logs must be UUID-validated first. If validation fails, log `resourceId: "[invalid-format]"` instead of raw untrusted input.

**Changing an operationName is a breaking observability change.** It requires a coordinated update of the dashboard query before or at the same time as the code change, and a changelog entry if the operation is on a critical metric surface.

---

## 6. Anti-Patterns To Reject

Reject these during review:

1. Hook or client component imports a server action.
2. Browser facade imports `app/lib/domains/*/service.ts` directly.
3. API route performs Prisma-heavy business logic inline.
4. Repository checks roles or ownership.
5. Domain service returns `NextResponse`, `Response`, or action-shaped envelopes.
6. Client facade infers DTO types from server-only `ReturnType` values.
7. Route invents custom sentinel objects instead of mapping structured domain errors.
8. Mutation hook conditionally skips invalidation for successful writes without a documented reason.
9. Form component hardcodes hex color values instead of referencing design tokens.
10. Interactive component omits one or more of the eight required visual states.
11. Multi-step form relies on React component state alone for draft persistence across navigation.
12. Instrumentation events are fired inline in component render logic rather than at a defined component boundary.
13. Route handler, domain service, repository, or config module reads `process.env` directly instead of importing from `app/lib/infrastructure/env.ts`. (Exception: documented bootstrap-only callsites in `next.config.ts`, `instrumentation.ts`, and `sentry.*.config.ts`.)
14. Route handler or server action logs with `console.log`, string interpolation, or an unstructured message instead of the structured log contract defined in Section 5.6.
15. Log event includes `userId`, `clerkId`, `userEmail`, or any request/response body content. Role is safe; identity is not.
16. Domain service calls `getClientLogger()` directly. Domain services return `Result<T, DomainError>`; the adapter layer that receives the result is responsible for logging.
17. `operationName` is renamed without a coordinated dashboard update and changelog entry.
18. A component file contains a `font-family` declaration that is not a reference to a design system token or an import from the design system package. Generic fallback stacks (Inter, Roboto, Arial, system-ui) are only acceptable when an existing slice-level design system constraint explicitly requires them — document the constraint inline.
19. A color value is expressed as a hex literal, `rgb()`, or `hsl()` in component CSS or a style prop instead of a CSS custom property from the design token file. Hardcoded values are a presentation-layer boundary violation.
20. A component uses `outline: none` on an interactive element without a visually equivalent custom focus indicator using `--color-focus-ring`. Removing the outline without a replacement fails WCAG 2.1 AA.
21. A motion effect (transition, animation, keyframe) is applied to more than three elements on a page without a `prefers-reduced-motion` media query guard, or is used purely for decoration with no comprehension benefit.
22. A frontend PR is submitted without confirming the implemented surface on both a desktop viewport (≥1280px) and a mobile viewport (≤390px). Marking a task complete without this check is a process violation.
23. A PR expands scope by adding a feature, route, or service that was not in the agreed task — even when the addition is low-risk. Scope changes require a new task. Partial implementations of the in-scope journey are also rejectable.
24. `.passthrough()` is used on a mutation route schema body (`POST`, `PATCH`, `PUT`) instead of `.strict()` or explicit `.pick()` allowlisting.
25. `dangerouslySetInnerHTML` renders user-generated content without documented server-side sanitization.
26. `apiError(error.message, ...)`, `apiError(error.stack, ...)`, or any non-approved internal exception detail is returned to clients.
27. `IdempotencyService.complete()` is called without an isolated try-catch that marks the key failed, logs `idempotency_complete_failed`, and returns success. Use `safeIdempotencyComplete()` from `app/lib/services/idempotency-helpers.ts` instead of writing inline try-catch in each handler.
28. A route-level outer catch rethrows completion failures from `IdempotencyService.complete()` and turns successful mutations into 500 responses.
29. `apiError()` first argument is derived from domain-message fields (`err.message`, `data.message`, `result.data.message`, including rebound forms) instead of static pre-approved strings from the slice's client-safe message table in `shared.ts`.
30. Tier 1 sensitive operations (financial mutations, identity-destruction mutations) use `maxAgeSeconds: 300` or default freshness instead of 180.
31. A new Tier 1 or Tier 2 sensitive route or action is added without a corresponding entry in high-risk guard registry rules.
32. Adapter actor objects omit `clerkId` for verification or identity-transition domain calls when the domain contract supports Clerk correlation.
33. `result.data.success` used as the domain result discriminant — the canonical field is `result.data.ok`. Using `success` silently produces `undefined` at runtime and masks domain failures as successes.
34. Domain result error narrowing uses `result.data.error` as a plain string key (e.g. in a switch) without first confirming `!result.data.ok`. Access `error` only after narrowing through the `ok` discriminant.
35. `Date.now()` used inline in handlers instead of `now()` from `shared.ts`. The `now()` helper is the canonical timing primitive across a route family — using it consistently means `durationMs` values are comparable across all operations.
36. A domain route family with more than one handler has no `shared.ts`. Multiple handlers duplicating error-mapping, logging, and message-string logic is a boundary violation — the shared utilities belong in `shared.ts` co-located with the route family.
37. `IdempotencyService.generateKey()` called with the full request body or a spread of the update DTO payload. Key derivation must use Class C/D summary fields only (ADR-006).
38. `getClientLogger()` called at module level (outside a function body). Logger must be obtained per-invocation so each call carries the current request context rather than a stale module-load snapshot.
39. A mapper function (`toPropertyListItemDto`, etc.) contains a Prisma query, a logger call, or an import from infrastructure. Mappers are pure functions — no side effects, no infrastructure dependencies.

---

## 7. Testing and Verification Standard

### 7.1 Philosophy: Risk-Centric, Not Layer-Centric

**The problem with layer-only coverage.** A test suite organized purely by layer - domain tests, route tests, hook tests - answers "does each layer do what it says?" but does not answer "does the system deny access to the right principals under the right conditions?" Those are different questions. Layer tests can all pass while a role-matrix gap, a missing redirect, or a broken authorization path remains undetected.

**The target state.** Organize coverage by risk, not by layer. Each test type has a clear job:

| Test type                  | Job                                                                          | Layer it tests                             | Failure it catches                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Contract tests**         | Assert the shape of inputs and outputs at each internal boundary             | Domain <-> repository, service <-> adapter | Implicit Prisma return inference leaking across a boundary; DTO shape regression after a repository change |
| **Policy tests**           | Exhaustively prove role x resource x action outcomes                         | Domain service, directly                   | Authorization gap; missing ownership check; wrong `forbidden` vs `not_found` distinction                   |
| **Layer tests** (existing) | Prove each adapter and consumer behaves correctly given valid domain results | Route, action, hook, facade                | HTTP status mapping; validation rejection; cache invalidation; resilience wrapping                         |
| **Critical-journey E2E**   | Prove the fully assembled system enforces access control on real HTTP paths  | Full stack, Cypress                        | Auth redirect broken; onboarding gate bypassed; role check removed without E2E catching it                 |

Layer tests are not replaced - they are the foundation. Contract and policy tests eliminate the gaps that layer tests structurally cannot cover. Critical-journey E2E tests act as the final tripwire for the highest-severity failure modes.

---

### 7.2 Contract Tests

Contract tests assert the _boundary shape_ between two layers. They are not integration tests - they do not hit a real database. They assert that when a domain service calls a repository method, it passes the right input shape, and that when a repository returns, the domain service does not silently depend on an implicit field that might disappear.

**Where they live:** `__tests__/contracts/<domain>/`

**What they must cover per domain:**

- Repository input contracts: assert that the domain service constructs repository calls with the correct Prisma `where`, `data`, and `include` shapes for each operation.
- Repository output contracts: assert that the domain service correctly handles `null` returns, soft-deleted record shapes, and optimistic-lock miss shapes (`updateMany` returning `{ count: 0 }`).
- HTTP boundary contracts: assert that the domain service's output DTOs pass the explicit DTO interface - no implicit `Date` fields, no unserializable union members.

**Example pattern:**

```typescript
// __tests__/contracts/projects/repository-input.contract.test.ts
describe("ProjectsRepository input contracts", () => {
  it("findById excludes soft-deleted records", async () => {
    const spy = vi.spyOn(prisma.project, "findFirst");
    await projectsRepository.findById("project-123");
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });

  it("updateWithVersion increments version on success", async () => {
    const spy = vi.spyOn(prisma.project, "updateMany");
    await projectsRepository.updateWithVersion("project-123", 3, {
      title: "New",
    });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: { increment: 1 } }),
      }),
    );
  });
});
```

**Failure this prevents:** A repository change that renames a field or drops `deletedAt: null` from a `where` clause passes all domain and route tests (because those mock the repository) and silently ships a data-exposure bug.

---

### 7.3 Policy Tests

Policy tests are the exhaustive role x resource x action matrix. They call domain services directly with varied actor contexts and assert the `Result` outcome. They do not go through HTTP. They are fast, cheap, and the only tests that prove the authorization model is complete.

**Where they live:** `__tests__/policy/<domain>/`

**Matrix structure.** For each domain with actor-sensitive operations, define the full matrix:

Every domain method that accepts a resource ID and reads or mutates that resource must include a policy test asserting non-owner and non-participant actors receive `not_found` (not `forbidden`) unless a documented business requirement intentionally reveals existence.

```typescript
// __tests__/policy/projects/authorization.policy.test.ts

const PROJECT_OWNER_ACTOR = { userId: "owner-1", role: "professional" };
const OTHER_PROFESSIONAL = { userId: "other-1", role: "professional" };
const HOMEOWNER_ACTOR = { userId: "home-1", role: "homeowner" };
const ADMIN_ACTOR = { userId: "admin-1", role: "admin" };

describe("Projects authorization policy", () => {
  describe("updateProject", () => {
    it("permits owner", () =>
      expectOk(updateProject(PROJECT_OWNER_ACTOR, cmd)));
    it("denies non-owner professional", () =>
      expectErr("forbidden", updateProject(OTHER_PROFESSIONAL, cmd)));
    it("denies homeowner", () =>
      expectErr("forbidden", updateProject(HOMEOWNER_ACTOR, cmd)));
    it("permits admin override", () =>
      expectOk(updateProject(ADMIN_ACTOR, cmd)));
  });

  describe("deleteProject", () => {
    it("permits owner", () =>
      expectOk(deleteProject(PROJECT_OWNER_ACTOR, cmd)));
    it("denies non-owner professional", () =>
      expectErr("forbidden", deleteProject(OTHER_PROFESSIONAL, cmd)));
    it("returns not_found for non-existent resource (not forbidden)", () =>
      expectErr(
        "not_found",
        deleteProject(PROJECT_OWNER_ACTOR, { ...cmd, id: "ghost-id" }),
      ));
  });
});
```

**Required policy coverage per migrated domain:**

- Every actor role that exists in `UserRole` must appear as a test case for each sensitive operation.
- The `forbidden` vs `not_found` distinction must be explicitly tested - returning `not_found` when the resource exists but the actor lacks access is an information-disclosure bug.
- Admin override paths must be tested; so must the absence of override for non-admin roles.
- Ownership transfer edge cases (e.g., shared participants on a project) must be covered when the domain supports them.

**Failure this prevents:** A policy test suite that covers only the happy path misses the case where a junior engineer removes an ownership check while refactoring and all layer tests continue to pass because they mock the domain service.

---

### 7.4 Layer Tests (Existing Standard, Preserved)

Layer tests prove that each adapter and consumer behaves correctly _given valid domain results_. They remain required. The layer coverage targets below are unchanged:

- **Domain tests:** actor enforcement, ownership, DTO shaping, optimistic-lock outcomes
- **Route tests:** HTTP status mapping, rate limits, validation, idempotency replay, ETag / `If-Match` behavior
- **Action tests:** `secureAction` input validation, actor propagation, cache revalidation triggers
- **Facade tests:** envelope parsing, rollout flags, DTO normalization
- **Hook tests:** invalidation, error unwrapping, consumer-visible behavior
- **UI component tests:** all eight visual states render correctly; ARIA attributes present in error state; focus moves to correct element on step transition

---

### 7.5 Critical-Journey E2E Tests

Critical journeys are the highest-severity failure modes for this application. They must have Cypress test coverage that runs as a **blocking CI job** (`critical-journeys`). A failing journey blocks merge regardless of whether unit and integration suites pass.

**Why a separate blocking job.** Layer and policy tests mock the runtime environment. A broken Clerk middleware configuration, a missing `withAuth` wrapper on a newly added route, or a redirect that got removed during a refactor will not be caught by any Vitest suite. Only a test that assembles the real HTTP stack can catch it.

**Mandatory journeys:**

```text
Journey 1 - Unauthenticated redirect
  Given: an unauthenticated browser session
  When:  navigating directly to any protected route (e.g., /dashboard, /projects, /professional/*)
  Then:  the response is a redirect to the sign-in page
  Why:   a missing or misconfigured middleware lets unauthenticated requests through

Journey 2 - Onboarded professional access
  Given: a user who has completed the professional onboarding flow
  When:  navigating to the professional dashboard
  Then:  the page renders without redirect or error
  Why:   a broken onboarding-completion flag leaves legitimate professionals locked out

Journey 3 - Non-professional denial
  Given: an authenticated homeowner or unverified user
  When:  navigating directly to a professional-gated route
  Then:  the response is a redirect or 403, not a rendered professional page
  Why:   role-gating middleware or layout guard removed without E2E coverage

Journey 4 - Incomplete onboarding redirect
  Given: an authenticated user who has started but not completed professional onboarding
  When:  navigating to the professional dashboard
  Then:  the user is redirected to the correct onboarding step, not a 404 or crash
  Why:   step-gating logic is fragile under concurrent onboarding state changes

Journey 5 - Thread read authorization
  Given: an authenticated user who is not a participant in a message thread
  When:  making a GET request directly to /api/messaging/threads/:id
  Then:  the response is 403 or 404, not the thread payload
  Why:   messaging authz is the most frequently touched and highest-leakage domain

Journey 6 - Thread send authorization
  Given: an authenticated user who is not a participant in a message thread
  When:  making a POST request directly to /api/messaging/threads/:id/messages
  Then:  the response is 403 or 404, not a 201
  Why:   write-path authz is independently breakable from read-path authz
```

**CI job definition:**

```yaml
# .github/workflows/ci.yml - add alongside existing test jobs

critical-journeys:
  name: Critical Journey E2E
  runs-on: ubuntu-latest
  needs: [build] # run against the built app, not dev server
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v3
    - run: pnpm install --frozen-lockfile
    - run: pnpm run build:client
    - run: pnpm run start:client &
    # Wait for the server to be ready before running Cypress.
    # Without this, Cypress races the startup and produces intermittent failures
    # that erode confidence in the suite. The app must expose /api/health (or
    # equivalent) for this probe. Add the endpoint if it does not exist.
    - run: npx wait-on http://localhost:3500/api/health --timeout 60000
    - run: pnpm run cypress:run --spec "cypress/e2e/critical-journeys/**"
  # This job is required in branch protection rules.
  # A failing critical journey blocks merge even if all Vitest suites pass.
```

**Test file location:** `apps/client/cypress/e2e/critical-journeys/`

**Naming convention:** one file per journey group, named after the concern being protected:

```text
cypress/e2e/critical-journeys/
  auth-redirect.cy.ts          # Journeys 1, 3
  professional-access.cy.ts    # Journeys 2, 4
  messaging-authz.cy.ts        # Journeys 5, 6
```

---

### 7.6 Mock Type Fidelity Requirement

Test mocks that substitute production types must exactly match production shapes.
Extra fields or missing required fields are correctness defects.

AuthContext mock fidelity is mandatory. Derive `withAuth` mocks from the production
`AuthContext` interface so type drift fails at compile time.

```typescript
import type { AuthContext } from "@/app/lib/api/api-middleware";
import { UserRole } from "@build/db";

const mockAuthContext: AuthContext = {
  clerkId: "clerk_123",
  dbUserId: "db_user_123",
  userRole: UserRole.PROFESSIONAL,
};
```

Domain actor-call assertions must include all adapter-forwarded fields, including
`clerkId` when present.

```typescript
expect(mockCertificatesService.updateCertificate).toHaveBeenCalledWith(
  { userId: "db_user_123", clerkId: "clerk_123", role: "PROFESSIONAL" },
  certificateId,
  updateData,
);
```

Error response assertions must use static approved strings, not domain message text.

```typescript
expect(payload.error).toBe("Forbidden");
```

---

### 7.7 Minimum Expectations Per Change Type

Use this table to determine which test types a given change requires.

| Change type               | Contract tests | Policy tests | Layer tests             | Journey E2E                                                                                                                                                      |
| ------------------------- | -------------- | ------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| New domain slice          | Required       | Required     | Required                | Add if a new protected route is introduced                                                                                                                       |
| Authorization rule change | Not required   | Required     | Required (route/action) | Required if the journey was previously covered, OR if the rule gates a route handling authentication, session state, or role-based access on a high-traffic path |
| Repository shape change   | Required       | Not required | Required (domain)       | Not required unless a journey relied on the changed field                                                                                                        |
| New UI component          | Not required   | Not required | Required (component)    | Not required unless the component gates a critical path                                                                                                          |
| New protected route       | Not required   | Not required | Required (route)        | Required                                                                                                                                                         |
| Migration of legacy slice | Required       | Required     | Required                | Required if the slice owns a critical journey                                                                                                                    |

---

### 7.8 Verification Commands

```bash
# Type-check the full client surface
pnpm run client:tsc-noemit

# Run targeted slice suites
pnpm run client:test:<suite>

# Run contract and policy tests only (fast, no DB)
pnpm -C apps/client exec vitest run __tests__/contracts __tests__/policy

# Run all Vitest suites
pnpm run client:test:all

# Run critical-journey E2E against the built app
pnpm run cypress:run --spec "cypress/e2e/critical-journeys/**"
```

---

## 8. Migration Playbook For Legacy Slices

When a slice still lives under `lib/services/*`, migrate in this order:

1. Create `app/lib/domains/<slice>/contracts.ts`, `repository.ts`, `service.ts`, and `index.ts`.
2. Move role checks, ownership checks, and orchestration into the new service.
3. Keep repositories persistence-only.
4. Refactor `app/api/<slice>/**` and `app/actions/<slice>.ts` into thin adapters.
5. Update `lib/<slice>-client.ts` to call API routes only.
6. Update hooks to consume the browser facade and invalidate canonical query keys.
7. Add direct domain coverage plus focused adapter or consumer tests.
8. Remove or quarantine the old `lib/services/*` surface. **Quarantine means:** (1) move the file to `lib/services/_deprecated/<slice>.ts`, (2) add a module-level `@deprecated` JSDoc comment citing the canonical replacement path, (3) ensure the lint config flags any new imports from `_deprecated/` as a CI error, and (4) add the slice to the removal queue in `PROGRESS-SUMMARY.md` with a target migration version. A quarantine comment without a lint guard is not a quarantine — it is a suggestion.

Current priority queue, based on scope impact and remaining boundary leakage:

1. Professionals
2. Calendar
3. Idea Books
4. Notifications
5. Seller dashboard read models (`inventory`, `orders`, `products`)
6. Reviews

CRM is no longer the next slice. It is already operating on the canonical domain pattern and should now be treated as a reference implementation alongside projects, properties, portfolio, messaging, and user-profile.

---

## 9. Staff Architecture Review Checklist

Use this checklist during implementation review and before calling a migrated slice complete.

### Data Flow and Ownership

- [ ] Data flows through `UI -> hook -> lib/*-client.ts -> app/api/** -> app/lib/domains/**/service.ts -> repository.ts`
- [ ] Hooks and client components do not import server actions or domain services directly
- [ ] Routes and actions remain transport-only and do not own multi-step business logic
- [ ] Repositories remain persistence-only and do not own authz, response mapping, or UI strings
- [ ] No new direct `process.env` reads appear in routes, domain services, repositories, or config modules - all env access goes through `app/lib/infrastructure/env.ts`
- [ ] Any `process.env` reads remaining in non-canonical locations are at documented bootstrap-only callsites with the required inline comment

### DTO and Serialization Correctness

- [ ] Domain services return explicit DTOs for HTTP or action boundaries instead of raw repository or Prisma return types
- [ ] `Date` values are normalized to `string` before crossing the network boundary
- [ ] Browser facades use explicit `ApiResponse<T>` generics and do not infer from server-only `ReturnType`
- [ ] Any browser-side normalization is limited to envelope parsing or compatibility shims, not canonical DTO shaping

### UI & Presentation-Layer Correctness

- [ ] All interactive components implement the eight required visual states (`default`, `hover`, `focus-visible`, `active`, `disabled`, `loading`, `error`, `success`)
- [ ] All color references use CSS custom properties from the design token file — no hardcoded hex values
- [ ] Every form input has a programmatic `<label>`; no input relies solely on `placeholder`
- [ ] Error messages are wired to `aria-live="polite"`, `aria-invalid`, and `aria-describedby`
- [ ] Touch targets meet 44×44 CSS pixel minimum with adequate spacing between adjacent targets
- [ ] Multi-step forms persist draft state in `sessionStorage` or URL-encoded step state
- [ ] Form validation follows the explicit state machine: `untouched → touched → validating → valid | invalid`
- [ ] Async validation debounces 300ms–500ms and handles network failure with a visible retry affordance
- [ ] Focus moves programmatically to the new step heading or first interactive element on step advance
- [ ] Conversion instrumentation events are wired at the component boundary via a swappable abstraction
- [ ] Visual direction is intentional and non-generic; page composition is not interchangeable boilerplate
- [ ] Typography choices are deliberate and not default-stack driven unless constrained by an existing design system
- [ ] Color direction avoids purple-on-white defaults and dark-mode bias; readability is validated in light and dark modes
- [ ] Motion is limited and purposeful, not broad decorative animation noise
- [ ] Primary surfaces use intentional background treatment when needed for visual framing, without reducing readability
- [ ] Desktop and mobile readiness are both explicitly verified before completion
- [ ] The requested UI flow is implemented to runnable, testable in-scope completion with no adjacent feature creep

### Functions, Classes, and Boundary Design

- [ ] Functions and classes are introduced only when they encapsulate a stable concern such as a client facade, concurrency limiter, or operations helper
- [ ] State-bearing classes in browser code do not hide business rules that belong in the domain service
- [ ] Shared helpers are colocated with the layer that owns the behavior, rather than duplicated across route, hook, and client layers

### Bundle and Code-Splitting Review

- [ ] New browser dependencies are justified against the route's critical path
- [ ] Heavy client-only UI such as date pickers, rich editors, form stacks, or modal workflows are considered for `next/dynamic`
- [ ] Dynamic imports are applied at meaningful boundaries, usually optional or intent-triggered UI, not core transport or hook layers
- [ ] Browser facades and hooks are not dynamically imported just to hide poor DTO or boundary design

### Hydration and SSR Safety

- [ ] No client-only globals such as `window`, `document`, `localStorage`, `sessionStorage`, or `navigator` are accessed during render on the server path
- [ ] If client-only globals are needed, they are gated behind user events, effects, or an explicit `typeof window !== "undefined"` guard
- [ ] Rendered date and time formatting is reviewed for locale and timezone mismatch risk during prerender and hydration
- [ ] Client-only widgets that are hydration-sensitive are isolated behind dynamic import with `ssr: false` when warranted

### Route-Level Resilience

- [ ] Route segments with material UI surface have a meaningful `loading.tsx`
- [ ] Route segments with material UI surface have a meaningful `error.tsx`
- [ ] Child route segments add their own `error.tsx` and `loading.tsx` when they need isolation from the parent segment
- [ ] Inline query-state loading and error UI is complementary to route-level boundaries, not a substitute for them

### Observability and Operational Readiness

- [ ] Every route handler and server action emits a structured log event at the point of response, carrying `correlationId`, `operationName`, `actorRole`, `outcome`, `httpStatus`, and `durationMs`
- [ ] No log event contains `userId`, `clerkId`, `userEmail`, request body values, or response body content
- [ ] Domain services do not call `getClientLogger()` - logging is the adapter layer's responsibility
- [ ] `operationName` values follow the `<verb>_<resource>` convention and are documented in the slice contracts or domain README
- [ ] If this change introduces a new `operationName`, it has been added to the observability platform's operation inventory (dashboard query or alert group)
- [ ] If this change renames an existing `operationName`, the dashboard query has been updated in the same deploy window and a changelog entry has been added
- [ ] `warn` level is used for expected domain errors (`forbidden`, `not_found`, `conflict`); `error` level is used for infrastructure failures and unexpected throws

### Verification

#### Layer Coverage

- [ ] Direct domain tests cover actor enforcement, ownership checks, and DTO shaping
- [ ] Route or action tests cover validation, status mapping, idempotency, and resilience behavior; validation tests exercise the `.safeParse()` failure path and confirm a 400 is returned with a structured log event — not a 500
- [ ] Hook or browser-facade tests cover unwrapping, invalidation, and consumer-visible normalization when relevant
- [ ] UI component tests cover all eight visual states, ARIA wiring in error state, and focus behavior on step transition
- [ ] Typecheck is clean for the touched surface and for the client app baseline

#### Contract Coverage

- [ ] Repository input contracts assert `deletedAt: null` guards, correct `where` shapes, and version-increment behavior for all mutating operations in the slice
- [ ] Repository output contracts assert that the domain service handles `null`, soft-deleted shapes, and optimistic-lock miss (`count: 0`) correctly
- [ ] HTTP boundary contracts assert that the domain service's output DTOs satisfy the explicit DTO interface - no unserializable `Date` fields, no implicit Prisma return shapes

#### Policy Coverage

- [ ] Every role in `UserRole` is a test case for each authorization-sensitive operation in the domain
- [ ] `forbidden` and `not_found` outcomes are tested independently - returning `not_found` when the resource exists but access is denied is an information-disclosure bug and must be a failing test
- [ ] Admin override paths are tested; absence of override for non-admin roles is also tested
- [ ] Any ownership-transfer or shared-participant edge case is covered when the domain supports it
- [ ] Every domain method accepting a resource ID includes a policy test that non-owner and non-participant access returns `not_found` unless existence disclosure is explicitly required and documented

#### Security Coverage

- [ ] Sensitive operation mutations assert session freshness before domain invocation
- [ ] Mutation schemas use explicit allowlists (`.strict()` or `.pick()`), with no `.passthrough()` on route bodies
- [ ] Upload routes assert size guard, magic-byte MIME allowlist, server-generated storage keys, and safe serving disposition
- [ ] CORS policy is applied through the shared helper with `envConfig`-driven origins and no wildcard on authenticated routes
- [ ] Error responses do not expose exception internals; `apiError()` message sources are pre-approved constants

#### Critical-Journey Coverage

- [ ] If this change adds or modifies a protected route, a critical-journey E2E test exists for it and is part of the `critical-journeys` CI job
- [ ] If this change modifies authorization logic for messaging, professional access, or onboarding gating, the corresponding journey test is reviewed and updated
- [ ] The `critical-journeys` CI job passes against the built app before the PR is merged

---

## 10. Refinement Checklist For Migrated Slices

Migration alone is not the finish line. Once a slice is on the canonical domain path, use this checklist to refine it for correctness and maintainability.

### Boundary Refinement

- [ ] Remove leftover client-side DTO repair logic that exists only because the server still returns implicit repository shapes
- [ ] Replace repository-return aliases in domain services with explicit DTO mappers owned by the domain layer
- [ ] Remove compatibility imports from `lib/services/*` once the canonical path is stable

### UI Refinement

- [ ] Split optional, heavy, or modal-only UI into route-local dynamic components when that reduces initial route JS
- [ ] Prefer extracted route-local components for large client pages instead of keeping form stacks and widget bundles inline in `page.tsx`
- [ ] Keep route-local skeletons and error surfaces aligned with the actual page layout rather than generic placeholders
- [ ] Audit form components against the eight-state component contract and the validation state machine after any form refactor
- [ ] Remove generic template drift by re-establishing clear typography, color, motion, and background direction for the slice
- [ ] Re-verify desktop and mobile behavior after visual refactors before considering the slice refinement complete

### Correctness Refinement

- [ ] Review hydration-sensitive rendering such as `new Date()` initial state, locale formatting, and time-zone dependent strings
- [ ] Replace full-page reload fallbacks with route-aware refetch or retry behavior when the failure is query-scoped
- [ ] Ensure idempotency, optimistic locking, and actor propagation rules still hold after the migration cutover

### Documentation Refinement

- [ ] Update `apps/client/docs/CHANGELOG.md` when a migrated slice gains a materially stricter boundary
- [ ] Update `apps/client/docs/PROGRESS-SUMMARY.md` when a slice moves from baseline migration to refinement or correctness hardening
- [ ] Update ADRs when the change affects standing architectural rules rather than only one slice implementation

---

## 11. Architecture Change Log

### [2026-03-30] OWASP ASVS Hardening Pass (Architecture Policy)

**Context:** A staff-level OWASP ASVS L2 audit identified missing explicit policy constraints across trust boundaries, CORS, mutation validation, upload controls, re-auth for sensitive operations, and safe error-message handling.

**Fix:** Added explicit trust-boundary statements in Section 2; tightened onboarding persistence and server-side sequencing requirements in Section 3.1; added rendering safety controls in Section 3.7; added method-semantics and safe `apiError()` constraints in Section 4; extended Section 5 with CORS policy, mass-assignment protection, file-upload security, sensitive-operation re-auth, and anti-automation requirements; extended Section 5.6.4 with compile-time `operationName` and UUID-validated `resourceId` logging constraints; added anti-patterns 24-26; and extended verification checklist coverage for IDOR and security controls.

**Verification:** Cross-checked with `apps/client/docs/OWASP-ASVS-CLIENT-APP-AUDIT.md`, `ADR-001`, `ADR-005`, and canonical `copilot-instructions.md` policy surfaces.

### [2026-03-25] Staff-Level Audit — Bug Fixes, Gap Closures, and Structural Improvements

**Context:** A comprehensive staff-level audit of this document identified correctness bugs in code examples, missing guidance in several high-risk areas, and structural navigation problems.

**Issues addressed:**

- BUG: Route handler example used `.parse()` instead of `.safeParse()`, causing ZodError to escape as a 500 and drop the structured log event entirely.
- BUG: TanStack Query v5 hook example used a four-argument `onSuccess` signature. v5 only passes three arguments; the fourth `mutation` parameter does not exist.
- BUG: Critical-journey CI YAML had a race condition — Cypress ran immediately after starting the server in the background without a readiness probe.
- GAP: No rule preventing cross-domain service imports. Added as Architectural Rule 8.
- GAP: `secureAction` was referenced throughout but never defined. Added definition and contract in Section 4 Step 5.
- GAP: No React Query caching strategy guidance. Added `staleTime` defaults in Section 4 Step 7.
- GAP: No guidance on React error boundaries for multi-surface pages. Added to Section 5.
- GAP: `IdempotencyService` was referenced without a location or contract definition. Added to Section 5.
- GAP: "Quarantine" in Section 8 Step 8 was undefined. Added a concrete four-step quarantine protocol.
- GAP: ADR-005 (canonical observability contract) was cited in the changelog but absent from Section 12 (Related Documentation). Added.
- AMB: `DomainActor.clerkId` optionality was unexplained. Added contract comment clarifying when it is and is not present.
- AMB: The two-level `Result` unwrap pattern from `getResilientExecutor` was implicit. Added inline callout in Step 4.
- AMB: `Result<T,E>` was re-defined inline rather than referencing the canonical import. Replaced with import reference.
- AMB: Journey E2E matrix condition for authorization rule changes was too narrow. Updated to cover new high-traffic auth gates.
- STR: Section 9 heading (`Architecture Change Log`) appeared before the review checklists but the changelog content appeared after Section 10 and 11. Restructured: 9A→9, 9B→10, changelog→11, old 10→12, old 11→13.
- STR: Anti-patterns 18–23 restated Section 3.6 policy language too abstractly to be useful in review. Replaced with mechanically verifiable reject criteria.
- Additional: `StructuredLogEvent` extended with `httpMethod` and `routePattern` fields. `durationMs` timing requirement made explicit.
- Additional: Route handler example in Section 5.6.2 updated to use `safeParse` and match the corrected Step 4 example.

**Verification:** Cross-checked against ADR-001 through ADR-008, existing boilerplate examples, TanStack Query v5 API documentation, and the anti-pattern enforcement model.

### [2026-03-25] Added Visual Direction and In-Scope Delivery Completion Standard (Section 3.6)

**Context:** The architecture guide had strong accessibility, state, and boundary rules but no explicit enforcement against generic visual output or incomplete frontend delivery.

**Issue:** Frontend work could satisfy technical correctness while still shipping interchangeable layouts, default typographic choices, mode-biased color decisions, or partially completed user journeys. These gaps degrade conversion and product clarity even when tests pass.

**Fix:** Added Section 3.6 to enforce intentional visual direction, typography and color constraints, motion discipline, background treatment guidance, desktop and mobile readiness, in-scope completion rules, and compatibility with established slice visual systems. Extended anti-patterns with enforceable rejections (items 18-23). Extended staff and refinement checklists with explicit verification criteria for visual direction and delivery completeness.

**Verification:** Cross-checked with existing Section 3 accessibility and token rules, anti-pattern enforcement model in Section 6, and review/checklist gates in Sections 9 and 10.

### [2026-03-21] Added Observability and Operational Readiness Standard (Section 5.6)

**Context:** Logging in `apps/client` was present but unstructured and ad-hoc - primarily `console.log` calls and string-interpolated messages in route error branches. No defined field contract, no PII boundary, and no connection between log events and operational metrics.

**Issue:** Without a structured log contract, the following failure modes are undetectable until a user reports them: a role-gating regression that silently denies legitimate actors; a p95 latency regression on a critical flow introduced by a dependency change; a middleware misconfiguration that redirects authenticated sessions. The observability gap is architectural, not a matter of adding more log statements.

**Fix:** Added Section 5.6 defining the structured log field contract, PII exclusion rules, layer-specific logging responsibilities (adapter layers log, domain services do not), the principle that metrics are derived from structured log events rather than a second instrumentation pass, four required metric surfaces with their source fields and failure modes, and the `operationName` naming convention with explicit guidance that renaming is a breaking observability change. Added anti-patterns 14-17. Added Observability and Operational Readiness checklist to Section 9.

**Verification:** Cross-checked against the existing `getClientLogger()` and `initializeCorrelationId()` usage in the route boilerplate, the resilience executor `operationName` field, ADR-002 (infrastructure layer owns logging primitives), and ADR-005 (canonical observability contract).

### [2026-03-21] Shifted Testing Strategy from Layer-Centric to Risk-Centric (Section 7)

**Context:** The existing testing standard was organized by layer (domain, route, hook, component). This correctly identified _where_ to add tests but did not define _what risk_ each test type protects against.

**Issue:** Layer tests can all pass while an authorization gap, a missing redirect, or a broken role-matrix entry goes undetected - because those tests mock the boundaries where the real failure would occur. A professional-access route check removed during a refactor would not be caught by any Vitest suite.

**Fix:** Rewrote Section 7 around four test types aligned to distinct risk categories: contract tests (boundary shape regressions), policy tests (role x resource x action matrix), layer tests (preserved, adapter and consumer correctness), and critical-journey E2E (full-stack auth and access control). Added a mandatory `critical-journeys` blocking CI job with six specified journeys covering unauthenticated redirect, professional access, role denial, incomplete onboarding, and messaging authz. Added a change-type matrix defining which test types are required per change category. Expanded the Section 9 verification checklist with contract, policy, and journey subsections.

**Verification:** Cross-checked against ADR-001 (auth model), ADR-002 (layer boundaries), ADR-003 (domain structure), and the existing Cypress setup referenced in `copilot-instructions.md`.

### [2026-03-16] Added UI & Presentation-Layer Standards (Section 3)

**Context:** Onboarding and form UI were governed by a separate prompt document with no binding connection to the API-to-frontend architecture guide.

**Issue:** Without a single authoritative document, form validation logic, component state contracts, accessibility invariants, and conversion instrumentation were treated as style preferences rather than hard architectural invariants. Different slices implemented them inconsistently.

**Fix:** Spliced Build Market Frontend Standards into this document as Section 3, renumbered subsequent sections, extended the anti-pattern list with four UI-specific rejections, added UI/presentation checks to the staff review checklist, and added UI component test coverage to the verification standard.

**Verification:** Cross-checked against the staff architecture lens prompt, the onboarding UI/UX standards document, and existing ADRs.

### [2026-03-12] Canonicalized domain-first guidance

**Context:** The previous version of this guide still described `lib/services/*` as the primary service layer and no longer matched the accepted ADRs or the current migration state.

**Issue:** The document was encouraging new work to land in legacy boundaries, understated actor-aware authorization requirements, and did not reflect the current `secureAction` plus `Result<T, DomainError>` pattern.

**Fix:** Rewrote the guide around `app/lib/domains/*` as the canonical server-side business layer, clarified adapter and repository responsibilities, added DTO and actor-boundary rules, and aligned the migration queue with the current progress summary.

**Verification:** Cross-checked against the accepted ADRs, `app/lib/domains/README.md`, and the latest migration progress summary.

### [2026-02-25] Decoupled browser client facades from server actions

**Context:** Some browser facades were still importing server actions directly.

**Issue:** This created server-environment leakage risk and degraded type safety across browser boundaries.

**Fix:** Browser facades were moved to `fetch`-based API access, with localized DTOs and explicit `ApiResponse<T>` normalization.

**Verification:** Client facade tests and type checking passed after the cutover.

### [2026-02-21] Explicit DTO boundaries for network serialization

**Context:** Property mutations were degrading to `Promise<unknown>` because implicit inferred types did not survive Next.js serialization boundaries cleanly.

**Issue:** `Date` fields and other non-trivial types caused generic inference to collapse in browser-facing client code.

**Fix:** Standardized explicit DTO interfaces with serialized date fields and asserted them at the network boundary instead of depending on implicit server return inference.

**Verification:** Type checking confirmed the repaired mutation inference path.

### [2025-02-16] Union narrowing and hook composition guardrails

**Context:** Repeated TypeScript and React Query regressions appeared during optimistic-lock and mutation-hook work.

**Issue:** Route handlers accessed union members before narrowing, and hooks were inconsistently forwarding TanStack Query callbacks or invalidating related caches.

**Fix:** Added explicit narrowing guidance, success-branch `else` handling, `unwrapApiResponse()` usage, and standardized merged `onSuccess` behavior.

**Verification:** Affected route, hook, and typecheck suites passed after the refactors.

---

## 12. Checklist For New Domains

- [ ] Create `app/lib/domains/<domain>/contracts.ts`, `repository.ts`, `service.ts`, and `index.ts`
- [ ] Define actor-aware inputs for authorization-sensitive methods
- [ ] Define explicit DTOs for all browser or action-facing payloads
- [ ] Normalize serialized DTOs in the domain service before they cross HTTP or action boundaries
- [ ] Use structured `Result<T, DomainError>` for expected business failures
- [ ] Keep repositories persistence-only
- [ ] Refactor `app/api/<domain>/**` into thin HTTP adapters
- [ ] Use `secureAction` in `app/actions/<domain>.ts` where server actions are needed
- [ ] Create or update `lib/<domain>-client.ts` with browser-safe `fetch` access only
- [ ] Create or update `hooks/use<Domain>.ts` with stable keys, error unwrapping, and deterministic invalidation
- [ ] Add route-level `loading.tsx` and `error.tsx` when the route segment owns a meaningful UI surface
- [ ] Review bundle impact and split heavy client-only widgets or modal form stacks with `next/dynamic` when it reduces route-critical JS
- [ ] Add idempotency and `If-Match` handling for versioned mutations
- [ ] Add direct domain coverage plus focused adapter or consumer tests
- [ ] Implement the eight-state component contract for all interactive components in the slice
- [ ] Wire form validation to the explicit state machine; implement async validation debounce and error recovery
- [ ] Confirm all accessibility invariants: labels, ARIA error wiring, touch targets, focus management on step transitions
- [ ] Wire conversion instrumentation events at the component boundary via a swappable abstraction
- [ ] Has the typography stack been confirmed against the design system package — not a generic fallback (Inter, Roboto, Arial, system-ui) — or is the fallback justified by an explicit existing design system constraint documented inline?
- [ ] Have all color declarations been verified to use CSS custom properties from the design token file, with no hex literals, `rgb()`, or `hsl()` values in component code?
- [ ] Has the implemented surface been reviewed against an existing slice's visual pattern to confirm it extends rather than conflicts with that system?
- [ ] Has the UI been verified on both a desktop viewport (≥1280px) and a mobile viewport (≤390px) with functional navigation and interaction before marking complete?
- [ ] Is the requested UI journey implemented to a runnable, testable, end-to-end complete state within agreed scope — with no partial flow steps and no adjacent unrequested features added?
- [ ] Any environment variables needed by the domain are accessed through `app/lib/infrastructure/env.ts`, not raw `process.env`
- [ ] Update docs when the migration materially changes architecture or queue status

---

## 14. Domain Audit Registry and Remediation Plan

This section is the living source of truth for the compliance and migration
state of every domain slice in `apps/client`. It defines the binary compliance
rubric, the current audit status of every slice, and the risk-ordered
remediation phases.

**Governance rules for this section:**

- Compliance status cells are updated by agents immediately after a phase
  completes, not after the whole plan finishes.
- A status cell moves to ✅ only when runtime code, focused tests, strict drift
  output, and docs all align. Partial evidence is not sufficient.
- Every status change must be accompanied by a CHANGELOG entry and a
  PROGRESS-SUMMARY update in the same commit.
- This section is the agent's first read at the start of any remediation session.
  After reading it, load `docs/PROGRESS-SUMMARY.md` for the current in-flight
  state.

---

### 14.1 Compliance Rubric

Each check is binary: **pass** (✅) or **fail** (❌). Checks marked ⚠️
have not been audited against actual files and require a read-pass before a
status can be assigned. N/A indicates the check does not apply to the slice.

#### Layer A — Domain

| ID  | Check                                                                                                                                               |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | `contracts.ts` defines explicit actor type; `clerkId?: string` present for any operation that performs or may trigger Clerk-side effects            |
| A2  | `service.ts` owns all business rules, authz checks, and orchestration; contains no route/action semantics, HTTP status codes, or response envelopes |
| A3  | `repository.ts` is persistence-only: no authz, no HTTP shapes, no user-facing strings; never imports from route or action modules                   |
| A4  | `index.ts` exports only the public surface of the domain; no re-export of internal service or repository internals                                  |
| A5  | All expected control flow uses `Result<T, DomainError>`; no thrown exceptions for predictable business failures (forbidden, not_found, conflict)    |
| A6  | DTOs crossing HTTP or action boundaries normalize `Date → string`; no raw `Date` objects in types that appear in `ApiResponse<T>`                   |
| A7  | ADR-006 `// ADR-006 classification:` comment present on every DTO or contract file where Class A or Class B fields appear                           |

#### Layer B — API Route Adapters

| ID  | Check                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Route is transport-only: no Prisma queries, no business rule execution, no ownership or authorization logic                                                                                                                                |
| B2  | `withAuth` wraps every exported handler that requires an authenticated actor                                                                                                                                                               |
| B3  | Tier 1 operations use `recentAuth: { maxAgeSeconds: 180 }`; Tier 2 operations use `recentAuth: { maxAgeSeconds: 300 }`; values confirmed against the named constant, not just its presence                                                 |
| B4  | `csrf: {}` option present on all mutation routes (POST, PATCH, PUT, DELETE) that carry authenticated state                                                                                                                                 |
| B5  | Actor-scoped throttling via `getActorRateLimitIdentifier(dbUserId, namespace)` on all authenticated routes; IP-based `getRateLimitIdentifier` used only for public/unauthenticated surfaces                                                |
| B6  | All `apiError()` first arguments are static string constants — no `error.message`, `err.message ??`, `data.message ??`, `result.data.message`, or any locally rebound domain result field regardless of variable name                      |
| B7  | Structured log event emitted per ADR-005 at the point of response: `correlationId`, `operationName`, `httpMethod`, `routePattern`, `actorRole`, `outcome`, `httpStatus`, `durationMs`                                                      |
| B8  | `IdempotencyService.complete()` is in an isolated inner try-catch that calls `fail()`, logs `outcome: "idempotency_complete_failed"`, and **does not rethrow**; the success response is returned regardless of whether `complete()` throws |
| B9  | `clerkId` destructured from `AuthContext` and included in actor object for verification and onboarding routes; domain contract confirmed to accept it                                                                                      |
| B10 | Route has entry in `HIGH_VALUE_ROUTE_GUARD_RULES` if it is a Tier 1 (financial, identity-destruction) or Tier 2 (verification, account-transition) mutation                                                                                |
| B11 | DELETE handlers on versioned resources use `extractExpectedVersionFromIfMatch()` exclusively; `extractExpectedVersion()` body-fallback form never called from a DELETE handler                                                             |
| B12 | Rate-limit namespace is consistent within a resource family; no mixed singular/plural forms across operations on the same resource type                                                                                                    |

#### Layer C — Server Actions

| ID  | Check                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `secureAction` wrapper with `recentAuth` at the correct tier value and `rateLimit` with an actor-scoped key function                            |
| C2  | Action has entry in `HIGH_VALUE_SERVER_ACTION_GUARD_RULES` if it is a Tier 1 or Tier 2 operation                                                |
| C3  | `IdempotencyService.complete()` in isolated inner try-catch with same contract as B8: calls `fail()`, logs, does not rethrow                    |
| C4  | Input validated with `schema.safeParse()` — never `schema.parse()` which throws and escapes as a 500                                            |
| C5  | Explicit serialization-safe DTO return type; no `ReturnType<typeof handler>` inference across action boundary                                   |
| C6  | `finalizeClerkOnboardingTransition` used for role and onboarding state transitions; direct Clerk metadata mutation not called from handler body |

#### Layer D — Browser Client Facade

| ID  | Check                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------- |
| D1  | Uses `fetch` or `apiFetch` against `/api/...` paths only; no direct imports from `app/lib/domains/**` or `app/actions/**` |
| D2  | Explicit `ApiResponse<T>` generic at the facade boundary; no `ReturnType<>` inference from server-only types              |
| D3  | Explicit DTO interfaces with `string` date fields; no `Date` objects expected across the network boundary                 |

#### Layer E — Hooks

| ID  | Check                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------- |
| E1  | React Query used for all server state; no manual `fetch`/`useState` for remote data                                           |
| E2  | `unwrapApiResponse()` centralized in the hook body; not scattered across component `onSuccess` callbacks                      |
| E3  | Stable query key factory (array literal or factory function); no ad-hoc inline strings as cache keys                          |
| E4  | Mutation `onSuccess` invalidates both detail and list keys; preserves caller-provided `onSuccess` after internal invalidation |
| E5  | TanStack Query v5 `onSuccess(data, variables, context)` — three arguments, no fourth `mutation` argument                      |

#### Layer F — Tests

| ID  | Check                                                                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1  | Policy tests cover every `UserRole` variant for each authorization-sensitive domain operation                                                                          |
| F2  | `forbidden` and `not_found` outcomes tested independently; `not_found` for non-owner access when existence must not be disclosed                                       |
| F3  | Admin override (expect success) and absence of override for non-admin elevated roles (expect fail) both tested                                                         |
| F4  | Repository contract tests assert `deletedAt: null` guards, correct `where` shapes, and version-increment behavior                                                      |
| F5  | Route tests exercise the `.safeParse()` failure path and confirm a 400 response with a structured log event — not a 500                                                |
| F6  | `withAuth` mocks use the exact production `AuthContext` interface — no extra fields (no `userEmail`), no missing required fields; mock variable typed as `AuthContext` |
| F7  | Error response assertions use pre-approved static strings — not domain message text copied from mock return values                                                     |
| F8  | Domain service call assertions include all actor fields the route constructs, including `clerkId` when the route forwards it                                           |
| F9  | `IdempotencyService.complete()` throw case tested for every handler that calls it; test asserts success response is returned and `fail()` was called                   |

#### Layer G — Observability

| ID  | Check                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | `operationName` follows `<verb>_<resource>` convention and is documented in the slice contracts file or domain README                   |
| G2  | No `console.log`, `console.error`, `console.warn`, or string-interpolated log calls in route handlers or server actions                 |
| G3  | Log events contain only ADR-005 safe fields; no `userId`, `clerkId`, `userEmail`, raw request body fields, or response body content     |
| G4  | No spread operators into logger call arguments (`...actor`, `...authContext`, `...ctx`, `...auth`) — each field logged by explicit name |

---

### 14.2 Slice Risk Classification

Risk tier determines remediation priority and the strictness of compliance
verification required. All Tier 1 and Tier 2 items block full audit sign-off
for the pass they belong to.

#### Tier 1 — Critical

Financial mutations, identity destruction, and Class A data surfaces.
ASVS L3 controls apply. Both `recentAuth: { maxAgeSeconds: 180 }` and
`csrf: {}` are mandatory. Registry entry required.

- `finance` (withdrawal, payout, escrow)
- `user-rights` (export, deletion, rectification)

#### Tier 2 — High

Identity verification, account transitions, and Class B data surfaces.
ASVS L2 controls apply. `recentAuth: { maxAgeSeconds: 300 }` and `csrf: {}`
mandatory. Registry entry required.

- `professional-verification` (documents, licenses, certificates)
- `onboarding` (submit, skip transitions)
- `messaging` (authz, IDOR risk)

#### Tier 3 — Medium

All remaining slices are migrated to the canonical domain path, with varying
audit depth across layers A-G.

- `properties`
- `projects`
- `professionals`
- `portfolio`
- `user-profile`
- `crm` (`leads` / `inquiries` / `pipeline`)
- `idea-books`
- `documents` / `licenses` / `certificates`
- `reviews` / `search`
- `client-dashboard`
- `calendar`
- `notifications`
- `seller-insights`

No slices remain in Tier 4 (not migrated).

---

### 14.3 Domain Audit Registry

Status codes: **✅ compliant** · **❌ known defect** · **⚠️ unaudited/in-progress** · **N/A**

This table is reconciled against current CHANGELOG history and mirrored in
`apps/client/docs/PROGRESS-SUMMARY.md`.

| Slice                               | Tier | Domain | Adapters | Actions | Tests | Observability | Overall |
| ----------------------------------- | ---- | ------ | -------- | ------- | ----- | ------------- | ------- |
| **finance**                         | T1   | ✅     | ✅       | ✅      | ✅    | ⚠️            | ✅      |
| **user-rights**                     | T1   | ✅     | ✅       | N/A     | ⚠️    | ⚠️            | ✅      |
| **professional-verification**       | T2   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **onboarding**                      | T2   | ✅     | N/A      | ✅      | ✅    | ✅            | ✅      |
| **messaging**                       | T2   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **properties**                      | T3   | ✅     | ✅       | N/A     | ✅    | ✅            | ✅      |
| **projects**                        | T3   | ✅     | ✅       | N/A     | ✅    | ✅            | ✅      |
| **professionals**                   | T3   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **portfolio**                       | T3   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **user-profile**                    | T3   | ✅     | ✅       | ✅      | ✅    | ✅            | ✅      |
| **crm** (leads/inquiries/pipeline)  | T3   | ✅     | ✅       | ✅      | ✅    | ✅            | ✅      |
| **idea-books**                      | T3   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **documents/licenses/certificates** | T3   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **reviews / search**                | T3   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **client-dashboard**                | T3   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **calendar**                        | T3   | ✅     | ✅       | N/A     | ✅    | ⚠️            | ✅      |
| **notifications**                   | T3   | ⚠️     | ⚠️       | N/A     | ⚠️    | ⚠️            | ⚠️      |
| **seller-insights**                 | T3   | ⚠️     | ⚠️       | N/A     | ⚠️    | ⚠️            | ⚠️      |

**No slices remain unmigrated.** All previously queued slices are on the
canonical domain path. ⚠️ means migrated but not yet fully audited.

---

### 14.4 Remediation Phases

Phases are sequenced by risk tier and dependency order. Phase N must be
complete (all status cells updated, all verification commands green, CHANGELOG
and PROGRESS-SUMMARY updated) before Phase N+1 begins.

Each phase specifies:

- Target slice(s) and layer(s)
- Specific defects from the registry being resolved
- Verification commands that must pass before the phase closes
- Documentation actions required

---

#### Phase R1 — Finance `complete()` Rethrow + Wrong `maxAgeSeconds` (Tier 1, Critical)

**Priority: Highest. A successful withdrawal can return 500 on retry. Potential double-withdrawal risk.**

Target: `app/actions/finance.ts`, `app/lib/security/high-risk-auth-windows.ts`,
`app/lib/security/high-risk-registry.ts`, `scripts/high-risk-registry.mjs`

Defects resolved: AP-2026-04-11-2.1 (C3), AP-2026-04-11-3.2 (B3)

Implementation steps:

1. Create `app/lib/security/high-risk-auth-windows.ts`:

   ```typescript
   /** Tier 1: financial mutations and identity destruction — 3-minute window */
   export const TIER1_RECENT_AUTH_MAX_AGE_SECONDS = 180 as const;
   /** Tier 2: verification and account transitions — 5-minute window */
   export const TIER2_RECENT_AUTH_MAX_AGE_SECONDS = 300 as const;
   ```

2. In `finance.ts`: change `WITHDRAWAL_RECENT_AUTH_MAX_AGE_SECONDS` to import
   `TIER1_RECENT_AUTH_MAX_AGE_SECONDS` and set to 180. Wrap `complete()` in
   isolated inner try-catch (see Section 5.A pattern). The outer catch must
   only rethrow `throwActionFailure` calls, not `complete()` throws.

3. Update `high-risk-registry.ts`: set escrow route snippets to
   `"maxAgeSeconds: 180"`. Rebuild `high-risk-registry.mjs`.

Verification:

```bash
pnpm run client:test:tier3-transition-policy
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Fixed`, `Security`

Registry updates: Finance B3 → ✅, C3 → ✅

---

#### Phase R2 — User-Rights and Payout Routes Registry + Guardrails (Tier 1, Critical)

Target: `app/api/user/export/route.ts`, `app/api/user/deletion/route.ts`,
`app/api/user/rectification/route.ts`, `app/api/finance/payout/route.ts`,
`app/api/finance/payout/[id]/cancel/route.ts`,
`app/lib/security/high-risk-registry.ts`, `scripts/high-risk-registry.mjs`

Defect resolved: AP-2026-04-11-3.1 (B10 for user-rights and payout)

Implementation steps:

1. Audit each route file. Confirm `recentAuth: { maxAgeSeconds: 180 }` and
   `csrf: {}` are present in `withAuth` options. Add if missing.
2. Confirm `getActorRateLimitIdentifier(dbUserId, namespace)` is used. Add if
   missing.
3. Add all five routes to `HIGH_VALUE_ROUTE_GUARD_RULES` with correct
   `requiredAuthOptions`, `requiredRecentAuthSnippets: ["maxAgeSeconds: 180"]`,
   and `requiredRateLimitSnippets`.
4. Rebuild `high-risk-registry.mjs`.

Verification:

```bash
pnpm run client:test:tier3-transition-policy
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Security`

Registry updates: user-rights B10 → ✅, payout B10 → ✅

---

#### Phase R3 — Onboarding `complete()` Fail-Safe (Tier 2, High)

Target: `app/actions/onboarding.ts`

Defect resolved: AP-2026-04-11-3.3 (C3)

Implementation steps:

1. In `submitOnboarding`: wrap `await IdempotencyService.complete(idempotencyKey, response)`
   in isolated inner try-catch. Catch calls `fail()` and logs
   `outcome: "idempotency_complete_failed"`. Does not rethrow. Falls through to
   `return response`.

Verification:

```bash
pnpm -C apps/client exec vitest run __tests__/actions/tier3-high-value-guard-policy.test.ts __tests__/actions/onboarding-tier3-guards.test.ts --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Fixed`

Registry updates: onboarding C3 → ✅

---

#### Phase R4 — Professional-Verification `err.message` + `clerkId` Forwarding (Tier 2, High)

Target: `app/api/professional-portal/certificates/route.ts`,
`app/api/professional-portal/documents/route.ts`,
`app/api/professional-portal/licenses/route.ts` (and `[id]` variants for each),
`app/lib/domains/certificates/contracts.ts`,
`app/lib/domains/documents/contracts.ts`,
`app/lib/domains/licenses/contracts.ts`

Defects resolved: AP-2026-04-11-3.4 (B6), AP-2026-04-11-3.5 (B9)

Implementation steps:

1. Audit each contracts file. If `VerificationActor` or equivalent actor type
   does not include `clerkId?: string`, add it with a comment explaining its
   use for Clerk-side correlation.
2. In each route handler, destructure `clerkId` from `AuthContext` and include
   it in actor construction.
3. Replace all `apiError(err.message ?? "...", status)` forms in POST error
   branches with pre-approved static strings. Log the domain error code at
   `warn` level instead.
4. Extend `SEC-LINT-004` / `adapterMessagePassthrough` drift check to flag
   `apiError(\w+\.message` patterns, not just `error.message` and `error.stack`.

Verification:

```bash
pnpm -C apps/client exec vitest run __tests__/api/professional-portal/ --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Fixed`, `Security`

Registry updates: professional-verification B6 → ✅, B9 → ✅

---

#### Phase R5 — Messaging Domain Message Passthrough + Test Fidelity (Tier 2, High)

Target: `app/api/messaging/conversations/[id]/route.ts`,
`app/api/messaging/messages/[id]/route.ts`,
`__tests__/api/messaging/route-auth-mapping.test.ts`,
`scripts/security-lint-checks.mjs` or `scripts/report-security-drift.mjs`

Defects resolved: AP-2026-04-11-2.2 (B6, F6, F7)

Implementation steps:

1. Extend `adapterMessagePassthrough` drift scan path to include
   `app/api/messaging/**`. Run strict drift to confirm new findings surface.
2. Fix each flagged `apiError(result.data.message ??`, `apiError(data.message ??`
   form in the messaging route handlers to use static strings.
3. Update `route-auth-mapping.test.ts`:
   - Remove `userEmail: "user@example.com"` from the `withAuth` mock context.
     Type the mock as `AuthContext` from `api-middleware.ts`.
   - Update all error-path assertions from domain message text to static
     strings (`"Forbidden"`, `"Not found"`, etc.).
4. Confirm `adapterMessagePassthrough` strict drift is zero after changes.

Verification:

```bash
pnpm -C apps/client exec vitest run __tests__/api/messaging/ --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Fixed`, `Security`

Registry updates: messaging B6 → ✅, F6 → ✅, F7 → ✅

---

#### Phase R6 — Properties Documents Actor-Scoped Throttling (Tier 3, Medium)

Target: `app/api/properties/[id]/documents/route.ts`

Defect resolved: Properties B5 (IP-based throttling in documents route)

Implementation steps:

1. Replace `getRateLimitIdentifier(req)` with `getActorRateLimitIdentifier(dbUserId, "property-docs-write")` in the POST and DELETE handlers.
2. Replace `getRateLimitIdentifier(req)` with `getActorRateLimitIdentifier(dbUserId, "property-docs-read")` in the GET handler.
3. Add to `HIGH_VALUE_ROUTE_GUARD_RULES` if this is a Tier 2 surface; otherwise confirm `actorScopedThrottling` drift check covers it.

Verification:

```bash
pnpm -C apps/client exec vitest run __tests__/api/properties/property-id.route.test.ts --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Security`

Registry updates: properties B5 → ✅

---

#### Phase R7 — Tier 3 Compliance Audit: stores, portfolio, crm, user-profile, leads/inquiries (Tier 3, Medium)

This phase is an audit-first phase. Each slice requires a read-pass against the
compliance rubric before any code changes are made. The audit must produce a
finding list per slice. Code changes follow within the same phase.

Target: All ⚠️ cells in the Tier 3 rows of the registry.

For each slice:

1. Read `app/lib/domains/<slice>/contracts.ts`, `service.ts`, `repository.ts`.
   Assign pass/fail per checks A1–A7.
2. Read `app/api/<slice>/**` route handlers.
   Assign pass/fail per checks B1–B12.
3. Read `lib/<slice>-client.ts`.
   Assign pass/fail per D1–D3.
4. Read `hooks/use<Slice>.ts`.
   Assign pass/fail per E1–E5.
5. Read `__tests__/api/<slice>/` and `__tests__/policy/<slice>/`.
   Assign pass/fail per F1–F9.
6. Confirm G1–G4 for adapters.

After the audit, update all ⚠️ cells to ✅ or ❌. Then remediate all ❌
cells found, re-verify, and update the registry.

Verification:

```bash
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
pnpm -C apps/client exec vitest run __tests__/api/<slice>/ __tests__/policy/<slice>/ --maxWorkers=1
```

CHANGELOG categories: `Security`, `Fixed` (per finding)

---

#### Phase R8 — Notifications and Seller-Insights Full Compliance Audit

Target: `app/api/notifications/**`,
`app/api/professional-portal/seller-insights/**`

This phase performs a read-pass and targeted remediation of the two remaining
⚠️ slices. Adapter suites exist; runtime confirmation and rubric-complete audit
remain pending.

Implementation steps:

1. Read route handlers and assign pass/fail for checks B1-B12 and G1-G4.
2. Run adapter suites for notifications and seller-insights and confirm runtime
   output is captured.
3. For each ❌ finding: patch, re-run targeted suite, and confirm strict drift
   remains zero.
4. Update this registry and `docs/PROGRESS-SUMMARY.md` in the same commit.

Verification:

```bash
pnpm -C apps/client exec vitest run __tests__/api/notifications __tests__/api/professional-portal/seller-insights-adapters.route.test.ts --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Security`, `Fixed`

---

#### Phase R9 — IDOR Policy Matrix Completion

Target: policy coverage gaps across migrated slices.

Implementation steps:

1. Add `__tests__/policy/<domain>.policy.test.ts` coverage for remaining
   domains: `user-rights`, `professionals`, `idea-books`, `notifications`,
   `seller-insights`, `calendar`.
2. Ensure each suite includes owner, non-owner, admin-override, and
   no-disclosure (`forbidden` vs `not_found`) cases where applicable.
3. Ensure each authorization-sensitive operation exercises all relevant roles.

Verification:

```bash
pnpm -C apps/client exec vitest run __tests__/policy --maxWorkers=1
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Added`, `Security`

---

#### Phase R10 — Observability Annotation Sweep

Target: migrated-but-unaudited slices with incomplete ADR-005 operation-name
inventory documentation.

Implementation steps:

1. Document `operationName` inventory in domain contracts or slice README files
   for all slices with ⚠️ observability status.
2. Confirm adapter logs emit stable keys and only ADR-005 safe fields.
3. Remove remaining unstructured logger calls or spread-based payload logging.

Verification:

```bash
pnpm run client:report-security-drift:strict
pnpm run client:tsc-noemit
```

CHANGELOG categories: `Docs`, `Security`

---

### 14.5 Documentation Protocol — CHANGELOG

Every phase completion, defect fix, or material architectural change must
produce a CHANGELOG entry in `apps/client/docs/CHANGELOG.md` in the same
commit. Entries are prepended to the file (newest first).

#### Entry format

```markdown
## [YYYY-MM-DD] Phase RN — Short description

### Security

- Resolved: brief description of security improvement and the defect reference
  (e.g., AP-2026-04-11-2.1). Include the route/action file path.

### Fixed

- Fixed: brief description of correctness improvement. Include the file path
  and what the old behavior was vs the new behavior.

### Changed

- Changed: brief description of behavioral or structural change.

### Added

- Added: new file, function, or test suite created.

### Deprecated

- Deprecated: surface moved to quarantine. Include the canonical replacement
  path.

### Removed

- Removed: surface deleted after quarantine period.

### Docs

- Docs: architecture guide section updated, ADR amended, instruction file
  updated.

**Files changed:** comma-separated list of all touched files  
**Verification:**

- `pnpm run client:report-security-drift:strict` → all categories 0
- `pnpm run client:tsc-noemit` → exit 0
- `pnpm -C apps/client exec vitest run <targeted suites> --maxWorkers=1` → N tests passed
```

#### CHANGELOG Rules

- Use only the semantic categories that apply. Omit empty categories.
- Every entry must include the Files changed and Verification sections.
- Verification section must include actual results, not planned results.
  Write the entry after running verification, not before.
- A phase entry that records "planned" verification is not a completed phase.
- `Security` entries must cite the specific ASVS control or autopsy defect
  reference being addressed.
- `Deprecated` entries must cite the quarantine protocol (Section 8 Step 8)
  and include the target removal version.

---

### 14.6 Documentation Protocol — PROGRESS-SUMMARY

`apps/client/docs/PROGRESS-SUMMARY.md` is the agent's recovery document. It
must be updated at the end of every working session before context is discarded,
and at the start of a new session it is loaded immediately after the architecture
guide. Its purpose is to prevent re-doing work that was already done and to
resume in-progress phases without a full context rebuild.

#### File structure

```markdown
# apps/client Migration and Remediation Progress Summary

**Last updated:** YYYY-MM-DD  
**Last session scope:** Brief one-sentence description of what was done
**Strict drift baseline:** all categories 0 / [category: N findings]
**Typecheck baseline:** clean / [N errors]

---

## Active Phase

**Phase:** RN — Short description  
**Status:** In progress / Completed  
**Remaining steps:** bullet list of what is left within this phase  
**Blocked by:** (if applicable)

---

## Slice Status Registry

| Slice       | Tier | Domain | Adapters | Actions | Tests | Overall |
| ----------- | ---- | ------ | -------- | ------- | ----- | ------- |
| finance     | T1   | ⚠️     | ❌       | ❌      | ⚠️    | ❌      |
| user-rights | T1   | ⚠️     | ❌       | N/A     | ⚠️    | ❌      |

| ...

Status codes: ✅ compliant · ❌ known defect · ⚠️ unaudited · N/A not applicable

---

## Open Defects (Unresolved)

| ID                | Slice   | Layer | Severity | Description                                   |
| ----------------- | ------- | ----- | -------- | --------------------------------------------- |
| AP-2026-04-11-2.1 | finance | C     | Critical | complete() rethrow in requestWithdrawalAction |

| ...

---

## Completed Phases

List of phases with completion date and the CHANGELOG entry reference.
Keep the last 10 entries; archive older ones to CHANGELOG.md.

| Phase   | Completed  | Summary                                |
| ------- | ---------- | -------------------------------------- |
| Phase 9 | 2026-04-09 | DELETE semantics expanded to messaging |

| ...

---

## Next Priority

**Next phase:** RN — Short description  
**Entry criteria:** what must be true before starting  
**Estimated scope:** N files, N tests

---

## Known Blockers

List anything that blocks the next priority.
If none, write "None."
```

#### PROGRESS-SUMMARY Rules

- The Slice Status Registry in this file must mirror the registry in Section 14.3
  of the architecture guide. When one is updated, the other must be updated in
  the same commit.
- The Active Phase section must be updated to "Completed" when the phase is
  done, and immediately replaced with the next phase entry. Never leave the
  file showing a completed phase as "In progress."
- The Open Defects table must be pruned when a defect is resolved — move it to
  the Completed Phases section or the CHANGELOG entry, not left open.
- Do not truncate or summarize file lists in the Completed Phases table. The
  full file list belongs in CHANGELOG.md. PROGRESS-SUMMARY.md keeps only the
  phase name, date, and a one-line summary.
- If an agent session ends mid-phase, write the partial progress into the
  Remaining Steps of the Active Phase section before discarding context.
  The next agent session reads this first and resumes from the last step.

---

### 14.7 Agent Execution Standard for Remediation Work

When an agent begins a remediation session, the required read sequence is:

1. Load this Section 14 to understand the compliance rubric and current
   registry state.
2. Load `docs/PROGRESS-SUMMARY.md` to identify the active phase and any
   in-progress work.
3. Load the CHANGELOG for the last 3 entries to understand recent context.
4. Load the specific instruction file for the layer being touched
   (e.g., `apps-client-api-adapters.instructions.md` for route work).
5. Execute the phase steps. After each step, run the targeted verification
   command before proceeding.
6. On phase completion: update the audit registry in this section, write the
   CHANGELOG entry, update PROGRESS-SUMMARY.md.
7. Before ending the session: write any partial progress to PROGRESS-SUMMARY.md
   Active Phase / Remaining Steps.

**The agent must never mark a phase complete without:**

- Running `pnpm run client:report-security-drift:strict` and confirming zero
  findings in all categories
- Running `pnpm run client:tsc-noemit` and confirming exit 0
- Running the targeted Vitest suites and confirming all tests pass
- Writing the CHANGELOG entry with actual verification results
- Updating the PROGRESS-SUMMARY.md

**The agent must never begin a new phase while the previous phase has an
outstanding defect or unconfirmed verification result.** If verification fails,
the phase remains open and the failure is recorded in the Active Phase /
Remaining Steps section of PROGRESS-SUMMARY.md before the session ends.

---

### 14.8 Architecture Change Log Entry

**[2026-05-08] Properties Domain Alignment Pass — Code-to-Doc Gap Closure**

**Context:** A staff-level audit of the properties domain reference implementation against this document identified twelve divergences where the doc described patterns that did not match the production code.

**Issues addressed:**

- BUG: Section 4 Step 1 `PropertyDomainError` example used a plain string union (`"forbidden" | "not_found"`). The actual type is `DomainError<PropertyDomainErrorCode>` — a structured object with `error`, `message`, and `details` fields. Any engineer reading the example would define the wrong type and break the `err()` factory call.
- BUG: Section 4 Step 2 used a class-based `PropertiesRepository` example. The actual pattern is an object literal singleton exported as `propertyRepository`. Class-based repositories introduce unnecessary instantiation complexity and diverge from every other domain in the repo.
- BUG: Section 4 Step 3 used `err("not_found")` shorthand. The actual pattern is `err<PropertyDomainError>({ error: "not_found", message: "..." })` via the `propertyError()` factory function. The shorthand produces a structurally incompatible `Result` shape.
- BUG: Section 4 Step 4 route handler example checked `result.data.success === false`. The canonical `Result<T,E>` discriminant is `ok`, not `success`. `success` is `undefined` on the type and produces a silent runtime failure.
- BUG: Section 5.6.2 observability example also used `result.data.success === false` and `Date.now()` inline. Both were corrected to match the properties reference.
- BUG: Section 5 TypeScript Narrowing said "narrow with `if (!result.success)`". Changed to `if (!result.data.ok)`.
- GAP: `mappers.ts` was not named as a layer. The doc described "canonical DTO shaping" but never identified where it lives or what constraints apply. Added Step 3.5 and the mapper layer to the Domain Layer files list.
- GAP: `operations.ts` was not documented. Added to the Domain Layer files list with explanation of what belongs there vs. `service.ts`.
- GAP: `shared.ts` route-family pattern was not documented. Added to the Presentation/Adapter Layer section and explained what it owns.
- GAP: `safeIdempotencyComplete()` helper from `idempotency-helpers.ts` was not mentioned. Section 5.A updated to recommend it as the canonical completion wrapper rather than writing inline try-catch in each handler.
- GAP: Idempotency key generation ADR-006 Class C/D constraint was stated in the ASVS docs but absent from the architecture doc's idempotency section. Added with a correct/incorrect example.
- GAP: `getClientLogger()` module-level call was shown in a comment in section 5.6.2. Clarified that logger must be obtained per-invocation inside the handler function.
- ADDED: Section 15 reference implementation table mapping every properties domain file to its architectural purpose.
- ADDED: Server Component and ISR pattern from `page.tsx` files — canonical public page data-fetching approach.
- ADDED: Anti-patterns 33–39 covering `result.data.success`, mapper side effects, missing `shared.ts`, module-level logger, and `Date.now()` inline.
- RENAMED: Old Section 15 (Related Documentation) → Section 16.

**Verification:** Cross-checked every code example against `contracts.ts`, `mappers.ts`, `repository.ts`, `service.ts`, `operations.ts`, `shared.ts`, `idempotency-helpers.ts`, `route.ts` (collection), and `route.ts` (item) from the properties reference implementation. All examples compile against the actual exported types.

**[2026-04-11] Added Section 14: Domain Audit Registry and Remediation Plan**

**Context:** Domain slices in `apps/client` had inconsistent compliance with
ADR, architecture, and ASVS guidelines. Some slices were fully migrated;
others were partially compliant or entirely on the legacy `lib/services/*`
path. No single document provided a complete picture of the compliance state
or a risk-ordered remediation plan.

**Issue:** Without a canonical audit registry, agents and engineers had no
reliable way to determine which slices needed work, in what order, or what
"done" meant for each slice. Work was fragmented, and compliance gaps in
high-risk slices (finance, user-rights, messaging) persisted across multiple
remediation passes because there was no systematic inventory.

**Fix:** Added Section 14 defining: a binary compliance rubric (Layers A–G,
checks A1–G4); a slice risk tier classification; a full audit registry with
current status for all known slices; an ordered remediation phase model;
CHANGELOG and PROGRESS-SUMMARY documentation protocols; and an agent
execution standard that prevents partial completions from being recorded as
done.

**Verification:** Cross-checked against all accepted ADRs, the ASVS canonical
remediation plan, the autopsy report dated 2026-04-11, and the existing
Sections 8–13 of this guide to confirm no duplication and no conflict.

## 15. Reference Implementation: Properties Domain

The properties domain is the canonical reference for all layers of the architecture. Read these files when implementing a new slice or auditing an existing one.

| File                                       | Layer        | What it demonstrates                                                                                                                                                                                                                  |
| ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/lib/domains/properties/contracts.ts`  | Domain       | `DomainError<TCode>` structured errors; `PropertyResult<T>` alias; explicit serialization-safe DTOs with `string` dates and `number` decimals; `OptimisticLockResult<T>` shape                                                        |
| `app/lib/domains/properties/mappers.ts`    | Domain       | `toNumber()` and `toIsoString()` helpers; pure DTO construction functions; nested asset/agent/image normalization                                                                                                                     |
| `app/lib/domains/properties/repository.ts` | Domain       | Object-literal singleton pattern; soft-delete guards on every read; `updatePropertyWithVersion()` with `{ count, property }` return; `withTransaction()` participant                                                                  |
| `app/lib/domains/properties/service.ts`    | Domain       | `propertyError()` factory; `ensureOwnedProperty()` guard helper; transaction-scoped ownership + optimistic-lock + mapper call sequence; `try/catch → internal_error` wrapping                                                         |
| `app/lib/domains/properties/operations.ts` | Domain       | `buildPropertyUpdatePayload()` — complex Prisma input builder extracted from service                                                                                                                                                  |
| `app/lib/domains/properties/index.ts`      | Domain       | Public surface: exports contracts, repository singleton, service singleton only                                                                                                                                                       |
| `app/api/properties/shared.ts`             | Adapter      | `logPropertiesRouteOutcome()` ADR-005 helper; `domainErrorCodeToStatus()` single source of truth; `propertyDomainErrorToClientMessage()` static message table; `conflictResponse()` with ETag headers; `now()` and `actorRoleLabel()` |
| `app/api/properties/route.ts`              | Adapter      | Public GET with IP-scoped rate limiting and query param validation; authenticated POST with actor-scoped rate limiting, body-size guard, idempotency, two-level unwrap, `safeIdempotencyComplete()`                                   |
| `app/api/properties/[id]/route.ts`         | Adapter      | PATCH with `If-Match` header-only semantics, `extractExpectedVersionFromIfMatch()`, conflict response with ETag; DELETE with header-only version; ETag on success                                                                     |
| `app/lib/services/idempotency-helpers.ts`  | Shared       | `safeIdempotencyComplete()` — the canonical idempotency completion wrapper used by all route families                                                                                                                                 |
| `app/lib/errors/result.ts`                 | Shared       | Canonical `Result<T,E>`, `DomainError<TCode>`, `ok()`, `err()`, `isOk()` — import from here, never re-define                                                                                                                          |
| `app/(user)/properties/page.tsx`           | Presentation | Server Component with `export const revalidate = 60`; ISR fetch via browser facade; `notFound()` for missing resources                                                                                                                |
| `app/(user)/properties/[id]/page.tsx`      | Presentation | `generateMetadata()` from same fetch; `notFound()` delegation; client sub-components for interactive surfaces                                                                                                                         |

### Server Component and ISR Pattern

Public-facing pages use Server Components with ISR revalidation. The properties pages show the canonical pattern:

```typescript
// app/(user)/properties/page.tsx
import { propertiesClient } from "@/lib/facades/properties-client";

// Revalidate at most every 60 seconds — page stays fresh without per-request fetching
export const revalidate = 60;

async function getFeaturedProperties() {
  try {
    const res = await propertiesClient.getProperties({
      featured: "true",
      limit: "4",
    });
    if (res.success && res.data) return res.data.properties ?? [];
  } catch {
    // Graceful fallback — page renders without listings rather than throwing
  }
  return [];
}

export default async function PropertiesPage() {
  const properties = await getFeaturedProperties();
  // ... render with properties — no client-side fetching needed for initial load
}
```

Rules for Server Component pages:

- Import from `lib/facades/<domain>/*-client.ts` (browser-safe facades) — never from `app/lib/domains/**` directly
- Wrap data fetches in try/catch with graceful fallback — a failed API call should not 500 the entire page
- Extract interactive surfaces (search filters, image galleries, contact forms) into route-local client components
- Use `notFound()` from `next/navigation` for missing resources — never render a blank page

## 16. Related Documentation

### `apps/client` Documentation

- `apps/client/app/lib/domains/README.md` for domain versus repository responsibilities and CRM boundary examples
- `apps/client/docs/PROGRESS-SUMMARY.md` for current migration status and remaining slice queue
- `apps/client/docs/CHANGELOG.md` for client-app architectural milestones
- `apps/client/docs/adr/ADR-001-auth-model.md` for Clerk-first identity and actor propagation
- `apps/client/docs/adr/ADR-002-client-layer-boundaries.md` for layer ownership and import direction
- `apps/client/docs/adr/ADR-003-domain-structure-and-import-direction.md` for canonical domain-first dependency flow
- `apps/client/docs/adr/ADR-004-cannonical-env-access-boundary.md` for env module ownership, bootstrap exceptions, and migration order
- `apps/client/docs/adr/ADR-005-cannonical-observability-contract.md` for structured log field contract, PII exclusion rules, metric derivation strategy, and `operationName` stability requirements
- `apps/client/docs/adr/ADR-006-data-classification.md` for Class A-D data handling boundaries across DTOs, logging, and browser persistence
- `apps/client/docs/adr/ADR-007-role-model-admin-sub-roles-and-actor-context-shape.md` for role model normalization, admin sub-role capability boundaries, and canonical actor context typing
- `apps/client/docs/adr/ADR-008-http-surface-security.md` for CORS, CSRF, anti-caching, security headers, and webhook/callback integrity controls
- `app/api/properties/` — canonical reference implementation for all adapter patterns
- `app/lib/domains/properties/` — canonical reference implementation for all domain patterns
- `app/lib/services/idempotency-helpers.ts` — `safeIdempotencyComplete()` shared completion wrapper

### `apps/admin` Documentation

- `.agent/ADMIN-ARCHITECTURE.md` — canonical architecture guide for `apps/admin` (parallel to this document)
- `apps/admin/docs/adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md` — `AdminActor`, `AdminRole`, capability policy, `safeAction`, session freshness tiers
- `apps/admin/docs/adr/ADR-ADMIN-002-admin-action-boundary-and-layer-structure.md` — action adapter, domain service, repository import direction and ownership
- `apps/admin/docs/adr/ADR-ADMIN-003-admin-observability-contract.md` — structured log fields, PII exclusions, `operationName` stability
- `apps/admin/docs/adr/ADR-ADMIN-004-admin-data-classification-and-handling.md` — Class A–D data handling for admin logging, UI, and export
- `apps/admin/docs/adr/ADR-ADMIN-005-admin-http-and-security-surface.md` — admin HTTP security controls
- `apps/admin/docs/adr/ADR-ADMIN-006-admin-environment-variable-access-boundary.md` — `adminEnvConfig`, bootstrap exceptions, env contract checker
- `apps/admin/docs/adr/ADR-ADMIN-007-admin-ui-component-contract.md` — admin UI component standards
- `apps/admin/docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md` — mandatory audit operations, append-only writes, declarative `safeAction` integration
- `apps/admin/docs/adr/ADR-ADMIN-009-admin-strangler-fig-and-feature-flag-strategy.md` — `AdminFeatureFlag`, v2 route gates, rollback-by-flag pattern
- `apps/admin/docs/PROGRESS-SUMMARY.md` — live overhaul execution surface: current phase, open defects, slice status, verification results
- `apps/admin/docs/CHANGELOG.md` — admin overhaul architectural milestones
