/**
 * Professional Categories Mapping
 * 
 * This file defines the relationship between:
 * - UI category slugs (used in URLs and page tabs)
 * - Profession values (stored in ProfessionalProfile.servicesOffered)
 * - Human-readable labels (for display)
 */

import {
  ShoppingBasket,
  DraftingCompass,
  Hammer,
  Paintbrush,
  Building2,
  Lightbulb,
  Wrench,
  Sprout,
  HardHat,
  Ruler,
  LucideIcon,
  Home,
} from "lucide-react";

// =============================================================================
// Category to Professions Mapping
// =============================================================================

/**
 * Maps URL-friendly category slugs to the profession values stored in the database.
 * The profession values match the `value` field in ProfessionalForm's PROFESSION_OPTIONS.
 */
export const CATEGORY_TO_PROFESSIONS: Record<string, string[]> = {
  "all": [], // Empty array means no filtering
  
  "architecture": [
    "architect",
    "draftsman",
    "urban_planner",
  ],
  
  "general-contracting": [
    "general_contractor",
    "building_contractor",
    "construction_manager",
    "project_manager",
    "site_supervisor",
  ],
  
  "interior-design": [
    "interior_designer",
  ],
  
  "structural-engineering": [
    "structural_engineer",
    "civil_engineer",
    "geotechnical_engineer",
    "environmental_engineer",
    "water_engineer",
    "mechanical_engineer",
  ],
  
  "electrical": [
    "electrician",
    "electrical_engineer",
    "solar_installer",
    "smart_home_specialist",
    "security_systems",
  ],
  
  "plumbing": [
    "plumber",
    "waterproofing_specialist",
  ],
  
  "landscaping": [
    "landscaper",
    "landscape_architect",
    "pool_builder",
  ],
  
  "construction": [
    "mason",
    "carpenter",
    "welder",
    "glazier",
    "tiler",
    "plasterer",
    "roofing_contractor",
    "flooring_contractor",
    "painting_contractor",
    "demolition_contractor",
    "hvac_technician",
    "fire_safety_specialist",
    "acoustic_consultant",
  ],
  
  "surveying": [
    "quantity_surveyor",
    "land_surveyor",
    "estimator",
    "clerk_of_works",
    "property_valuator",
  ],
  
  "real-estate": [
    "real_estate_agent",
    "realtor",
    "realty_company",
    "property_developer",
  ],
};

// =============================================================================
// Profession Labels (Human-Readable)
// =============================================================================

/**
 * Human-readable labels for profession values.
 * Used for display in cards, badges, and filters.
 */
export const PROFESSION_LABELS: Record<string, string> = {
  // Architecture & Design
  "architect": "Architect",
  "interior_designer": "Interior Designer",
  "landscape_architect": "Landscape Architect",
  "urban_planner": "Urban Planner",
  "draftsman": "Draftsman / CAD Technician",
  
  // Engineering
  "structural_engineer": "Structural Engineer",
  "civil_engineer": "Civil Engineer",
  "mechanical_engineer": "Mechanical Engineer (HVAC)",
  "electrical_engineer": "Electrical Engineer",
  "geotechnical_engineer": "Geotechnical Engineer",
  "environmental_engineer": "Environmental Engineer",
  "water_engineer": "Water & Sanitation Engineer",
  
  // Construction Management
  "construction_manager": "Construction Manager",
  "project_manager": "Project Manager",
  "site_supervisor": "Site Supervisor / Foreman",
  "quantity_surveyor": "Quantity Surveyor",
  "estimator": "Construction Estimator",
  "clerk_of_works": "Clerk of Works",
  
  // Contractors
  "general_contractor": "General Contractor",
  "building_contractor": "Building Contractor",
  "roofing_contractor": "Roofing Contractor",
  "flooring_contractor": "Flooring Contractor",
  "painting_contractor": "Painting Contractor",
  "demolition_contractor": "Demolition Contractor",
  
  // Specialized Trades
  "plumber": "Plumber",
  "electrician": "Electrician",
  "hvac_technician": "HVAC Technician",
  "mason": "Mason / Bricklayer",
  "carpenter": "Carpenter",
  "welder": "Welder / Fabricator",
  "glazier": "Glazier (Glass Work)",
  "tiler": "Tiler",
  "plasterer": "Plasterer",
  "waterproofing_specialist": "Waterproofing Specialist",
  
  // Real Estate
  "real_estate_agent": "Real Estate Agent",
  "realtor": "Realtor",
  "realty_company": "Realty Company",
  "property_developer": "Property Developer",
  "land_surveyor": "Land Surveyor",
  "property_valuator": "Property Valuator",
  
  // Specialists
  "solar_installer": "Solar Panel Installer",
  "pool_builder": "Pool Builder",
  "landscaper": "Landscaper",
  "security_systems": "Security Systems Installer",
  "smart_home_specialist": "Smart Home Specialist",
  "fire_safety_specialist": "Fire Safety Specialist",
  "acoustic_consultant": "Acoustic Consultant",
  
  // Suppliers
  "building_materials_supplier": "Building Materials Supplier",
  "hardware_supplier": "Hardware Supplier",
  "sanitary_supplier": "Sanitary Ware Supplier",
  
  // Fallback
  "other": "Other Professional",
};

