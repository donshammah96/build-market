/**
 * Shared types for the Professional Onboarding Wizard
 */

import { z } from "zod";
import { RegulatoryAuthority } from "@build/types";
import type { County } from "@build/enums";
import { StoreFormSubmitData } from "../StoreForm";
import type { PropertyFormSubmitData } from "../PropertyForm";
import type { ConsentData } from "./ConsentStep";
import {
  isSupplierProfession,
  isRealEstateProfession,
  isEngineeringProfession,
  isArchitectureProfession,
  PROFESSION_OPTIONS,
  getRegulatoryAuthorityCode,
} from "@/lib/constants/professionOptions";

// ============================================================================
// FORM DATA TYPES
// ============================================================================

/**
 * Base professional form data (shared across steps)
 */
export interface ProfessionalWizardData {
  // Step 1: Profession Selection
  profession: string;
  authority?: RegulatoryAuthority;

  // Step 2: Professional Details
  companyName: string;
  licenseNumber: string;
  yearsExperience?: number;
  website?: string;
  bio?: string;
  county?: County;

  // Step 3a: Store Data
  stores?: StoreFormSubmitData[];

  // Step 3b: Property listing data
  properties?: PropertyFormSubmitData[];

  // Step 3c: Real Estate Credentials (REFACTORED for VRB/ISK/EARB support)
  boardRegistrationNumber?: string;

  // Step 4: Verification Documents
  certificates: Array<{ file: File }>;
  idDocuments: Array<{ file: File }>;

  documents?: Array<{
    uploadId: string;
    previewUrl?: string;
    category: string;
    title?: string;
  }>;

  // Consent step data
  consents?: ConsentData;
}

/**
 * Wizard step definition
 */
export interface WizardStep {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
  /** Condition to determine if this step should be shown */
  condition?: (data: Partial<ProfessionalWizardData>) => boolean;
}

/**
 * Props passed to each step component
 */
export interface StepComponentProps {
  /** Current form data */
  data: Partial<ProfessionalWizardData>;
  /** Update form data */
  onUpdate: (updates: Partial<ProfessionalWizardData>) => void;
  /** Navigate to next step */
  onNext: () => void;
  /** Navigate to previous step */
  onBack: () => void;

  goToStep: (stepId: string) => void;
  /** Whether this is the first step */
  isFirstStep: boolean;
  /** Whether this is the last step */
  isLastStep: boolean;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
}

// ============================================================================
// STEP CONFIGURATIONS
// ============================================================================

/**
 * All possible wizard steps
 */
export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "profession",
    label: "Profession",
    description: "Select Profession",
  },
  { id: "details", label: "Details", description: "Business Details" },
  {
    id: "store",
    label: "Store",
    description: "Setup your store",
    optional: true,
    condition: (data) => isSupplierProfession(data.profession || ""),
  },
  {
    id: "property",
    label: "Property Listing",
    description: "Add an initial property listing",
    optional: true,
    condition: (data) => isRealEstateProfession(data.profession || ""),
  },
  {
    id: "credentials",
    label: "Board Credentials",
    description: "Professional Registration",
    optional: false, // Make it mandatory if they see it
    condition: (data) => {
      // If getRegulatoryAuthorityCode returns a board (e.g., EBK, NCA), show the step
      return getRegulatoryAuthorityCode(data.profession || "") !== null;
    },
  },
  {
    id: "documents",
    label: "Documents",
    description: "Upload Documents",
  },
  {
    id: "consent",
    label: "Consent",
    description: "Terms & Agreements",
  },
  { id: "review", label: "Review", description: "Confirm & Submit" },
];

/**
 * Get the active steps based on current form data
 */
export const getActiveSteps = (
  data: Partial<ProfessionalWizardData>,
): WizardStep[] => {
  return WIZARD_STEPS.filter((step) => !step.condition || step.condition(data));
};

/**
 * Get step index in active steps array
 */
export const getStepIndex = (
  stepId: string,
  data: Partial<ProfessionalWizardData>,
): number => {
  return getActiveSteps(data).findIndex((s) => s.id === stepId);
};

