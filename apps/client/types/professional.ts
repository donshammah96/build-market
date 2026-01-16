// Type definitions aligned with ProfessionalProfile schema

import { County, COUNTY_LABELS } from "./store";

// ============================================================================
// ENUMS - Professional Categories (from Prisma schema)
// ============================================================================

// Professional service categories - matches Prisma Profession enum
export type Profession =
  // Architecture & Design
  | "architect"
  | "interior_designer"
  | "landscape_architect"
  | "urban_planner"
  | "draftsman"
  // Engineering
  | "structural_engineer"
  | "civil_engineer"
  | "mechanical_engineer"
  | "electrical_engineer"
  | "geotechnical_engineer"
  | "environmental_engineer"
  | "water_engineer"
  // Construction Management
  | "construction_manager"
  | "project_manager"
  | "site_supervisor"
  | "quantity_surveyor"
  | "estimator"
  | "clerk_of_works"
  // Contractors
  | "contractor"
  | "building_contractor"
  | "roofing_contractor"
  | "flooring_contractor"
  | "painting_contractor"
  | "demolition_contractor"
  // Specialized Trades
  | "plumber"
  | "electrician"
  | "hvac_technician"
  | "mason"
  | "carpenter"
  | "welder"
  | "glazier"
  | "tiler"
  | "plasterer"
  | "waterproofing_specialist"
  | "painter"
  | "roofer"
  // Real Estate
  | "real_estate_agent"
  | "realtor"
  | "realty_company"
  | "property_developer"
  | "land_surveyor"
  | "property_valuator"
  | "surveyor"
  // Specialists
  | "solar_installer"
  | "pool_builder"
  | "landscaper"
  | "security_systems"
  | "smart_home_specialist"
  | "fire_safety_specialist"
  | "acoustic_consultant"
  // Suppliers
  | "building_materials_supplier"
  | "hardware_supplier"
  | "sanitary_supplier"
  // Other
  | "other";

// Professional verification status - matches Prisma VerificationStatus enum
export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "NEEDS_CORRECTION";

// Certificate verification status - matches Prisma CertificateVerificationStatus enum
export type CertificateVerificationStatus = "pending" | "verified" | "rejected";

// ============================================================================
// LABELS - Human-readable labels
// ============================================================================

export const PROFESSION_LABELS: Record<Profession, string> = {
  // Architecture & Design
  architect: "Architect",
  interior_designer: "Interior Designer",
  landscape_architect: "Landscape Architect",
  urban_planner: "Urban Planner",
  draftsman: "Draftsman / CAD Technician",
  // Engineering
  structural_engineer: "Structural Engineer",
  civil_engineer: "Civil Engineer",
  mechanical_engineer: "Mechanical Engineer (HVAC)",
  electrical_engineer: "Electrical Engineer",
  geotechnical_engineer: "Geotechnical Engineer",
  environmental_engineer: "Environmental Engineer",
  water_engineer: "Water & Sanitation Engineer",
  // Construction Management
  construction_manager: "Construction Manager",
  project_manager: "Project Manager",
  site_supervisor: "Site Supervisor / Foreman",
  quantity_surveyor: "Quantity Surveyor",
  estimator: "Construction Estimator",
  clerk_of_works: "Clerk of Works",
  // Contractors
  contractor: "General Contractor",
  building_contractor: "Building Contractor",
  roofing_contractor: "Roofing Contractor",
  flooring_contractor: "Flooring Contractor",
  painting_contractor: "Painting Contractor",
  demolition_contractor: "Demolition Contractor",
  // Specialized Trades
  plumber: "Plumber",
  electrician: "Electrician",
  hvac_technician: "HVAC Technician",
  mason: "Mason / Bricklayer",
  carpenter: "Carpenter",
  welder: "Welder / Fabricator",
  glazier: "Glazier (Glass Work)",
  tiler: "Tiler",
  plasterer: "Plasterer",
  waterproofing_specialist: "Waterproofing Specialist",
  painter: "Painter",
  roofer: "Roofer",
  // Real Estate
  real_estate_agent: "Real Estate Agent",
  realtor: "Realtor",
  realty_company: "Realty Company",
  property_developer: "Property Developer",
  land_surveyor: "Land Surveyor",
  property_valuator: "Property Valuator",
  surveyor: "Surveyor",
  // Specialists
  solar_installer: "Solar Panel Installer",
  pool_builder: "Pool Builder",
  landscaper: "Landscaper",
  security_systems: "Security Systems Installer",
  smart_home_specialist: "Smart Home Specialist",
  fire_safety_specialist: "Fire Safety Specialist",
  acoustic_consultant: "Acoustic Consultant",
  // Suppliers
  building_materials_supplier: "Building Materials Supplier",
  hardware_supplier: "Hardware Supplier",
  sanitary_supplier: "Sanitary Ware Supplier",
  // Other
  other: "Other",
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  UNVERIFIED: "Unverified",
  PENDING: "Pending Review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  NEEDS_CORRECTION: "Needs Correction",
};

