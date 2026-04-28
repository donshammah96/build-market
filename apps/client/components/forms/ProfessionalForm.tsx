"use client";

import React, {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Award, Loader2 } from "lucide-react";

import {
  ProfessionalOnboardingData,
  Profession,
  County,
  StoreOnboardingSchema,
  PropertyOnboardingSchema,
} from "@build/types";
import { DocumentCategory } from "@build/enums";
import {
  StepProgress,
  CompactStepProgress,
} from "@/components/ui/step-progress";
import { onboardingClient } from "@/lib/onboarding-client";
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
  professionalDraftSchema,
} from "./professional-wizard";
import { useOnboardingAnalytics } from "@/lib/analytics/OnboardingAnalyticsContext";

// SECURITY_PERSISTENCE_ALLOWLIST: Stores non-sensitive onboarding draft state in sessionStorage.

// ============================================================================
// TYPES
// ============================================================================

export type ProfessionalFormMode = "onboarding" | "completion";
export type ProfessionalFormVariant = "dark" | "light";

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEYS = {
  onboarding: "professional_onboarding_draft_v1",
  completion: "professional_completion_draft_v1",
} as const;

const StorePayloadSchema = StoreOnboardingSchema.omit({ role: true });
const PropertyPayloadSchema = PropertyOnboardingSchema.omit({ role: true });

// Theme-aware styles
const createTheme = (_variant: ProfessionalFormVariant) => {
  return {
    container: "max-w-2xl mx-auto",
    loadingOverlay:
      "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center",
    loadingSpinner: "text-[var(--color-onboarding-primary)]",
    loadingText:
      "text-[var(--color-onboarding-primary)] font-medium animate-pulse",
  };
};

