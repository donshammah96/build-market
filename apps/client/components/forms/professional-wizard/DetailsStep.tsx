"use client";

import React from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  ShieldCheck,
  Clock,
  Globe,
  FileText,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getProfessionRegulatoryBody } from "@/lib/constants/professionOptions";
import { StepComponentProps, detailsStepSchema, WIZARD_STYLES } from "./types";

// ============================================================================
// TYPES
// ============================================================================

type FormData = z.infer<typeof detailsStepSchema>;

// ============================================================================
// FORM FIELD COMPONENT
// ============================================================================

interface FormFieldProps {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  hint,
  error,
  children,
}) => (
  <div className="space-y-2">
    <label className="flex items-center justify-between">
      <span className={WIZARD_STYLES.label}>
        {label}
        {required && <span className="text-amber-500 ml-1">*</span>}
      </span>
      {hint && (
        <span className="text-[10px] text-zinc-500 font-normal normal-case tracking-normal">
          {hint}
        </span>
      )}
    </label>
    {children}
    {error && (
      <p className={WIZARD_STYLES.error}>
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
);

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
  const regulatoryBody = data.profession
    ? getProfessionRegulatoryBody(data.profession)
    : "NCA";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(detailsStepSchema),
    defaultValues: {
      companyName: data.companyName || "",
      licenseNumber: data.licenseNumber || "",
      yearsExperience: data.yearsExperience,
      website: data.website || "",
      bio: data.bio || "",
    },
  });

  const onSubmit = (formData: FormData) => {
    onUpdate({
      companyName: formData.companyName,
      licenseNumber: formData.licenseNumber,
      yearsExperience: formData.yearsExperience,
      website: formData.website || undefined,
      bio: formData.bio || undefined,
    });
    onNext();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center gap-2 mb-4">
          <Building2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Tell us about your business
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          This information helps clients find and trust you
        </p>
      </motion.div>

      {/* Form Fields */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="space-y-6"
      >
        {/* Company Name */}
        <FormField
          label="Company / Business Name"
          required
          error={errors.companyName?.message}
        >
          <div className="relative">
            <Building2 className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Your Firm's Legal Name"
              {...register("companyName")}
              className={cn(
                WIZARD_STYLES.input,
                "pl-11",
                errors.companyName && "border-red-500/50"
              )}
            />
          </div>
        </FormField>

        {/* License Number */}
        <FormField
          label={`${regulatoryBody?.split(" ")[0] || "NCA"} License Number`}
          hint={
            <span className="flex items-center gap-1 text-amber-400">
              <ShieldCheck className="h-3 w-3" />
              For verification
            </span>
          }
          error={errors.licenseNumber?.message}
        >
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-amber-500/70" />
            <input
              type="text"
              placeholder="e.g. NCA/1234/5678"
              {...register("licenseNumber")}
              className={cn(
                WIZARD_STYLES.input,
                "pl-11",
                "focus:border-amber-400 focus:ring-amber-400",
                errors.licenseNumber && "border-red-500/50"
              )}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            Regulated by: {regulatoryBody}
          </p>
        </FormField>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Years of Experience */}
          <FormField
            label="Years of Experience"
            hint="Optional"
            error={errors.yearsExperience?.message}
          >
            <div className="relative">
              <Clock className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500" />
              <input
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 5"
                {...register("yearsExperience", { valueAsNumber: true })}
                className={cn(WIZARD_STYLES.input, "pl-11")}
              />
            </div>
          </FormField>

          {/* Website */}
          <FormField
            label="Website"
            hint="Optional"
            error={errors.website?.message}
          >
            <div className="relative">
              <Globe className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500" />
              <input
                type="url"
                placeholder="https://yourfirm.com"
                {...register("website")}
                className={cn(
                  WIZARD_STYLES.input,
                  "pl-11",
                  errors.website && "border-red-500/50"
                )}
              />
            </div>
          </FormField>
        </div>

        {/* Bio */}
        <FormField
          label="Professional Bio"
          hint="Optional • Max 1000 characters"
          error={errors.bio?.message}
        >
          <div className="relative">
            <FileText className="absolute left-3 top-3.5 h-5 w-5 text-zinc-500" />
            <textarea
              rows={4}
              placeholder="Tell us about your expertise, specializations, and notable projects..."
              {...register("bio")}
              className={cn(
                WIZARD_STYLES.input,
                "pl-11 resize-none",
                errors.bio && "border-red-500/50"
              )}
            />
          </div>
        </FormField>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex items-center justify-between pt-4"
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isFirstStep}
          className={cn(
            WIZARD_STYLES.secondaryButton,
            "flex items-center gap-2"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <button
          type="submit"
          className={cn(
            WIZARD_STYLES.primaryButton,
            "max-w-xs flex items-center justify-center gap-2"
          )}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </form>
  );
}
