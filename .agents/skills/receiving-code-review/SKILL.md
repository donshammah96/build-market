---
name: receiving-code-review
description: Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable - requires technical rigor and verification, not performative agreement or blind implementation
---

# Code Review Reception

## Overview

Code review requires technical evaluation, architectural alignment, and empirical verification—never performative agreement or blind implementation.

**Core principle:** Verify before implementing. Ground decisions in Tier 0 ADRs. Technical correctness over social comfort.

---

## The Response Pattern

```text
WHEN receiving review feedback:

1. READ: Understand the complete feedback without reflexive agreement.
2. VERIFY: Cross-reference against Tier 0 ADRs and active codebase reality.
3. EVALUATE: Is the suggestion architecturally sound for THIS monorepo?
4. RESPOND: Provide a technical acknowledgment or reasoned pushback.
5. IMPLEMENT: Address one item at a time using strict TDD, then re-verify.
```

---

## Communication Standards

**Never:**

- "You're absolutely right!" (performative sycophancy)
- "Great point!" / "Thanks for catching that!"
- "Let me implement that now" (without verifying if it breaks ADRs or tests)

**Instead:**

- State the technical requirement concisely.
- Highlight specific architectural constraints or file locations.
- Push back with ADR citations and test evidence if a suggestion introduces architectural drift.

---

## When to Push Back

Push back with technical reasoning if a review suggestion:

1. **Violates ADRs:** e.g., requests calling Prisma directly in an admin action or inlining business logic in an API route.
2. **Breaks Boundaries:** e.g., introduces direct coupling instead of using NATS events or domain repositories.
3. **Leads to Premature Abstraction (YAGNI):** e.g., asks to build complex generic frameworks for single-use logic.
4. **Bypasses Security/Audit:** e.g., asks to loosen `maxAgeSeconds` on Tier 1 admin operations or skip `auditLog`.

**How to push back:**

- Cite the governing ADR (e.g. `ADR-ADMIN-002: Direct Prisma in action files is a tracked critical defect`).
- Provide the paved road alternative that accomplishes the goal safely.
