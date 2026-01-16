"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { OnboardingData } from "@repo/types";
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

// ============================================================================
// CONSTANTS
// ============================================================================

// County options - matches Prisma County enum (required for ClientProfile)
const COUNTY_OPTIONS: ComboboxOption[] = Object.entries(COUNTY_LABELS).map(
  ([value, label]) => ({
    value: value as County,
    label,
  })
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
      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-500/10",
    error:
      "bg-red-500/20 text-red-300 border border-red-500/30 shadow-lg shadow-red-500/10",
    info: "bg-white/10 text-white border border-white/20 shadow-lg",
  };

  return (
    <div className={cn(baseClasses, typeClasses[type])}>
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
}> = ({ label, icon, children, hint, required, error }) => (
  <div className="group space-y-3">
    <label className="flex items-center gap-2.5 text-sm font-medium">
      {icon && (
        <span
          className={cn(
            "transition-colors",
            error
              ? "text-red-500"
              : "text-emerald-500 group-focus-within:text-emerald-400"
          )}
        >
          {icon}
        </span>
      )}
      <span className="text-zinc-300 group-focus-within:text-white transition-colors">
        {label}
      </span>
      {required && (
        <span className="text-xs text-amber-500/80 font-normal">
          (required)
        </span>
      )}
    </label>
    {children}
    {error && (
      <p className="text-xs text-red-400 flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
    {hint && !error && (
      <p className="text-xs text-zinc-500 pl-0.5 flex items-center gap-1.5">
        <Sparkles className="h-3 w-3 text-emerald-500/50" />
        {hint}
      </p>
    )}
  </div>
);

const SuccessCard: React.FC<{
  onEdit: () => void;
  onGoDashboard: () => void;
  isNavigating?: boolean;
}> = ({ onEdit, onGoDashboard, isNavigating }) => (
  <div className="relative overflow-hidden">
    {/* Background glow */}
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl" />
    </div>

    <div className="relative bg-gradient-to-b from-white/10 to-white/5 backdrop-blur-xl border border-white/20 p-10 max-w-md mx-auto text-center rounded-2xl shadow-2xl">
      {/* Success icon with animation */}
      <div className="mb-6 relative">
        <div className="absolute inset-0 flex items-center justify-center animate-ping">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full" />
        </div>
        <div className="relative w-16 h-16 mx-auto bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30">
          <CheckCircle2 className="w-8 h-8 text-white" />
        </div>
      </div>

      <h3 className="text-2xl font-bold text-white mb-3">
        You&apos;re all set!
      </h3>
      <p className="text-zinc-400 mb-8 leading-relaxed">
        We&apos;ve received your project details. Our team will match you with
        vetted professionals who specialize in your needs.
      </p>

      <div className="flex flex-col gap-3">
        <button
          onClick={onGoDashboard}
          disabled={isNavigating}
          className={cn(
            "w-full py-3 px-6 rounded-xl font-semibold text-sm",
            "bg-gradient-to-r from-emerald-500 to-emerald-600",
            "text-white shadow-lg shadow-emerald-500/25",
            "hover:from-emerald-400 hover:to-emerald-500",
            "transition-all duration-200 hover:scale-[1.02]",
            "flex items-center justify-center gap-2",
            "disabled:opacity-50 disabled:cursor-not-allowed"
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
  <div className="text-center mb-10 relative">
    {/* Decorative glow */}
    <div className="absolute inset-0 -top-8 flex items-center justify-center pointer-events-none">
      <div className="w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
    </div>

    {/* Icon with decorative lines */}
    <div className="relative inline-flex items-center justify-center gap-4 mb-5">
      <div className="h-px w-12 bg-gradient-to-r from-transparent via-emerald-500/50 to-emerald-500" />
      <div className="relative">
        <div className="absolute inset-0 animate-pulse">
          <Home className="h-9 w-9 text-emerald-500/30" />
        </div>
        <Home className="h-9 w-9 text-emerald-500 drop-shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
      </div>
      <div className="h-px w-12 bg-gradient-to-l from-transparent via-emerald-500/50 to-emerald-500" />
    </div>

    {/* Heading with gradient */}
    <h2 className="text-3xl md:text-4xl font-bold mb-3">
      <span className="bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
        Tell us about your
      </span>
      <br />
      <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-teal-400 bg-clip-text text-transparent">
        dream project
      </span>
    </h2>

    {/* Subtitle */}
    <p className="text-zinc-400 text-sm max-w-xs mx-auto leading-relaxed">
      Share your vision and we&apos;ll connect you with the
      <span className="text-emerald-400 font-medium">
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
    formState: { errors, isSubmitting },
  } = useForm<HomeownerOnboardingData>({
    resolver: zodResolver(homeownerOnboardingSchema),
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

  // UI state
  const [toast, setToast] = useState<ToastState | null>(null);
  const [success, setSuccess] = useState(false);
  const [navigating, setNavigating] = useState(false);

  // Handle navigation to dashboard with hard refresh
  const handleGoDashboard = useCallback(async () => {
    setNavigating(true);
    await new Promise((resolve) => setTimeout(resolve, 4000));
    window.location.href = "/dashboard";
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

  // Form submission handler
  const onFormSubmit = async (formData: HomeownerOnboardingData) => {
    const finalProjectType =
      formData.projectType === "other"
        ? formData.customProjectType
        : formData.projectType;

    const data: OnboardingData = {
      role: "client",
      projectType: finalProjectType!,
      projectLocation: formData.projectLocation || "",
      estimatedBudget: formData.estimatedBudget || "",
      description: formData.description || "",
    };

    try {
      showToast("info", "Submitting your details…");
      await onSubmit(data);
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
    "bg-white/5 backdrop-blur-sm",
    "border border-white/10 hover:border-white/20",
    "focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20",
    "placeholder:text-zinc-500",
    "transition-all duration-200"
  );

  return (
    <form onSubmit={rhfHandleSubmit(onFormSubmit)} className="max-w-md mx-auto">
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
        >
          <Controller
            name="county"
            control={control}
            render={({ field }) => (
              <Combobox
                options={COUNTY_OPTIONS}
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="Select your county..."
                searchPlaceholder="Search counties..."
                emptyMessage="No matching county found."
                className={cn(
                  "w-full rounded-xl",
                  "bg-white/5 border",
                  errors.county
                    ? "border-red-500/50"
                    : "border-white/10 hover:border-white/20",
                  "text-white hover:bg-white/10",
                  "focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
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
        >
          <Controller
            name="projectType"
            control={control}
            render={({ field }) => (
              <Combobox
                options={PROJECT_TYPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                placeholder="What are you building?"
                searchPlaceholder="Search project types..."
                emptyMessage="No matching project type found."
                className={cn(
                  "w-full rounded-xl",
                  "bg-white/5 border",
                  errors.projectType
                    ? "border-red-500/50"
                    : "border-white/10 hover:border-white/20",
                  "text-white hover:bg-white/10",
                  "focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                )}
              />
            )}
          />
          {projectType === "other" && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <input
                type="text"
                placeholder="Describe your project type..."
                {...register("customProjectType")}
                className={cn(
                  inputStyles,
                  errors.customProjectType && "border-red-500/50"
                )}
              />
              {errors.customProjectType && (
                <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.customProjectType.message}
                </p>
              )}
            </div>
          )}
        </FormField>

        {/* Project Location */}
        <FormField
          label="Project Location"
          icon={<MapPin className="h-4 w-4" />}
        >
          <Controller
            name="projectLocation"
            control={control}
            render={({ field }) => (
              <Combobox
                options={LOCATION_OPTIONS}
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="Where is your project located?"
                searchPlaceholder="Search locations..."
                className={cn(
                  "w-full rounded-xl",
                  "bg-white/5 border border-white/10 hover:border-white/20",
                  "text-white hover:bg-white/10"
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
        >
          <input
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
        >
          <textarea
            className={cn(
              inputStyles,
              "min-h-[140px] resize-none leading-relaxed",
              errors.description && "border-red-500/50"
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
              "bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600",
              "text-white shadow-lg shadow-emerald-500/25",
              "hover:from-emerald-400 hover:via-emerald-500 hover:to-teal-500",
              "hover:shadow-xl hover:shadow-emerald-500/30",
              "transition-all duration-300 hover:scale-[1.02]",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
              "disabled:shadow-none"
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
                <span className="bg-zinc-900 px-4 text-zinc-500">or</span>
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
                  "text-zinc-400 hover:text-emerald-400",
                  "disabled:opacity-50"
                )}
              >
                Skip for now →
              </button>
              <p className="text-[11px] text-zinc-600">
                Complete your profile anytime from the dashboard
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onBack}
            className={cn(
              "w-full py-3 text-center text-sm",
              "text-zinc-500 hover:text-white",
              "transition-colors duration-200"
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
