# Staff Code Reviewer Template & Checklist

Use this review framework when evaluating diffs in Build Market.

## Build Market Invariant Audit

### 1. Presentation & Action Layer

- **`apps/client` Routes (`app/api/**`):**
  - [ ] Thin HTTP adapter only? (Zod validation, auth check, resilience, response shaping).
  - [ ] Zero inline business logic or direct DB mutations?
- **`apps/admin` Server Actions (`src/actions/admin/**`):**
  - [ ] Wrapped with `safeAction`?
  - [ ] Validated with `.safeParse()` (never `.parse()`)?
  - [ ] No direct Prisma calls in the action file (tracked critical defect ADR-ADMIN-002)?
  - [ ] Capabilities checked against `AdminCapability` (no raw string comparisons)?
  - [ ] High-risk actions specify declarative `auditLog` (ADR-ADMIN-008)?
  - [ ] Tier 1 actions enforce `maxAgeSeconds: 180`?

### 2. Domain & Repository Layer

- [ ] Business logic resides in `src/lib/domains/<slice>/service.ts` or `app/lib/domains/<slice>/service.ts`?
- [ ] Returns `Result<T, DomainError>`?
- [ ] Repositories (`repository.ts`) are persistence-only without business branching?
- [ ] Cross-service events use NATS rather than ad-hoc direct calls?

### 3. Environment, Security & Observability

- [ ] Env variables read exclusively through `envConfig` (client) or `adminEnvConfig` (admin)?
- [ ] No PII logged (`userId`, `clerkId`, `userEmail`, `phone`, `nationalId`, full payload bodies)?
- [ ] Adapter layer emits structured telemetry (`correlationId`, `operationName`, `adminRole`, `outcome`, `durationMs`)?

---

## Review Output Format

```markdown
### Summary of Changes

[1-2 sentence description of reviewed diff]

### Strengths

- [Concrete well-architected points]

### Issues

#### Critical (Must Fix Before Merge)

- **[File:Line]**: [Description of ADR violation, security flaw, or bug]
  - _Why it matters:_ [Impact on architecture, security, or data integrity]
  - _Required fix:_ [Concrete code fix]

#### Important (Should Fix)

- **[File:Line]**: [Missing edge case, unhandled error, type gap]

#### Minor (Nice to Have)

- **[File:Line]**: [Optimization or clarity suggestion]

### Assessment

**Ready to Merge:** [Yes | With Fixes | No]
```
