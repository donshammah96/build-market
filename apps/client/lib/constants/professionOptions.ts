/**
 * Profession Options for Professional Onboarding Form
 *
 * Derived from PROFESSION_LABELS in professionalCategories.ts
 * Used in ProfessionalForm Combobox for profession selection
 */

import type { ComboboxOption } from "@/components/ui/combobox";

// ============================================================================
// PROFESSION OPTIONS - Matches Prisma Profession enum
// ============================================================================

export const PROFESSION_OPTIONS: ComboboxOption[] = [
  // Architecture & Design
  { value: "architect", label: "Architect" },
  { value: "interior_designer", label: "Interior Designer" },
  { value: "landscape_architect", label: "Landscape Architect" },
  { value: "urban_planner", label: "Urban Planner" },
  { value: "draftsman", label: "Draftsman / CAD Technician" },

  // Engineering
  { value: "structural_engineer", label: "Structural Engineer" },
  { value: "civil_engineer", label: "Civil Engineer" },
  { value: "mechanical_engineer", label: "Mechanical Engineer (HVAC)" },
  { value: "electrical_engineer", label: "Electrical Engineer" },
  { value: "geotechnical_engineer", label: "Geotechnical Engineer" },
  { value: "environmental_engineer", label: "Environmental Engineer" },
  { value: "water_engineer", label: "Water & Sanitation Engineer" },

  // Construction Management
  { value: "construction_manager", label: "Construction Manager" },
  { value: "project_manager", label: "Project Manager" },
  { value: "site_supervisor", label: "Site Supervisor / Foreman" },
  { value: "quantity_surveyor", label: "Quantity Surveyor" },
  { value: "estimator", label: "Construction Estimator" },
  { value: "clerk_of_works", label: "Clerk of Works" },

  // Contractors
  { value: "contractor", label: "General Contractor" },
  { value: "building_contractor", label: "Building Contractor" },
  { value: "roofing_contractor", label: "Roofing Contractor" },
  { value: "flooring_contractor", label: "Flooring Contractor" },
  { value: "painting_contractor", label: "Painting Contractor" },
  { value: "demolition_contractor", label: "Demolition Contractor" },

  // Specialized Trades
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "hvac_technician", label: "HVAC Technician" },
  { value: "mason", label: "Mason / Bricklayer" },
  { value: "carpenter", label: "Carpenter" },
  { value: "welder", label: "Welder / Fabricator" },
  { value: "glazier", label: "Glazier (Glass Work)" },
  { value: "tiler", label: "Tiler" },
  { value: "plasterer", label: "Plasterer" },
  { value: "waterproofing_specialist", label: "Waterproofing Specialist" },
  { value: "painter", label: "Painter" },
  { value: "roofer", label: "Roofer" },

  // Real Estate
  { value: "real_estate_agent", label: "Real Estate Agent" },
  { value: "realtor", label: "Realtor" },
  { value: "realty_company", label: "Realty Company" },
  { value: "property_developer", label: "Property Developer" },
  { value: "land_surveyor", label: "Land Surveyor" },
  { value: "property_valuator", label: "Property Valuator" },

  // Specialists
  { value: "solar_installer", label: "Solar Panel Installer" },
  { value: "pool_builder", label: "Pool Builder" },
  { value: "landscaper", label: "Landscaper" },
  { value: "security_systems", label: "Security Systems Installer" },
  { value: "smart_home_specialist", label: "Smart Home Specialist" },
  { value: "fire_safety_specialist", label: "Fire Safety Specialist" },
  { value: "acoustic_consultant", label: "Acoustic Consultant" },
  { value: "surveyor", label: "Surveyor" },

  // Suppliers
  {
    value: "building_materials_supplier",
    label: "Building Materials Supplier",
  },
  { value: "hardware_supplier", label: "Hardware Supplier" },
  { value: "sanitary_supplier", label: "Sanitary Ware Supplier" },

  // Other
  { value: "other", label: "Other" },
];

// ============================================================================
// PROFESSION GROUPS - For grouped display (optional)
// ============================================================================

