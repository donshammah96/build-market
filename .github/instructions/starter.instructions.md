---
description: "Use when creating or editing instruction files under .github/instructions. Enforces safe, scoped, non-duplicative instruction authoring."
applyTo: ".github/instructions/**"
---

# Instruction Authoring Standard

Last aligned with canonical on: 2026-08-15.

## Scope

- Applies to instruction files stored under `.github/instructions`.
- Purpose is to define how to write new instruction files safely and consistently.

## Hard Rules

1. Do not duplicate policy that already exists in `.github/copilot-instructions.md`.
2. Prefer references to canonical docs over restating architecture details.
3. Keep each instruction file narrow in scope, with a clear name and trigger description.
4. Use `applyTo` only when file targeting is intentional; avoid broad always-on matching.
5. Never include secrets, tokens, credentials, or machine-specific absolute paths.
6. For generated instruction content (for example Postman), keep files under tracked project paths only, such as `.github/instructions/postman`.

## Authoring Checklist

1. Description includes concrete trigger phrases someone would actually ask for.
2. Scope is explicit (which paths or workflows this file is for).
3. Rules are short, actionable, and testable.
4. Conflicts with canonical policy are resolved in favor of `.github/copilot-instructions.md`.
5. File naming follows intent-first style (example: `onboarding-form.instructions.md`, not `misc.instructions.md`).

## Preferred Structure For New Instruction Files

1. Frontmatter with `description` and optional `applyTo`.
2. Scope section.
3. Rules section (5-10 bullets max).
4. Validation section with how to verify compliance.

## Validation

- Confirm file is in `.github/instructions`.
- Confirm frontmatter parses correctly.
- Confirm no duplicated architecture policy copied from canonical docs.
- Confirm no temp-directory or user-profile paths are referenced.
