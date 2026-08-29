# 🛡️ Verification Operations Center (`apps/verification-ops`)

Monorepo-isolated Next.js compliance surface dedicated to statutory regulator license verification for professional registration boards in Kenya (`EBK`, `BORAQS`, `NCA`, `EARB`, `VRB`, `ISK`, `EPRA`).

---

## 🏛️ System Role & Architecture

The **Verification Operations Center** provides statutory verification workflows, four-eyes decision governance, and compliance audit log exports for statutory licenses submitted by built-environment professionals.

### **Core Monorepo Dependencies**

- **`@build/verification-domain`**: Domain models, status state machines, commands, and audit events.
- **`@build/db`**: Prisma schema, migrations (`RegulatorVerificationCase`, `RegulatorVerificationDecision`, `RegulatorVerificationEvidenceView`), and repositories.
- **`@build/enums`**: Shared monorepo enum definitions.

---

## 🔒 Security, Authorization & ADR Invariants

### 1. Clerk Satellite Authentication

This app is a **Clerk satellite** of `apps/client` (`buildmarket.app`), the platform's Clerk **primary** domain. Sign-in itself is never handled here:

| App                     | Role              | Domain                         | Auth Model                                                                 |
| :---------------------- | :---------------- | :----------------------------- | :------------------------------------------------------------------------- |
| `apps/client`           | Canonical Primary | `buildmarket.app`              | Hosts primary Clerk sign-in & issues the canonical session cookie          |
| `apps/admin`            | Satellite         | `admin.buildmarket.app`        | Delegated sign-in to `apps/client`; DB-driven `AdminProfile` authorization |
| `apps/verification-ops` | Satellite         | `verification.buildmarket.app` | Shared primary session; DB-driven `AdminProfile` verification permissions  |

