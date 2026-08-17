# Build Market Monorepo

Build Market is a high-performance, Turborepo-based monorepo powering a specialized construction and building marketplace platform in Kenya. It connects homeowners, construction professionals, materials suppliers, and regulatory bodies across verified end-to-end project lifecycles.

This document is the operational and architectural entrypoint for staff engineers, system operators, and contributors. It defines the workspace topology, architectural standards, development workflows, quality gates, deployment procedures, and incident response runbooks.

---

## Table of Contents

1. [System Architecture & Workspace Map](#1-system-architecture--workspace-map)
   - [Applications (`apps/*`)](#applications-apps)
   - [Shared Packages (`packages/*`)](#shared-packages-packages)
   - [Core Technology Stack](#core-technology-stack)
2. [Documentation Hierarchy & Governance](#2-documentation-hierarchy--governance)
   - [Authority Tier Map](#authority-tier-map)
   - [Conflict-Resolution Rules](#conflict-resolution-rules)
   - [Key Architecture Blueprints](#key-architecture-blueprints)
3. [Prerequisites & Workspace Toolchain](#3-prerequisites--workspace-toolchain)
4. [Local Development & Runtime Operations](#4-local-development--runtime-operations)
   - [Environment Provisioning](#environment-provisioning)
   - [Database & Seed Operations](#database--seed-operations)
   - [Starting Services](#starting-services)
   - [Local Endpoints Map](#local-endpoints-map)
5. [Quality Gates, Testing & Drift Enforcement](#5-quality-gates-testing--drift-enforcement)
   - [Standard Quality Gate Sequence](#standard-quality-gate-sequence)
   - [Full Local CI Pre-Flight](#full-local-ci-pre-flight)
   - [Security Drift & Contract Verification](#security-drift--contract-verification)
   - [Redis Health & Policy Governance](#redis-health--policy-governance)
6. [Architectural Invariants & Standards](#6-architectural-invariants--standards)
   - [Client Application (`apps/client`)](#client-application-appsclient)
   - [Admin Portal (`apps/admin`)](#admin-portal-appsadmin)
   - [Verification Operations (`apps/verification-ops`)](#verification-operations-appsverification-ops)
   - [Event Messaging Architecture (NATS JetStream)](#event-messaging-architecture-nats-jetstream)
7. [Environment & Secret Management](#7-environment--secret-management)
8. [Deployment & Release Engineering](#8-deployment--release-engineering)
   - [Build Pipelines](#build-pipelines)
   - [Zero-Downtime Migration Policy](#zero-downtime-migration-policy)
   - [Feature Flags & Rollback Controls](#feature-flags--rollback-controls)
9. [Incident Response & Operational Runbooks](#9-incident-response--operational-runbooks)
   - [Severity Classification & Response Targets](#severity-classification--response-targets)
   - [Triage & Mitigation Sequence](#triage--mitigation-sequence)
10. [Appendix A: On-Call Runbook (Strict)](#appendix-a-on-call-runbook-strict)
11. [Appendix B: Incident Documentation Templates](#appendix-b-incident-documentation-templates)

---

## 1. System Architecture & Workspace Map

The repository is structured as a monorepo managed by **Turborepo** and **pnpm** (with strict catalog versioning).

```text
build-market/
├── apps/
│   ├── client/              # Primary marketplace web app (Homeowners, Pros, Vendors) [Port 3500]
│   ├── admin/               # Internal administration portal with capability-based RBAC [Port 3005]
│   └── verification-ops/    # Regulatory verification operations console [Port 3501]
├── packages/
│   ├── auth-server/         # Server-side auth utilities & session validation
│   ├── clerk-test-harness/  # Deterministic test harness & mock helpers for Clerk
│   ├── db/                  # Prisma schema, client, migrations, and seed scripts
│   ├── enums/               # Canonical shared domain enums (roles, statuses, regulators)
│   ├── env-validation/      # Unified environment schema parsing and validation logic
│   ├── eslint-config/       # Monorepo-wide ESLint configurations
│   ├── mail-server/         # Email delivery abstraction (Resend / SMTP)
│   ├── messaging-server/    # Real-time WebSocket / chat server integrations
│   ├── nats/                # NATS JetStream event publishing, consuming & stream management
│   ├── queue-server/        # BullMQ background job queues, workers, and processor factories
│   ├── redis/               # Upstash & ioredis caching, rate limiting, and eviction policies
│   ├── resilience/          # Circuit breaker, retry mechanisms & resilient execution wrapper
│   ├── security-clerk/      # Clerk security integrations & session assertion helpers
│   ├── types/               # Monorepo shared TypeScript interfaces, DTOs & Zod schemas
│   ├── typescript-config/   # Base tsconfig presets across all workspaces
│   ├── ui/                  # Shared Radix UI component library and design tokens
│   └── verification-domain/ # Domain state machines and regulatory API integrations (EBK, BORAQS, NCA)
├── pnpm-workspace.yaml       # Workspace definition with strict catalog dependency pinning
└── turbo.json               # Pipeline task execution and caching declarations
```

### Applications (`apps/*`)

| Application                 | Port   | Runtime / Framework                                 | Operational Ownership & Target Audience                                                                                                                                             |
| :-------------------------- | :----- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`apps/client`**           | `3500` | Next.js 16 (Turbopack / OpenNext Cloudflare Worker) | Consumer-facing portal for homeowners, contractors, architects, vendors, and suppliers. Manages onboarding, catalog, project coordination, secure payments, messaging, and reviews. |
| **`apps/admin`**            | `3005` | Next.js 16 (`src/` layout)                          | Internal platform operators, trust & safety, finance teams, and system administrators. Employs `safeAction` mutation flows and capability-based authorization.                      |
| **`apps/verification-ops`** | `3501` | Next.js 16                                          | Regulatory compliance operators verifying credentials with Kenya statutory boards (EBK, BORAQS, NCA, EARB, VRB, ISK, EPRA).                                                         |

### Shared Packages (`packages/*`)

All internal libraries are packaged under the `@build/*` namespace:

- **`@build/db`**: Canonical Prisma schema, database client instance, soft-delete filtering conventions, and database migrations.
- **`@build/types`**: Shared domain types, network boundary DTO contracts, and Zod schemas.
- **`@build/enums`**: Single source of truth for platform enums (user roles, verification status, Kenyan counties, project milestones).
- **`@build/resilience`**: Distributed resilient execution primitive (`getResilientExecutor()`) incorporating timeouts, retries, and circuit breakers.
- **`@build/nats`**: High-throughput JetStream messaging producer/consumer framework for cross-service events.
- **`@build/redis`**: Redis connection pooling, rate limiters, and memory eviction enforcement.
- **`@build/queue-server`**: BullMQ async workers for background heavy processing (document watermarking, report exports, OCR processing).
- **`@build/verification-domain`**: Regulatory verification state machines and external statutory API clients.
- **`@build/ui`**: Radix UI-based accessible component library styled with Tailwind CSS.
- **`@build/env-validation`**: Zero-dependency environment variable schema parsers.
- **`@build/auth-server`** & **`@build/security-clerk`**: Identity assertion, session freshness guards, and Clerk integration.

### Core Technology Stack

- **Runtime & Toolchain:** Node.js `24.x`, pnpm `11.1.2`, Turborepo `^2.10`, TypeScript `^7.0` (with TS 6 tooling compat)
- **Frontend & App Frameworks:** Next.js `16.2.11` (App Router), React `^19.1.0`, Tailwind CSS `^4.0`, Framer Motion
- **State & Data Fetching:** TanStack React Query `^5.90`, Zustand
- **Persistence & Caching:** PostgreSQL (via Prisma `^7.6`), Redis (Upstash / ioredis `5.11`)
- **Messaging & Event Streaming:** NATS JetStream `^2.19`, BullMQ `^5.76`
- **Identity & Auth:** Clerk (`@clerk/nextjs` `^7.3`, `@clerk/backend` `^3.4`)
- **Telemetry & Observability:** OpenTelemetry (OTLP gRPC), Pino structured logging, PostHog

---

## 2. Documentation Hierarchy & Governance

To maintain architectural integrity across teams and automated coding agents, the repository follows a strict multi-tier document hierarchy governed by [`.agent/DOCUMENT-HIERARCHY.md`](.agent/DOCUMENT-HIERARCHY.md).

### Authority Tier Map

```text
┌─────────────────────────────────────────────────────────────┐
│  TIER 0 — Decision Rationale (Immutable ADRs)              │
│  apps/client/docs/adr/ADR-001 through ADR-009               │
│  apps/admin/docs/adr/ADR-ADMIN-001 through ADR-ADMIN-009    │
│  → Defines fundamental architectural decisions & invariants │
└─────────────────────────────────────────────────────────────┘
                            │ governs
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 1 — Current Law (Canonical Rules)                     │
│  .github/copilot-instructions.md                            │
│  .agent/API-TO-FRONTEND-ARCHITECTURE.md (apps/client canon) │
│  .agent/ADMIN-ARCHITECTURE.md (apps/admin canon)            │
│  → Rules read and enforced before writing code              │
└─────────────────────────────────────────────────────────────┘
                            │ informs
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2 — Execution Lenses (Derived Prompts)                │
│  .github/prompts/staff-architecture-lens.prompt.md          │
│  .github/prompts/ui-implementation-standard.prompt.md       │
│  → Review checklists and audit contracts                    │
└─────────────────────────────────────────────────────────────┘
                            │ references
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 3 — Slice-Local Documentation                         │
│  apps/*/docs/PROGRESS-SUMMARY.md, CHANGELOG.md, DEFECTS.md  │
│  → Implementation detail scoped to a single domain/slice    │
└─────────────────────────────────────────────────────────────┘
```

### Conflict-Resolution Rules

When documents disagree, resolve top-to-bottom:

1. **Higher Tier Wins:** `Tier 0 (ADR) > Tier 1 (Rules) > Tier 2 (Prompts) > Tier 3 (Slice Docs)`.
2. **Narrower Scope Wins within Same Tier:** Specific app architecture guides override repo-wide defaults for that application.
3. **Stricter Rule Wins:** If scopes and tiers match, the stricter architectural boundary or security invariant governs.
4. **Drift Protocol:** Never encode workarounds or in-code comments that bypass higher-tier rules. Surface drift explicitly.

### Key Architecture Blueprints

- **Client Architecture Guide:** [`.agent/API-TO-FRONTEND-ARCHITECTURE.md`](.agent/API-TO-FRONTEND-ARCHITECTURE.md)
- **Admin Architecture Guide:** [`.agent/ADMIN-ARCHITECTURE.md`](.agent/ADMIN-ARCHITECTURE.md)
- **Repo-Wide Instructions:** [`.github/copilot-instructions.md`](.github/copilot-instructions.md)
- **Admin Defect Registry:** [`apps/admin/docs/DEFECTS.md`](apps/admin/docs/DEFECTS.md)
- **Admin Feature Flag & Rollback Contracts:** [`apps/admin/docs/ROLLBACK-CONTRACTS.md`](apps/admin/docs/ROLLBACK-CONTRACTS.md)

---

## 3. Prerequisites & Workspace Toolchain

- **Node.js:** `24.x` (LTS recommended)
- **pnpm:** `>=11.1.2 <12.0.0` (managed via `packageManager: pnpm@11.1.2`)
- **Docker & Docker Compose:** Required for running local PostgreSQL, Redis, and NATS instances.

Ensure `corepack` is enabled or `pnpm` is installed matching the workspace version:

```bash
corepack enable
node --version   # Must be v24.x
pnpm --version   # Must be 11.1.2
```

> **Dependency Catalog Note:** All multi-package dependencies are pinned in `pnpm-workspace.yaml` under `catalog:`. Always reference catalog versions (`catalog:`) in `package.json` rather than arbitrary semver strings.

---

## 4. Local Development & Runtime Operations

### Environment Provisioning

Copy the root template and populate required keys:

```bash
cp .env.example .env
```

Ensure environment files exist in individual apps if overriding local configurations (`apps/client/.env.local`, `apps/admin/.env.local`).

### Database & Seed Operations

Run migrations and generate the Prisma Client:

```bash
# Apply pending Prisma migrations
pnpm run db:migrate:deploy

# Generate Prisma Client types
pnpm run db:generate

# (Optional) Seed development database with initial fixture data
pnpm run db:seed
```

### Local Infrastructure (Docker Compose)

Start local PostgreSQL, Redis (noeviction), and NATS JetStream services:

```bash
# Start all local infrastructure containers in background
pnpm run docker:up

# Stop all local infrastructure containers
pnpm run docker:down
```

### Starting Services

Start the development runtime using Turbo filtering:

```bash
# Start all apps, workers, and watchers across the monorepo
pnpm run dev

# Start specific applications
pnpm run dev:client            # Client app on http://localhost:3500
pnpm run dev:admin             # Admin portal on http://localhost:3005
pnpm run dev:verification-ops  # Verification Ops on http://localhost:3501
pnpm run dev:workers           # Background worker daemon on http://localhost:8080

# Start both frontends simultaneously (Client + Admin)
pnpm run dev:frontend
```

### Local Endpoints Map

| Surface                 | URL                             | Authentication Boundary                                |
| :---------------------- | :------------------------------ | :----------------------------------------------------- |
| **Marketplace Client**  | `http://localhost:3500`         | Clerk User Session (`withAuth`, `DomainActor`)         |
| **Admin Portal**        | `http://localhost:3005`         | Clerk + DB `AdminProfile` (`safeAction`, `AdminActor`) |
| **Verification Ops**    | `http://localhost:3501`         | Clerk Verification Admin Role                          |
| **Worker Health Probe** | `http://localhost:8080/healthz` | Unauthenticated HTTP Health / Liveness Probe           |

---

## 5. Quality Gates, Testing & Drift Enforcement

Quality gates are non-negotiable. Every change must pass static analysis, type checking, security drift scans, environment contracts, and unit/contract test suites.

### Standard Quality Gate Sequence

```bash
# Fast local lint, format, typecheck, and unit test pass
pnpm run validate
```

Equivalent granular commands:

```bash
pnpm run format:check     # Prettier formatting check
pnpm run lint             # Turbo-orchestrated ESLint sweep
pnpm run check-types       # TypeScript typecheck across all apps/packages
pnpm run test              # Vitest test run
```

### Full Local CI Pre-Flight

Before opening a pull request or pushing to `main`, run the local CI simulation matching remote CI:

```bash
pnpm run ci:local
# Or with frozen lockfile check:
pnpm run ci:local:full
```

### Security Drift & Contract Verification

The repository employs automated contract and drift verification scripts to catch boundary violations:

```bash
# Client App Drift & Contracts
pnpm run client:check-env-contract       # Verifies all env reads go through canonical env boundary
pnpm run client:check-security-drift      # Validates log safety, CORS, browser persistence & lint
pnpm run client:report-security-drift:strict # Fails if any unclassified security drift exists

# Admin Portal Drift & Governance
pnpm run admin:check-env-contract        # Verifies adminEnvConfig boundary
pnpm run admin:check-security-drift       # Enforces safeAction & capability usage
pnpm run admin:check-governance           # Audits ADR compliance and architectural rules
pnpm run admin:report-security-drift:strict

# Verification Ops Checks
pnpm run verification-ops:check-all      # Types, env contracts, and security drift
```

### Redis Health & Policy Governance

```bash
pnpm run redis:audit            # Audit Redis keyspace and prefixes
pnpm run redis:healthcheck      # Ping and verify Redis connection
pnpm run redis:enforce-policy   # Verify maxmemory eviction policies
```

---

## 6. Architectural Invariants & Standards

### Client Application (`apps/client`)

1. **Layer Structure:**
   - **`app/api/**`**: Thin HTTP adapters only (auth resolution, rate-limiting, Zod schema validation, resilient execution, response envelope mapping).
   - **`app/actions/**`**: Server Action mutation adapters wrapped in `secureAction`.
   - **`app/lib/domains/<slice>/service.ts`**: Canonical home for business logic, actor-aware authorization, and orchestration. Returns `Result<T, DomainError>`.
   - **`app/lib/domains/<slice>/repository.ts`**: Persistence-only layer interacting with `@build/db`. No role checks, no HTTP concepts, no user strings.
   - **`lib/facades/<domain>/<name>-client.ts`**: Network boundary client calling `/api/**`.
   - **`lib/facades/<domain>/use<Name>.ts`**: Domain React Query hooks colocated with facades.
2. **Actor Model:** Authorization-sensitive domain operations require a typed `DomainActor` or `MarketplaceActor` from `app/lib/domains/shared/contracts.ts` (never bare user IDs).
3. **Canonical Result Pattern:** Import `Result`, `DomainError`, `ok()`, `err()` exclusively from `@/app/lib/errors/result`. Discriminant is `ok: true | false`.
4. **Canonical Env Access:** All runtime `process.env` reads must go through `app/lib/infrastructure/env.ts` (ADR-004). Direct reads outside bootstrap files are prohibited.
5. **Structured Observability (ADR-005):** Route and action adapters log structured events with `correlationId`, `operationName`, `outcome`, and `durationMs`. **PII logging is strictly prohibited** (no emails, phone numbers, national IDs, or raw payload bodies).
6. **Data Classification (ADR-006):** DTOs crossing network boundaries must classify fields (Class A: Restricted PII, Class B: Operational PII, Class C: Internal Business, Class D: Public).

### Admin Portal (`apps/admin`)

1. **`safeAction` Mutation Model (ADR-ADMIN-002):** All admin mutations go through `safeAction` which validates Clerk identity, resolves the DB `AdminProfile`, authorizes against `AdminCapability` maps, and enforces session freshness windows.
2. **Admin Auth & Capabilities (ADR-ADMIN-001):** Role checks cannot rely on Clerk session claims. `adminRole` is resolved from database state. Raw role-string comparisons are prohibited; use `hasCapability(actor, capability)`.
3. **Session Freshness:**
   - **Tier 1 (High Risk - Max 180s):** Role alterations, user suspension/deletion, financial payouts, data exports.
   - **Tier 2 (Operational - Max 300s):** Verification status overrides, account transitions.
4. **Declarative Audit Logs (ADR-ADMIN-008):** High-risk operations require declarative `auditLog` parameters in `safeAction`. Written append-only before returning success.
5. **Admin Env Boundary (ADR-ADMIN-006):** All env access routed through `adminEnvConfig` from `src/lib/infrastructure/env.ts`.
6. **Strangler-Fig Rollouts (ADR-ADMIN-009):** New admin features ship behind typed `AdminFeatureFlag` values with documented rollback contracts.

### Verification Operations (`apps/verification-ops`)

1. Handles regulatory ingestion, document verification queues, and external registrar synchronization (EBK, BORAQS, NCA).
2. Maintains strict isolation from customer-facing client logic to protect regulatory compliance integrity.

### Event Messaging Architecture (NATS JetStream)

Cross-service and asynchronous workflows prefer NATS JetStream eventing (`@build/nats`) over direct point-to-point HTTP coupling.

- Producers emit strongly-typed domain events with correlation IDs.
- Consumers run with explicit stream acknowledgment and dead-letter handling.

---

## 7. Environment & Secret Management

Environment configuration is managed through Zod-validated infrastructure modules.

### Key Environment Variable Categories

- **Core Runtime:** `NODE_ENV`, `APP_URL`, `NEXT_PUBLIC_APP_URL`
- **Database & Pooling:** `DATABASE_URL`, `POSTGRES_URL`, `DIRECT_URL`
- **Authentication & Clerk:** `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET`, `INTERNAL_API_SECRET`
- **Redis & Caching:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `REDIS_URL`
- **Event Messaging:** `NATS_URL`, `NATS_TOKEN`, `NATS_USER`, `NATS_PASS`
- **Object Storage (S3 / Cloudflare R2):** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `AWS_REGION`, `STORAGE_BUCKET`
- **Regulatory Secrets:** `REGULATOR_EBK_API_KEY`, `REGULATOR_BORAQS_API_KEY`, `REGULATOR_NCA_API_KEY`
- **Observability:** `OTEL_EXPORTER_OTLP_ENDPOINT`, `NEXT_PUBLIC_POSTHOG_KEY`

### Security Rules

- **Zero Secrets in Git:** Never commit `.env`, `.env.local`, or secret tokens.
- **Fail-Closed Env Validation:** Applications fail fast at startup if required variables fail schema validation.
- **Rotation:** Secrets suspected of exposure or subject to staff offboarding must be rotated immediately using designated rotation scripts (`pnpm run rotate:keys`).

---

## 8. Deployment & Release Engineering

### Build Pipelines

```bash
# Full workspace build
pnpm run build

# Targeted application builds
pnpm run build:client
pnpm run build:admin
pnpm run build:verification-ops

# Cloudflare Worker deployment for client
pnpm run client:build:cloudflare-worker
pnpm run client:deploy:cloudflare-worker
```

### Zero-Downtime Migration Policy

1. **Expand-Contract Strategy:** Schema changes must be backward-compatible with the currently running application version.
   - _Phase 1 (Expand):_ Add optional columns/tables, deploy migration.
   - _Phase 2 (Dual-Write/Read):_ Deploy new application code supporting both old and new schema shapes.
   - _Phase 3 (Contract):_ Remove old columns in a subsequent release once all consumers are upgraded.
2. **Down-Migration Warning:** Down migrations are treated as high-risk operations that can cause data loss. Favor forward-fixing over rollbacks when database schemas are involved.

### Feature Flags & Rollback Controls

- Client features use environment/runtime feature toggles defined in `turbo.json`.
- Admin features use `AdminFeatureFlag` constants in `apps/admin/src/lib/feature-flags.ts`.
- Rollbacks are executed primarily by flipping feature flags to false without requiring full binary redeployments (see [`apps/admin/docs/ROLLBACK-CONTRACTS.md`](apps/admin/docs/ROLLBACK-CONTRACTS.md)).

---

## 9. Incident Response & Operational Runbooks

### Severity Classification & Response Targets

| Severity  | Definition & Impact                                                                                       | Response SLA | Mitigation SLA | Update Cadence   |
| :-------- | :-------------------------------------------------------------------------------------------------------- | :----------- | :------------- | :--------------- |
| **Sev 1** | Production outage, active data corruption risk, payment processing failure, or security compromise.       | **5 min**    | **30 min**     | Every **15 min** |
| **Sev 2** | Significant feature degradation (e.g. search down, verification queue stalled) with available workaround. | **10 min**   | **2 hrs**      | Every **30 min** |
| **Sev 3** | Minor localized bug or non-blocking UI defect affecting limited users.                                    | **30 min**   | Next Sprint    | Every **60 min** |

### Triage & Mitigation Sequence

1. **Detect & Acknowledge:** Incident Commander (IC) acknowledges page and opens dedicated incident channel/doc.
2. **Stabilize (Mitigation First):**
   - Flip offending Feature Flags to `false`.
   - Revert application deployment to last known good artifact if release-related.
   - Enable traffic throttling or rate-limiting if dependency saturation occurs.
3. **Isolate Root Cause:** Only investigate deep root cause after user-facing symptoms are stabilized.
4. **Postmortem SLA:** Complete postmortem draft within 24h (Sev 1) or 48h (Sev 2).

---

## Appendix A: On-Call Runbook (Strict)

This appendix is prescriptive. In an active Sev 1/Sev 2 incident, follow this procedure and log all timestamps in UTC.

### A1. Incident Roles

- **Incident Commander (IC):** Directs triage, assigns tasks, authorizes rollbacks/freezes, and approves external communications.
- **Primary On-Call:** First responder; leads debugging and mitigation implementation.
- **Secondary On-Call:** Assists with parallel investigations and telemetry log forensics.
- **Scribe:** Maintains the real-time incident document, records decisions, and tracks action owners.

### A2. Communication Broadcast Template

```text
[INCIDENT STATUS UPDATE]
Incident ID: INC-XXXX
Severity: Sev 1 | Sev 2 | Sev 3
Status: Investigating | Mitigating | Monitoring | Resolved
Impact: <Clear statement of customer or system impact>
Mitigation In Flight: <Action being executed, e.g. disabling flag FEATURE_PORTAL_PROJECTS_V2>
Owner: <Name>
Next Update: YYYY-MM-DD HH:MM UTC
```

### A3. Incident Freeze Policy

- Deployments to impacted services are frozen immediately upon declaration of a Sev 1 or Sev 2.
- Schema migrations during an incident require explicit IC approval.

---

## Appendix B: Incident Documentation Templates

### B1. Postmortem Template

```markdown
# Incident Postmortem: [Incident ID / Title]

## 1. Metadata

- **Date (UTC):** YYYY-MM-DD
- **Severity:** Sev 1 / Sev 2
- **Duration:** XX minutes (Detection to Resolution)
- **Incident Commander:** @name
- **Lead Investigator:** @name
- **Impacted Services:** `apps/client`, `packages/db`, etc.

## 2. Executive Summary

Brief non-technical description of what failed, customer impact, and how it was mitigated.

## 3. Impact Analysis

- Total impacted requests / transactions:
- Financial or regulatory impact:
- Data integrity impact (Any data loss or corruption?):

## 4. Root Cause (5 Whys)

1. Why did the service fail? -> ...
2. Why did that happen? -> ...
3. Why was that not detected in staging? -> ...
4. Why did our telemetry not catch it earlier? -> ...
5. Why did our policy allow it? -> ...

## 5. Timeline (UTC)

| Time (UTC) | Event Description                           | Owner        | Evidence Link |
| :--------- | :------------------------------------------ | :----------- | :------------ |
| HH:MM      | Alert fired for elevated 5xx error rate     | Alertmanager | Link          |
| HH:MM      | IC declared Sev 1 and froze deployments     | @name        | Slack         |
| HH:MM      | Mitigation executed (Feature flag disabled) | @name        | Dashboard     |
| HH:MM      | Error rates normalized; recovery confirmed  | @name        | Grafana       |

## 6. What Went Well / What Went Poorly

- **Went Well:** Fast mitigation via feature flag; no data loss.
- **Went Poorly:** Alert threshold took 7 minutes to trigger.

## 7. Action Items & Preventative Measures

| Action Item                           | Type (Corrective/Preventative) | Owner  | Priority | Target Date |
| :------------------------------------ | :----------------------------- | :----- | :------- | :---------- |
| Add synthetic healthcheck for route X | Preventative                   | @dev   | P0       | YYYY-MM-DD  |
| Update ADR-XXX to restrict pattern Y  | Governance                     | @staff | P1       | YYYY-MM-DD  |
```

---

## License

Private and proprietary. All rights reserved. Build Market Kenya.
