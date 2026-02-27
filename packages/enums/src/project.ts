/**
 * Project and Contracts domain enums for build-market.
 *
 * Values MUST exactly match the Prisma enums (UPPERCASE).
 * Zero runtime dependencies — safe for browser and server.
 *
 * SINGLE SOURCE OF TRUTH — do not duplicate these values elsewhere.
 */

// -------------------------------------------------------------------------
// ProjectType
// -------------------------------------------------------------------------

export const PROJECT_TYPES = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "INDUSTRIAL",
  "MIXED_USE",
  "RENOVATION",
  "INTERIOR_DESIGN",
  "LANDSCAPING",
  "INFRASTRUCTURE",
  "OTHER",
] as const;

export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  RESIDENTIAL: "Residential",
  COMMERCIAL: "Commercial",
  INDUSTRIAL: "Industrial",
  MIXED_USE: "Mixed Use",
  RENOVATION: "Renovation",
  INTERIOR_DESIGN: "Interior Design",
  LANDSCAPING: "Landscaping",
  INFRASTRUCTURE: "Infrastructure",
  OTHER: "Other",
};

export function isProjectType(value: unknown): value is ProjectType {
  return (
    typeof value === "string" &&
    (PROJECT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ProjectStatus
// -------------------------------------------------------------------------

export const PROJECT_STATUSES = [
  "PLANNING",
  "IN_PROGRESS",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
  "CANCELLED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  IN_PROGRESS: "In Progress",
  PAUSED: "Paused",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  CANCELLED: "Cancelled",
};

export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === "string" &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ContractType
// -------------------------------------------------------------------------

export const CONTRACT_TYPES = [
  "LABOR_ONLY",
  "FULL_CONTRACT",
  "DESIGN_ONLY",
  "CONSULTANCY",
] as const;

export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  LABOR_ONLY: "Labor Only",
  FULL_CONTRACT: "Full Contract (Labor & Materials)",
  DESIGN_ONLY: "Design Only",
  CONSULTANCY: "Consultancy",
};

export function isContractType(value: unknown): value is ContractType {
  return (
    typeof value === "string" &&
    (CONTRACT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// MilestoneStatus
// -------------------------------------------------------------------------

export const MILESTONE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "IN_REVIEW",
  "COMPLETED",
  "DELAYED",
] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  DELAYED: "Delayed",
};

export function isMilestoneStatus(value: unknown): value is MilestoneStatus {
  return (
    typeof value === "string" &&
    (MILESTONE_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ApprovalStatus
// -------------------------------------------------------------------------

export const APPROVAL_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "REQUESTED_CHANGE",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_STATUS_LABELS: Record<ApprovalStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REQUESTED_CHANGE: "Requested Change",
};

export function isApprovalStatus(value: unknown): value is ApprovalStatus {
  return (
    typeof value === "string" &&
    (APPROVAL_STATUSES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ProjectDocumentType
// -------------------------------------------------------------------------

export const PROJECT_DOCUMENT_TYPES = [
  "CONTRACT_AGREEMENT",
  "BOQ",
  "INVOICE",
  "RECEIPT",
  "BLUEPRINT_ARCHITECTURAL",
  "BLUEPRINT_STRUCTURAL",
  "NCA_PERMIT",
  "SITE_INSTRUCTION",
  "HANDOVER_CERTIFICATE",
  "OTHER",
] as const;

export type ProjectDocumentType = (typeof PROJECT_DOCUMENT_TYPES)[number];

export const PROJECT_DOCUMENT_TYPE_LABELS: Record<ProjectDocumentType, string> =
  {
    CONTRACT_AGREEMENT: "Contract Agreement",
    BOQ: "Bill of Quantities (BOQ)",
    INVOICE: "Invoice",
    RECEIPT: "Receipt",
    BLUEPRINT_ARCHITECTURAL: "Architectural Blueprint",
    BLUEPRINT_STRUCTURAL: "Structural Blueprint",
    NCA_PERMIT: "NCA Permit",
    SITE_INSTRUCTION: "Site Instruction",
    HANDOVER_CERTIFICATE: "Handover Certificate",
    OTHER: "Other",
  };

export function isProjectDocumentType(
  value: unknown,
): value is ProjectDocumentType {
  return (
    typeof value === "string" &&
    (PROJECT_DOCUMENT_TYPES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ProjectImageCategory
// -------------------------------------------------------------------------

export const PROJECT_IMAGE_CATEGORIES = [
  "SITE_PREPARATION",
  "FOUNDATION",
  "WALLING",
  "ROOFING",
  "FINISHING",
  "SNAG_LIST",
  "MATERIAL_DELIVERY",
  "OTHER",
] as const;

export type ProjectImageCategory = (typeof PROJECT_IMAGE_CATEGORIES)[number];

export const PROJECT_IMAGE_CATEGORY_LABELS: Record<
  ProjectImageCategory,
  string
> = {
  SITE_PREPARATION: "Site Preparation",
  FOUNDATION: "Foundation",
  WALLING: "Walling",
  ROOFING: "Roofing",
  FINISHING: "Finishing",
  SNAG_LIST: "Snag List",
  MATERIAL_DELIVERY: "Material Delivery",
  OTHER: "Other",
};

export function isProjectImageCategory(
  value: unknown,
): value is ProjectImageCategory {
  return (
    typeof value === "string" &&
    (PROJECT_IMAGE_CATEGORIES as readonly string[]).includes(value)
  );
}

// -------------------------------------------------------------------------
// ProjectDurationUnit
// -------------------------------------------------------------------------

export const PROJECT_DURATION_UNITS = [
  "DAYS",
  "WEEKS",
  "MONTHS",
  "YEARS",
] as const;

export type ProjectDurationUnit = (typeof PROJECT_DURATION_UNITS)[number];

export const PROJECT_DURATION_UNIT_LABELS: Record<ProjectDurationUnit, string> =
  {
    DAYS: "Days",
    WEEKS: "Weeks",
    MONTHS: "Months",
    YEARS: "Years",
  };

export function isProjectDurationUnit(
  value: unknown,
): value is ProjectDurationUnit {
  return (
    typeof value === "string" &&
    (PROJECT_DURATION_UNITS as readonly string[]).includes(value)
  );
}
