"use client";

import React from "react";
import { motion } from "framer-motion";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Clock,
  Globe,
  FileText,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { StepComponentProps, WIZARD_STYLES } from "./types";

// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================

interface FormFieldProps {
  /** Must match the `id` on the child input for programmatic label association. */
  htmlFor: string;
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({
  htmlFor,
  label,
  required,
  hint,
  error,
  children,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className={WIZARD_STYLES.label}>
          {label}
          {required && (
            <span className="text-(--color-error) ml-1" aria-hidden="true">
              *
            </span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </label>
        {hint && (
          <span className="text-[10px] text-white/35 font-normal normal-case tracking-normal">
            {hint}
          </span>
        )}
      </div>

      {children}

      {/* aria-live="polite" announces errors without interrupting AT */}
      <div aria-live="polite" aria-atomic="true">
        {error && (
          <p id={`${htmlFor}-error`} className={WIZARD_STYLES.error}>
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// SCHEMA
// ============================================================================

const detailsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  yearsExperience: z.number().min(0).max(100).optional(),
  website: z
    .string()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  bio: z.string().max(1000, "Bio must be less than 1000 characters").optional(),
});

type FormData = z.infer<typeof detailsSchema>;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DetailsStep({
  data,
  onUpdate,
  onNext,
  onBack,
  isFirstStep,
}: StepComponentProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(detailsSchema),
    shouldFocusError: false,
    defaultValues: {
      companyName: data.companyName || "",
      yearsExperience: data.yearsExperience,
      website: data.website || "",
      bio: data.bio || "",
    },
  });

  const onSubmit = (formData: FormData) => {
    onUpdate({
      companyName: formData.companyName,
      yearsExperience: formData.yearsExperience,
      website: formData.website || undefined,
      bio: formData.bio || undefined,
    });
    onNext();
  };

  const focusFieldById = (id: string) => {
    requestAnimationFrame(() => {
      const element = document.getElementById(id) as HTMLElement | null;
      element?.focus();
    });
  };

  const onInvalid = (formErrors: FieldErrors<FormData>) => {
    const fieldOrder: Array<keyof FormData> = [
      "companyName",
      "yearsExperience",
      "website",
      "bio",
    ];
    const firstInvalid = fieldOrder.find((field) => !!formErrors[field]);
    if (!firstInvalid) return;
    focusFieldById(firstInvalid);
  };

  // Shared icon class inside inputs
  const inputIconClass =
    "absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500 pointer-events-none";

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="space-y-8"
      noValidate
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center space-y-2"
      >
        <div className="inline-flex items-center justify-center gap-2 mb-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
        <h2 className="font-['Syne'] text-2xl md:text-3xl font-bold tracking-tight text-white">
          Tell us about your business
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
          This information will be displayed on your verified professional
          profile.
        </p>
      </motion.div>

      {/* Form fields */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.38 }}
        className="space-y-5"
      >
        {/* Company Name */}
        <FormField
          htmlFor="companyName"
          label="Company / Practice Name"
          required
          error={errors.companyName?.message}
        >
          <div className="relative">
            <Building2 className={inputIconClass} aria-hidden="true" />
            <input
              id="companyName"
              type="text"
              placeholder="e.g. Apex Structural Consultants Ltd"
              {...register("companyName")}
              aria-invalid={errors.companyName ? "true" : undefined}
              aria-describedby={
                errors.companyName ? "companyName-error" : undefined
              }
              className={cn(
                WIZARD_STYLES.input,
                "pl-10",
                errors.companyName && "border-red-500/60 bg-red-950/10",
              )}
            />
          </div>
        </FormField>

        {/* Two-column row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Years of Experience */}
          <FormField
            htmlFor="yearsExperience"
            label="Years in Practice"
            hint="Optional"
            error={errors.yearsExperience?.message}
          >
            <div className="relative">
              <Clock className={inputIconClass} aria-hidden="true" />
              <input
                id="yearsExperience"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 8"
                {...register("yearsExperience", { valueAsNumber: true })}
                aria-invalid={errors.yearsExperience ? "true" : undefined}
                aria-describedby={
                  errors.yearsExperience ? "yearsExperience-error" : undefined
                }
                className={cn(WIZARD_STYLES.input, "pl-10")}
              />
            </div>
          </FormField>

          {/* Website */}
          <FormField
            htmlFor="website"
            label="Website or Portfolio"
            hint="Optional"
            error={errors.website?.message}
          >
            <div className="relative">
              <Globe className={inputIconClass} aria-hidden="true" />
              <input
                id="website"
                type="url"
                placeholder="https://yourfirm.co.ke"
                {...register("website")}
                aria-invalid={errors.website ? "true" : undefined}
                aria-describedby={errors.website ? "website-error" : undefined}
                className={cn(
                  WIZARD_STYLES.input,
                  "pl-10",
                  errors.website && "border-red-500/60 bg-red-950/10",
                )}
              />
            </div>
          </FormField>
        </div>

        {/* Bio */}
        <FormField
          htmlFor="bio"
          label="Professional Overview / Bio"
          hint="Optional · Max 1000 characters"
          error={errors.bio?.message}
        >
          <div className="relative">
            <FileText
              className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500 pointer-events-none"
              aria-hidden="true"
            />
            <textarea
              id="bio"
              rows={4}
              placeholder="Highlight your key specializations, landmark projects completed in Kenya, and client value proposition..."
              {...register("bio")}
              aria-invalid={errors.bio ? "true" : undefined}
              aria-describedby={errors.bio ? "bio-error" : undefined}
              className={cn(
                WIZARD_STYLES.input,
                "pl-10 resize-none leading-relaxed min-h-24",
                errors.bio && "border-red-500/60 bg-red-950/10",
              )}
            />
          </div>
        </FormField>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28 }}
        className="flex items-center justify-between pt-4 border-t border-zinc-800"
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isFirstStep}
          className={cn(
            WIZARD_STYLES.secondaryButton,
            "flex items-center gap-2",
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back
        </button>

        <button
          type="submit"
          className={cn(
            WIZARD_STYLES.primaryButton,
            "max-w-xs flex items-center justify-center gap-2",
          )}
        >
          Continue
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </motion.div>
    </form>
  );
}
