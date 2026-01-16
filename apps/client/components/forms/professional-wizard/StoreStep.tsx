"use client";

import React, { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Store,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  CheckCircle2,
  MapPin,
} from "lucide-react";

import { cn } from "@/lib/utils";
import StoreForm, { StoreFormSubmitData } from "../StoreForm";
import { StepComponentProps, WIZARD_STYLES } from "./types";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StoreStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepComponentProps) {
  const [storeData, setStoreData] = useState<StoreFormSubmitData | null>(
    data.storeData || null
  );
  const [isFormValid, setIsFormValid] = useState(false);
  const [showForm, setShowForm] = useState(!data.storeData);

  // Handle store form changes
  const handleStoreChange = useCallback(
    (formData: Partial<StoreFormSubmitData>) => {
      // Only update if we have meaningful data
      if (formData.name || formData.address) {
        setStoreData(formData as StoreFormSubmitData);
      }
    },
    []
  );

  // Handle validity change from StoreForm
  const handleValidityChange = useCallback((isValid: boolean) => {
    setIsFormValid(isValid);
  }, []);

  // Save store and proceed
  const handleSaveAndContinue = () => {
    if (storeData && isFormValid) {
      onUpdate({ storeData });
    }
    onNext();
  };

  // Skip store setup
  const handleSkip = () => {
    onUpdate({ storeData: undefined });
    onNext();
  };

  // Edit existing store
  const handleEdit = () => {
    setShowForm(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="inline-flex items-center justify-center gap-2 mb-4">
          <Store className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
          Set up your store
        </h2>
        <p className="text-zinc-400 max-w-md mx-auto">
          Add your store details so customers can find you on Build Market
        </p>
      </motion.div>

      {/* Store Preview (if already set up) */}
      {storeData && !showForm && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-emerald-500/20 rounded-xl">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {storeData.name}
                </h3>
                <p className="text-sm text-zinc-400 flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {storeData.city}, {storeData.county}
                </p>
                {storeData.categories && storeData.categories.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {storeData.categories.slice(0, 3).map((cat) => (
                      <span
                        key={cat}
                        className="text-xs px-2 py-1 rounded-full bg-white/10 text-zinc-300"
                      >
                        {cat.replace(/_/g, " ")}
                      </span>
                    ))}
                    {storeData.categories.length > 3 && (
                      <span className="text-xs text-zinc-500">
                        +{storeData.categories.length - 3} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleEdit}
              className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Edit
            </button>
          </div>
        </motion.div>
      )}

      {/* Store Form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <StoreForm
            defaultValues={storeData || undefined}
            onSubmit={async (formData) => {
              setStoreData(formData);
              setShowForm(false);
            }}
            onChange={handleStoreChange}
            onValidityChange={handleValidityChange}
            hideSubmitButton={false}
            variant="dark"
          />
        </motion.div>
      )}

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4"
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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className={cn(
              WIZARD_STYLES.secondaryButton,
              "flex items-center gap-2"
            )}
          >
            <SkipForward className="h-4 w-4" />
            Skip for now
          </button>

          <button
            type="button"
            onClick={handleSaveAndContinue}
            disabled={showForm && !isFormValid}
            className={cn(
              WIZARD_STYLES.primaryButton,
              "flex items-center justify-center gap-2"
            )}
          >
            {storeData ? "Save & Continue" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      {/* Skip Info */}
      <p className="text-xs text-zinc-500 text-center">
        You can add or update your store anytime from your dashboard
      </p>
    </div>
  );
}
