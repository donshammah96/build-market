/**
 * Shared types for the Professional Onboarding Wizard
 */

import { z } from "zod";
import { StoreFormSubmitData } from "../StoreForm";

// ============================================================================
// FORM DATA TYPES
// ============================================================================

/**
 * Base professional form data (shared across steps)
 */
export interface ProfessionalWizardData {
  // Step 1: Profession Selection
  profession: string;

  // Step 2: Professional Details
  companyName: string;
  licenseNumber: string;
  yearsExperience?: number;
  website?: string;
  bio?: string;

  // Step 3a: Store Data (for suppliers only)
  storeData?: StoreFormSubmitData;

  // Step 3b: Real Estate Credentials (for real estate professionals)
  earbNumber?: string;

  // Step 4: Verification Documents
  certificates: Array<{ file: File }>;
  idDocuments: Array<{ file: File }>;

  // Computed URLs after upload (set during submission)
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
  {
    id: "details",
    label: "Details",
    description: "Business information",
  },
  {
    id: "store",
    label: "Store",
    description: "Setup your store",
    optional: true,
    condition: (data) => {
      // Import dynamically to avoid circular dependencies
      const { isSupplierProfession } = require("@/lib/constants/professionOptions");
      return isSupplierProfession(data.profession || "");
    },
  },
  {
    id: "credentials",
    label: "Credentials",
    description: "EARB registration",
    optional: true,
    condition: (data) => {
      const { isRealEstateProfession } = require("@/lib/constants/professionOptions");
      return isRealEstateProfession(data.profession || "");
    },
  },
  {
    id: "documents",
    label: "Documents",
    description: "Upload verification docs",
  },
  {
    id: "review",
    label: "Review",
    description: "Confirm and submit",
  },
];

/**
 * Get the active steps based on current form data
 */
export const getActiveSteps = (data: Partial<ProfessionalWizardData>): WizardStep[] => {
  return WIZARD_STEPS.filter((step) => {
    if (!step.condition) return true;
    return step.condition(data);
  });
};

/**
 * Get step index in active steps array
 */
export const getStepIndex = (
  stepId: string,
  data: Partial<ProfessionalWizardData>
): number => {
  const activeSteps = getActiveSteps(data);
  return activeSteps.findIndex((s) => s.id === stepId);
};

// ============================================================================
// VALIDATION SCHEMAS (per step)
// ============================================================================

export const professionStepSchema = z.object({
  profession: z.string().min(1, "Please select your profession"),
});

export const detailsStepSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  licenseNumber: z.string().optional(),
  yearsExperience: z.number().min(0).max(100).optional(),
  website: z.string().url("Please enter a valid URL").optional().or(z.literal("")),
  bio: z.string().max(1000, "Bio must be less than 1000 characters").optional(),
});

export const credentialsStepSchema = z.object({
  earbNumber: z.string().min(1, "EARB registration number is required"),
});

// ============================================================================
// STYLE CONSTANTS
// ============================================================================

export const WIZARD_STYLES = {
  // Card container
  card: "bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 md:p-8",
  
  // Input base
  input: "w-full bg-white/5 p-3 text-white placeholder:text-slate-400 focus:outline-none transition-colors rounded-md border border-white/30 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400",
  
  // Label
  label: "text-emerald-400 text-xs uppercase tracking-widest font-semibold mb-2 block",
  
  // Primary button
  primaryButton: "w-full font-bold py-3.5 px-6 rounded-lg text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
  
  // Secondary button
  secondaryButton: "py-3 px-6 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50",
  
  // Error text
  error: "text-xs text-red-400 mt-1 flex items-center gap-1",
} as const;
