"use client";

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Loader2 } from "lucide-react";

import {
  ProfessionalOnboardingData,
  Profession,
  County,
  type AreaUnit,
  type PropertyType,
  type PropertyCategory,
  type PropertyDocumentType,
} from "@build/types";
import { PropertyTenure } from "@build/enums";
import {
  StepProgress,
  CompactStepProgress,
} from "@/components/ui/step-progress";
import { API_ROUTES } from "@/lib/links";
import { getRegulatoryAuthorityCode } from "@/lib/constants/professionOptions";
import {
  ProfessionStep,
  DetailsStep,
  StoreStep,
  PropertyStep,
  CredentialsStep,
  DocumentsStep,
  ReviewStep,
  getActiveSteps,
  ProfessionalWizardData,
} from "./professional-wizard";

// ============================================================================
// TYPES
// ============================================================================

export type ProfessionalFormMode = "onboarding" | "completion";
export type ProfessionalFormVariant = "dark" | "light";

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  onboarding: "professional_onboarding_draft",
  completion: "professional_completion_draft",
} as const;

// Theme-aware styles
const createTheme = (variant: ProfessionalFormVariant) => {
  const isDark = variant === "dark";
  return {
    container: isDark ? "max-w-2xl mx-auto" : "max-w-2xl mx-auto",
    loadingOverlay: isDark
      ? "fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center"
      : "fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center",
    loadingSpinner: isDark ? "text-emerald-500" : "text-emerald-600",
    loadingText: isDark
      ? "text-emerald-500 font-medium animate-pulse"
      : "text-emerald-600 font-medium animate-pulse",
  };
};

// Animation variants for step transitions
const stepVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0,
  }),
};

interface Props {
  /** Mode determines behavior: onboarding (new user) vs completion (existing profile) */
  mode?: ProfessionalFormMode;
  /** Theme variant */
  variant?: ProfessionalFormVariant;
  /** Initial data to pre-populate the form (for completion mode) */
  initialData?: Partial<ProfessionalWizardData>;
  /** Called when user clicks back on first step (onboarding mode only) */
  onBack?: () => void;
  /** Called to submit the form data */
  onSubmit: (data: ProfessionalOnboardingData) => Promise<void>;
  /** Called on successful submission */
  onSuccess?: (data: ProfessionalOnboardingData) => void;
  /** Deprecated: use onSuccess instead */
  onAuthSuccess?: (response: ProfessionalOnboardingData) => void;
}

// ============================================================================
// SUCCESS CARD COMPONENT
// ============================================================================

interface SuccessCardProps {
  mode: ProfessionalFormMode;
  variant: ProfessionalFormVariant;
  onEdit: () => void;
  onGoDashboard: () => void;
  isNavigating?: boolean;
}

