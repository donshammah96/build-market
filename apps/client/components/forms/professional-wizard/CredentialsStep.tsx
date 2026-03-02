"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { BadgeCheck, ShieldCheck, ArrowRight, ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { getRegulatoryAuthorityCode } from "@/lib/constants/professionOptions";
import {
  StepComponentProps,
  credentialsStepSchema,
  WIZARD_STYLES,
} from "./types";

type FormData = z.infer<typeof credentialsStepSchema>;

// ============================================================================
// DOMAIN HELPER
// ============================================================================

/**
 * Resolves the correct regulatory board details for ALL professions.
 */
function getBoardDetails(profession?: string, authorityCode?: string | null) {
  // 1. Handle specific overrides first
  if (profession === "REAL_ESTATE_VALUER") {
    return {
      abbr: "VRB",
      fullName: "Valuers Registration Board",
      placeholder: "e.g., VRB/1234/26",
      description:
        "To perform valuations, we must verify your active standing with the VRB.",
    };
  }
  if (profession === "LAND_SURVEYOR") {
    return {
      abbr: "ISK",
      fullName: "Institution of Surveyors of Kenya",
      placeholder: "e.g., ISK/LS/5678",
      description:
        "To provide surveying services, your ISK membership must be validated.",
    };
  }
  if (profession === "REAL_ESTATE_AGENT") {
    return {
      abbr: "EARB",
      fullName: "Estate Agents Registration Board",
      placeholder: "e.g., EARB/9012",
      description:
        "To list properties, we must verify your active registration with the EARB.",
    };
  }

  // 2. Handle broader authority groups
  switch (authorityCode) {
    case "EBK":
      return {
        abbr: "EBK",
        fullName: "Engineers Board of Kenya",
        placeholder: "e.g., A3456 or B1234",
        description:
          "To offer engineering services, we must verify your active standing with the EBK.",
      };
    case "BORAQS":
      return {
        abbr: "BORAQS",
        fullName: "Board of Registration of Architects and Quantity Surveyors",
        placeholder: "e.g., A/1234 or Q/5678",
        description:
          "Please provide your BORAQS registration number to verify your professional standing.",
      };
    case "NCA":
      return {
        abbr: "NCA",
        fullName: "National Construction Authority",
        placeholder: "e.g., NCA1/1234/2026",
        description:
          "Contractors and specialized trades must provide their NCA accreditation number.",
      };
    case "EPRA":
      return {
        abbr: "EPRA",
        fullName: "Energy and Petroleum Regulatory Authority",
        placeholder: "e.g., EPRA/EW/12345",
        description:
          "Electricians and Solar Technicians must hold a valid EPRA license.",
      };
    default:
      return {
        abbr: "License",
        fullName: "Professional Licensing Board",
        placeholder: "Enter your license number",
        description: "Please provide your professional registration details.",
      };
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function CredentialsStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepComponentProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(credentialsStepSchema),
    defaultValues: {
      boardRegistrationNumber: data.boardRegistrationNumber || "",
    },
  });

  // Resolve dynamic board info using our domain logic
  const board = useMemo(() => {
    const authCode = getRegulatoryAuthorityCode(data.profession || "");
    return getBoardDetails(data.profession, authCode);
  }, [data.profession]);

  const onSubmit = (formData: FormData) => {
    onUpdate({ boardRegistrationNumber: formData.boardRegistrationNumber });
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
          <BadgeCheck className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Verify your Credentials
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto">{board.description}</p>
      </motion.div>

      {/* Main Input Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={WIZARD_STYLES.card}
      >
        <div className="space-y-6">
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm text-zinc-300">
              Your profile will display a{" "}
              <span className="text-white font-semibold">
                {board.abbr} Verified
              </span>{" "}
              badge once our team confirms this registration number.
            </div>
          </div>

          <div>
            <label
              htmlFor="boardRegistrationNumber"
              className={WIZARD_STYLES.label}
            >
              {board.abbr} Registration Number{" "}
              <span className="text-red-400">*</span>
            </label>
            <input
              id="boardRegistrationNumber"
              type="text"
              {...register("boardRegistrationNumber")}
              placeholder={board.placeholder}
              className={cn(
                WIZARD_STYLES.input,
                errors.boardRegistrationNumber
                  ? "border-red-500/50 ring-1 ring-red-500/50"
                  : "",
              )}
            />
            {errors.boardRegistrationNumber && (
              <p className={WIZARD_STYLES.error}>
                {errors.boardRegistrationNumber.message}
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex items-center justify-between pt-4"
      >
        <button
          type="button"
          onClick={onBack}
          className={WIZARD_STYLES.secondaryButton}
        >
          <span className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" /> Back
          </span>
        </button>
        <button
          type="submit"
          className={cn(
            WIZARD_STYLES.primaryButton,
            "max-w-xs flex items-center justify-center gap-2",
          )}
        >
          Continue <ArrowRight className="h-4 w-4" />
        </button>
      </motion.div>
    </form>
  );
}
