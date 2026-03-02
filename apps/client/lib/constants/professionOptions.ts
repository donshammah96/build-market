/**
 * Profession Options for Professional Onboarding Form
 *
 * Values come from @build/enums — the single source of truth.
 * Labels are human-readable display strings shown in the UI.
 */

import { RegulatoryAuthority, AUTHORITY_METADATA } from "@build/types";
import {
  PROFESSIONS,
  PROFESSION_LABELS,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  STORE_DOCUMENT_TYPES,
  STORE_DOCUMENT_TYPE_LABELS,
  type Profession,
  type StoreCategory,
  type StoreDocumentType,
} from "@build/enums";
import type { ComboboxOption } from "@/components/ui/combobox";

// ============================================================================
// PROFESSION OPTIONS - Built from @build/enums (values = Prisma enum, labels = UI)
// ============================================================================

export const PROFESSION_OPTIONS: ComboboxOption[] = PROFESSIONS.map(
  (value) => ({
    value,
    label: PROFESSION_LABELS[value as Profession],
  }),
);

export const STORE_OPTIONS: ComboboxOption[] = STORE_CATEGORIES.map(
  (value) => ({
    value,
    label: STORE_CATEGORY_LABELS[value as StoreCategory],
  }),
);

export const STORE_DOCUMENT_OPTIONS: ComboboxOption[] =
  STORE_DOCUMENT_TYPES.map((value) => ({
    value,
    label: STORE_DOCUMENT_TYPE_LABELS[value as StoreDocumentType],
  }));

// ============================================================================
// PROFESSION GROUPS - For grouped category card display
// ============================================================================

export const PROFESSION_GROUPS = {
  "Architecture & Design": [
    "ARCHITECT",
    "INTERIOR_DESIGNER",
    "LANDSCAPE_ARCHITECT",
    "URBAN_PLANNER",
    "QUANTITY_SURVEYOR",
  ],
  Engineering: [
    "STRUCTURAL_ENGINEER",
    "CIVIL_ENGINEER",
    "MECHANICAL_ENGINEER",
    "ELECTRICAL_ENGINEER",
  ],
  "Construction Management": [
    "PROJECT_MANAGER",
    "CLERK_OF_WORKS",
    "GENERAL_CONTRACTOR",
  ],
  "Specialized Trades": [
    "MASON",
    "ELECTRICIAN",
    "PLUMBER",
    "CARPENTER",
    "JOINER",
    "PAINTER",
    "WELDER",
    "GLAZIER",
    "ROOFER",
    "STEEL_FIXER",
    "FLOORING_SPECIALIST",
    "PLASTERER",
    "HVAC_TECHNICIAN",
  ],
  "Real Estate": ["LAND_SURVEYOR", "REAL_ESTATE_VALUER", "REAL_ESTATE_AGENT"],
  Specialists: [
    "SOLAR_ENERGY_TECHNICIAN",
    "BOREHOLE_DRILLER",
    "CCTV_AND_SECURITY_PRO",
    "INTERNET_AND_NETWORK_PRO",
  ],
  Suppliers: ["MATERIAL_SUPPLIER", "EQUIPMENT_RENTER"],
} as const;

// ============================================================================
// PROFESSION CATEGORY UTILITIES - For conditional form rendering
// ============================================================================

export const SPECIALIST_PROFESSIONS: string[] = [
  "SOLAR_ENERGY_TECHNICIAN",
  "BOREHOLE_DRILLER",
  "CCTV_AND_SECURITY_PRO",
  "INTERNET_AND_NETWORK_PRO",
] as const;

export const SPECIALIZED_TRADES_PROFESSIONS: string[] = [
  "MASON",
  "ELECTRICIAN",
  "PLUMBER",
  "CARPENTER",
  "JOINER",
  "PAINTER",
  "WELDER",
  "GLAZIER",
  "ROOFER",
  "STEEL_FIXER",
  "FLOORING_SPECIALIST",
  "PLASTERER",
  "HVAC_TECHNICIAN",
] as const;

export const CONSTRUCTION_MANAGEMENT_PROFESSIONS: string[] = [
  "PROJECT_MANAGER",
  "CLERK_OF_WORKS",
  "GENERAL_CONTRACTOR",
] as const;

export const SUPPLIER_PROFESSIONS: string[] = [
  "HARDWARE",
  "BUILDING_MATERIALS",
  "TILES_AND_CERAMICS",
  "ELECTRICAL",
  "PLUMBING",
  "PAINTS_AND_FINISHES",
  "ROOFING",
  "TIMBER_AND_WOOD",
  "GLASS_AND_ALUMINUM",
  "KITCHEN_AND_BATH",
  "LANDSCAPING",
  "STEEL_AND_METALS",
  "SAFETY_AND_TOOLS",
  "HVAC",
  "SOLAR_AND_ENERGY",
  "WATER_STORAGE",
  "SECURITY_SYSTEMS",
  "DECOR_AND_LIGHTING",
  "HEAVY_MACHINERY",
  "WINDOWS_AND_DOORS",
  "AUTOMOTIVE",
] as const;

