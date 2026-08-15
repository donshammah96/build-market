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
        "group relative overflow-hidden rounded-2xl border transition-all duration-300",
        "p-4 sm:p-5",
        isActive
          ? [
              "bg-emerald-950/20 border-emerald-500/50",
              "shadow-[0_0_24px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/20",
            ].join(" ")
          : [
              "bg-zinc-900/70 border-zinc-800/90",
              "hover:border-zinc-700 hover:bg-zinc-900/95",
            ].join(" "),
      )}
    >
      {/* Left accent bar */}
      <div
        aria-hidden="true"
        className={cn(
          "absolute left-0 inset-y-0 w-1 rounded-r-full transition-all duration-300",
          isActive ? "opacity-100 bg-emerald-500" : "opacity-0 bg-emerald-500",
        )}
      />

      {/* Header row */}
      <div className="flex items-center gap-3 mb-3.5 pl-2">
        <div
          aria-hidden="true"
          className={cn(
            "p-2 rounded-xl transition-colors duration-200",
            isActive
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-zinc-800 text-zinc-400 group-hover:text-zinc-200",
          )}
        >
          {icon}
        </div>
        <h3
          className={cn(
            "text-sm font-bold tracking-tight transition-colors duration-200",
            isActive
              ? "text-emerald-400"
              : "text-white group-hover:text-emerald-300",
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
                "text-xs px-3 py-1.5 rounded-lg transition-all duration-200 font-medium",
                "focus-visible:outline-2 focus-visible:outline-emerald-500 focus-visible:outline-offset-1",
                isSelected
                  ? [
                      "bg-emerald-500 text-zinc-950 font-bold",
                      "shadow-[0_0_12px_rgba(16,185,129,0.4)]",
                    ].join(" ")
                  : [
                      "bg-zinc-800/80 text-zinc-300",
                      "hover:bg-zinc-700 hover:text-white",
                      "border border-zinc-700/60",
                    ].join(" "),
              )}
            >
              {opt.label}
            </button>
          );
        })}
        {professionOptions.length > 4 && (
          <span
            aria-hidden="true"
            className="text-xs text-zinc-500 px-2 py-1.5"
          >
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
            <Briefcase className="h-6 w-6" aria-hidden="true" />
          </div>
        </div>
        <h2 className="font-['Syne'] text-2xl md:text-3xl font-bold tracking-tight text-white">
          What is your primary profession?
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto leading-relaxed">
          Select your primary expertise to customize your professional
          verification requirements.
        </p>
      </motion.div>

      {/* Search combobox */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.35 }}
        className="max-w-md mx-auto space-y-2"
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
              placeholder="Type to search profession..."
              searchPlaceholder="Search professions..."
              emptyMessage="No profession found"
              id="profession-search"
              aria-invalid={errors.profession ? "true" : undefined}
              aria-describedby={
                errors.profession ? "profession-error" : undefined
              }
              className={cn(
                "w-full bg-zinc-900 border text-white hover:bg-zinc-800/80 rounded-xl",
                "focus:outline-none focus:ring-2 focus:ring-emerald-500/25",
                "transition-all duration-200",
                errors.profession ? "border-red-500/60" : "border-zinc-800",
              )}
            />
          )}
        />
        <div aria-live="polite" aria-atomic="true">
          {errors.profession && (
            <p id="profession-error" className={WIZARD_STYLES.error}>
              {errors.profession.message}
            </p>
          )}
        </div>
      </motion.div>

      {/* Category grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryCard
          icon={<Building2 className="h-4 w-4" />}
          title="Architecture & Design"
          professions={PROFESSION_GROUPS["Architecture & Design"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.05}
        />
        <CategoryCard
          icon={<Lightbulb className="h-4 w-4" />}
          title="Engineering"
          professions={PROFESSION_GROUPS["Engineering"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.1}
        />
        <CategoryCard
          icon={<HardHat className="h-4 w-4" />}
          title="Construction & Contracting"
          professions={PROFESSION_GROUPS["Construction Management"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.15}
        />
        <CategoryCard
          icon={<Wrench className="h-4 w-4" />}
          title="Specialized Trades"
          professions={PROFESSION_GROUPS["Specialized Trades"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.2}
        />
        <CategoryCard
          icon={<Home className="h-4 w-4" />}
          title="Real Estate"
          professions={PROFESSION_GROUPS["Real Estate"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.25}
        />
        <CategoryCard
          icon={<Store className="h-4 w-4" />}
          title="Building Suppliers"
          professions={PROFESSION_GROUPS["Suppliers"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.3}
        />
      </div>

      {/* Selected profession feedback */}
      {selectedProfession && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 shadow-lg"
        >
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-bold text-emerald-400 truncate">
                {
                  PROFESSION_OPTIONS.find((p) => p.value === selectedProfession)
                    ?.label
                }
              </h4>

              {regulatoryBodyFullName ? (
                <p className="text-xs text-zinc-300 mt-1">
                  Regulated & Verified by:{" "}
                  <span className="font-semibold text-white">
                    {regulatoryBodyFullName}
                  </span>
                </p>
              ) : (
                <p className="text-xs text-zinc-400 mt-1">
                  Standard identity, business registration, and tax compliance
                  verification required.
                </p>
              )}

              {isSupplier && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5 font-medium">
                  <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  You will be prompted to set up your merchant store details in
                  the following steps.
                </p>
              )}
              {isRealEstate && (
                <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1.5 font-medium">
                  <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Have your Estate Agents Registration Board (EARB) credentials
                  ready.
                </p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex justify-end pt-4 border-t border-zinc-800"
      >
        <button
          type="submit"
          disabled={!selectedProfession}
          className={cn(
            WIZARD_STYLES.primaryButton,
            "max-w-xs flex items-center justify-center gap-2",
          )}
        >
          Continue to Details
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </motion.div>
    </form>
  );
}
