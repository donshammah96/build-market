# Plan Document Reviewer Checklist

Use this checklist when evaluating an implementation plan before execution.

**Purpose:** Verify the plan is complete, aligns with Tier 0 ADRs, and has bite-sized test-driven task decomposition.

## Plan Review Checklist

### 1. Architectural & Tier Alignment

- [ ] **Thin Routes (`apps/client` ADR-002):** Routes only handle auth, Zod validation, rate limiting, and response shaping. No inline business logic.
- [ ] **Domain Services & Repositories (`apps/client` ADR-003):** Business logic is in `app/lib/domains/<slice>/service.ts`. Repositories are persistence-only.
- [ ] **Admin Actions (`apps/admin` ADR-ADMIN-001, ADR-ADMIN-002):** All mutations use `safeAction`. No direct Prisma in action files. Uses `.safeParse()`.
- [ ] **Admin Capabilities & Audit (`apps/admin` ADR-ADMIN-001, ADR-ADMIN-008):** Capabilities resolved from `AdminProfile`. High-risk mutations specify declarative audit logs.
- [ ] **Env Access (ADR-004, ADR-ADMIN-006):** No raw `process.env`. Uses `envConfig` / `adminEnvConfig`.

### 2. Task Decomposition & TDD

- [ ] **Bite-Sized Steps:** Each task has RED (failing test) -> GREEN (minimal code) -> VERIFY GREEN -> REFACTOR steps.
- [ ] **Exact File Paths:** All files have full relative paths (`apps/client/app/lib/domains/...`).
- [ ] **Interfaces Defined:** Consumed and produced function signatures and types are explicitly written out.
- [ ] **No Placeholders:** Zero "TBD", "TODO", "add validation later", or missing code snippets.

### 3. Verification Commands

- [ ] Plan includes exact Turborepo / pnpm verification commands (`pnpm run client:test:all`, `pnpm run admin:test:all`, `pnpm run admin:report-security-drift:strict`).

---

## Output Verdict

**Status:** `Approved` | `Requires Revision`

**Issues Found (if any):**

- [Task X]: [Specific violation of ADR or missing step] - [Why it matters]

**Recommendations:**

- [Advisory suggestions]