// ============================================================================
// INTERFACES - Service Category (matches Prisma ServiceCategory model)
// ============================================================================

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
  professionType?: Profession | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// INTERFACES - Professional Images & Documents
// ============================================================================

// Matches Prisma ProfessionalImage model
export interface ProfessionalImage {
  id: string;
  professionalId: string;
  url: string;
  key?: string | null;
  caption?: string | null;
  isMain: boolean;
  sortOrder: number;
  createdAt: Date | string;
}

// Attachment types for documents - matches Prisma AttachmentType enum (subset)
export type ProfessionalAttachmentType =
  | "NATIONAL_ID"
  | "KRA_PIN"
  | "EARB_CERTIFICATE"
  | "PRACTICING_LICENCE";

// Matches Prisma ProfessionalDocument model
export interface ProfessionalDocument {
  id: string;
  professionalId: string;
  fileUrl: string;
  fileKey?: string | null;
  type: ProfessionalAttachmentType;
  isVerified: boolean;
  verifiedAt?: Date | string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// ============================================================================
// INTERFACES - Certificate (matches Prisma Certificate model)
// ============================================================================

export interface Certificate {
  id: string;
  professionalId: string;
  name: string;
  issuer: string;
  issueDate?: Date | string | null;
  expiryDate?: Date | string | null;
  fileUrl: string;
  fileKey?: string | null;
  verificationStatus: CertificateVerificationStatus;
  verifiedAt?: Date | string | null;
  verifiedById?: string | null;
  notes?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Simplified certificate data for display
export interface CertificateData {
  id: string;
  name: string;
  issuer: string;
  issueDate?: Date | string | null;
  expiryDate?: Date | string | null;
  fileUrl: string;
  verificationStatus: CertificateVerificationStatus;
  verifiedAt?: Date | string | null;
}

// ============================================================================
// INTERFACES - Portfolio (matches Prisma Portfolio model)
// ============================================================================

export interface PortfolioImage {
  id: string;
  portfolioId: string;
  url: string;
  key?: string | null;
  caption?: string | null;
  isMain: boolean;
  isBefore: boolean;
  isAfter: boolean;
  sortOrder: number;
  createdAt: Date | string;
}

export interface Portfolio {
  id: string;
  professionalId: string;
  title: string;
  description?: string | null;
  projectType: string;
  clientTestimonial?: string | null;
  completedAt?: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  images?: PortfolioImage[];
}

// ============================================================================
// INTERFACES - Review (matches Prisma Review model for professionals)
// ============================================================================

export interface ProfessionalReview {
  id: string;
  reviewerId: string;
  reviewer: {
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
  };
  type: "professional";
  rating: number;
  comment?: string | null;
  approved: boolean;
  projectId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

// Legacy Review interface for backwards compatibility
export interface Review {
  id: string;
  reviewerId: string;
  reviewer: {
    firstName?: string | null;
    lastName?: string | null;
    avatar?: string | null;
  };
  rating: number;
  comment?: string | null;
  approved: boolean;
  createdAt: Date | string;
}

// ============================================================================
// INTERFACES - Professional Profile (matches Prisma ProfessionalProfile model)
// ============================================================================

export interface ProfessionalProfile {
  userId: string;
  user: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
    phone?: string | null;
    avatar?: string | null;
  };
  profession: Profession;
  companyName: string;
  licenseNumber?: string | null;
  yearsExperience?: number | null;
  services?: ServiceCategory[];
  portfolioUrl?: string | null;
  website?: string | null;
  bio?: string | null;

