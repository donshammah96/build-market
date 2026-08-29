# Client Dashboard API-to-Frontend — Changelog

Changelog for the client dashboard API architecture and dashboard page wiring.

---

## Summary

Introduced a full API-to-frontend architecture for the client dashboard: service layer, typed client, React Query hook, and dashboard page wired to live data.

---

## File Changelog

### `app/api/client/dashboard/route.ts`

| Change         | Description                                                                               |
| -------------- | ----------------------------------------------------------------------------------------- |
| **Refactored** | Replaced direct `ClientRepository` usage with `getClientDashboardData` from service layer |
| **Removed**    | `prisma` and `ClientRepository` imports                                                   |
| **Added**      | Import of `getClientDashboardData` from `@/lib/services/client-dashboard`                 |
| **Unchanged**  | Auth (`withAuth`), rate limiting, resilient execution, correlation ID, response shape     |

---

### `lib/services/client-dashboard.ts` _(new)_

| Change             | Description                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Added**          | Service layer for client dashboard data aggregation                                                          |
| **Exports**        | `getClientDashboardData(userId)`, `DashboardData`, `DashboardStats`, `DashboardProject`, `DashboardIdeaBook` |
| **Implementation** | Instantiates `ClientRepository` and delegates to `getDashboardData(userId)`                                  |
| **Dependencies**   | `../db` (prisma), `@/app/lib/repositories/client.repository`                                                 |

---

### `lib/client-dashboard-client.ts` _(new)_

| Change             | Description                                                                                                        |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Added**          | Client-side typed fetch wrapper for `/api/client/dashboard`                                                        |
| **Exports**        | `clientDashboardClient.getDashboard()`, `DashboardData`, `DashboardStats`, `DashboardProject`, `DashboardIdeaBook` |
| **Implementation** | `fetchJson<T>()` helper; returns `ApiResponse<DashboardData>` (`{ success, data }` or `{ success, error }`)        |
| **Dependencies**   | `@/lib/links` (API_ROUTES.clientDashboard), `@/lib/services/client-dashboard` (types)                              |

---

### `hooks/useClientDashboard.ts` _(new)_

| Change            | Description                                                   |
| ----------------- | ------------------------------------------------------------- |
| **Added**         | TanStack Query hook for client dashboard data                 |
| **Exports**       | `useClientDashboard()`, `clientDashboardKeys`                 |
| **Configuration** | `queryKey: ["client-dashboard"]`, `staleTime: 60_000` (1 min) |
| **Returns**       | `{ data, isLoading, error, refetch, ...query }`               |
| **Dependencies**  | `@tanstack/react-query`, `@/lib/client-dashboard-client`      |

---

### `lib/links.ts`

| Change       | Description                                           |
| ------------ | ----------------------------------------------------- |
| **Added**    | `API_ROUTES.clientDashboard: '/api/client/dashboard'` |
| **Location** | Under `API_ROUTES` (or equivalent API routes object)  |

---

### `app/(user)/dashboard/page.tsx`

| Change             | Description                                                                                                                                     |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Removed**        | Mock state (`useState` for `activeProject`, `ideaBooks`, `activities`), `useEffect` with 1s timeout                                             |
| **Added**          | `useClientDashboard()` hook; `formatDistanceToNow` from `date-fns`; `DashboardProject`, `DashboardIdeaBook` types                               |
| **Data flow**      | `dashboardData` from hook → `projects`, `ideaBooks`, `stats`, `activeProject` derived                                                           |
| **Active project** | First `IN_PROGRESS` or `PLANNING` project, else `projects[0]`; uses `PLACEHOLDER_IMAGE`; timeline shows `milestoneCount` and `estimatedEndDate` |
| **Idea books**     | `book.coverImage \|\| PLACEHOLDER_IMAGE`; `itemCount` from API                                                                                  |
| **Header**         | Dynamic copy from `stats.activeProjects`; fallback when no active projects                                                                      |
| **Professional**   | Avatar uses initials (no `avatar` in API); `professional.title` for role                                                                        |
| **Activity feed**  | Empty state when `activities.length === 0` (API does not yet return activities)                                                                 |
| **CTAs**           | Find Pros, New Project, Find a Pro, Create New Board link to `ROUTES.findProfessional`, `ROUTES.userProjects`, `ROUTES.ideaBooks`               |

---

## Architecture Flow

```
Dashboard Page (useClientDashboard)
    │
    └── clientDashboardClient.getDashboard()
            │
            └── GET /api/client/dashboard
                    │
                    └── getClientDashboardData(dbUserId)
                            │
                            └── ClientRepository.getDashboardData(userId)
                                    │
                                    └── Prisma
```

---

## Types (API Response Shape)

- **DashboardData**: `{ stats, projects, ideaBooks, savedProfessionals }`
- **DashboardStats**: `{ totalProjects, activeProjects, completedProjects, savedProfessionals, ideaBooks }`
- **DashboardProject**: `{ id, title, description, status, progress, budget, milestoneCount, professional, startDate, estimatedEndDate }`
- **DashboardIdeaBook**: `{ id, title, category, itemCount, attachmentCount, coverImage, updatedAt }`

---

## Notes

- Activity feed is placeholder; dashboard API does not yet return activities.
- Project images use `PLACEHOLDER_IMAGE`; API does not yet return project cover images.
