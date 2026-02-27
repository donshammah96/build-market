/**
 * Shared types for the Professional Onboarding Wizard
 */

import { z } from "zod";
import { RegulatoryAuthority } from "@build/types";
import type { County } from "@build/enums";
import { StoreFormSubmitData } from "../StoreForm";
import type { PropertyFormSubmitData } from "../PropertyForm";
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

  certificatesUrls?: string[];
  idDocumentsUrls?: string[];
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
    description: "Select your profession",
  },
  { id: "details", label: "Details", description: "Business information" },
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
    description: "Upload verification docs",
  },
  { id: "review", label: "Review", description: "Confirm and submit" },
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

export const reviewStepSchema = z.object({
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
  bio: z.string().max(1000, "Bio must be less than 1000 characters").optional(),
  boardRegistrationNumber: z
    .string()
    .min(1, "Board registration number is required"),
});

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

export const WIZARD_STYLES = {
  // Card container
  card: "bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 md:p-8",

  // Input base
  input:
    "w-full bg-white/5 p-3 text-white placeholder:text-slate-400 focus:outline-none transition-colors rounded-md border border-white/30 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400",

  // Label
  label:
    "text-emerald-400 text-xs uppercase tracking-widest font-semibold mb-2 block",

  // Primary button
  primaryButton:
    "w-full font-bold py-3.5 px-6 rounded-lg text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",

  // Secondary button
  secondaryButton:
    "py-3 px-6 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50",

  // Error text
  error: "text-xs text-red-400 mt-1 flex items-center gap-1",
} as const;
