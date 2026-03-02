"use client";

import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { PropertyFormSubmitData } from "../PropertyForm";
import { MultiPropertyForm } from "../MultiPropertyForm";
import { StepComponentProps, WIZARD_STYLES } from "./types";

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PropertyStep({
  data,
  onUpdate,
  onNext,
  onBack,
}: StepComponentProps) {
  const [properties] = useState<PropertyFormSubmitData[]>(
    data.properties || [],
  );

  // Skip property setup
  const handleSkip = () => {
    onUpdate({ properties: [] });
    onNext();
  };

  return (
    <div className="space-y-8">
      <MultiPropertyForm
        initialProperties={properties}
        onSubmit={(validProperties) => {
          onUpdate({ properties: validProperties });
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
