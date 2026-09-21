---
name: executing-plans
description: Use when you have a written implementation plan to execute in a separate session with review checkpoints
---

# Executing Plans

## Overview

Load the approved implementation plan, review constraints critically, execute tasks sequentially using strict TDD, verify at each step, and document changes in a walkthrough.

**Announce at start:** "I'm using the executing-plans skill to execute this plan."

---

## The Execution Workflow

### Step 1: Load and Review Plan

1. **Verify Workspace State:** Ensure the working directory is clean or in a dedicated worktree using the `using-git-worktrees` skill.
2. **Review Plan & Tier Invariants:** Read `implementation_plan.md` (or plan file). Double-check adherence to Build Market Tier 0 ADRs (`apps/client` ADR-001..008, `apps/admin` ADR-ADMIN-001..009).
3. **Raise Blockers Early:** If the plan contains ambiguities, missing interface definitions, or schema conflicts, raise them immediately before modifying files.

### Step 2: Task-by-Task Execution (Strict TDD)

For each task in the plan:

1. **RED:** Write the failing test for the planned unit or route adapter. Run the test command to confirm it fails for the right reason.
2. **GREEN:** Write the minimal implementation code in the domain service, repository, or action.
3. **VERIFY GREEN:** Run the exact test command:

   ```bash
   # Client domain test:
   pnpm --filter client test path/to/service.test.ts
   # Admin action test:
   pnpm --filter admin test path/to/action.test.ts
   ```

4. **REFACTOR & TYPECHECK:** Clean up code, remove duplication, and run typechecks:

   ```bash
   pnpm run client:tsc-noemit
   pnpm run admin:check-types
   ```

5. **CHECKPOINT:** Mark task as completed in the plan.

### Step 3: Global Verification

Before concluding execution, run the full test suite and boundary checkers:

```bash
pnpm run client:test:all
pnpm run admin:test:all
pnpm run admin:report-security-drift:strict
```

### Step 4: Documentation & Handoff

1. Create or update the walkthrough artifact (`walkthrough.md`) summarizing:
   - Specific files created / modified
   - ADR compliance confirmation
   - Verification test outputs and evidence
2. Complete the branch integration using the `finishing-a-development-branch` skill.

---

## When to Stop and Ask for Help

**STOP executing immediately when:**

- A test failure reveals unexpected architectural coupling or unmodeled state.
- An ADR boundary conflict is discovered (e.g. action requires direct Prisma access without an existing domain service).
- Verification fails repeatedly after 2 fix attempts (triggering `systematic-debugging`).

**Never force through blockers by skipping tests or adding loose types (`any`).**