// ============================================================================
// VALIDATION SCHEMAS (per step)
// ============================================================================

export const professionStepSchema = z.object({
  profession: z
    .string()
    .min(1, "Please select your profession")
    .refine((val) => PROFESSION_OPTIONS.some((opt) => opt.value === val), {
      message:
        "Invalid profession selected. Please choose from the provided list.",
    }),
});

export const detailsStepSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  licenseNumber: z.string().optional(),
  yearsExperience: z.coerce
    .number()
    .min(0, "Cannot be negative")
    .max(100, "Invalid experience limit")
    .optional(),
  website: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  bio: z.string().max(1000, "Bio must be less than 1000 characters").optional(),
});

export const credentialsStepSchema = z.object({
  boardRegistrationNumber: z
    .string()
    .min(1, "Board registration number is required"),
});

export const documentsStepSchema = z.object({
  certificates: z.array(z.object({ file: z.instanceof(File) })),
  idDocuments: z.array(z.object({ file: z.instanceof(File) })),
});

/** Schema for validating restored draft from sessionStorage (excludes File fields) */
export const professionalDraftSchema = z.object({
  profession: z.string().optional(),
  companyName: z.string().optional(),
  licenseNumber: z.string().optional(),
  yearsExperience: z.number().optional(),
  website: z.string().optional(),
  bio: z.string().optional(),
  county: z.string().optional(),
  boardRegistrationNumber: z.string().optional(),
  stores: z.array(z.record(z.string(), z.unknown())).optional(),
  properties: z.array(z.record(z.string(), z.unknown())).optional(),
});

export const reviewStepSchema = z
  .object({
    profession: z
      .string()
      .min(1, "Please select your profession")
      .refine((val) => PROFESSION_OPTIONS.some((opt) => opt.value === val), {
        message:
          "Invalid profession selected. Please choose from the provided list.",
      }),
    companyName: z.string().min(1, "Company name is required"),
    licenseNumber: z.string().optional(),
    yearsExperience: z.coerce
      .number()
      .min(0, "Cannot be negative")
      .max(100, "Invalid experience limit")
      .optional(),
    website: z
      .string()
      .url("Please enter a valid URL")
      .optional()
      .or(z.literal("")),
    bio: z
      .string()
      .max(1000, "Bio must be less than 1000 characters")
      .optional(),
    boardRegistrationNumber: z.string().optional(),
  })
  .superRefine((data, context) => {
    if (
      getRegulatoryAuthorityCode(data.profession) !== null &&
      !data.boardRegistrationNumber?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["boardRegistrationNumber"],
        message: "Board registration number is required",
      });
    }
  });

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

export const WIZARD_STYLES = {
  // Card container
  card: "rounded-3xl border border-zinc-800 bg-zinc-900/90 p-6 md:p-8 shadow-2xl backdrop-blur-2xl",

  label: ["text-xs font-semibold uppercase tracking-wider text-zinc-300"].join(
    " ",
  ),

  input: [
    "w-full rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3",
    "text-sm text-white placeholder:text-zinc-500",
    "focus:border-emerald-500 focus:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
    "transition-all duration-200",
  ].join(" "),

  primaryButton: [
    "w-full rounded-xl px-5 py-3",
    "font-semibold text-sm tracking-wide",
    "bg-emerald-500 text-zinc-950",
    "hover:bg-emerald-400 active:scale-[0.98]",
    "transition-all duration-200",
    "shadow-[0_4px_20px_rgba(16,185,129,0.25)]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
  ].join(" "),

  secondaryButton: [
    "px-4 py-2.5 text-xs font-semibold tracking-wide rounded-xl",
    "text-zinc-300 hover:text-white",
    "border border-zinc-700 hover:border-zinc-600",
    "bg-zinc-800/80 hover:bg-zinc-800",
    "transition-all duration-200",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
    "disabled:opacity-40 disabled:cursor-not-allowed",
  ].join(" "),

  error: [
    "mt-1.5 flex items-center gap-1.5",
    "text-xs font-medium text-red-400",
  ].join(" "),
} as const;
