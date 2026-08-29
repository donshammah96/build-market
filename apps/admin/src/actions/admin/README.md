# src/actions/admin — Action Layer Structure

## Flat-File Rule

Domain action files are **flat `.ts` files** by default:

```text
actions/admin/
├── users.ts
├── verification.ts
├── stores.ts
├── properties.ts
├── leads.ts
├── professionals.ts
├── projects.ts
├── settings.ts
├── analytics.ts
├── audit.ts
├── dashboard.ts
└── ...
```

A domain action file splits into a named sub-directory **only** when it exceeds ~400 lines and contains logically separable sub-domains. When splitting:

- Create `<domain>/index.ts` as the barrel
- Name sub-files `<domain>/<sub-domain>.ts`
- Export everything through the barrel so callers do not need to change

## Why Some Sub-Directories Are Exempt

The following sub-directories contain **Next.js App Router HTTP route handlers** (`route.ts`), not domain action files. App Router requires each HTTP endpoint to live in its own directory named after the URL segment, with the handler in a file called `route.ts`. These **cannot** be collapsed to flat files without changing the URL surface:

| Directory                    | URL served                                 | Handler type  |
| ---------------------------- | ------------------------------------------ | ------------- |
| `compliance/`                | `POST /api/admin/compliance`               | Route handler |
| `compliance/queue-status/`   | `GET /api/admin/compliance/queue-status`   | Route handler |
| `pending-verifications/`     | `GET /api/admin/pending-verifications`     | Route handler |
| `verification-details/[id]/` | `GET /api/admin/verification-details/[id]` | Route handler |
| `verification-stats/`        | `GET /api/admin/verification-stats`        | Route handler |
| `verify/`                    | `POST /api/admin/verify`                   | Route handler |
| `verify-document/`           | `POST /api/admin/verify-document`          | Route handler |
| `verify-professional/`       | `POST /api/admin/verify-professional`      | Route handler |

These are legacy routes from the pre-`safeAction` era. New HTTP endpoints should be added as server actions in flat `.ts` files under this directory. The legacy route handlers remain because they serve active API clients.

> **See also:** `ARCHITECTURE-AUTOPSY.md` I-14 / F-S2 for the original finding and this constraint rationale.

## Core Infrastructure

```text
_core/
├── safe-action.ts         ← safeAction, SafeActionOptions, AdminPermissions
├── actor-resolver.ts      ← resolveAdminActor (private to _core)
├── audit.ts               ← recordDeclarativeAudit (private to _core)
├── client-api.ts          ← callClientApi, ClientApiOptions
├── permissions.ts         ← getAdminPermissions
└── validation.ts          ← parseActionInput (shared parser)
```

Import from `@/actions/admin` (the barrel `index.ts`) — not directly from sub-files.
