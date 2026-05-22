/**
 * Profession enum constants for build-market.
 *
 * Values MUST exactly match the Prisma `Profession` enum (UPPERCASE).
 * This file has zero runtime dependencies and is safe to import in both
 * browser (apps/client) and server (packages/db, services) contexts.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 * When Prisma schema changes, update this file and all consumers will
 * automatically stay in sync via TypeScript.
 */

// -------------------------------------------------------------------------
// Canonical array — the ground truth
// -------------------------------------------------------------------------

export const PROFESSIONS = [
  // Architecture & Design
  "ARCHITECT",
  "INTERIOR_DESIGNER",
  "LANDSCAPE_ARCHITECT",
  "URBAN_PLANNER",
  // Engineering
  "STRUCTURAL_ENGINEER",
  "CIVIL_ENGINEER",
  "MECHANICAL_ENGINEER",
  "ELECTRICAL_ENGINEER",
  "QUANTITY_SURVEYOR",
  // Construction Management
  "PROJECT_MANAGER",
  "CLERK_OF_WORKS",
  // Trades & Artisans
  "GENERAL_CONTRACTOR",
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
  // Specialists
  "SOLAR_ENERGY_TECHNICIAN",
  "BOREHOLE_DRILLER",
  "CCTV_AND_SECURITY_PRO",
  "INTERNET_AND_NETWORK_PRO",
  // Real Estate & Valuation
  "LAND_SURVEYOR",
  "REAL_ESTATE_VALUER",
  "REAL_ESTATE_AGENT",
  // Vendors
  "MATERIAL_SUPPLIER",
  "EQUIPMENT_RENTER",
  // Other
  "OTHER",
] as const;

// -------------------------------------------------------------------------
// TypeScript type derived from the array — always in sync
// -------------------------------------------------------------------------

export type Profession = (typeof PROFESSIONS)[number];

// -------------------------------------------------------------------------
// Human-readable display labels for UI
// -------------------------------------------------------------------------

export const PROFESSION_LABELS: Record<Profession, string> = {
  ARCHITECT: "Architect",
  INTERIOR_DESIGNER: "Interior Designer",
  LANDSCAPE_ARCHITECT: "Landscape Architect",
  URBAN_PLANNER: "Urban Planner",
  STRUCTURAL_ENGINEER: "Structural Engineer",
  CIVIL_ENGINEER: "Civil Engineer",
  MECHANICAL_ENGINEER: "Mechanical Engineer (HVAC)",
  ELECTRICAL_ENGINEER: "Electrical Engineer",
  QUANTITY_SURVEYOR: "Quantity Surveyor",
  PROJECT_MANAGER: "Project Manager",
  CLERK_OF_WORKS: "Clerk of Works",
  GENERAL_CONTRACTOR: "General Contractor",
  MASON: "Mason / Bricklayer",
  ELECTRICIAN: "Electrician",
  PLUMBER: "Plumber",
  CARPENTER: "Carpenter",
  JOINER: "Joiner",
  PAINTER: "Painter",
  WELDER: "Welder / Fabricator",
  GLAZIER: "Glazier (Glass Work)",
  ROOFER: "Roofer",
  STEEL_FIXER: "Steel Fixer",
  FLOORING_SPECIALIST: "Flooring Specialist",
  PLASTERER: "Plasterer",
  HVAC_TECHNICIAN: "HVAC Technician",
  SOLAR_ENERGY_TECHNICIAN: "Solar Energy Technician",
  BOREHOLE_DRILLER: "Borehole Driller",
  CCTV_AND_SECURITY_PRO: "CCTV & Security Professional",
  INTERNET_AND_NETWORK_PRO: "Internet & Network Professional",
  LAND_SURVEYOR: "Land Surveyor",
  REAL_ESTATE_VALUER: "Real Estate Valuer",
  REAL_ESTATE_AGENT: "Real Estate Agent",
  MATERIAL_SUPPLIER: "Material Supplier",
  EQUIPMENT_RENTER: "Equipment Renter",
  OTHER: "Other",
};

export const PROFESSION_GROUPS: Record<string, Profession[]> = {
  "Architecture & Design": [
    "ARCHITECT",
    "INTERIOR_DESIGNER",
    "LANDSCAPE_ARCHITECT",
    "URBAN_PLANNER",
  ],
  Engineering: [
    "STRUCTURAL_ENGINEER",
    "CIVIL_ENGINEER",
    "MECHANICAL_ENGINEER",
    "ELECTRICAL_ENGINEER",
    "QUANTITY_SURVEYOR",
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
  "Real Estate": ["LAND_SURVEYOR", "REAL_ESTATE_VALUER"],
  Specialists: [
    "SOLAR_ENERGY_TECHNICIAN",
    "BOREHOLE_DRILLER",
    "CCTV_AND_SECURITY_PRO",
    "INTERNET_AND_NETWORK_PRO",
  ],
};

// -------------------------------------------------------------------------
// Type guard
// -------------------------------------------------------------------------

export function isProfession(value: unknown): value is Profession {
  return (
    typeof value === "string" &&
    (PROFESSIONS as readonly string[]).includes(value)
  );
}
