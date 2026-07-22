# Build Market — Admin Control Center (apps/admin)

Welcome to the **Admin Control Center**, a secure, high-integrity administrative console for managing the Build Market platform.

This application is built with **Next.js (App Router)**, **TypeScript**, **Tailwind CSS**, and **Prisma**. It is designed to act as a secure, audited, and strictly-segregated environment for back-office operations, GDPR compliance, content moderation, verification pipelines, and financial analytics.

---

## 1. Architectural Architecture & Layer Boundaries

The admin application adheres strictly to the layer boundaries defined in [ADR-ADMIN-002](docs/adr/ADR-ADMIN-002-admin-action-boundary-and-layer-structure.md). This layout isolates presentation/HTTP concerns from domain rules and direct database access.

```text
       Presentation Layer
         [app/* Route Pages] (UI)
                 │
                 ▼ imports
       Adapter Layer (Server Actions)
         [src/actions/admin/*.ts] (safeAction, validation, audit contracts)
                 │
                 ▼ imports
       Domain Layer (Business Logic)
         [src/lib/domains/<slice>/service.ts] (pure business logic, Result<T, E>)
                 │
                 ▼ imports
       Persistence Layer (Prisma Queries)
         [src/lib/domains/<slice>/repository.ts] (no business logic)
                 │
                 ▼ queries
       Database Engine (@build/db)
```

### The Rules of Engagement

1. **Thin Actions**: Action files under [src/actions/admin/](src/actions/admin/) are thin adapter layers. They handle authentication resolution, Zod input validation (using `.safeParse()`), capability mapping, dynamic cache revalidation, and audit logging. **They never execute direct database queries.**
2. **Result Envelope**: Services return a typed `Result<T, DomainError>` (using `ok`/`err` helpers from [src/lib/result.ts](src/lib/result.ts)) to actions. Throwing errors is reserved for unexpected repository or system failures.
3. **No Downstream Imports**: No service or repository may import from the action adapter layer.
4. **Independent Domain Slices**: Slices under `src/lib/domains/` represent distinct contexts. Cross-slice usage must be clean and not introduce circular imports.

---

## 2. Directory Structure

```text
apps/admin/
├── __tests__/                      # Integration & boundary test suites
│   ├── actions/                    # Action adapter tests (moved from src/actions/admin)
│   ├── config/                     # Page environment & layout tests
│   ├── security/                   # Coarse auth & policy engine tests
│   └── middleware.test.ts          # Root middleware checks
├── docs/                           # Architectural Decision Records (ADRs) & guides
│   ├── adr/                        # ADR-ADMIN-001 through ADR-ADMIN-009
│   ├── PROGRESS-SUMMARY.md         # Phase and migration status tracker
│   ├── RETIREMENT.md               # Feature retirement instructions
│   └── VERIFICATION.md             # Verification procedures
├── public/                         # Static assets
├── scripts/                        # Maintenance & management scripts
│   ├── promote-admin.ts            # Promotes user to Super Admin in DB and audit-logs
│   └── set-admin.ts                # Sets administrative role on Clerk metadata
└── src/
    ├── actions/                    # Server Actions & HTTP Route Handlers
    │   └── admin/                  # Safe actions matching domain slices
    │       ├── _core/              # Core action infrastructure (safeAction base)
    │       └── README.md           # Rationale for flat actions vs directories
    ├── app/                        # Next.js App Router folders & pages
    ├── components/                 # Shared UI, layouts, providers, and charts
    ├── hooks/                      # Custom React hooks (e.g. use-mobile)
    ├── lib/                        # Shared libraries and domain slices
    │   ├── api/                    # Legacy REST route guards & middleware
    │   ├── config/                 # Feature flags and app configuration
    │   ├── domains/                # Domain Slices (contracts, repository, service)
    │   │   ├── audit/              # Audit domain logic
    │   │   ├── users/              # User account & suspension domain logic
    │   │   └── verification/       # Professional verification pipelines
    │   ├── infrastructure/         # Environment variables, logs, telemetry, SMS
    │   └── security/               # Authorization policies & claims resolution
    └── middleware.ts               # Global Next.js edge auth/routing gate
```

