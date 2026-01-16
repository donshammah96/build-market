"use client";

import React from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShieldCheck,
  Home,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ExternalLink,
  Award,
  Info,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  StepComponentProps,
  credentialsStepSchema,
  WIZARD_STYLES,
} from "./types";

// ============================================================================
// TYPES
// ============================================================================

type FormData = z.infer<typeof credentialsStepSchema>;

// ============================================================================
// MAIN COMPONENT
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
      earbNumber: data.earbNumber || "",
    },
  });

  const onSubmit = (formData: FormData) => {
    onUpdate({ earbNumber: formData.earbNumber });
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
          <Home className="h-8 w-8 text-emerald-500" />
          <Award className="h-6 w-6 text-amber-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Real Estate Credentials
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          As a real estate professional, you need EARB registration to operate
          in Kenya
        </p>
      </motion.div>

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5"
      >
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-400 mb-1">
              Why is EARB Registration Required?
            </h4>
            <p className="text-sm text-zinc-400">
              The Estate Agents Registration Board (EARB) is the regulatory body
              for real estate agents in Kenya. Registration ensures you&apos;re
              legally authorized to conduct property transactions.
            </p>
            <a
              href="https://www.earb.go.ke"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 mt-2 transition-colors"
            >
              Visit EARB Website
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </motion.div>

      {/* Form Field */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-6"
      >
        <div className="space-y-2">
          <label className={WIZARD_STYLES.label}>
            <span className="flex items-center gap-2">
              EARB Registration Number
              <span className="text-amber-500">*</span>
            </span>
          </label>
          <div className="relative">
            <ShieldCheck className="absolute left-3 top-3.5 h-5 w-5 text-amber-500" />
            <input
              type="text"
              placeholder="e.g. EARB/AGT/2024/12345"
              {...register("earbNumber")}
              className={cn(
                WIZARD_STYLES.input,
                "pl-11",
                "focus:border-amber-400 focus:ring-amber-400",
                errors.earbNumber && "border-red-500/50"
              )}
            />
          </div>
          {errors.earbNumber && (
            <p className={WIZARD_STYLES.error}>
              <AlertCircle className="h-3 w-3" />
              {errors.earbNumber.message}
            </p>
          )}
          <p className="text-xs text-zinc-500">
            This will be verified by our team before your profile is published
          </p>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-2 gap-4 pt-4">
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <ShieldCheck className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Verified Badge</p>
            <p className="text-xs text-zinc-500 mt-1">
              Earn a verified badge on your profile
            </p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-center">
            <Award className="h-6 w-6 text-amber-400 mx-auto mb-2" />
            <p className="text-sm font-medium text-white">Premium Leads</p>
            <p className="text-xs text-zinc-500 mt-1">
              Get access to quality property leads
            </p>
          </div>
        </div>
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
