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
  Sparkles,
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
import { StepComponentProps, professionStepSchema, WIZARD_STYLES } from "./types";

// ============================================================================
// TYPES
// ============================================================================

type FormData = z.infer<typeof professionStepSchema>;

// ============================================================================
// PROFESSION CATEGORY CARDS
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
    professions.includes(opt.value)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className={cn(
        "group p-4 rounded-xl border transition-all duration-300 cursor-pointer",
        isActive
          ? "bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10"
          : "bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/8"
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            "p-2 rounded-lg transition-colors",
            isActive
              ? "bg-emerald-500/20 text-emerald-400"
              : "bg-white/5 text-zinc-400 group-hover:text-zinc-300"
          )}
        >
          {icon}
        </div>
        <h3
          className={cn(
            "font-semibold transition-colors",
            isActive ? "text-emerald-400" : "text-white"
          )}
        >
          {title}
        </h3>
      </div>

      <div className="flex flex-wrap gap-2">
        {professionOptions.slice(0, 4).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onSelect(opt.value)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full transition-all",
              selectedProfession === opt.value
                ? "bg-emerald-500 text-white"
                : "bg-white/10 text-zinc-400 hover:bg-white/20 hover:text-white"
            )}
          >
            {opt.label}
          </button>
        ))}
        {professionOptions.length > 4 && (
          <span className="text-xs text-zinc-500 px-2 py-1">
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
  isFirstStep,
}: StepComponentProps) {
  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(professionStepSchema),
    defaultValues: {
      profession: data.profession || "",
    },
  });

  const selectedProfession = watch("profession");

  // Get info about selected profession
  const regulatoryBody = selectedProfession
    ? getProfessionRegulatoryBody(selectedProfession)
    : null;
  const isSupplier = isSupplierProfession(selectedProfession);
  const isRealEstate = isRealEstateProfession(selectedProfession);

  const handleProfessionSelect = (profession: string) => {
    setValue("profession", profession, { shouldValidate: true });
  };

  const onSubmit = (formData: FormData) => {
    onUpdate({ profession: formData.profession });
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
          <Briefcase className="h-8 w-8 text-emerald-500" />
          <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          What do you do?
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          Select your profession to customize your onboarding experience
        </p>
      </motion.div>

      {/* Search Combobox */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="max-w-md mx-auto"
      >
        <label className={WIZARD_STYLES.label}>Search All Professions</label>
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
              className={cn(
                "w-full bg-white/5 border text-white hover:bg-white/10",
                "focus:outline-none focus:ring-2 focus:ring-emerald-400",
                errors.profession ? "border-red-500/50" : "border-white/30"
              )}
            />
          )}
        />
        {errors.profession && (
          <p className={WIZARD_STYLES.error}>{errors.profession.message}</p>
        )}
      </motion.div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryCard
          icon={<Building2 className="h-5 w-5" />}
          title="Architecture & Design"
          professions={PROFESSION_GROUPS["Architecture & Design"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.15}
        />
        <CategoryCard
          icon={<Lightbulb className="h-5 w-5" />}
          title="Engineering"
          professions={PROFESSION_GROUPS["Engineering"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.2}
        />
        <CategoryCard
          icon={<HardHat className="h-5 w-5" />}
          title="Construction"
          professions={PROFESSION_GROUPS["Contractors"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.25}
        />
        <CategoryCard
          icon={<Wrench className="h-5 w-5" />}
          title="Specialized Trades"
          professions={PROFESSION_GROUPS["Specialized Trades"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.3}
        />
        <CategoryCard
          icon={<Home className="h-5 w-5" />}
          title="Real Estate"
          professions={PROFESSION_GROUPS["Real Estate"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.35}
        />
        <CategoryCard
          icon={<Store className="h-5 w-5" />}
          title="Suppliers"
          professions={PROFESSION_GROUPS["Suppliers"]}
          selectedProfession={selectedProfession}
          onSelect={handleProfessionSelect}
          delay={0.4}
        />
      </div>

      {/* Selected Profession Info */}
      {selectedProfession && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Briefcase className="h-5 w-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-medium text-emerald-400">
                {PROFESSION_OPTIONS.find((p) => p.value === selectedProfession)?.label}
              </h4>
              <p className="text-sm text-zinc-400 mt-1">
                {regulatoryBody && (
                  <span>Regulated by: {regulatoryBody}</span>
                )}
              </p>
              {isSupplier && (
                <p className="text-xs text-amber-400 mt-2">
                  You&apos;ll be able to set up your store in the next steps
                </p>
              )}
              {isRealEstate && (
                <p className="text-xs text-amber-400 mt-2">
                  You&apos;ll need to provide your EARB registration details
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
        transition={{ delay: 0.5 }}
        className="flex justify-end pt-4"
      >
        <button
          type="submit"
          disabled={!selectedProfession}
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
