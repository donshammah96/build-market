"use client";

import React from "react";
import { motion } from "framer-motion";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Briefcase,
  Building2,
  HardHat,
  Home,
  Wrench,
  Lightbulb,
  Store,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  PROFESSION_OPTIONS,
  PROFESSION_GROUPS,
  isSupplierProfession,
  isRealEstateProfession,
  getProfessionRegulatoryBody,
} from "@/lib/constants/professionOptions";
import {
  StepComponentProps,
  professionStepSchema,
  WIZARD_STYLES,
} from "./types";

// ============================================================================
// TYPES
// ============================================================================

type FormData = z.infer<typeof professionStepSchema>;

// ============================================================================
// CATEGORY CARD — Redesigned for legibility
//
// Changes from original:
//   - bg-white/5 → bg-white/[0.06]  (visible surface)
//   - border-white/10 → border-white/[0.13] (visible border)
//   - Inactive title: text-white (not conditional) — always readable
//   - Profession pills: bg-white/[0.09] text-white/75 (not text-zinc-400)
//   - Active pill: bg-[var(--color-success)] — unchanged but glow added
//   - Added left-side accent bar for active category
// ============================================================================

interface CategoryCardProps {
  icon: React.ReactNode;
  title: string;
  professions: readonly string[];
  selectedProfession: string;
  onSelect: (profession: string) => void;
  delay?: number;
}