  // Location
  city?: string | null;
  county?: string | null;
  country?: string | null;

  // Verification (for real estate agents)
  earbNumber?: string | null;
  status: VerificationStatus;
  verified: boolean;

  createdAt: Date | string;
  updatedAt: Date | string;

  // Media attachments
  images?: ProfessionalImage[];
  documents?: ProfessionalDocument[];

  // Business relations
  portfolios?: Portfolio[];
  certificates?: Certificate[];
  reviews?: ProfessionalReview[];

  _count?: {
    reviews: number;
    projects: number;
    stores: number;
    properties: number;
  };
}

// ============================================================================
// INTERFACES - Display Types
// ============================================================================

// For display purposes in cards/lists
export interface ProfessionalCardData {
  id: string;
  name: string;
  companyName: string;
  profession: Profession;
  professionLabel: string;
  title: string; // main service/specialty
  bio?: string;
  services?: ServiceCategory[];
  serviceNames?: string[]; // Simplified service names for display
  yearsExperience?: number;
  status: VerificationStatus;
  verified: boolean;
  rating?: number;
  reviewCount?: number;
  projectCount?: number;
  portfolioImage?: string;
  profileImage?: string;
  city?: string;
  county?: string;
  country?: string;
  location?: string; // Formatted location string
  certificates?: CertificateData[];
  portfolioUrl?: string;
  profileUrl?: string;
}

export interface Location {
  city: string;
  county: string;
  country?: string;
}

// Professional list/search response
export interface ProfessionalListResponse {
  professionals: ProfessionalProfile[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Professional filter options
export interface ProfessionalFilters {
  profession?: Profession;
  services?: string[]; // Service category IDs
  city?: string;
  county?: string;
  verified?: boolean;
  status?: VerificationStatus;
  search?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper function to get main image from ProfessionalImage array
function getMainImage(images?: ProfessionalImage[]): string | undefined {
  if (!images || images.length === 0) return undefined;
  const mainImage = images.find((img) => img.isMain);
  return mainImage?.url ?? images[0]?.url;
}

// Helper function to format location
function formatLocation(profile: ProfessionalProfile): string | undefined {
  const parts = [profile.city, profile.county, profile.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

// Helper function to convert ProfessionalProfile to ProfessionalCardData
export function toProfessionalCardData(
  profile: ProfessionalProfile
): ProfessionalCardData {
  const fullName = profile.user
    ? `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim()
    : profile.companyName;

  return {
    id: profile.userId,
    name: fullName || profile.companyName,
    companyName: profile.companyName,
    profession: profile.profession,
    professionLabel: PROFESSION_LABELS[profile.profession],
    title: PROFESSION_LABELS[profile.profession],
    bio: profile.bio ?? undefined,
    services: profile.services,
    serviceNames: profile.services?.map((s) => s.name),
    yearsExperience: profile.yearsExperience ?? undefined,
    status: profile.status,
    verified: profile.verified,
    rating: undefined, // Calculate from reviews if needed
    reviewCount: profile._count?.reviews,
    projectCount: profile._count?.projects,
    portfolioImage: profile.portfolios?.[0]?.images?.[0]?.url,
    profileImage: profile.user?.avatar ?? getMainImage(profile.images),
    city: profile.city ?? undefined,
    county: profile.county ?? undefined,
    country: profile.country ?? undefined,
    location: formatLocation(profile),
    certificates: profile.certificates?.map((c) => ({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      issueDate: c.issueDate,
      expiryDate: c.expiryDate,
      fileUrl: c.fileUrl,
      verificationStatus: c.verificationStatus,
      verifiedAt: c.verifiedAt,
    })),
    portfolioUrl: profile.portfolioUrl ?? undefined,
    profileUrl: `/professionals/${profile.userId}`,
  };
}

// Re-export County for convenience
export { type County, COUNTY_LABELS };
