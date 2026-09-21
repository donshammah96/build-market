import type { LicenseAuthority } from "@prisma/client";

/**
 * Manual cross-check links for the operator review workflow (see
 * professional-onboarding-observability-runbook.md §6). None of the seven
 * statutory authorities expose a public API (confirmed 2026-08-01 - see
 * commit message / PR description for the research behind this), so
 * automated adapters route everything to manual review. This module gives
 * operators a one-click starting point instead of having them search for
 * "how do I check an NCA license" from scratch on every case.
 *
 * IMPORTANT: these are convenience links for a human reviewer, not part of
 * the verification pipeline. Nothing in gateway.ts or the adapters reads
 * this file - it must never be wired into an automated decision path.
 *
 * Link rot risk: government/board sites restructure without notice.
 * `verified` below reflects manual confirmation as of the date in
 * `verifiedAt` - re-check periodically (a lightweight uptime/link-check job
 * would catch this earlier; not included in this change set).
 */

export type RegulatorLookupLink = {
  authority: LicenseAuthority;
  label: string;
  url: string;
  /**
   * True only if this URL was manually confirmed to be a public,
   * no-login page where a license/registration number can actually be
   * searched or browsed. False means it's a fallback to the authority's
   * homepage because no such page could be found - operators will need to
   * fall back to phone/email verification (see `fallbackNote`).
   */
  verified: boolean;
  verifiedAt: string;
  fallbackNote?: string;
};

const LOOKUP_LINKS: Record<LicenseAuthority, RegulatorLookupLink | null> = {
  NCA: {
    authority: "NCA",
    label: "NCA — Search Registered Contractors",
    url: "https://www.nca.go.ke/registered-contractors",
    verified: true,
    verifiedAt: "2026-08-01",
  },
  VRB: {
    authority: "VRB",
    label: "VRB — Registered Valuers & License Status",
    url: "https://vrb.or.ke/registered/",
    verified: true,
    verifiedAt: "2026-08-01",
  },
  EARB: {
    authority: "EARB",
    label: "EARB — Official Site",
    url: "https://estateagentsboard.or.ke/",
    verified: false,
    verifiedAt: "2026-08-01",
    fallbackNote:
      "EARB states publicly that the register can be checked on their site, but no direct search-page URL was confirmed - browse from the homepage, or contact EARB directly if the register isn't locatable.",
  },
  BORAQS: {
    authority: "BORAQS",
    label: "BORAQS — Official Site",
    url: "https://boraqs.or.ke/",
    verified: false,
    verifiedAt: "2026-08-01",
    fallbackNote:
      "BORAQS's member listing (boraqs.or.ke/registered) is login-gated. No public search confirmed - verify via email/phone (info@boraqs.or.ke) if evidence is inconclusive.",
  },
  ISK: {
    authority: "ISK",
    label: "ISK — Official Site",
    url: "https://isk.or.ke/",
    verified: false,
    verifiedAt: "2026-08-01",
    fallbackNote:
      "ISK's members portal (members.isk.or.ke) is registration/login-gated. No public search confirmed - verify via email/phone (info@isk.or.ke) if evidence is inconclusive.",
  },
  EBK: {
    authority: "EBK",
    label: "EBK — Official Site",
    url: "https://ebk.go.ke/",
    verified: false,
    verifiedAt: "2026-08-01",
    fallbackNote:
      "EBK's Engineers Portal is login-gated. No public search confirmed - verify via email/phone if evidence is inconclusive.",
  },
  EPRA: {
    authority: "EPRA",
    label: "EPRA — Official Site",
    url: "https://www.epra.go.ke/",
    verified: false,
    verifiedAt: "2026-08-01",
    fallbackNote:
      "No public license-lookup page confirmed. Verify via EPRA's contact channels if evidence is inconclusive.",
  },
  // No public web presence identified for these - fall back to
  // NEEDS_MANUAL_REVIEW with no auto-generated link at all.
  ERC: null,
  NEMA: null,
  KEBS: null,
  OTHER: null,
};

/**
 * Returns the operator-facing lookup link for an authority, or null if
 * none is configured. Callers (e.g. the manual-review case detail view -
 * not yet built, see runbook §6) should render `verified` links as a
 * primary "Check official register ↗" action and unverified links as a
 * secondary "Authority website (register not confirmed)" action, showing
 * `fallbackNote` as help text so reviewers don't assume the link does more
 * than it does.
 */
export function getRegulatorLookupLink(
  authority: LicenseAuthority,
): RegulatorLookupLink | null {
  return LOOKUP_LINKS[authority] ?? null;
}

/** All configured links, for a settings/reference page rather than a specific case. */
export function listRegulatorLookupLinks(): RegulatorLookupLink[] {
  return Object.values(LOOKUP_LINKS).filter(
    (link): link is RegulatorLookupLink => link !== null,
  );
}
