# Scoped Instruction Maintenance Playbook

Purpose:

- Keep scoped instruction files concise, accurate, and aligned with canonical policy.
- Prevent policy drift between .github/copilot-instructions.md and .github/instructions/\*.instructions.md.

When to update:

- A canonical policy rule is added, removed, or changed.
- A new folder boundary needs path-scoped operational rules.
- Two instruction files conflict or overlap in scope.

Change workflow:

1. Update canonical policy first in .github/copilot-instructions.md when policy intent changes.
2. Update only the affected scoped instruction file under .github/instructions.
3. Keep scoped files operational and path-specific; avoid copying long canonical prose.
4. If two files overlap, narrow applyTo patterns and keep the stricter boundary.
5. Record meaningful architectural shifts in repository changelog or ADR workflow as appropriate.

Drift prevention checks:

- Every .instructions.md file must include frontmatter with description and applyTo.
- Descriptions should contain realistic trigger phrases.
- Rules must be testable, concise, and non-duplicative.
- Scoped files should reference canonical docs rather than re-documenting them.
- Alignment metadata should be kept current through `pnpm run check:instructions`, which runs the sync script when `.github/copilot-instructions.md` changes.
- `pnpm audit --audit-level=high` must pass as a required CI gate on pull requests.
- Critical CVEs in direct or first-level transitive dependencies must be remediated within 7 calendar days; high-severity CVEs within 30 calendar days.
- If no patch is available within SLA, document compensating mitigation and tracking owner before merge.

Review checklist for PRs:

1. Does this change belong in canonical policy, scoped file, or both?
2. Are applyTo patterns narrow and correct?
3. Are stricter boundary rules preserved across admin and client surfaces?
4. Did the instruction frontmatter check pass?

Operational command:

- Run pnpm run check:instructions before merging instruction-file changes.
- Use pnpm run sync:instructions-aligned-date -- --force to refresh all alignment dates manually.
