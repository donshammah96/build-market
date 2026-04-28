# Starter Claude Rules

Purpose:

- Keep rule files project-scoped and easy to audit.
- Align guidance with repository canonical docs.
- Avoid secrets or environment-specific credentials.

Baseline rules:

- Do not duplicate policy that already exists in .github/copilot-instructions.md.
- Prefer links to canonical architecture docs for detailed guidance.
- Keep each rule file narrow in scope and clearly named.

Suggested rule skeleton:

## Scope

- <paths or feature area>

## Rules

- <Rule 1>
- <Rule 2>

## Validation

- <how to verify the rule was followed>