export const PROFESSION_GROUPS = {
  "Architecture & Design": [
    "architect",
    "interior_designer",
    "landscape_architect",
    "urban_planner",
    "draftsman",
  ],
  Engineering: [
    "structural_engineer",
    "civil_engineer",
    "mechanical_engineer",
    "electrical_engineer",
    "geotechnical_engineer",
    "environmental_engineer",
    "water_engineer",
  ],
  "Construction Management": [
    "construction_manager",
    "project_manager",
    "site_supervisor",
    "quantity_surveyor",
    "estimator",
    "clerk_of_works",
  ],
  Contractors: [
    "contractor",
    "building_contractor",
    "roofing_contractor",
    "flooring_contractor",
    "painting_contractor",
    "demolition_contractor",
  ],
  "Specialized Trades": [
    "plumber",
    "electrician",
    "hvac_technician",
    "mason",
    "carpenter",
    "welder",
    "glazier",
    "tiler",
    "plasterer",
    "waterproofing_specialist",
    "painter",
    "roofer",
  ],
  "Real Estate": [
    "real_estate_agent",
    "realtor",
    "realty_company",
    "property_developer",
    "land_surveyor",
    "property_valuator",
  ],
  Specialists: [
    "solar_installer",
    "pool_builder",
    "landscaper",
    "security_systems",
    "smart_home_specialist",
    "fire_safety_specialist",
    "acoustic_consultant",
    "surveyor",
  ],
  Suppliers: [
    "building_materials_supplier",
    "hardware_supplier",
    "sanitary_supplier",
  ],
} as const;

// ============================================================================
// PROFESSION CATEGORY UTILITIES - For conditional form rendering
// ============================================================================

/**
 * Professions that should see StoreForm during onboarding.
 * These are suppliers who need to set up a storefront.
 */
export const SUPPLIER_PROFESSIONS = [
  "building_materials_supplier",
  "hardware_supplier",
  "sanitary_supplier",
] as const;

/**
 * Real estate professions that need EARB credentials.
 * These professionals deal with property transactions.
 */
export const REAL_ESTATE_PROFESSIONS = [
  "real_estate_agent",
  "realtor",
  "realty_company",
  "property_developer",
] as const;

/**
 * Engineering professions that require board registration.
 */
export const ENGINEERING_PROFESSIONS = [
  "structural_engineer",
  "civil_engineer",
  "mechanical_engineer",
  "electrical_engineer",
  "geotechnical_engineer",
  "environmental_engineer",
  "water_engineer",
] as const;

/**
 * Architecture professions that require BORAQS registration.
 */
export const ARCHITECTURE_PROFESSIONS = [
  "architect",
  "landscape_architect",
  "urban_planner",
  "draftsman",
] as const;

// Type exports for the profession categories
export type SupplierProfession = (typeof SUPPLIER_PROFESSIONS)[number];
export type RealEstateProfession = (typeof REAL_ESTATE_PROFESSIONS)[number];
export type EngineeringProfession = (typeof ENGINEERING_PROFESSIONS)[number];
export type ArchitectureProfession = (typeof ARCHITECTURE_PROFESSIONS)[number];

/**
 * Check if a profession is a supplier (should see StoreForm)
 */
export const isSupplierProfession = (profession: string): boolean =>
  SUPPLIER_PROFESSIONS.includes(profession as SupplierProfession);

/**
 * Check if a profession is in real estate (needs EARB credentials)
 */
export const isRealEstateProfession = (profession: string): boolean =>
  REAL_ESTATE_PROFESSIONS.includes(profession as RealEstateProfession);

/**
 * Check if a profession is an engineer (needs EBK registration)
 */
export const isEngineeringProfession = (profession: string): boolean =>
  ENGINEERING_PROFESSIONS.includes(profession as EngineeringProfession);

/**
 * Check if a profession is in architecture (needs BORAQS registration)
 */
export const isArchitectureProfession = (profession: string): boolean =>
  ARCHITECTURE_PROFESSIONS.includes(profession as ArchitectureProfession);

/**
 * Get the regulatory body name for a profession
 */
export const getProfessionRegulatoryBody = (
  profession: string
): string | null => {
  if (isRealEstateProfession(profession))
    return "EARB (Estate Agents Registration Board)";
  if (isEngineeringProfession(profession))
    return "EBK (Engineers Board of Kenya)";
  if (isArchitectureProfession(profession))
    return "BORAQS (Board of Registration of Architects and Quantity Surveyors)";
  if (profession === "quantity_surveyor")
    return "BORAQS (Board of Registration of Architects and Quantity Surveyors)";
  return "NCA (National Construction Authority)";
};

/**
 * Get the step configuration for a profession
 * Returns which optional steps should be shown during onboarding
 */
export const getProfessionOnboardingConfig = (profession: string) => ({
  showStoreStep: isSupplierProfession(profession),
  showRealEstateCredentials: isRealEstateProfession(profession),
  regulatoryBody: getProfessionRegulatoryBody(profession),
  requiresLicense: !isSupplierProfession(profession), // Suppliers may not need NCA license
});
