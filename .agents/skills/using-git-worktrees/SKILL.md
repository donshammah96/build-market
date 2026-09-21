---
name: using-git-worktrees
description: Use when starting feature work that needs isolation from current workspace or before executing implementation plans - ensures an isolated workspace exists via native tools or git worktree fallback
---

# Using Git Worktrees

## Overview

Ensure work happens in an isolated workspace when starting major feature branches, refactors, or executing implementation plans.

**Core principle:** Detect existing isolation first. Respect user preference. Use git worktrees safely in the monorepo.

**Announce at start:** "I'm using the using-git-worktrees skill to set up an isolated workspace."

---

## Step 0: Detect Existing Isolation

Before creating anything, check if the current checkout is already a worktree:

```bash
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
GIT_COMMON=$(git rev-parse --git-common-dir 2>/dev/null)
BRANCH=$(git branch --show-current)
```

- **If `GIT_DIR != GIT_COMMON`:** You are already inside an isolated worktree. Skip to Step 2 (Monorepo Setup).
- **If `GIT_DIR == GIT_COMMON`:** You are in the main repo root. Ask for user consent before creating a worktree if not already specified in task context.

---

## Step 1: Create Isolated Worktree

### 1. Directory Selection & Gitignore Check

Default to `.worktrees/` at the monorepo root. Ensure it is ignored:

```bash
git check-ignore -q .worktrees 2>/dev/null || echo ".worktrees/" >> .gitignore
```

### 2. Create the Branch and Worktree

```bash
git worktree add ".worktrees/<branch-name>" -b "<branch-name>"
```

---

## Step 2: Monorepo Project Setup

Inside the new worktree:

1. **Install dependencies:**

   ```bash
   pnpm install --frozen-lockfile
   ```

2. **Verify baseline build & tests:**

   ```bash
   pnpm run client:tsc-noemit
   pnpm run client:test:all
   ```

If the baseline fails, report to the user before making changes. If clean, proceed with plan execution.

---

## Step 3: Commit, Merge to `staging`, and Clean Up

Use this handoff after implementation, verification, and changelog updates are complete. Do not merge a dirty worktree or hide cleanup errors.

### 1. Commit from the feature worktree

```powershell
git status --short --untracked-files=all
git diff --check
git add -A
git diff --cached --check
git commit -S -m "<type>(<scope>): <imperative summary>"
git show --show-signature --stat --oneline HEAD
```

Confirm the commit contains only the requested work and that the signature is valid. If signing is required but unavailable, stop and report it; do not silently create an unsigned commit.

### 2. Check out the integration branch from the main checkout

Return to the repository root, not the feature worktree:

```powershell
$commonGitDir = git rev-parse --path-format=absolute --git-common-dir
$mainRoot = Split-Path -Parent $commonGitDir
Set-Location $mainRoot
git worktree list --porcelain
git switch staging
git pull --ff-only origin staging
```

If `staging` is already checked out by another worktree, operate from that worktree or stop and ask which checkout owns the integration branch. Never force a branch checkout that would detach or overwrite another worktree.

### 3. Merge and verify on `staging`

```powershell
git merge --no-ff --gpg-sign <feature-branch>
pnpm run validate
git log -2 --oneline --decorate
git status --short --untracked-files=all
```

Resolve conflicts deliberately, rerun the relevant verification, and create a separate merge-fix commit if needed. Confirm `staging` is clean before cleanup.

### 4. Remove the feature worktree and branch

Verify the exact path and branch first:

```powershell
$featurePath = [System.IO.Path]::GetFullPath('.worktrees\<feature-branch>')
git worktree list --porcelain
git worktree remove -- $featurePath
git worktree prune
git branch -d <feature-branch>
```

Use the actual feature-worktree path from `git worktree list --porcelain`; do not derive a broad or guessed deletion target. Delete the local branch only after the merge is present on `staging` and the worktree is no longer registered.

### 5. Windows `Filename too long` recovery

If `git worktree remove` reports `Filename too long`, do not ignore the error and do not delete the repository or `.worktrees` parent. First confirm the feature commit is merged, the worktree has no needed uncommitted files, and the target path is exact.

```powershell
$featurePath = [System.IO.Path]::GetFullPath('.worktrees\<feature-branch>')
git worktree list --porcelain
git status --short --untracked-files=all
git worktree remove -- $featurePath
```

If Git has removed the worktree metadata but the directory remains, verify that `git worktree list --porcelain` no longer contains that path, then remove only the exact leftover directory with the Windows long-path prefix:

```powershell
$longFeaturePath = "\\?\$featurePath"
if (Test-Path -LiteralPath $featurePath) {
  [System.IO.Directory]::Delete($longFeaturePath, $true)
}
git worktree prune
Test-Path -LiteralPath $featurePath
git worktree list --porcelain
```

If dependency junctions or `node_modules` prevent recursive removal, inspect the exact target first and remove only that target's dependency tree. Never remove a workspace root, a parent `.worktrees` directory, or unrelated worktrees. If the target contains user changes, stop and recover them before deletion.

### 6. Cleanup completion criteria

- `git worktree list --porcelain` has no feature-worktree entry.
- `Test-Path -LiteralPath <exact-feature-path>` returns `False`.
- `git branch --merged staging` contains the feature branch before deletion.
- `git status --short --untracked-files=all` is clean on `staging`.
- Any unrelated worktrees and branches remain untouched.

---

## Quick Reference

| State                                         | Action                                                    |
| --------------------------------------------- | --------------------------------------------------------- |
| Already in worktree (`GIT_DIR != GIT_COMMON`) | Proceed with setup and implementation                     |
| In main repository checkout                   | Ask consent, create `.worktrees/<branch>`, `pnpm install` |
| Worktree directory missing from `.gitignore`  | Add `.worktrees/` to `.gitignore` first                   |
| Implementation verified                       | Commit, switch to `staging`, merge, verify, then clean up |
| `Filename too long` during removal            | Verify exact target, use long-path cleanup, then prune    |
