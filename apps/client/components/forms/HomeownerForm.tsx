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
} from "@/app/lib/validation/onboarding";
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
    success:
      "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-lg",
    error: "bg-red-500/20 text-red-400 border border-red-500/30 shadow-lg",
    info: "bg-zinc-800 text-zinc-200 border border-zinc-700 shadow-lg",
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
    <div className="group space-y-2">
      <label
        htmlFor={id}
        className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-300"
      >
        {icon && (
          <span
            className={cn(
              "transition-colors",
              error ? "text-red-400" : "text-emerald-400",
            )}
          >
            {icon}
          </span>
        )}
        <span className="text-zinc-300 group-focus-within:text-white transition-colors">
          {label}
        </span>
        {required && (
          <span className="text-[11px] text-zinc-500 font-normal lowercase">
            (required)
          </span>
        )}
      </label>
      {childWithProps}
      {error && (
        <div aria-live="polite" aria-atomic="true">
          <p
            id={errorId}
            className="text-xs text-red-400 flex items-center gap-1.5 font-medium"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        </div>
      )}
      {hint && !error && (
        <p className="text-xs text-zinc-500 pl-0.5 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-emerald-400/60" />
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
  <div className="relative overflow-hidden py-4">
    <div className="relative bg-zinc-900/90 border border-zinc-800 p-8 sm:p-10 max-w-md mx-auto text-center rounded-3xl shadow-2xl backdrop-blur-2xl">
      <div className="mb-6 relative">
        <div className="w-16 h-16 mx-auto bg-emerald-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30 text-emerald-400 shadow-[0_0_24px_rgba(16,185,129,0.25)]">
          <CheckCircle2 className="w-8 h-8" />
        </div>
      </div>

      <h3 className="text-2xl font-bold text-white mb-2 font-['Syne']">
        You&apos;re all set!
      </h3>
      <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
        We&apos;ve received your project details. We will match you with vetted
        professionals specializing in your project type.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={onGoDashboard}
          disabled={isNavigating}
          className={cn(
            "w-full py-3.5 px-6 rounded-xl font-semibold text-sm",
            "bg-emerald-500 text-zinc-950 shadow-[0_4px_20px_rgba(16,185,129,0.25)]",
            "hover:bg-emerald-400 transition-all duration-200 active:scale-[0.98]",
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
          className="text-sm text-zinc-400 hover:text-white transition-colors py-2 disabled:opacity-50"
        >
          ← Edit details
        </button>
      </div>
    </div>
  </div>
);

const FormHeader: React.FC = () => (
  <div className="text-center mb-8 space-y-2">
    <div className="inline-flex items-center justify-center gap-2 mb-2">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <Home className="h-6 w-6" aria-hidden="true" />
      </div>
    </div>

    <h2 className="text-2xl md:text-3xl font-bold text-white font-['Syne'] tracking-tight">
      Tell us about your project
    </h2>

    <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
      Share your project requirements so we can connect you with the right
      professionals.
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

  const showToast = (type: ToastType, message: string) => {
    setToast({ type, message });
    if (type !== "info") {
      setTimeout(() => setToast(null), 5000);
    }
  };

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

      if (firstInvalid) {
        const fieldId =
          HOMEOWNER_FIELD_IDS[firstInvalid] ?? HOMEOWNER_FIELD_IDS.projectType;
        focusFieldById(fieldId);
      }

      const errorCount = Object.keys(formErrors).length;
      showToast(
        "error",
        `Please fix the ${errorCount} error${errorCount > 1 ? "s" : ""} below before submitting.`,
      );
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
    "w-full px-4 py-3 rounded-xl text-white text-sm",
    "bg-zinc-950/80 border border-zinc-800",
    "focus:outline-none focus:border-emerald-500 focus:bg-zinc-900 focus:ring-2 focus:ring-emerald-500/20",
    "placeholder:text-zinc-500",
    "transition-all duration-200",
  );

  return (
    <form
      onSubmit={rhfHandleSubmit(onFormSubmit, handleInvalidSubmit)}
      className="max-w-xl mx-auto"
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
                  "bg-zinc-950/80 border",
                  errors.county
                    ? "border-red-500/60"
                    : "border-zinc-800 hover:border-zinc-700",
                  "text-white hover:bg-zinc-900",
                  "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
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
                placeholder="What are you building or renovating?"
                searchPlaceholder="Search project types..."
                emptyMessage="No matching project type found."
                className={cn(
                  "w-full rounded-xl",
                  "bg-zinc-950/80 border",
                  errors.projectType
                    ? "border-red-500/60"
                    : "border-zinc-800 hover:border-zinc-700",
                  "text-white hover:bg-zinc-900",
                  "focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20",
                )}
              />
            )}
          />
          {projectType === "other" && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <label
                htmlFor={HOMEOWNER_FIELD_IDS.customProjectType}
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-zinc-400"
              >
                Project Type Details <span className="text-red-400">*</span>
              </label>
              <input
                id={HOMEOWNER_FIELD_IDS.customProjectType}
                type="text"
                placeholder="Describe your specific project type..."
                {...register("customProjectType")}
                aria-invalid={errors.customProjectType ? "true" : undefined}
                aria-describedby={
                  errors.customProjectType
                    ? `${HOMEOWNER_FIELD_IDS.customProjectType}-error`
                    : undefined
                }
                className={cn(
                  inputStyles,
                  errors.customProjectType && "border-red-500/60",
                )}
              />
              {errors.customProjectType && (
                <div aria-live="polite" aria-atomic="true">
                  <p
                    id={`${HOMEOWNER_FIELD_IDS.customProjectType}-error`}
                    className="mt-1 text-xs text-red-400 flex items-center gap-1 font-medium"
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
          label="Project Specific Location / Area"
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
                placeholder="Where is your project located? (e.g. Karen, Westlands)"
                searchPlaceholder="Search locations..."
                className={cn(
                  "w-full rounded-xl",
                  "bg-zinc-950/80 border border-zinc-800 hover:border-zinc-700",
                  "text-white hover:bg-zinc-900",
                )}
              />
            )}
          />
        </FormField>

        {/* Estimated Budget */}
        <FormField
          label="Estimated Budget Range (KES)"
          icon={<Wallet className="h-4 w-4" />}
          hint="Helps us match you with professionals tailored to your budget scale"
          id={HOMEOWNER_FIELD_IDS.estimatedBudget}
        >
          <input
            id={HOMEOWNER_FIELD_IDS.estimatedBudget}
            type="text"
            placeholder="e.g. KES 5,000,000 - 15,000,000"
            {...register("estimatedBudget")}
            className={inputStyles}
          />
        </FormField>

        {/* Project Description */}
        <FormField
          label="Project Description & Vision"
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
              "min-h-32 resize-none leading-relaxed",
              errors.description && "border-red-500/60",
            )}
            placeholder="Describe your vision, estimated timeline, materials preference, and any specific details that will help professionals prepare accurate quotes..."
            {...register("description")}
          />
        </FormField>

        {/* Submit Button */}
        <div className="pt-6 space-y-4 border-t border-zinc-800/80">
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "w-full py-3.5 px-6 rounded-xl font-semibold text-sm",
              "bg-emerald-500 text-zinc-950 shadow-[0_4px_20px_rgba(16,185,129,0.25)]",
              "hover:bg-emerald-400 transition-all duration-200 active:scale-[0.98]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none",
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating your profile...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </button>

          {/* Skip option for homeowners */}
          {onSkip && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={onSkip}
                disabled={isSubmitting}
                className="text-xs font-medium text-zinc-400 hover:text-emerald-400 transition-colors disabled:opacity-50"
              >
                Skip for now — complete details later
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};

export default HomeownerForm;