// Step transition variants.
// When the user has enabled "Reduce motion" in their OS/browser,
// we honour that by eliminating the horizontal slide — only opacity transitions.
// This is required by WCAG 2.3.3 (Animation from Interactions, AAA) and is
// good practice for vestibular disorder accessibility even at AA.
const createStepVariants = (prefersReduced: boolean) => ({
  enter: (direction: number) => ({
    x: prefersReduced ? 0 : direction > 0 ? 50 : -50,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: prefersReduced ? 0 : direction < 0 ? 50 : -50,
    opacity: 0,
  }),
});

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
          ? "bg-onboarding-surface/82 backdrop-blur-md border border-onboarding-primary/28 p-8 max-w-md mx-auto text-center rounded-xl"
          : "bg-white border border-border shadow-lg p-8 max-w-md mx-auto text-center rounded-xl"
      }
    >
      <div className="mb-4 text-onboarding-primary">
        <Award
          className={`w-12 h-12 inline-block ${isDark ? "drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]" : "drop-shadow-md"}`}
        />
      </div>
      <h3
        className={
          isDark
            ? "font-['Syne'] text-2xl text-white mb-2 drop-shadow-lg"
            : "font-semibold text-2xl text-foreground mb-2"
        }
      >
        {isCompletion ? "Profile Updated!" : "Thanks — application received"}
      </h3>
      <p
        className={
          isDark ? "text-onboarding-ink/62 mb-6" : "text-muted-foreground mb-6"
        }
      >
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
              ? "text-sm border-b border-onboarding-primary/50 pb-1 text-onboarding-primary hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
              : "text-sm border-b border-success/50 pb-1 text-success hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
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
              ? "text-sm text-onboarding-ink/58 hover:text-onboarding-ink transition-colors disabled:opacity-50"
              : "text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
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
  const analytics = useOnboardingAnalytics();
  // Respect the user's OS/browser reduced-motion preference for step animations.
  const prefersReducedMotion = useReducedMotion() ?? false;
  const stepVariants = useMemo(
    () => createStepVariants(prefersReducedMotion),
    [prefersReducedMotion],
  );

  // ========================================
  // STATE
  // ========================================

  // Wizard step state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [direction, setDirection] = useState(0); // For animation direction

  // Form data state - base from initialData; draft restore happens in useEffect (hydration-safe)
  const [formData, setFormData] = useState<Partial<ProfessionalWizardData>>(
    () => {
      const baseData: Partial<ProfessionalWizardData> = initialData
        ? {
            ...initialData,
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
      return baseData;
    },
  );

  // Restore draft from sessionStorage on mount (hydration-safe; validates with Zod)
  useEffect(() => {
    // SECURITY_PERSISTENCE_ALLOWLIST: Reads non-sensitive professional onboarding draft state.
    const saved = sessionStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      const result = professionalDraftSchema.safeParse(parsed);
      if (!result.success) {
        // SECURITY_PERSISTENCE_ALLOWLIST: Clears invalid non-sensitive professional onboarding draft state.
        sessionStorage.removeItem(storageKey);
        analytics.trackDraftRestoreFailed();
        return;
      }
      const data = result.data as Partial<ProfessionalWizardData>;
      setFormData({
        ...data,
        certificates: [],
        idDocuments: [],
      });
    } catch {
      // SECURITY_PERSISTENCE_ALLOWLIST: Clears malformed non-sensitive professional onboarding draft state.
      sessionStorage.removeItem(storageKey);
      analytics.trackDraftRestoreFailed();
    }
  }, [storageKey, analytics]);

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

  // ========================================
  // PERSISTENCE
  // ========================================

  // Save to sessionStorage when form data changes (excluding files)
  useEffect(() => {
    if (formData.profession) {
      const dataToSave = {
        ...formData,
        certificates: undefined,
        idDocuments: undefined,
        stores: formData.stores,
        properties: formData.properties,
      };
      // SECURITY_PERSISTENCE_ALLOWLIST: Persists non-sensitive professional onboarding draft state.
      sessionStorage.setItem(storageKey, JSON.stringify(dataToSave));
    }
  }, [formData, storageKey]);

  // Clear sessionStorage on successful submission
  const clearSavedData = useCallback(() => {
    // SECURITY_PERSISTENCE_ALLOWLIST: Removes non-sensitive professional onboarding draft state.
    sessionStorage.removeItem(storageKey);
  }, [storageKey]);

  // ========================================
  // FOCUS MANAGEMENT
  // ========================================

  // When the step changes, move focus to the step heading so keyboard and
  // screen reader users are oriented in the new step context.
  // tabIndex={-1} on the heading makes it programmatically focusable without
  // entering the tab order — WCAG 2.4.3 (Focus Order).
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    // Use a microtask delay to ensure the new step's DOM has rendered
    // before we attempt to focus. Without this, focus may land on the
    // previous step's heading if AnimatePresence hasn't completed the swap.
    const raf = requestAnimationFrame(() => {
      stepHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [currentStepIndex]);

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
    ): Promise<Array<{ uploadId: string; previewUrl: string }>> => {
      if (files.length === 0) return [];

      const results: Array<{ uploadId: string; previewUrl: string }> = [];
      const totalFiles = files.length;
      let uploadedIndex = 0;

      for (const file of files) {
        if (signal?.aborted) {
          throw new DOMException("Upload cancelled", "AbortError");
        }

        onProgress?.(uploadedIndex, totalFiles, file.name);

        try {
          const res = await onboardingClient.uploadFiles(
            [file],
            fieldName,
            signal,
          );

          if (!res.success) {
            throw new Error(res.error || "Upload failed");
          }

          const uploadedResult = res.data?.[0];

          if (uploadedResult?.uploadId) {
            results.push({
              uploadId: uploadedResult.uploadId,
              previewUrl: uploadedResult.previewUrl || "",
            });
          } else {
            throw new Error("No uploadId returned from server");
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
      return results;
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

      const uploadedDocuments: Array<{
        uploadId: string;
        previewUrl?: string;
        category: DocumentCategory;
        title?: string;
      }> = [];

      // 1. Upload Certificates
      if (certificateFiles.length > 0) {
        const certRecords = await uploadFiles(
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
        certRecords.forEach((record, i) =>
          uploadedDocuments.push({
            uploadId: record.uploadId,
            previewUrl: record.previewUrl,
            category: "EDUCATION_CERT",
            title: `Professional Certificate ${i + 1}`,
          }),
        );
      }

      // 2. Upload IDs
      if (idDocumentFiles.length > 0) {
        const idRecords = await uploadFiles(
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
        idRecords.forEach((record, i) =>
          uploadedDocuments.push({
            uploadId: record.uploadId,
            previewUrl: record.previewUrl,
            category: "ID_OR_PASSPORT",
            title: `ID Document ${i + 1}`,
          }),
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

      const stores = formData.stores?.length
        ? formData.stores.map((store, index) => {
            const parsed = StorePayloadSchema.safeParse(store);
            if (!parsed.success) {
              throw new Error(
                `Store ${index + 1} is invalid: ${parsed.error.issues[0]?.message || "Invalid store data"}`,
              );
            }
            return parsed.data;
          })
        : undefined;

      const properties = formData.properties?.length
        ? formData.properties.map((property, index) => {
            const parsed = PropertyPayloadSchema.safeParse(property);
            if (!parsed.success) {
              throw new Error(
                `Property ${index + 1} is invalid: ${parsed.error.issues[0]?.message || "Invalid property data"}`,
              );
            }
            return parsed.data;
          })
        : undefined;

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
          certificateUrl:
            uploadedDocuments.find((d) => d.category === "EDUCATION_CERT")
              ?.previewUrl || "",
        },
        documents: uploadedDocuments,
        ...(stores && {
          stores,
        }),
        ...(properties && {
          properties,
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
    stepHeadingRef, // <--- Focus management: each step renders a heading with this ref
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
