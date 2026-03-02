/**
 * License domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// LicenseAuthority
// -------------------------------------------------------------------------

export const LICENSE_AUTHORITIES = [
  "NCA",
  "EBK",
  "BORAQS",
  "EARB",
  "ERC",
  "EPRA",
  "VRB",
  "ISK",
  "NEMA",
  "KEBS",
  "OTHER",
] as const;

export type LicenseAuthority = (typeof LICENSE_AUTHORITIES)[number];

export const LICENSE_AUTHORITY_LABELS: Record<LicenseAuthority, string> = {
  NCA: "National Construction Authority (NCA)",
  EBK: "Engineers Board of Kenya (EBK)",
  BORAQS: "Board of Registration of Architects and Quantity Surveyors (BORAQS)",
  EARB: "Estate Agents Registration Board (EARB)",
  ERC: "Energy and Petroleum Regulatory Authority (ERC)",
  EPRA: "Energy and Petroleum Regulatory Authority (EPRA)",
  VRB: "Valuers Registration Board (VRB)",
  ISK: "Institution of Surveyors of Kenya (ISK)",
  NEMA: "National Environment Management Authority (NEMA)",
  KEBS: "Kenya Bureau of Standards (KEBS)",
  OTHER: "Other",
};

export function isLicenseAuthority(value: unknown): value is LicenseAuthority {
  return (
    typeof value === "string" &&
    (LICENSE_AUTHORITIES as readonly string[]).includes(value)
  );
}
