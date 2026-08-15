---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work
---

# Finishing a Development Branch

## Overview

Update root & app changelogs → Craft staff-level signed commit → Verify tests & signatures → Detect environment → Present integration options → Execute choice → Clean up worktree.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

---

## Step 0: Update Root and App-Specific Changelogs & Documentation

Before crafting the commit and running validation, document all changes across the root repository and any touched applications:

### 1. Root Changelog (`CHANGELOG.md`)

Update `CHANGELOG.md` at the repository root under the `## [Unreleased]` section:

- `### Added`: For new features, domain slices, components, or endpoints.
- `### Changed`: For modifications to existing behavior, refactors, or architectural upgrades.
- `### Fixed`: For bug fixes and error handling corrections.
- `### Security`: For security patches, auth hardening, or audit log implementations.

### 2. Touched / Implemented Apps & Packages Documentation

Update the dedicated documentation for each touched workspace app or package:

- **`apps/client`:**
  - Update `apps/client/docs/CHANGELOG.md` with slice-level and facade changes.
- **`apps/admin`:**
  - Update `apps/admin/docs/CHANGELOG.md` with action, capability, or domain changes.
  - If milestones or slice completions were achieved, update `apps/admin/docs/PROGRESS-SUMMARY.md`.
- **`apps/verification-ops`:**
  - Update `apps/verification-ops/docs/CHANGELOG.md`.
- **Touched Packages (`packages/<package-name>/`):**
  - Update `packages/<package-name>/docs/CHANGELOG.md` under `## [Unreleased]` with exported API, schema, or contract changes.
  - Update `packages/<package-name>/docs/PROGRESS-SUMMARY.md` if module compliance status, tier invariants, or testing coverage changed.
- **Agent Skills (`.agents/skills/*`):**
  - Update skill documentation when workflows or guidelines are modified.

---

## Step 1: Craft Staff-Level Commit Message & Commit (Signed)

Compose a structured, staff-level commit message that explains **context, architectural rationale, and verification proof**.

### 1. Staff Commit Message Standards

- **Header Format:** `<type>(<scope>): <concise imperative summary (max 72 chars)>`
  - **Types:** `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`
  - **Scopes:** `client`, `admin`, `db`, `nats`, `redis`, `verification-ops`, `shared`, `skills`
- **Body Structure:**
  - **Context & Why:** What problem or business requirement prompted this change?
  - **Architectural Fit & Invariants:** Which ADRs are satisfied? (e.g. `ADR-001`, `ADR-002`, `ADR-ADMIN-001`, `ADR-ADMIN-008`). What layer boundaries are preserved?
  - **Key Changes:** Concise bullet points detailing modifications across files.
  - **Verification:** Explicit proof of passed tests and drift checks.

### 2. Staff Commit Message Template

```text
<type>(<scope>): <short summary>

### Why
[1-2 sentences explaining root problem, business motivation, or system goal]

### Architectural Alignment
- Enforces [ADR-XXX / boundary requirement]
- Layer impacts: [e.g. Presentation thin route -> Domain service -> Repository]
- Invariants maintained: [e.g. safeAction capability checks, no PII logging, idempotent mutations]

### Key Changes
- [Slice/File 1]: [Summary of changes]
- [Slice/File 2]: [Summary of changes]
- [Docs/Changelogs]: Updated root and touched app changelogs

### Verification
- pnpm run validate (workspace versions, deps audit, format, lint, check-types, tests)
- pnpm run admin:report-security-drift:strict
- pnpm run client:report-security-drift:strict
```

### 3. Execute Signed Commit

```bash
git add -A
git commit -S -m "<type>(<scope>): <short summary>" -m "$(cat <<'EOF'
### Why
[Explanation]

### Architectural Alignment
- Enforces [ADR]

### Key Changes
- [Changes]
- Updated root and app changelogs

### Verification
- pnpm run validate (0 errors, all tests green)
EOF
)"
```

---

## Step 2: Run Full Verification Suite & Signature Check

Before presenting integration options, all relevant test suites, typechecks, security drift checks, and commit signatures must pass:

### 1. Workspace Validation & Security Drift Checks

```bash
# Run full workspace validation (workspace versions, dependency audits, format, lint, typecheck, tests)
pnpm run validate

# Security drift checks
pnpm run admin:report-security-drift:strict
pnpm run verification-ops:report-security-drift:strict
pnpm run client:report-security-drift:strict
```

### 2. Verified Commit Check (OpenPGP)

Ensure all branch commits are signed with the configured OpenPGP key:

```bash
git log -1 --show-signature
```

Confirm that the latest commit outputs `gpg: Good signature from ...`.

**If any validation or signature check fails:** Stop and resolve the failure before presenting the integration menu.

---

## Step 3: Detect Environment & Base Branch

1. Determine if running inside a `.worktrees/` directory:

   ```bash
   WORKTREE_PATH=$(git rev-parse --show-toplevel)
   ```

2. Determine base branch (usually `main` or the parent feature branch).

---

## Step 4: Present Integration Options

Present exactly these 3 options to the user:

```text
All tests, typechecks, and commit signatures verified. What would you like to do with branch <branch-name>?

1. Merge back to <base-branch> locally and clean up worktree
2. Push to remote and prepare Pull Request
3. Keep the branch as-is (I'll handle it later)

Which option?
```

---

## Step 5: Execute Choice

### Option 1: Merge Locally (Signed)

```bash
# Move to main repo root
git checkout <base-branch>
git pull origin <base-branch>
git merge --gpg-sign <branch-name>

# Verify on merged result
pnpm run validate

# Clean up worktree and delete branch
git worktree remove ".worktrees/<branch-name>" 2>/dev/null || true
git branch -d <branch-name>
```

### Option 2: Push and Create PR

```bash
git push -u origin <branch-name>
```

Keep the branch and worktree for PR review iterations.

### Option 3: Keep As-Is

Preserve the worktree and branch. Report path to user.
