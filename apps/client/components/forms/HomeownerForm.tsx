"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OnboardingData } from "@build/types";
import { Combobox, ComboboxOption } from "../ui/combobox";

import {
  CheckCircle2,
  Loader2,
  Home,
  MapPin,
  Wallet,
  FileText,
  Sparkles,
  ArrowRight,
  Building2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  homeownerOnboardingSchema,
  type HomeownerOnboardingData,
  type County,
} from "@/lib/schemas/onboarding";
import { COUNTY_LABELS } from "@/types/store";
import { useOnboardingAnalytics } from "@/lib/analytics/OnboardingAnalyticsContext";
import { ROUTES } from "@/lib/links";

export const SECURITY_PERSISTENCE_ALLOWLIST = [
  "county",
  "projectType",
  "customProjectType",
  "estimatedBudget",
  "description",
] as const;

// ============================================================================
// CONSTANTS
// ============================================================================

// County options - matches Prisma County enum (required for ClientProfile)
const COUNTY_OPTIONS: ComboboxOption[] = Object.entries(COUNTY_LABELS).map(
  ([value, label]) => ({
    value: value as County,
    label,
  }),
);

const LOCATION_OPTIONS: ComboboxOption[] = [
  { value: "karen", label: "Karen" },
  { value: "runda", label: "Runda" },
  { value: "muthaiga", label: "Muthaiga" },
  { value: "kilimani", label: "Kilimani / Kileleshwa" },
  { value: "langata", label: "Lang'ata" },
  { value: "upperhill", label: "Upper Hill" },
  { value: "westlands", label: "Westlands" },
  { value: "lavington", label: "Lavington" },
  { value: "riverside", label: "Riverside" },
  { value: "gigiri", label: "Gigiri" },
  { value: "rosslyn", label: "Rosslyn" },
  { value: "thika_road", label: "Thika Road Environs" },
  { value: "limuru_road", label: "Limuru Road Environs" },
  { value: "ngong_road", label: "Ngong Road Environs" },
  { value: "mombasa_road", label: "Mombasa Road Environs" },
  { value: "syokimau", label: "Syokimau" },
  { value: "kitengela", label: "Kitengela" },
  { value: "ongata_rongai", label: "Ongata Rongai" },
  { value: "ruiru", label: "Ruiru" },
  { value: "kiambu", label: "Kiambu Environs" },
  { value: "kikuyu", label: "Kikuyu Environs" },
  { value: "other", label: "Other (Nairobi Environs)" },
];

const PROJECT_TYPE_OPTIONS: ComboboxOption[] = [
  // Residential - New Construction
  { value: "new_residential_build", label: "New Residential Build" },
  { value: "custom_home", label: "Custom Home Construction" },
  { value: "townhouse_development", label: "Townhouse Development" },
  { value: "apartment_building", label: "Apartment Building Construction" },
  { value: "maisonette", label: "Maisonette Construction" },
  { value: "bungalow", label: "Bungalow Construction" },

  // Residential - Renovation & Remodeling
  { value: "full_home_renovation", label: "Full Home Renovation" },
  { value: "kitchen_remodel", label: "Kitchen Remodel" },
  { value: "bathroom_remodel", label: "Bathroom Remodel" },
  { value: "home_extension", label: "Home Extension / Addition" },
  { value: "roof_replacement", label: "Roof Replacement / Repair" },
  { value: "structural_repairs", label: "Structural Repairs" },
  { value: "facade_upgrade", label: "Facade / Exterior Upgrade" },

  // Commercial
  { value: "commercial_office", label: "Commercial Office Building" },
  { value: "retail_space", label: "Retail / Shop Construction" },
  { value: "warehouse", label: "Warehouse / Industrial Facility" },
  { value: "restaurant_hospitality", label: "Restaurant / Hospitality" },
  { value: "mixed_use", label: "Mixed-Use Development" },

  // Interior & Finishing
  { value: "interior_design", label: "Interior Design & Decoration" },
  { value: "flooring_tiling", label: "Flooring & Tiling" },
  { value: "painting_finishing", label: "Painting & Finishing" },
  { value: "ceiling_works", label: "Ceiling Works (Gypsum/PVC)" },
  { value: "cabinetry", label: "Custom Cabinetry & Joinery" },

  // Exterior & Landscaping
  { value: "landscaping", label: "Landscaping & Outdoor Spaces" },
  { value: "swimming_pool", label: "Swimming Pool Construction" },
  { value: "perimeter_wall", label: "Perimeter Wall & Fencing" },
  { value: "driveway_paving", label: "Driveway & Paving" },
  { value: "gate_installation", label: "Gate Installation (Sliding/Swing)" },

  // Infrastructure & Systems
  { value: "plumbing_works", label: "Plumbing Works" },
  { value: "electrical_works", label: "Electrical Works" },
  { value: "hvac_installation", label: "HVAC Installation" },
  { value: "solar_installation", label: "Solar Power Installation" },
  { value: "borehole_drilling", label: "Borehole Drilling" },
  { value: "water_tank", label: "Water Tank Installation" },
  { value: "septic_tank", label: "Septic Tank / Biodigester" },

  // Specialized
  { value: "smart_home", label: "Smart Home Automation" },
  { value: "security_systems", label: "Security Systems Installation" },
  { value: "fire_safety", label: "Fire Safety Systems" },

  // Professional Services
  { value: "consultation", label: "Professional Consultation Only" },
  { value: "architectural_plans", label: "Architectural Plans / Drawings" },
  { value: "project_management", label: "Project Management Services" },

  // Other
  { value: "other", label: "Other (Please Specify)" },
];

