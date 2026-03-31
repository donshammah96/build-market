---
description: How to document codebase changes in the changelog
---

# Codebase Changes & Changelog Workflow

**CRITICAL RULE:** For any edits, fixes, refactors, or feature additions made to the codebase, you MUST document those changes in the `c:\Users\User\build-market\CHANGELOG.md` file before completing your task.

## When to Use

Trigger this workflow automatically as the final step of any coding task, bug fix, architectural change, or refactor.

## Steps

1. **Wait for Code Changes to Complete**
   Ensure all file modifications, database seed updates, or package additions are finished and verified.

2. **Read the Current Changelog**
   Use the `view_file` tool to inspect `c:\Users\User\build-market\CHANGELOG.md`. Note the structure under the `## [Unreleased]` section.

3. **Categorize the Change**
   Determine the appropriate category for the work you just completed:
   - `### Added`: For new features, endpoints, or components.
   - `### Changed`: For changes in existing functionality, refactors, or logic updates.
   - `### Deprecated`: For features removed or marked for removal.
   - `### Fixed`: For any bug fixes or error resolutions.
   - `### Security`: For vulnerability patches.

4. **Draft the Entry**
   Write a concise, bulleted description of the change.
   - Start with a bolded component/area tag (e.g., `- **API**:` or `- **Schema**:`).
   - If fixing a bug, briefly describe the problem and the implemented solution.
   - Mention key files modified.

5. **Update the Changelog**
   Use `replace_file_content` to insert the new bullet point into the correct section under `## [Unreleased]`. If the category header (e.g., `### Fixed`) doesn't exist yet for the unreleased version, add it.

6. **Verify**
   Ensure the markdown formatting is correct and the `CHANGELOG.md` file saved successfully.
