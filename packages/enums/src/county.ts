/**
 * County enum constants for build-market (Kenya counties).
 *
 * Values MUST exactly match the Prisma `County` enum (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// Canonical array — the ground truth
// -------------------------------------------------------------------------

export const COUNTIES = [
  "BARINGO",
  "BOMET",
  "BUNGOMA",
  "BUSIA",
  "ELGEYO_MARAKWET",
  "EMBU",
  "GARISSA",
  "HOMA_BAY",
  "ISIOLO",
  "KAJIADO",
  "KAKAMEGA",
  "KERICHO",
  "KIAMBU",
  "KILIFI",
  "KIRINYAGA",
  "KISII",
  "KISUMU",
  "KITUI",
  "KWALE",
  "LAIKIPIA",
  "LAMU",
  "MACHAKOS",
  "MAKUENI",
  "MANDERA",
  "MARSABIT",
  "MERU",
  "MIGORI",
  "MOMBASA",
  "MURANGA",
  "NAIROBI",
  "NAKURU",
  "NANDI",
  "NAROK",
  "NYAMIRA",
  "NYANDARUA",
  "NYERI",
  "SAMBURU",
  "SIAYA",
  "TAITA_TAVETA",
  "TANA_RIVER",
  "THARAKA_NITHI",
  "TRANS_NZOIA",
  "TURKANA",
  "UASIN_GISHU",
  "VIHIGA",
  "WAJIR",
  "WEST_POKOT",
] as const;

// -------------------------------------------------------------------------
// TypeScript type derived from the array — always in sync
// -------------------------------------------------------------------------

export type County = (typeof COUNTIES)[number];

// -------------------------------------------------------------------------
// Human-readable display labels
// County names are already human-readable; underscores replaced with spaces.
// -------------------------------------------------------------------------

export const COUNTY_LABELS: Record<County, string> = {
  BARINGO: "Baringo",
  BOMET: "Bomet",
  BUNGOMA: "Bungoma",
  BUSIA: "Busia",
  ELGEYO_MARAKWET: "Elgeyo-Marakwet",
  EMBU: "Embu",
  GARISSA: "Garissa",
  HOMA_BAY: "Homa Bay",
  ISIOLO: "Isiolo",
  KAJIADO: "Kajiado",
  KAKAMEGA: "Kakamega",
  KERICHO: "Kericho",
  KIAMBU: "Kiambu",
  KILIFI: "Kilifi",
  KIRINYAGA: "Kirinyaga",
  KISII: "Kisii",
  KISUMU: "Kisumu",
  KITUI: "Kitui",
  KWALE: "Kwale",
  LAIKIPIA: "Laikipia",
  LAMU: "Lamu",
  MACHAKOS: "Machakos",
  MAKUENI: "Makueni",
  MANDERA: "Mandera",
  MARSABIT: "Marsabit",
  MERU: "Meru",
  MIGORI: "Migori",
  MOMBASA: "Mombasa",
  MURANGA: "Muranga",
  NAIROBI: "Nairobi",
  NAKURU: "Nakuru",
  NANDI: "Nandi",
  NAROK: "Narok",
  NYAMIRA: "Nyamira",
  NYANDARUA: "Nyandarua",
  NYERI: "Nyeri",
  SAMBURU: "Samburu",
  SIAYA: "Siaya",
  TAITA_TAVETA: "Taita-Taveta",
  TANA_RIVER: "Tana River",
  THARAKA_NITHI: "Tharaka-Nithi",
  TRANS_NZOIA: "Trans Nzoia",
  TURKANA: "Turkana",
  UASIN_GISHU: "Uasin Gishu",
  VIHIGA: "Vihiga",
  WAJIR: "Wajir",
  WEST_POKOT: "West Pokot",
};

// -------------------------------------------------------------------------
// Type guard
// -------------------------------------------------------------------------

export function isCounty(value: unknown): value is County {
  return (
    typeof value === "string" && (COUNTIES as readonly string[]).includes(value)
  );
}
