---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

**Core principle:** Evidence before claims, always. Never state that code works, builds, or passes tests without running fresh verification commands in the current turn.

**Violating the letter of this rule is violating the spirit of this rule.**

---

## The Iron Law

```text
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't executed the verification command in this message turn, you cannot claim it passes.

---

## The Gate Function

```text
BEFORE claiming any status or expressing completion:

1. IDENTIFY: What specific verification command proves this claim?
2. RUN: Execute the FULL command (fresh, complete).
3. READ: Full output, check exit code (0), verify 0 failures.
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with failure logs.
   - If YES: State claim WITH command output evidence.
5. ONLY THEN: Mark step complete.
```

---

## Build Market Verification Matrix

| Claim                       | Required Verification Command                 | Success Standard         |
| --------------------------- | --------------------------------------------- | ------------------------ |
| Client tests pass           | `pnpm run client:test:all`                    | Exit 0, 0 test failures  |
| Admin tests pass            | `pnpm run admin:test:all`                     | Exit 0, 0 test failures  |
| Client typecheck clean      | `pnpm run client:tsc-noemit`                  | Exit 0, 0 type errors    |
| Admin typecheck clean       | `pnpm run admin:check-types`                  | Exit 0, 0 type errors    |
| Admin security & ADR checks | `pnpm run admin:report-security-drift:strict` | Exit 0, 0 drift findings |
| Specific domain unit test   | `pnpm --filter client test <path>`            | Exit 0, 0 failures       |

---

## Red Flags - STOP

- Using "should", "probably", "looks correct".
- Expressing satisfaction before verification ("Great!", "Done!", "Fixed!").
- Committing or moving to the next task without running the command.
- Relying on partial or previous turn test runs.
- Skipping typechecks because unit tests passed.

**Evidence before assertions, always.**