// =============================================================================
// Category Definitions (for UI)
// =============================================================================

export interface CategoryDefinition {
  name: string;
  slug: string;
  icon: LucideIcon;
  description: string;
}

/**
 * Category definitions for the professionals page tabs/filters.
 */
export const CATEGORIES: CategoryDefinition[] = [
  {
    name: "All Professionals",
    slug: "all",
    icon: ShoppingBasket,
    description: "Browse all verified professionals",
  },
  {
    name: "Architecture",
    slug: "architecture",
    icon: DraftingCompass,
    description: "Architects & building designers",
  },
  {
    name: "General Contracting",
    slug: "general-contracting",
    icon: Hammer,
    description: "General contractors & builders",
  },
  {
    name: "Interior Design",
    slug: "interior-design",
    icon: Paintbrush,
    description: "Interior designers & decorators",
  },
  {
    name: "Structural Engineering",
    slug: "structural-engineering",
    icon: Building2,
    description: "Structural & civil engineers",
  },
  {
    name: "Electrical",
    slug: "electrical",
    icon: Lightbulb,
    description: "Electrical contractors & lighting",
  },
  {
    name: "Plumbing",
    slug: "plumbing",
    icon: Wrench,
    description: "Plumbers & water specialists",
  },
  {
    name: "Landscaping",
    slug: "landscaping",
    icon: Sprout,
    description: "Landscape architects & gardeners",
  },
  {
    name: "Construction",
    slug: "construction",
    icon: HardHat,
    description: "Construction specialists",
  },
  {
    name: "Surveying",
    slug: "surveying",
    icon: Ruler,
    description: "Land surveyors & quantity surveyors",
  },
  {
    name: "Real Estate",
    slug: "real-estate",
    icon: Home,
    description: "Real estate agents & developers",
  },
];

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get the list of professions for a given category slug.
 * Returns empty array for "all" category (meaning no filtering).
 */
export function getProfessionsForCategory(categorySlug: string): string[] {
  const professions = CATEGORY_TO_PROFESSIONS[categorySlug];
  return professions || [];
}

/**
 * Get the category slug for a given profession value.
 * Returns "other" if no matching category is found.
 */
export function getCategoryForProfession(profession: string): string {
  for (const [category, professions] of Object.entries(CATEGORY_TO_PROFESSIONS)) {
    if (category !== "all" && professions.includes(profession)) {
      return category;
    }
  }
  return "construction"; // Default fallback
}

/**
 * Get the human-readable label for a profession value.
 * Returns the value with formatting if no label is found.
 */
export function getProfessionLabel(profession: string): string {
  if (PROFESSION_LABELS[profession]) {
    return PROFESSION_LABELS[profession];
  }
  // Fallback: convert snake_case to Title Case
  return profession
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Get the category name for a given slug.
 */
export function getCategoryName(categorySlug: string): string {
  const category = CATEGORIES.find(c => c.slug === categorySlug);
  return category?.name || "All Professionals";
}

/**
 * Check if a category slug is valid.
 */
export function isValidCategory(slug: string): boolean {
  return CATEGORIES.some(c => c.slug === slug);
}
