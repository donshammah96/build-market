---
description: "Use when creating or editing apps/admin ADR documents to keep them concise, canonical, and implementation-backed."
applyTo: "apps/admin/docs/adr/**"
---

# Admin ADR Authoring Guide

Last aligned with canonical on: 2026-08-15.

## Scope

- Applies to ADR files under apps/admin/docs/adr.
- Governs ADR structure, implementation linkage, and verification expectations.

## Rules

1. Use canonical section order: Status, Context, Decision, Consequences, Verification, Related Documentation.
2. Keep Decision content normative and concise; prefer short bullets over long prose.
3. Mark ADRs as Accepted only when implementation is in place across schema, runtime adapters, and tests. If these are excluded, include a section explicitly titled 'Component Relevance' that provides detailed reasoning and approval criteria for the exclusion.
4. For Proposed ADRs, include an explicit rollout sequence and state what is not yet implemented.
5. Link each material decision to concrete implementation surfaces (for example schema enums, adapter guards, domain contracts, and test suites).
6. Include at least one verification command that can be executed multiple times and produces identical outputs for the specific implementation areas affected by the ADR (e.g., schema, runtime adapters, or tests).
7. For enum or actor-shape changes, include migration notes covering data migration, trust-boundary normalization, and test updates.
8. Do not duplicate repository-wide policy from .github/copilot-instructions.md; reference canonical docs when needed.

## Validation

- Confirm frontmatter parses and `applyTo` is limited to apps/admin/docs/adr/\*\*.
- If the frontmatter does not parse or `applyTo` is invalid, provide an error message specifying the issue and suggest corrections.
- For ADRs that are partially implemented, include a section titled 'Partial Implementation' that outlines what is complete and what remains.
- If verification commands fail or are not executable, provide a detailed error log and steps to resolve the issue.
- Confirm markdown headings are proper headings (avoid emphasis-as-heading).
- Confirm related documentation includes relevant ADR cross-links for boundary changes.