export const REAL_ESTATE_PROFESSIONS: string[] = [
  "REAL_ESTATE_VALUER",
  "LAND_SURVEYOR",
  "REAL_ESTATE_AGENT",
] as const;

export const ENGINEERING_PROFESSIONS: string[] = [
  "STRUCTURAL_ENGINEER",
  "CIVIL_ENGINEER",
  "MECHANICAL_ENGINEER",
  "ELECTRICAL_ENGINEER",
] as const;

export const ARCHITECTURE_AND_QS_PROFESSIONS: string[] = [
  "ARCHITECT",
  "LANDSCAPE_ARCHITECT",
  "URBAN_PLANNER",
  "QUANTITY_SURVEYOR",
] as const;

// Type exports
export type SupplierProfession = (typeof SUPPLIER_PROFESSIONS)[number];
export type RealEstateProfession = (typeof REAL_ESTATE_PROFESSIONS)[number];
export type EngineeringProfession = (typeof ENGINEERING_PROFESSIONS)[number];
export type ArchitectureAndQsProfession =
  (typeof ARCHITECTURE_AND_QS_PROFESSIONS)[number];
export type SpecialistProfession = (typeof SPECIALIST_PROFESSIONS)[number];
export type ConstructionManagementProfession =
  (typeof CONSTRUCTION_MANAGEMENT_PROFESSIONS)[number];
export type SpecializedTradesProfession =
  (typeof SPECIALIZED_TRADES_PROFESSIONS)[number];

export const isSupplierProfession = (profession: string): boolean =>
  SUPPLIER_PROFESSIONS.includes(profession as SupplierProfession);

export const isRealEstateProfession = (profession: string): boolean =>
  REAL_ESTATE_PROFESSIONS.includes(profession as RealEstateProfession);

export const isEngineeringProfession = (profession: string): boolean =>
  ENGINEERING_PROFESSIONS.includes(profession as EngineeringProfession);

export const isArchitectureProfession = (profession: string): boolean =>
  ARCHITECTURE_AND_QS_PROFESSIONS.includes(
    profession as ArchitectureAndQsProfession,
  );

export const isConstructionManagementProfession = (
  profession: string,
): boolean =>
  CONSTRUCTION_MANAGEMENT_PROFESSIONS.includes(
    profession as ConstructionManagementProfession,
  );

export const isSpecializedTradesProfession = (profession: string): boolean =>
  SPECIALIZED_TRADES_PROFESSIONS.includes(
    profession as SpecializedTradesProfession,
  );

export const isSpecialistProfession = (profession: string): boolean =>
  SPECIALIST_PROFESSIONS.includes(profession as SpecialistProfession);

/**
 * REFACTORED: Strict Kenyan Regulatory Authority Mapping
 * Returns null if the profession does not have a strict mandatory board.
 */
export const getRegulatoryAuthorityCode = (
  profession: string,
): RegulatoryAuthority | null => {
  // 1. Exact Matches (Overrides & Specifics)
  if (profession === "LAND_SURVEYOR") return "ISK";
  if (profession === "REAL_ESTATE_VALUER") return "VRB";
  if (profession === "REAL_ESTATE_AGENT") return "EARB";
  if (profession === "ELECTRICIAN" || profession === "SOLAR_ENERGY_TECHNICIAN")
    return "EPRA";

  // 2. Group Matches
  if (isEngineeringProfession(profession)) return "EBK";
  if (isArchitectureProfession(profession)) return "BORAQS";

  // 3. NCA covers Contractors and formal Trades
  if (
    profession === "GENERAL_CONTRACTOR" ||
    profession === "CLERK_OF_WORKS" ||
    isSpecializedTradesProfession(profession)
  ) {
    return "NCA";
  }

  // Suppliers, Interior Designers, Project Managers, etc., might not have a hardcoded board here
  return null;
};

export const getProfessionRegulatoryBody = (
  profession: string,
): string | null => {
  const code = getRegulatoryAuthorityCode(profession);
  if (!code) return null;
  // Fallback to code if metadata is missing, but optimally it reads "Engineers Board of Kenya (EBK)"
  return AUTHORITY_METADATA[code]?.fullName
    ? `${AUTHORITY_METADATA[code].fullName} (${code})`
    : `${code} (Regulatory Authority)`;
};

export const getProfessionOnboardingConfig = (profession: string) => ({
  showStoreStep: isSupplierProfession(profession),
  showRealEstateCredentials: isRealEstateProfession(profession),
  regulatoryBody: getProfessionRegulatoryBody(profession),
  requiresLicense: !isSupplierProfession(profession),
});