Mechanics (mirrors `apps/admin`, see that app's `layout.tsx`/`middleware.ts` for the canonical writeup):

- `layout.tsx` configures `<ClerkProvider isSatellite domain signInUrl>` from `NEXT_PUBLIC_CLERK_IS_SATELLITE` / `NEXT_PUBLIC_CLERK_DOMAIN` / `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL`, and fails fast at boot if satellite mode is on without an absolute primary sign-in URL configured (an infinite-redirect-loop precondition, not something to degrade silently).
- `middleware.ts` redirects any unauthenticated, non-public request to the **primary's** sign-in URL with a `redirect_url` back to this app — not to a local sign-in page.
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx` no longer renders a `<SignIn />` form. It exists only as a safety net for direct navigation (bookmarks, the client-app shadow-mode banner) and immediately forwards to the primary's sign-in, preserving query params.
- **`syncOnLoad` is intentionally left at Clerk's default (`false`)**, not forced on. This is a low-traffic internal tool reached via a deliberate click (the shadow-mode banner, or a bookmark) rather than cold organic traffic, so there's no meaningful population of "arrived without a primary-domain handshake but already holds a session" visitors to justify the extra sync round trip on every load. Revisit if this surface ever gets cold/organic traffic.
- Non-satellite fallback: with `NEXT_PUBLIC_CLERK_IS_SATELLITE=false` (or unset), the app still works standalone against a local Clerk test instance — useful for local dev without a running `apps/client`.

### 2. Default-Deny Access Control (`lib/auth.ts`)

Access to this operational surface is governed by a strict default-deny permission engine, **separate from and layered on top of** the satellite authentication above — Clerk's `isSatellite` config only establishes _who_ the request is, never _what_ they're allowed to do here:

- User identity is resolved via Clerk `auth()`.
- Active database `AdminProfile` (`isActive: true`) is **mandatory**.
- **Role Mapping Allow-List:**

  | Admin Role           | Verification Capability Role      | Permissions                                                                            |
  | :------------------- | :-------------------------------- | :------------------------------------------------------------------------------------- |
  | `SUPER_ADMIN`        | `VERIFICATION_COMPLIANCE_OFFICER` | Decision Recording, Four-Eyes Senior Approval, Unredacted Evidence View, Packet Export |
  | `OPS_ADMIN`          | `VERIFICATION_SENIOR_REVIEWER`    | Decision Recording, Four-Eyes Senior Approval, Packet Export                           |
  | `VERIFICATION_ADMIN` | `VERIFICATION_REVIEWER`           | Decision Recording                                                                     |
  | `AUDITOR`            | `VERIFICATION_COMPLIANCE_OFFICER` | Read-only Evidence View & Packet Export (Cannot Record Decisions)                      |
  | _Other / Unmapped_   | `null` (Access Denied)            | Renders Access Denied card with Sign-Out trigger                                       |

- `middleware.ts`'s satellite gate is defense-in-depth on top of (not a replacement for) this — it only guarantees no route is reachable fully signed-out; it has no knowledge of roles or `AdminProfile.isActive`.

### 3. Fail-Fast Environment Strategy (`ADR-004`)

- Environment configuration is validated at server startup via `instrumentation.ts` calling `validateEnv()`.
- **Server-Only Isolation:** Secrets such as `CLERK_SECRET_KEY` and `DATABASE_URL` must **never** receive the `NEXT_PUBLIC_` prefix.

---

## 🏛️ Regulator Authorities & Verification Case Pipeline

### Supported Statutory Authorities

- **EBK**: Engineers Board of Kenya
- **BORAQS**: Board of Registration of Architects and Quantity Surveyors
- **NCA**: National Construction Authority
- **EARB**: Estate Agents Registration Board
- **VRB**: Valuers Registration Board
- **ISK**: Institution of Surveyors of Kenya
- **EPRA**: Energy and Petroleum Regulatory Authority

### Case Status State Machine

`QUEUED` ➔ `PROCESSING` ➔ (`AUTO_VERIFIED` | `AUTO_REJECTED` | `NEEDS_MANUAL_REVIEW` | `LOW_CONFIDENCE` | `REGULATOR_UNAVAILABLE`) ➔ (`MANUALLY_VERIFIED` | `MANUALLY_REJECTED` | `DEAD_LETTER`)

---

## 🚀 Local Development & Onboarding

### 1. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure local environment variables in `.env.local`:

```env
# Clerk Test Instance (Shared across local dev apps)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in

# Satellite config — leave IS_SATELLITE=false to run this app standalone
# locally without apps/client running. Set to true (and fill in the two
# vars below) to test the full satellite handoff against a local
# apps/client instance.
NEXT_PUBLIC_CLERK_IS_SATELLITE=false
NEXT_PUBLIC_CLERK_DOMAIN=verification.buildmarket.app
NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL=https://accounts.buildmarket.app/sign-in

# Staging/Dev PostgreSQL Connection
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/buildmarket_dev?schema=public"

# App Base URL
NEXT_PUBLIC_VERIFICATION_OPS_URL=http://localhost:3501
```

> ⚠️ **SECURITY INVARIANT:** Never commit real `sk_test_...` or `DATABASE_URL` secrets to git. Real secrets live in gitignored `.env.local`; synthetic test placeholders live in committed `.env.test`.
> ⚠️ **SATELLITE INVARIANT:** If `NEXT_PUBLIC_CLERK_IS_SATELLITE=true`, `NEXT_PUBLIC_CLERK_PRIMARY_SIGN_IN_URL` **must** be an absolute URL pointing at the primary app (`apps/client`), never a relative path — `layout.tsx` throws at boot if it's missing, and a relative value here is exactly the misconfiguration that causes an infinite redirect loop in production.

### 2. Grant Local Admin Privileges

To grant your local Clerk account `SUPER_ADMIN` authorization:

```bash
pnpm -C packages/db tsx grant-admin.ts
```

### 3. Start Development Server

```bash
pnpm --filter verification-ops dev
```

The application will be available at **`http://localhost:3501`**.

---

## 🧪 Testing & Quality Assurance

- **Run Unit Tests (Vitest + `.env.test`):**

  ```bash
  pnpm --filter verification-ops test
  ```

- **Type Check (`tsc --noEmit`):**

  ```bash
  pnpm --filter verification-ops check-types
  ```

- **Linting (ESLint + `@build/eslint-config`):**

  ```bash
  pnpm --filter verification-ops lint
  ```