const HOMEOWNER_FIELD_IDS = {
  county: "homeowner-county",
  city: "homeowner-county",
  address: "homeowner-county",
  zipCode: "homeowner-county",
  projectType: "homeowner-project-type",
  customProjectType: "homeowner-custom-project-type",
  projectLocation: "homeowner-project-location",
  estimatedBudget: "homeowner-estimated-budget",
  description: "homeowner-description",
} as const satisfies Record<keyof HomeownerOnboardingData, string>;

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  onBack: () => void;
  onSubmit: (data: OnboardingData) => Promise<void>;
  onAuthSuccess: (response: OnboardingData) => void;
  onSkip?: () => void;
}

type ToastType = "success" | "error" | "info";

interface ToastState {
  type: ToastType;
  message: string;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const Toast: React.FC<ToastState> = ({ type, message }) => {
  const baseClasses =
    "px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-3 animate-in slide-in-from-top-2 duration-300 backdrop-blur-md";
  const typeClasses: Record<ToastType, string> = {
    success: "bg-success/20 text-success border border-success/30 shadow-lg",
    error: "bg-error/20 text-error border border-error/30 shadow-lg",
    info: "bg-white/10 text-white border border-white/20 shadow-lg",
  };

  return (
    <div
      className={cn(baseClasses, typeClasses[type])}
      role={type === "error" ? "alert" : "status"}
      aria-live={type === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      {type === "info" && <Loader2 className="h-4 w-4 animate-spin" />}
      {type === "success" && <CheckCircle2 className="h-4 w-4" />}
      {message}
    </div>
  );
};

const FormField: React.FC<{
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
  required?: boolean;
  error?: string;
  id?: string;
}> = ({ label, icon, children, hint, required, error, id: idProp }) => {
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const errorId = `${id}-error`;

  const childWithProps = React.isValidElement(children)
    ? React.cloneElement(
        children as React.ReactElement<{
          id?: string;
          "aria-invalid"?: boolean;
          "aria-describedby"?: string;
        }>,
        {
          id,
          "aria-invalid": !!error,
          "aria-describedby": error ? errorId : undefined,
        },
      )
    : children;

  return (
    <div className="group space-y-3">
      <label
        htmlFor={id}
        className="flex items-center gap-2.5 text-sm font-medium"
      >
        {icon && (
          <span
            className={cn(
              "transition-colors",
              error
                ? "text-(--color-error)"
                : "text-(--color-onboarding-primary) group-focus-within:opacity-90",
            )}
          >
            {icon}
          </span>
        )}
        <span className="text-onboarding-ink/68 group-focus-within:text-(--color-onboarding-ink) transition-colors">
          {label}
        </span>
        {required && (
          <span className="text-xs text-onboarding-ink/55 font-normal">
            (required)
          </span>
        )}
      </label>
      {childWithProps}
      {error && (
        <div aria-live="polite" aria-atomic="true">
          <p
            id={errorId}
            className="text-xs text-(--color-error) flex items-center gap-1"
          >
            <AlertCircle className="h-3 w-3" />
            {error}
          </p>
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-onboarding-ink/58 pl-0.5 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-onboarding-primary/60" />
          {hint}
        </p>
      )}
    </div>
  );
};

const SuccessCard: React.FC<{
  onEdit: () => void;
  onGoDashboard: () => void;
  isNavigating?: boolean;
}> = ({ onEdit, onGoDashboard, isNavigating }) => (
  <div className="relative overflow-hidden">
    {/* Background glow */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-64 h-64 bg-onboarding-primary/20 rounded-full blur-3xl" />
    </div>

    <div className="relative bg-linear-to-b from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-10 max-w-md mx-auto text-center rounded-2xl shadow-2xl">
      {/* Success icon with animation */}
      <div className="mb-6 relative">
        <div className="absolute inset-0 flex items-center justify-center animate-ping">
          <div className="w-16 h-16 bg-success/20 rounded-full" />
        </div>
        <div className="relative w-16 h-16 mx-auto bg-(--color-success) rounded-full flex items-center justify-center shadow-lg">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
      </div>

      <h3 className="text-2xl font-bold text-white mb-3">
        You&apos;re all set!
      </h3>
      <p className="text-onboarding-ink/62 mb-8 leading-relaxed">
        We&apos;ve received your project details. Our team will match you with
        vetted professionals who specialize in your needs.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={onGoDashboard}
          disabled={isNavigating}
          className={cn(
            "w-full py-3 px-6 rounded-xl font-semibold text-sm",
            "bg-(--color-onboarding-primary)",
            "text-[oklch(0.08_0.016_222)] shadow-lg",
            "hover:opacity-90",
            "transition-all duration-200 active:scale-[0.98]",
            "flex items-center justify-center gap-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isNavigating && <Loader2 className="h-4 w-4 animate-spin" />}
          Proceed to Dashboard
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={onEdit}
          disabled={isNavigating}
          className="text-sm text-onboarding-ink/62 hover:text-(--color-onboarding-ink) transition-colors py-2 disabled:opacity-50"
        >
          ← Edit details
        </button>
      </div>
    </div>
  </div>
);

const FormHeader: React.FC = () => (
  <div className="text-center mb-10 relative">
    {/* Decorative glow */}
    <div className="absolute inset-0 -top-8 flex items-center justify-center pointer-events-none">
      <div className="w-40 h-40 bg-onboarding-primary/12 rounded-full blur-3xl" />
    </div>

    {/* Icon with decorative lines */}
    <div className="relative inline-flex items-center justify-center gap-4 mb-5">
      <div className="h-px w-12 bg-linear-to-r from-transparent via-onboarding-primary/50 to-(--color-onboarding-primary)" />
      <div className="relative">
        <div className="absolute inset-0 animate-pulse">
          <Home className="h-9 w-9 text-onboarding-primary/30" />
        </div>
        <Home className="h-9 w-9 text-(--color-onboarding-primary)" />
      </div>
      <div className="h-px w-12 bg-linear-to-l from-transparent via-onboarding-primary/50 to-(--color-onboarding-primary)" />
    </div>

    {/* Heading with gradient */}
    <h2 className="text-3xl md:text-4xl font-bold mb-3">
      <span className="bg-linear-to-r from-white via-muted-foreground to-muted-foreground bg-clip-text text-transparent">
        Tell us about your
      </span>
      <br />
      <span className="text-(--color-onboarding-primary)">dream project</span>
    </h2>

    {/* Subtitle */}
    <p className="text-onboarding-ink/62 text-sm max-w-xs mx-auto leading-relaxed">
      Share your vision and we&apos;ll connect you with the
      <span className="text-(--color-onboarding-primary) font-medium">
        {" "}
        perfect professionals
      </span>
      .
    </p>
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const HOMEOWNER_DRAFT_KEY = "onboarding_homeowner_draft_v1";

const HomeownerForm: React.FC<Props> = ({
  onBack,
  onSubmit,
  onAuthSuccess,
  onSkip,
}) => {
  // React Hook Form with Zod validation
  const {
    register,
    control,
    handleSubmit: rhfHandleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<HomeownerOnboardingData>({
    resolver: zodResolver(homeownerOnboardingSchema),
    shouldFocusError: false,
    defaultValues: {
      county: undefined,
      projectType: "",
      customProjectType: "",
      projectLocation: "",
      estimatedBudget: "",
      description: "",
    },
  });

  // Watch project type for conditional field
  const projectType = watch("projectType");
  const formValues = watch();
  const analytics = useOnboardingAnalytics();

  // UI state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [success, setSuccess] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Restore draft from sessionStorage on mount (hydration-safe)
  useEffect(() => {
    // SECURITY_PERSISTENCE_ALLOWLIST: Reads non-sensitive onboarding draft state.
    const raw = sessionStorage.getItem(HOMEOWNER_DRAFT_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      const result = homeownerOnboardingSchema.safeParse(parsed);
      if (result.success) {
        reset(result.data);
      } else {
        // SECURITY_PERSISTENCE_ALLOWLIST: Clears invalid non-sensitive onboarding draft state.
        sessionStorage.removeItem(HOMEOWNER_DRAFT_KEY);
        analytics.trackDraftRestoreFailed();
      }
    } catch {
      // SECURITY_PERSISTENCE_ALLOWLIST: Clears malformed non-sensitive onboarding draft state.
      sessionStorage.removeItem(HOMEOWNER_DRAFT_KEY);
      analytics.trackDraftRestoreFailed();
    }
  }, [reset, analytics]);

  // Persist draft to sessionStorage when form values change
  useEffect(() => {
    if (success) return;
    // SECURITY_PERSISTENCE_ALLOWLIST: Persists non-sensitive onboarding draft state.
    sessionStorage.setItem(HOMEOWNER_DRAFT_KEY, JSON.stringify(formValues));
  }, [formValues, success]);

  // Handle navigation to dashboard with hard refresh
  const handleGoDashboard = useCallback(async () => {
    setNavigating(true);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    window.location.href = ROUTES.userDashboard;
  }, []);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
  }, []);

  const focusFieldById = useCallback((id: string) => {
    requestAnimationFrame(() => {
      const element = document.getElementById(id) as HTMLElement | null;
      element?.focus();
    });
  }, []);

  const handleInvalidSubmit = useCallback(
    (formErrors: FieldErrors<HomeownerOnboardingData>) => {
      const orderedFields: Array<keyof HomeownerOnboardingData> = [
        "county",
        "projectType",
        "customProjectType",
        "description",
      ];

      const firstInvalid = orderedFields.find((field) => {
        if (field === "customProjectType") {
          return projectType === "other" && !!formErrors.customProjectType;
        }
        return !!formErrors[field];
      });

      if (!firstInvalid) return;

      const fieldId =
        HOMEOWNER_FIELD_IDS[firstInvalid] ?? HOMEOWNER_FIELD_IDS.projectType;
      focusFieldById(fieldId);
    },
    [focusFieldById, projectType],
  );

  // Form submission handler
  const onFormSubmit = async (formData: HomeownerOnboardingData) => {
    const finalProjectType =
      formData.projectType === "other"
        ? formData.customProjectType
        : formData.projectType;

    const data: OnboardingData = {
      role: "client",
      type: "HOMEOWNER",
      county: formData.county,
      projectType: finalProjectType!,
      projectLocation: formData.projectLocation || "",
      estimatedBudget: formData.estimatedBudget || "",
      description: formData.description || "",
    };

    try {
      showToast("info", "Submitting your details…");
      await onSubmit(data);
      // SECURITY_PERSISTENCE_ALLOWLIST: Clears non-sensitive onboarding draft after successful submission.
      sessionStorage.removeItem(HOMEOWNER_DRAFT_KEY);
      showToast("success", "Profile completed successfully!");
      setSuccess(true);
      onAuthSuccess(data);
    } catch (err) {
      console.error("Homeowner submit error", err);
      const message =
        err instanceof Error
          ? err.message
          : "Failed to submit. Please try again.";
      showToast("error", message);
    }
  };

  if (success) {
    return (
      <SuccessCard
        onEdit={() => setSuccess(false)}
        onGoDashboard={handleGoDashboard}
        isNavigating={navigating}
      />
    );
  }

  // Common input styles
  const inputStyles = cn(
    "w-full px-4 py-3.5 rounded-xl text-white text-sm",
    "bg-white/6 backdrop-blur-sm",
    "border border-white/16 hover:border-onboarding-primary/32",
    "focus:outline-none focus:border-onboarding-primary/55 focus:ring-2 focus:ring-focus-ring/25",
    "placeholder:text-onboarding-ink/35",
    "transition-all duration-200",
  );

  return (
    <form
      onSubmit={rhfHandleSubmit(onFormSubmit, handleInvalidSubmit)}
      className="max-w-md mx-auto"
      noValidate
    >
      {/* Toast notification */}
      {toast && (
        <div className="mb-6">
          <Toast type={toast.type} message={toast.message} />
        </div>
      )}

      {/* Header */}
      <FormHeader />

      {/* Form fields */}
      <div className="space-y-6">
        {/* County - Required for ClientProfile */}
        <FormField
          label="Your County"
          icon={<MapPin className="h-4 w-4" />}
          required
          error={errors.county?.message}
          id={HOMEOWNER_FIELD_IDS.county}
        >
          <Controller
            name="county"
            control={control}
            render={({ field }) => (
              <Combobox
                id={HOMEOWNER_FIELD_IDS.county}
                options={COUNTY_OPTIONS}
                value={field.value || ""}
                onChange={field.onChange}
                aria-invalid={errors.county ? "true" : undefined}
                aria-describedby={
                  errors.county
                    ? `${HOMEOWNER_FIELD_IDS.county}-error`
                    : undefined
                }
                placeholder="Select your county..."
                searchPlaceholder="Search counties..."
                emptyMessage="No matching county found."
                className={cn(
                  "w-full rounded-xl",
                  "bg-white/6 border",
                  errors.county
                    ? "border-error/50"
                    : "border-white/16 hover:border-onboarding-primary/32",
                  "text-white hover:bg-white/10",
                  "focus:border-onboarding-primary/55 focus:ring-2 focus:ring-focus-ring/25",
                )}
              />
            )}
          />
        </FormField>

        {/* Project Type */}
        <FormField
          label="Project Type"
          icon={<Building2 className="h-4 w-4" />}
          required
          error={errors.projectType?.message}
          id={HOMEOWNER_FIELD_IDS.projectType}
        >
          <Controller
            name="projectType"
            control={control}
            render={({ field }) => (
              <Combobox
                id={HOMEOWNER_FIELD_IDS.projectType}
                options={PROJECT_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                aria-invalid={errors.projectType ? "true" : undefined}
                aria-describedby={
                  errors.projectType
                    ? `${HOMEOWNER_FIELD_IDS.projectType}-error`
                    : undefined
                }
                placeholder="What are you building?"
                searchPlaceholder="Search project types..."
                emptyMessage="No matching project type found."
                className={cn(
                  "w-full rounded-xl",
                  "bg-white/6 border",
                  errors.projectType
                    ? "border-error/50"
                    : "border-white/16 hover:border-onboarding-primary/32",
                  "text-white hover:bg-white/10",
                  "focus:border-onboarding-primary/55 focus:ring-2 focus:ring-focus-ring/25",
                )}
              />
            )}
          />
          {projectType === "other" && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label
                htmlFor={HOMEOWNER_FIELD_IDS.customProjectType}
                className="mb-2 block text-xs text-onboarding-ink/58"
              >
                Project Type Details{" "}
                <span className="text-(--color-error)">*</span>
              </label>
              <input
                id={HOMEOWNER_FIELD_IDS.customProjectType}
                type="text"
                placeholder="Describe your project type..."
                {...register("customProjectType")}
                aria-invalid={errors.customProjectType ? "true" : undefined}
                aria-describedby={
                  errors.customProjectType
                    ? `${HOMEOWNER_FIELD_IDS.customProjectType}-error`
                    : undefined
                }
                className={cn(
                  inputStyles,
                  errors.customProjectType && "border-error/50",
                )}
              />
              {errors.customProjectType && (
                <div aria-live="polite" aria-atomic="true">
                  <p
                    id={`${HOMEOWNER_FIELD_IDS.customProjectType}-error`}
                    className="mt-1 text-xs text-(--color-error) flex items-center gap-1"
                  >
                    <AlertCircle className="h-3 w-3" />
                    {errors.customProjectType.message}
                  </p>
                </div>
              )}
            </div>
          )}
        </FormField>

        {/* Project Location */}
        <FormField
          label="Project Location"
          icon={<MapPin className="h-4 w-4" />}
          id={HOMEOWNER_FIELD_IDS.projectLocation}
        >
          <Controller
            name="projectLocation"
            control={control}
            render={({ field }) => (
              <Combobox
                id={HOMEOWNER_FIELD_IDS.projectLocation}
                options={LOCATION_OPTIONS}
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="Where is your project located?"
                searchPlaceholder="Search locations..."
                className={cn(
                  "w-full rounded-xl",
                  "bg-white/6 border border-white/16 hover:border-onboarding-primary/32",
                  "text-white hover:bg-white/10",
                )}
              />
            )}
          />
        </FormField>

        {/* Estimated Budget */}
        <FormField
          label="Estimated Budget (KES)"
          icon={<Wallet className="h-4 w-4" />}
          hint="Helps us match you with appropriate professionals"
          id={HOMEOWNER_FIELD_IDS.estimatedBudget}
        >
          <input
            id={HOMEOWNER_FIELD_IDS.estimatedBudget}
            type="text"
            placeholder="e.g. 5,000,000 - 15,000,000"
            {...register("estimatedBudget")}
            className={inputStyles}
          />
        </FormField>

        {/* Project Description */}
        <FormField
          label="Project Description"
          icon={<FileText className="h-4 w-4" />}
          error={errors.description?.message}
          id={HOMEOWNER_FIELD_IDS.description}
        >
          <textarea
            id={HOMEOWNER_FIELD_IDS.description}
            aria-invalid={errors.description ? "true" : undefined}
            aria-describedby={
              errors.description
                ? `${HOMEOWNER_FIELD_IDS.description}-error`
                : undefined
            }
            className={cn(
              inputStyles,
              "min-h-35 resize-none leading-relaxed",
              errors.description && "border-error/50",
            )}
            placeholder="Describe your vision, timeline, requirements, and any specific details that would help professionals understand your needs..."
            {...register("description")}
          />
        </FormField>

        {/* Submit Button */}
        <div className="pt-6 space-y-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full py-4 px-6 rounded-xl font-semibold text-base",
              "bg-(--color-onboarding-primary)",
              "text-[oklch(0.08_0.016_222)] shadow-lg",
              "hover:opacity-90",
              "transition-all duration-300 active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
              "disabled:shadow-none",
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating your profile...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Get Started
                <ArrowRight className="h-5 w-5" />
              </span>
            )}
          </button>

          {/* Skip option for homeowners */}
          {onSkip && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-4 text-onboarding-ink/55">
                  or
                </span>
              </div>
            </div>
          )}

          {onSkip && (
            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={onSkip}
                disabled={isSubmitting}
                className={cn(
                  "text-sm font-medium transition-all duration-200",
                  "text-onboarding-ink/58 hover:text-(--color-onboarding-primary)",
                  "disabled:opacity-50",
                )}
              >
                Skip for now →
              </button>
              <p className="text-[11px] text-onboarding-ink/55">
                Complete your profile anytime from the dashboard
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onBack}
            className={cn(
              "w-full py-3 text-center text-sm",
              "text-onboarding-ink/60 hover:text-(--color-onboarding-ink)",
              "transition-colors duration-200",
            )}
          >
            ← Back to role selection
          </button>
        </div>
      </div>
    </form>
  );
};

export default HomeownerForm;
