---
name: finishing-a-development-branch
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work
---

# Finishing a Development Branch

## Overview

Update root & app changelogs → Craft staff-level signed commit → Verify tests & signatures → Detect environment → Present integration options → Execute choice → Clean up worktree.

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

For this repository, the default integration target is `staging`. The handoff
must include a verified feature-branch commit, checkout from the main
repository worktree, merge verification, and exact-path cleanup.

---

## Step 0: Update Root and App-Specific Changelogs & Documentation

Before crafting the commit and running validation, document all changes across the root repository and any touched applications:

### 1. Root-Level Release Changelog (`docs/CHANGELOG.md`)

Update only `docs/CHANGELOG.md` under the `## [Unreleased]` section. This is the sole applicable root-level release changelog; the retired root `CHANGELOG.md` must not be recreated:

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
- [Docs/Changelogs]: Updated `docs/CHANGELOG.md` and touched app changelogs

### Verification
- pnpm run validate (workspace versions, deps audit, format, lint, check-types, tests)
- pnpm run admin:report-security-drift:strict
- pnpm run client:report-security-drift:strict
```

### 3. Execute Signed Commit

```powershell
git add -A
git diff --cached --check
git commit -S -m "<type>(<scope>): <short summary>" `
  -m "Why: [business motivation and root problem]" `
  -m "Architectural Alignment: [ADRs, boundaries, and invariants]" `
  -m "Key Changes: [files or slices changed; changelogs updated]" `
  -m "Verification: [exact commands and results]"
git show --show-signature --stat --oneline HEAD
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

## Step 3: Detect Environment & Integration Branch

1. Determine if running inside a `.worktrees/` directory:

   ```bash
   WORKTREE_PATH=$(git rev-parse --show-toplevel)
   ```

2. For this repository, use `staging` as the integration branch unless the user explicitly names another branch. Confirm that `staging` is not already checked out by a different worktree.

   ```powershell
   git worktree list --porcelain
   git branch --show-current
   ```

---

## Step 4: Present Integration Options

Present exactly these 3 options to the user:

```text
All tests, typechecks, and commit signatures verified. What would you like to do with branch <branch-name>?

1. Merge back to staging locally and clean up worktree
2. Push to remote and prepare Pull Request
3. Keep the branch as-is (I'll handle it later)

Which option?
```

---

## Step 5: Execute Choice

### Option 1: Merge Locally to `staging` (Signed)

```powershell
# Move to the main repository checkout, not the feature worktree
$commonGitDir = git rev-parse --path-format=absolute --git-common-dir
$mainRoot = Split-Path -Parent $commonGitDir
Set-Location $mainRoot
git worktree list --porcelain
git switch staging
git pull --ff-only origin staging
git merge --no-ff --gpg-sign <branch-name>

# Verify on merged result
pnpm run validate
git log -2 --oneline --decorate
git status --short --untracked-files=all

# Clean up only after the merge and verification succeed
$featurePath = [System.IO.Path]::GetFullPath('.worktrees\<branch-name>')
git worktree remove -- $featurePath
git worktree prune
git branch -d <branch-name>
```

The merge is complete only when `staging` is clean and `git log` shows the merge. Never use `2>/dev/null || true` or an equivalent error-suppression pattern for worktree cleanup.

### Windows long-path cleanup

When removal fails with `Filename too long`, verify the feature branch is merged and the exact path is no longer registered before deleting leftover filesystem contents:

```powershell
$featurePath = [System.IO.Path]::GetFullPath('.worktrees\<branch-name>')
git worktree list --porcelain

# Run only if the path is no longer registered by Git.
$longFeaturePath = "\\?\$featurePath"
if (Test-Path -LiteralPath $featurePath) {
  [System.IO.Directory]::Delete($longFeaturePath, $true)
}
git worktree prune
Test-Path -LiteralPath $featurePath
git worktree list --porcelain
```

If `node_modules` junctions prevent deletion, inspect and remove only the dependency tree inside this exact feature-worktree path. Do not delete `.worktrees`, the repository root, or unrelated worktrees. If cleanup is incomplete or the path contains user changes, stop and report the precise blocker.

### Option 2: Push and Create PR

```bash
git push -u origin <branch-name>
```

Keep the branch and worktree for PR review iterations.

### Option 3: Keep As-Is

Preserve the worktree and branch. Report path to user.

## Step 6: Final Cleanup Checklist

- [ ] Feature changes are committed and the commit signature was verified.
- [ ] `staging` was checked out from its owning main checkout.
- [ ] `staging` was fast-forwarded from `origin/staging` before merge when a remote exists.
- [ ] The feature branch was merged with `--no-ff` and the merged result was verified.
- [ ] The exact feature-worktree path was removed or safely recovered from a Windows long-path failure.
- [ ] `git worktree list --porcelain` contains no feature-worktree entry.
- [ ] `git status --short --untracked-files=all` is clean on `staging`.
- [ ] Only the merged feature branch was deleted; unrelated worktrees and branches were untouched.