const CategoryCard: React.FC<CategoryCardProps> = ({
  icon,
  title,
  professions,
  selectedProfession,
  onSelect,
  delay = 0,
}) => {
  const isActive = professions.includes(selectedProfession);
  const professionOptions = PROFESSION_OPTIONS.filter((opt) =>
    professions.includes(opt.value),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-all duration-300",
        "p-4",
        isActive
          ? [
              "bg-[var(--color-onboarding-primary)]/[0.11]",
              "border-[var(--color-onboarding-primary)]/45",
              "shadow-[0_0_24px_oklch(0.70_0.21_162_/_0.12)]",
            ].join(" ")
          : [
              "bg-white/[0.04]",
              "border-white/[0.10]",
              "hover:border-white/20",
              "hover:bg-white/[0.07]",
            ].join(" "),
      )}
    >
      {/* Left accent bar — only when active */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute left-0 inset-y-0 w-[3px] rounded-r-full transition-all duration-300",
          isActive
            ? "opacity-100 bg-[var(--color-onboarding-primary)]"
            : "opacity-0 bg-[var(--color-onboarding-primary)]",
        )}
      />

      {/* Header row */}
      <div className="flex items-center gap-3 mb-3 pl-2">
        <div
          aria-hidden="true"
          className={cn(
            "p-2 rounded-lg transition-colors duration-200",
            isActive
              ? "bg-[var(--color-onboarding-primary)]/20 text-[var(--color-onboarding-primary)]"
              : "bg-white/[0.07] text-white/50 group-hover:text-white/80",
          )}
        >
          {icon}
        </div>
        <h3
          className={cn(
            "font-['Syne'] text-sm font-bold tracking-wide transition-colors duration-200",
            isActive
              ? "text-[var(--color-onboarding-primary)]"
              : "text-white/85 group-hover:text-white",
          )}
        >
          {title}
        </h3>
      </div>

      {/* Profession pills */}
      <div className="flex flex-wrap gap-2 pl-2">
        {professionOptions.slice(0, 4).map((opt) => {
          const isSelected = selectedProfession === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onSelect(opt.value)}
              aria-pressed={isSelected}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full transition-all duration-200",
                "focus-visible:outline-2 focus-visible:outline-[var(--color-focus-ring)] focus-visible:outline-offset-1",
                isSelected
                  ? [
                      "bg-[var(--color-success)] text-white font-semibold",
                      "shadow-[0_0_12px_oklch(0.70_0.21_162_/_0.40)]",
                    ].join(" ")
                  : [
                      "bg-white/[0.09] text-white/70",
                      "hover:bg-white/[0.16] hover:text-white",
                      "border border-white/[0.08]",
                    ].join(" "),
              )}
            >
              {opt.label}
            </button>
          );
        })}
        {professionOptions.length > 4 && (
          <span aria-hidden="true" className="text-xs text-white/35 px-2 py-1">
            +{professionOptions.length - 4} more
          </span>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProfessionStep({
  data,
  onUpdate,
  onNext,
}: StepComponentProps) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(professionStepSchema),
    shouldFocusError: false,
    defaultValues: {
      profession: data.profession || "",
    },
  });

  const selectedProfession = watch("profession");

  const regulatoryBodyFullName = selectedProfession
    ? getProfessionRegulatoryBody(selectedProfession)
    : null;

  const isSupplier = selectedProfession
    ? isSupplierProfession(selectedProfession)
    : false;
  const isRealEstate = selectedProfession
    ? isRealEstateProfession(selectedProfession)
    : false;

  const handleProfessionSelect = (profession: string) => {
    setValue("profession", profession, { shouldValidate: true });
  };

  const onSubmit = (formData: FormData) => {
    onUpdate({ profession: formData.profession });
    onNext();
  };

  const onInvalid = () => {
    requestAnimationFrame(() => {
      const comboboxTrigger = document.getElementById("profession-search");
      comboboxTrigger?.focus();
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="space-y-7"
      noValidate
    >
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center gap-2 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-onboarding-primary)]/16 text-[var(--color-onboarding-primary)]">
            <Briefcase className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
        <h2 className="font-['Syne'] text-2xl md:text-3xl font-bold leading-[1.1] text-white mb-2 tracking-tight">
          What do you do?
        </h2>
        <p className="text-white/55 text-sm max-w-md mx-auto leading-relaxed">
          Select your primary expertise to customise your onboarding
          verification.
        </p>
      </motion.div>

      {/* ── Search combobox ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        className="max-w-md mx-auto"
      >
        <label htmlFor="profession-search" className={WIZARD_STYLES.label}>
          Search All Professions
        </label>
        <Controller
          name="profession"
          control={control}
          render={({ field }) => (
            <Combobox
              options={PROFESSION_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              placeholder="Type to search..."
              searchPlaceholder="Search professions..."
              emptyMessage="No profession found"
              id="profession-search"
              aria-invalid={errors.profession ? "true" : undefined}
              aria-describedby={
                errors.profession ? "profession-error" : undefined
              }
              className={cn(
                // Combobox trigger — properly visible on dark
                "w-full bg-white/[0.08] border text-white hover:bg-white/[0.11]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--color-focus-ring)]/25",
                "transition-all duration-200",
                errors.profession
                  ? "border-[var(--color-error)]/60"
                  : "border-white/[0.16]",
              )}
            />
          )}
        />
        {/* aria-live ensures errors are announced without interrupting AT */}
        <div aria-live="polite" aria-atomic="true">
          {errors.profession && (
            <p id="profession-error" className={WIZARD_STYLES.error}>
              {errors.profession.message}
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Category grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CategoryCard
          icon={<Building2 className="h-4 w-4" />}
          title="Architecture & Design"
          professions={PROFESSION_GROUPS["Architecture & Design"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.12}
        />
        <CategoryCard
          icon={<Lightbulb className="h-4 w-4" />}
          title="Engineering"
          professions={PROFESSION_GROUPS["Engineering"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.16}
        />
        <CategoryCard
          icon={<HardHat className="h-4 w-4" />}
          title="Construction"
          professions={PROFESSION_GROUPS["Construction Management"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.2}
        />
        <CategoryCard
          icon={<Wrench className="h-4 w-4" />}
          title="Specialized Trades"
          professions={PROFESSION_GROUPS["Specialized Trades"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.24}
        />
        <CategoryCard
          icon={<Home className="h-4 w-4" />}
          title="Real Estate"
          professions={PROFESSION_GROUPS["Real Estate"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.28}
        />
        <CategoryCard
          icon={<Store className="h-4 w-4" />}
          title="Suppliers"
          professions={PROFESSION_GROUPS["Suppliers"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.32}
        />
      </div>

      {/* ── Selected profession feedback ── */}
      {selectedProfession && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "rounded-xl border p-4 overflow-hidden",
            "bg-[var(--color-onboarding-primary)]/[0.1] border-[var(--color-onboarding-primary)]/35",
          )}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-[var(--color-onboarding-primary)]/16 rounded-lg shrink-0">
              <CheckCircle2
                className="h-4 w-4 text-[var(--color-onboarding-primary)]"
                aria-hidden="true"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-['Syne'] text-sm font-bold text-[var(--color-onboarding-primary)] truncate">
                {
                  PROFESSION_OPTIONS.find((p) => p.value === selectedProfession)
                    ?.label
                }
              </h4>

              {regulatoryBodyFullName ? (
                <p className="text-xs text-white/60 mt-1">
                  Verified by:{" "}
                  <span className="font-semibold text-white/90">
                    {regulatoryBodyFullName}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-white/50 mt-1">
                  Standard identity and tax compliance verification required.
                </p>
              )}

              {isSupplier && (
                <p className="text-xs text-[var(--color-onboarding-primary)] mt-2 flex items-center gap-1.5">
                  <Store className="h-3 w-3 shrink-0" aria-hidden="true" />
                  You will be prompted to set up your merchant store in the next
                  steps.
                </p>
              )}
              {isRealEstate && (
                <p className="text-xs text-[var(--color-onboarding-primary)] mt-2 flex items-center gap-1.5">
                  <Home className="h-3 w-3 shrink-0" aria-hidden="true" />
                  Have your board registration documents ready for the
                  credential step.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Navigation ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex justify-end pt-3"
      >
        <button
          type="submit"
          disabled={!selectedProfession}
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
