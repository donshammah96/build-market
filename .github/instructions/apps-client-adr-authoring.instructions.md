---
description: "Use when creating or editing apps/client ADR documents to keep them concise, canonical, and implementation-backed."
applyTo: "apps/client/docs/adr/**"
---

# Client ADR Authoring Guide

Last aligned with canonical on: 2026-08-15.

## Scope

- Applies to ADR files under apps/client/docs/adr.
- Governs ADR structure, implementation linkage, and verification expectations.

## Rules

1. Use canonical section order: Status, Context, Decision, Consequences, Verification, Related Documentation.
2. Keep Decision content normative and concise; prefer short bullets over long prose.
3. Mark ADRs as Accepted only when implementation is in place across schema, runtime adapters, and tests where applicable.
4. For Proposed ADRs, include an explicit rollout sequence and state what is not yet implemented.
5. Link each material decision to concrete implementation surfaces (for example schema enums, adapter guards, domain contracts, and test suites).
6. Include at least one reproducible verification command for the affected surfaces.
7. For enum or actor-shape changes, include migration notes covering data migration, trust-boundary normalization, and test updates.
8. Do not duplicate repository-wide policy from .github/copilot-instructions.md; reference canonical docs when needed.

## Validation

- Confirm frontmatter parses and `applyTo` is limited to apps/client/docs/adr/\*\*.
- Confirm ADR status matches implementation reality.
- Confirm verification commands are executable from repository root.
- Confirm markdown headings are proper headings (avoid emphasis-as-heading).
- Confirm related documentation includes relevant ADR cross-links for boundary changes.
