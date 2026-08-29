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

## Quick Reference

| State                                         | Action                                                    |
| --------------------------------------------- | --------------------------------------------------------- |
| Already in worktree (`GIT_DIR != GIT_COMMON`) | Proceed with setup and implementation                     |
| In main repository checkout                   | Ask consent, create `.worktrees/<branch>`, `pnpm install` |
| Worktree directory missing from `.gitignore`  | Add `.worktrees/` to `.gitignore` first                   |
