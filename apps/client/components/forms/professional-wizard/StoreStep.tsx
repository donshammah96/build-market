"use client";

import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { StoreFormSubmitData } from "../StoreForm";
import { MultiStoreForm } from "../MultiStoreForm";
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
  const [stores] = useState<StoreFormSubmitData[]>(data.stores || []);

  // Skip store setup
  const handleSkip = () => {
    onUpdate({ stores: [] }); // Explicitly empty
    onNext();
  };

  return (
    <div className="space-y-8">
      {/* Header handled inside MultiStoreForm or here? MultiStoreForm has a header. 
          Let's use MultiStoreForm's internal header and layout for consistency.
      */}

      <MultiStoreForm
        initialStores={stores}
        onSubmit={(validStores) => {
          onUpdate({ stores: validStores });
          onNext();
        }}
        onCancel={handleSkip}
        isOnboarding={true}
        variant="dark"
      />

      <div className="flex justify-start pt-4">
        <button
          type="button"
          onClick={onBack}
          className={cn(
            WIZARD_STYLES.secondaryButton,
            "flex items-center gap-2",
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </div>
    </div>
  );
}