---

## 3. Security, Authentication, & Authorization

Security in the Admin app is governed by [ADR-ADMIN-001](docs/adr/ADR-ADMIN-001-admin-authentication-and-authorization-model.md) and [ADR-ADMIN-008](docs/adr/ADR-ADMIN-008-admin-audit-log-contract.md).

### The Admin Actor

Clerk is our runtime identity provider, but administrative capabilities are resolved from the database `AdminProfile` record:

- Administrative actions execute on behalf of an `AdminActor`: `{ dbUserId: string; adminRole: AdminRole }`.
- We support three roles: `SUPER_ADMIN`, `SUPPORT_AGENT`, and `CONTENT_MODERATOR`.
- `SUPER_ADMIN` acts as a full capability bypass. Other roles map to specific capabilities inside the [authorization-policy.ts](src/lib/security/authorization-policy.ts).

### safeAction & Freshness Gating

All mutations and administrative reads run within the `safeAction` wrapper, which guarantees:

1. **Authentication**: Resolves Clerk identity server-side.
2. **Capability Check**: Asserts the actor possesses the necessary `AdminCapability` for the action.
3. **Session Freshness**: High-risk operations require a recently verified session. If the session age exceeds the max age, the action fails.
   - **Tier 1 (Critical)**: Role modifications, data deletions, GDPR exports (`maxAgeSeconds: 180`).
   - **Tier 2 (Sensitive)**: Verification overrides, user status updates (`maxAgeSeconds: 300`).
4. **Idempotency**: Mutations require an idempotency key resolved via `runWithIdempotency`.

### The Audit Log Contract

High-risk actions require a declarative audit contract. The `safeAction` config accepts an `auditLog` specifier that writes append-only logs _before_ completing the transaction:

```ts
auditLog: {
  operation: "DELETE_USER",
  resourceType: "user",
  getTargetId: (params) => params.userId,
  getDetails: (params) => ({ reason: params.reason }),
}
```

---

## 4. Environment Variables & Security Drift Guard

To prevent boundary violations and configuration drift, all environment variable access is restricted to [adminEnvConfig](src/lib/infrastructure/env.ts). Direct access to `process.env` in application code is strictly prohibited (checked by security drift scripts).

Run the security drift audits before compiling or pushing code:

```bash
# Check env contract integrity
pnpm run check-env-contract

# Audit codebase for process.env drift and illegal imports
pnpm run check-security-drift
```

---

## 5. Development & Testing

### Installation & Local Setup

The admin app is a workspace workspace within the Build Market monorepo.
To run the dev server locally:

```bash
# Run from repository root
pnpm --filter admin dev

# Or run directly inside apps/admin
pnpm dev
```

The dev server launches on [http://localhost:3005](http://localhost:3005).

### Test Topology & Verification

We use **Vitest** for all testing needs. The tests are structured based on their target:

1. **Action Boundary Tests**: Live in [**tests**/actions/](__tests__/actions/). They test unauthenticated rejections, forbidden capabilities, and session freshness errors.
2. **Domain Service & Repository Tests**: Live inside their respective domain directory `src/lib/domains/<slice>/__tests__/`.
3. **Security/Policy Tests**: Live in [**tests**/security/](__tests__/security/).

#### Run Tests

```bash
# Run all tests (pool forks, sequential safety for prisma/databases)
pnpm run test:all

# Run Vitest in watch mode
pnpm run test
```

### Pre-PR Checklist

Before opening a PR, ensure all quality control gates pass cleanly:

```bash
pnpm run check-types                  # TypeScript compilation checks
pnpm run lint                         # ESLint rules checking
pnpm run check-env-contract           # Environment schemas checking
pnpm run check-security-drift         # Raw process.env and direct DB check
pnpm run test:all                     # All test specs pass
```

Update [CHANGELOG.md](docs/CHANGELOG.md) to log your changes according to the `/changelog-documentation` guidelines.
