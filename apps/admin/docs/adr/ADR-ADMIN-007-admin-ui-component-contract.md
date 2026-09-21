# ADR-ADMIN-007: Admin UI Component Contract

Status: Accepted
Owner: Admin Architecture
Next review: 2026-12-03

## Status

Accepted

## Context

Admin has a useful Radix/shadcn component base and route-level loading/error files for many sections. Phase 0 did not find a canonical admin design-token or state contract.

## Decision

Every interactive admin component supports default, hover, focus-visible, active, disabled, loading, error, and success states.

All colors use admin CSS custom properties. Hardcoded hex values are prohibited outside token definitions.

Accessibility invariants are semantic HTML, programmatic labels, ARIA error wiring, 44 by 44 CSS pixel touch targets, and visible focus indicators.

Material route segments require `loading.tsx` and `error.tsx`. Admin visual direction prioritizes operational authority, clarity, density, and hierarchy over decorative polish.

## Alternatives Considered

**Consumer-grade design system (MUI, Chakra, Mantine):** Comprehensive component libraries accelerate UI development. Rejected because admin operator UIs have different density and interaction requirements than consumer UIs; off-the-shelf defaults would require extensive theming overrides that cost more than the shadcn/Radix baseline. The Radix primitive approach maintains accessibility contracts without dictating visual style.

**No design-token system — direct Tailwind class usage:** Using Tailwind utility classes directly on each component avoids the CSS custom property layer. Rejected because it makes dark mode, density variants, and brand updates require touching every component file. The `tokens.css` layer provides a single mutation point for design-system-wide changes.

**Storybook component catalogue:** Storybook-driven development enforces state contracts through stories. Considered but deferred — the admin UI is primarily server-rendered, Storybook's RSC support is early, and the operational surface does not currently justify the Storybook build overhead.

## Consequences

Component refactors must preserve operator workflows and avoid broad visual churn without state/accessibility coverage.

## Verification

Component tests and visual review cover state variants, labels, error wiring, focus behavior, and reduced-motion behavior.

## Revision History

| Date       | Author       | Change                                                       |
| ---------- | ------------ | ------------------------------------------------------------ |
| 2026-06-04 | Phase 6 impl | Initial acceptance. Branch: `feat/admin-overhaul/ui-tokens`. |
| 2026-06-05 | Autopsy impl | Added Alternatives Considered and Revision History (F-Doc1). |

## Related Documentation

- `apps/admin/docs/progress/AUTOPSY-REPORT.md`