const SuccessCard: React.FC<SuccessCardProps> = ({
  mode,
  variant,
  onEdit,
  onGoDashboard,
  isNavigating,
}) => {
  const isDark = variant === "dark";
  const isCompletion = mode === "completion";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={
        isDark
          ? "bg-white/5 backdrop-blur-sm border border-white/20 p-8 max-w-md mx-auto text-center rounded-xl"
          : "bg-white border border-zinc-200 shadow-lg p-8 max-w-md mx-auto text-center rounded-xl"
      }
    >
      <div className={isDark ? "mb-4 text-amber-500" : "mb-4 text-emerald-500"}>
        <Award
          className={`w-12 h-12 inline-block ${isDark ? "drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "drop-shadow-md"}`}
        />
      </div>
      <h3
        className={
          isDark
            ? "font-playfair text-2xl text-white mb-2 drop-shadow-lg"
            : "font-semibold text-2xl text-zinc-900 mb-2"
        }
      >
        {isCompletion ? "Profile Updated!" : "Thanks — application received"}
      </h3>
      <p className={isDark ? "text-slate-200 mb-6" : "text-zinc-600 mb-6"}>
        {isCompletion
          ? "Your profile has been updated successfully. You're all set to start connecting with clients!"
          : "Our team will review your documents and contact you within 3 business days for verification."}
      </p>
      <div className="flex gap-4 justify-center">
        <button
          onClick={onGoDashboard}
          disabled={isNavigating}
          className={
            isDark
              ? "text-sm border-b border-emerald-400/50 pb-1 text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 flex items-center gap-2"
              : "text-sm border-b border-emerald-600/50 pb-1 text-emerald-600 hover:text-emerald-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          }
        >
          {isNavigating && <Loader2 className="h-3 w-3 animate-spin" />}
          Go to Dashboard
        </button>
        <button
          onClick={onEdit}
          disabled={isNavigating}
          className={
            isDark
              ? "text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              : "text-sm text-zinc-400 hover:text-zinc-900 transition-colors disabled:opacity-50"
          }
        >
          {isCompletion ? "Make more changes" : "Edit application"}
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ProfessionalForm: React.FC<Props> = ({
  mode = "onboarding",
  variant = "dark",
  initialData,
  onBack,
  onSubmit,
  onSuccess,
  onAuthSuccess,
}) => {
  const router = useRouter();
  const storageKey = STORAGE_KEYS[mode];
  const theme = createTheme(variant);

  // ========================================
  // STATE
  // ========================================

  // Wizard step state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(0); // For animation direction

  // Form data state - merge initialData with localStorage draft
  const [formData, setFormData] = useState<Partial<ProfessionalWizardData>>(
    () => {
      // Start with initial data if provided (completion mode)
      const baseData: Partial<ProfessionalWizardData> = initialData
        ? {
            ...initialData,
            // Don't restore File objects from initialData
            certificates: [],
            idDocuments: [],
          }
        : {
            profession: "",
            companyName: "",
            licenseNumber: "",
            certificates: [],
            idDocuments: [],
          };

      // Try to restore from localStorage (may have more recent edits)
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Merge with base data, localStorage takes precedence for edited fields
            return {
              ...baseData,
              ...parsed,
              certificates: [],
              idDocuments: [],
            };
          } catch {
            // Invalid saved data, use base
          }
        }
      }
      return baseData;
    },
  );

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // ========================================
  // COMPUTED VALUES
  // ========================================

  // Get active steps based on selected profession
  const activeSteps = useMemo(() => getActiveSteps(formData), [formData]);

  // Current step
  const currentStep = activeSteps[currentStepIndex];

  // Progress indicator steps (for UI)
  const progressSteps = useMemo(
    () =>
      activeSteps.map((step) => ({
        id: step.id,
        label: step.label,
        description: step.description,
        optional: step.optional,
      })),
    [activeSteps],
  );

  // ========================================
  // PERSISTENCE
  // ========================================

  // Save to localStorage when form data changes (excluding files)
  useEffect(() => {
    if (typeof window !== "undefined" && formData.profession) {
      const dataToSave = {
        ...formData,
        certificates: undefined,
        idDocuments: undefined,
        stores: formData.stores,
        properties: formData.properties,
      };
      localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    }
  }, [formData, storageKey]);

  // Clear localStorage on successful submission
  const clearSavedData = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  // ========================================
  // NAVIGATION
  // ========================================

  // Track if we should submit on next render (to avoid stale closure)
  const [shouldSubmit, setShouldSubmit] = useState(false);

  const handleBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setCurrentStepIndex((prev) => prev - 1);
    } else if (onBack) {
      onBack();
    } else if (mode === "completion") {
      router.push("/professional-portal/dashboard");
    }
  }, [currentStepIndex, onBack, mode, router]);

  const goToStep = useCallback(
    (stepId: string) => {
      const stepIndex = activeSteps.findIndex((s) => s.id === stepId);
      if (stepIndex !== -1) {
        setDirection(stepIndex > currentStepIndex ? 1 : -1);
        setCurrentStepIndex(stepIndex);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        console.error(`Step ${stepId} is currently not active.`);
      }
    },
    [activeSteps, currentStepIndex],
  );

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex < currentStepIndex) {
        setDirection(-1);
        setCurrentStepIndex(stepIndex);
      }
    },
    [currentStepIndex],
  );

  // ========================================
  // FORM DATA UPDATES
  // ========================================

  const handleUpdate = useCallback(
    (updates: Partial<ProfessionalWizardData>) => {
      setFormData((prev) => {
        const newData = { ...prev, ...updates };
        const newActiveSteps = getActiveSteps(newData);
        if (currentStepIndex >= newActiveSteps.length) {
          setCurrentStepIndex(newActiveSteps.length - 1);
        }
        return newData;
      });
    },
    [currentStepIndex],
  );

  // ========================================
  // TRIGGER SUBMISSION
  // ========================================

  useEffect(() => {
    if (shouldSubmit && !isSubmitting) {
      setShouldSubmit(false);
      handleSubmitForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldSubmit, isSubmitting]);

  // ========================================
  // FILE UPLOAD HELPER
  // ========================================

  const uploadFiles = useCallback(
    async (
      files: File[],
      fieldName: string,
      signal?: AbortSignal,
      onProgress?: (uploaded: number, total: number, fileName: string) => void,
    ): Promise<string[]> => {
      if (files.length === 0) return [];

      const urls: string[] = [];
      const totalFiles = files.length;
      let uploadedIndex = 0;

      for (const file of files) {
        if (signal?.aborted) {
          throw new DOMException("Upload cancelled", "AbortError");
        }

        onProgress?.(uploadedIndex, totalFiles, file.name);

        const form = new FormData();
        form.append(fieldName, file);

        try {
          const res = await fetch(API_ROUTES.onboardingUploads, {
            method: "POST",
            body: form,
            signal,
          });

          if (!res.ok) {
            const errorText = await res.text().catch(() => "");
            throw new Error(
              errorText || `Upload failed with status ${res.status}`,
            );
          }

          const json = await res.json();
          const uploadedUrl = json.uploaded?.[fieldName]?.[0]?.url;

          if (uploadedUrl) {
            urls.push(uploadedUrl);
          } else {
            throw new Error("No URL returned from server");
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") {
            throw err;
          }
          console.error(`Failed to upload ${file.name}:`, err);
          toast.error(`Failed to upload "${file.name}"`);
        }

        uploadedIndex++;
      }

      onProgress?.(totalFiles, totalFiles, "");
      return urls;
    },
    [],
  );

  // ========================================
  // FORM SUBMISSION
  // ========================================

  const handleSubmitForm = useCallback(async () => {
    setIsSubmitting(true);
    const toastId = toast.loading("Preparing your application…");

    try {
      const certificateFiles = formData.certificates?.map((c) => c.file) ?? [];
      const idDocumentFiles = formData.idDocuments?.map((d) => d.file) ?? [];

      let certificatesUrls: string[] = [];
      let idDocumentsUrls: string[] = [];

      // 1. Upload Certificates
      if (certificateFiles.length > 0) {
        certificatesUrls = await uploadFiles(
          certificateFiles,
          "certificates",
          undefined,
          (up, tot, name) => {
            if (name)
              toast.loading(`Uploading certificate ${up + 1}/${tot}: ${name}`, {
                id: toastId,
              });
          },
        );
      }

      // 2. Upload IDs
      if (idDocumentFiles.length > 0) {
        idDocumentsUrls = await uploadFiles(
          idDocumentFiles,
          "idDocuments",
          undefined,
          (up, tot, name) => {
            if (name)
              toast.loading(`Uploading ID document ${up + 1}/${tot}: ${name}`, {
                id: toastId,
              });
          },
        );
      }

      toast.loading("Submitting your application…", { id: toastId });

      // 3. Resolve Domain Logic
      const professionEnum = (formData.profession as Profession) || "OTHER";
      const authority =
        formData.authority ||
        getRegulatoryAuthorityCode(formData.profession || "") ||
        "OTHER";

      // STAFF FIX: Unified License Mapping
      const finalLicenseNumber =
        formData.boardRegistrationNumber || formData.licenseNumber || "PENDING";

      // 4. Construct Payload
      const payload: ProfessionalOnboardingData = {
        role: "professional",
        profession: professionEnum,
        companyName: formData.companyName || "",
        county: formData.county as County,
        yearsExperience: formData.yearsExperience,
        website: formData.website,
        bio: formData.bio,
        license: {
          authority,
          licenseNumber: finalLicenseNumber,
          certificateUrl: certificatesUrls[0] || "",
        },
        documents: idDocumentsUrls.map((url) => ({
          category: "ID_OR_PASSPORT",
          assetId: url,
        })),
        ...(formData.stores?.length && {
          stores: formData.stores.map((s: any) => ({
            ...s,
            role: "professional",
          })),
        }),
        ...(formData.properties?.length && {
          properties: formData.properties.map((p: any) => ({
            ...p,
            role: "professional",
          })),
        }),
      };

      // 5. Execute Parent Submit
      await onSubmit(payload);

      // 6. Cleanup & Success States
      clearSavedData();
      setSuccess(true);
      toast.success(
        mode === "completion"
          ? "Profile updated successfully!"
          : "Application received.",
        { id: toastId },
      );

      // 7. Fire Callbacks
      if (onSuccess) onSuccess(payload);
      else if (onAuthSuccess) onAuthSuccess(payload);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Failed to submit. Please try again.",
        { id: toastId },
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    // DEPENDENCY ARRAY: Everything external that this function relies on
    formData,
    mode,
    uploadFiles,
    onSubmit,
    clearSavedData,
    onSuccess,
    onAuthSuccess,
  ]);

  // ========================================
  // POST-SUCCESS NAVIGATION
  // ========================================
  const handleNext = useCallback(() => {
    if (currentStepIndex < activeSteps.length - 1) {
      setDirection(1);
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleSubmitForm();
    }
  }, [currentStepIndex, activeSteps.length, handleSubmitForm]);

  const handleGoDashboard = useCallback(() => {
    setNavigating(true);
    if (formData.stores && formData.stores.length > 0) {
      router.push("/professional-portal/settings/stores");
    } else {
      router.push("/professional-portal/dashboard");
    }
  }, [formData.stores, router]);

  // ========================================
  // RENDER SUCCESS STATE
  // ========================================

  if (success) {
    // In completion mode, skip success card and go directly to dashboard
    if (mode === "completion") {
      return (
        <SuccessCard
          mode={mode}
          variant={variant}
          onEdit={() => setSuccess(false)}
          onGoDashboard={handleGoDashboard}
          isNavigating={navigating}
        />
      );
    }

    return (
      <SuccessCard
        mode={mode}
        variant={variant}
        onEdit={() => setSuccess(false)}
        onGoDashboard={handleGoDashboard}
        isNavigating={navigating}
      />
    );
  }

  // ========================================
  // RENDER STEP CONTENT
  // ========================================

  const stepProps = {
    data: formData,
    onUpdate: handleUpdate,
    onNext: handleNext,
    onBack: handleBack,
    goToStep, // <--- PASSED DOWN HERE
    isFirstStep: currentStepIndex === 0,
    isLastStep: currentStepIndex === activeSteps.length - 1,
    isSubmitting,
  };

  const renderStepContent = () => {
    switch (currentStep?.id) {
      case "profession":
        return <ProfessionStep {...stepProps} />;
      case "details":
        return <DetailsStep {...stepProps} />;
      case "store":
        return <StoreStep {...stepProps} />;
      case "property":
        return <PropertyStep {...stepProps} />;
      case "credentials":
        return <CredentialsStep {...stepProps} />;
      case "documents":
        return <DocumentsStep {...stepProps} />;
      case "review":
        return <ReviewStep {...stepProps} />;
      default:
        return <ProfessionStep {...stepProps} />;
    }
  };

  return (
    <div className={theme.container}>
      <div className="mb-8">
        <div className="hidden md:block">
          <StepProgress
            steps={activeSteps}
            currentStep={currentStepIndex}
            onStepClick={(idx) => {
              const targetStepId = activeSteps[idx]?.id;
              if (targetStepId) {
                goToStep(targetStepId);
              }
            }}
            allowClickOnCompleted
            theme={variant}
          />
        </div>
        <div className="md:hidden">
          <CompactStepProgress
            currentStep={currentStepIndex}
            totalSteps={activeSteps.length}
            variant={variant}
          />
        </div>
      </div>

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep?.id}
          custom={direction}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            x: { type: "spring", stiffness: 300, damping: 30 },
            opacity: { duration: 0.2 },
          }}
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>

      {isSubmitting && (
        <div className={theme.loadingOverlay}>
          <div className="flex flex-col items-center gap-3">
            <Loader2
              className={`h-8 w-8 animate-spin ${theme.loadingSpinner}`}
            />
            <span className={theme.loadingText}>
              {mode === "completion"
                ? "Updating Profile..."
                : "Creating Profile..."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalForm;
