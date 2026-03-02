"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Home as HomeIcon,
  ChevronDown,
  AlertCircle,
  Check,
  Loader2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import PropertyForm, { PropertyFormSubmitData } from "./PropertyForm";

// ============================================================================
// TYPES
// ============================================================================

// PropertyData extends the submission type
export interface PropertyData extends PropertyFormSubmitData {
  id?: string;
  // Temporary ID for UI handling (not sent to backend)
  _tempId?: string;
}

export type PropertyFormVariant = "light" | "dark";

export interface MultiPropertyFormProps {
  initialProperties?: PropertyData[];
  onSubmit: (properties: PropertyData[]) => Promise<void> | void;
  onCancel?: () => void;
  maxProperties?: number;
  isOnboarding?: boolean;
  startEmpty?: boolean;
  /** Theme variant - 'light' for standalone pages, 'dark' for wizard/onboarding */
  variant?: PropertyFormVariant;
}

interface PropertyEntry {
  id: string; // Internal UI ID
  data: Partial<PropertyData>;
  isExpanded: boolean;
  isValid: boolean;
}

// ============================================================================
// THEME
// ============================================================================

const createMultiPropertyTheme = (variant: PropertyFormVariant) => {
  const isDark = variant === "dark";

  return {
    // Container
    container: "max-w-4xl mx-auto space-y-8 pb-10",

    // Header
    headerBorder: isDark
      ? "border-b border-white/10 pb-6"
      : "border-b border-zinc-200 pb-6",
    headerTitle: isDark
      ? "text-2xl font-bold text-white tracking-tight"
      : "text-2xl font-bold text-zinc-900 tracking-tight",
    headerDescription: isDark
      ? "text-zinc-400 mt-1 max-w-xl"
      : "text-zinc-500 mt-1 max-w-xl",

    // Add button
    addButton: isDark
      ? "bg-white/5 hover:bg-white/10 text-white border border-white/20 shadow-sm transition-all"
      : "bg-white hover:bg-zinc-50 text-zinc-900 border border-zinc-200 shadow-sm transition-all",
    addButtonIcon: isDark ? "text-emerald-400" : "text-emerald-600",

    // Error banner
    errorBanner: isDark
      ? "bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm"
      : "bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2 text-sm",

    // Property card
    propertyCard: isDark
      ? "group rounded-xl border transition-all duration-300 overflow-hidden bg-white/5 backdrop-blur-sm"
      : "group rounded-xl border transition-all duration-300 overflow-hidden bg-white",

    propertyCardExpanded: isDark
      ? "ring-1 ring-emerald-500/30 shadow-lg border-emerald-500/30"
      : "ring-1 ring-zinc-200 shadow-lg border-zinc-300",

    propertyCardCollapsed: isDark
      ? "hover:border-white/20 hover:shadow-md border-white/10 shadow-sm"
      : "hover:border-zinc-300 hover:shadow-md border-zinc-200 shadow-sm",

    // Card header
    cardHeader: isDark
      ? "flex items-center justify-between p-5 cursor-pointer select-none bg-white/5"
      : "flex items-center justify-between p-5 cursor-pointer select-none bg-white",

    // Status indicator
    statusIndicatorValid: isDark
      ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
      : "bg-emerald-50 border-emerald-100 text-emerald-600",

    statusIndicatorInvalid: isDark
      ? "bg-white/5 border-white/10 text-zinc-500 group-hover:bg-white/10"
      : "bg-zinc-50 border-zinc-100 text-zinc-400 group-hover:bg-zinc-100",

    // Property name
    propertyName: isDark ? "text-white" : "text-zinc-900",
    propertyNameEmpty: isDark ? "text-zinc-500 italic" : "text-zinc-400 italic",

    // Status text
    statusValid: isDark
      ? "text-emerald-400 font-medium"
      : "text-emerald-600 font-medium",
    statusInvalid: isDark ? "text-amber-400" : "text-amber-600",
    statusMeta: isDark ? "text-zinc-500" : "text-zinc-500",
    statusDot: isDark ? "bg-zinc-600" : "bg-zinc-300",

    // Remove button
    removeButton: isDark
      ? "text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      : "text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors",

    // Chevron
    chevron: isDark ? "text-zinc-500" : "text-zinc-400",

    // Accordion content
    accordionContent: isDark
      ? "border-t border-white/10 bg-white/5 p-6 md:p-8"
      : "border-t border-zinc-100 bg-zinc-50/30 p-6 md:p-8",

    // Empty state
    emptyState: isDark
      ? "text-center py-16 border-2 border-dashed border-white/10 rounded-xl bg-white/5"
      : "text-center py-16 border-2 border-dashed border-zinc-200 rounded-xl bg-zinc-50/50",

    emptyStateIcon: isDark ? "text-zinc-600" : "text-zinc-300",
    emptyStateTitle: isDark
      ? "text-lg font-medium text-white"
      : "text-lg font-medium text-zinc-900",
    emptyStateDescription: isDark
      ? "text-zinc-500 mb-6 max-w-sm mx-auto"
      : "text-zinc-500 mb-6 max-w-sm mx-auto",
    emptyStateButton: isDark
      ? "bg-emerald-600 text-white hover:bg-emerald-500"
      : "bg-zinc-900 text-white hover:bg-zinc-800",

    // Footer
    footer: isDark
      ? "sticky bottom-0 z-10 bg-zinc-900/80 backdrop-blur-md border-t border-white/10 p-4 -mx-4 md:mx-0 md:rounded-xl md:border md:shadow-lg flex items-center justify-between mt-8"
      : "sticky bottom-0 z-10 bg-white/80 backdrop-blur-md border-t border-zinc-200 p-4 -mx-4 md:mx-0 md:rounded-xl md:border md:shadow-lg flex items-center justify-between mt-8",

    footerMeta: isDark ? "text-sm text-zinc-500" : "text-sm text-zinc-500",

    // Footer buttons
    skipButton: isDark
      ? "text-zinc-400 hover:text-white hover:bg-white/5"
      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",

    submitButtonValid: isDark
      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white shadow-lg shadow-emerald-500/20"
      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-200",

    submitButtonInvalid: isDark
      ? "bg-white/10 text-zinc-500 cursor-not-allowed"
      : "bg-zinc-200 text-zinc-400 cursor-not-allowed",
  } as const;
};

// ============================================================================
// COMPONENT
// ============================================================================

export function MultiPropertyForm({
  initialProperties = [],
  onSubmit,
  onCancel,
  maxProperties = 5,
  isOnboarding = false,
  startEmpty = false,
  variant = "light",
}: MultiPropertyFormProps) {
  // Create theme based on variant
  const theme = useMemo(() => createMultiPropertyTheme(variant), [variant]);

  // Validation Logic
  function validateProperty(data: Partial<PropertyData>): boolean {
    return !!(
      data.title?.trim() &&
      data.price &&
      data.price > 0 &&
      data.currency &&
      data.type &&
      data.category &&
      data.location?.trim()
    );
  }

  // State Initialization
  const [properties, setProperties] = useState<PropertyEntry[]>(() => {
    if (initialProperties.length > 0) {
      return initialProperties.map((data, index) => ({
        id: `property-${Date.now()}-${index}`,
        data,
        isExpanded: index === 0,
        isValid: validateProperty(data),
      }));
    }
    if (startEmpty) return [];
    return [
      {
        id: `property-${Date.now()}-0`,
        data: {},
        isExpanded: true,
        isValid: false,
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handlers
  const handleAddProperty = useCallback(() => {
    if (properties.length >= maxProperties) return;
    setProperties((prev) => [
      ...prev.map((p) => ({ ...p, isExpanded: false })), // Collapse others
      {
        id: `property-${Date.now()}-${prev.length}`,
        data: {},
        isExpanded: true,
        isValid: false,
      },
    ]);
  }, [properties.length, maxProperties]);

  const handleRemoveProperty = useCallback((propertyId: string) => {
    setProperties((prev) => prev.filter((p) => p.id !== propertyId));
  }, []);

  const handleToggleProperty = useCallback((propertyId: string) => {
    setProperties((prev) =>
      prev.map((p) => ({
        ...p,
        isExpanded: p.id === propertyId ? !p.isExpanded : false,
      })),
    );
  }, []);

  const handlePropertyUpdate = useCallback(
    (propertyId: string, data: Partial<PropertyData>) => {
      setProperties((prev) =>
        prev.map((p) =>
          p.id === propertyId
            ? {
                ...p,
                data: { ...p.data, ...data },
                isValid: validateProperty({ ...p.data, ...data }),
              }
            : p,
        ),
      );
    },
    [],
  );

  const handleSubmit = async () => {
    const invalidProperties = properties.filter((p) => !p.isValid);
    if (invalidProperties.length > 0) {
      setError(
        `Please complete all required fields for ${invalidProperties.length} property listing(s).`,
      );
      // Expand the first invalid property
      setProperties((prev) =>
        prev.map((p) => ({
          ...p,
          isExpanded: p.id === invalidProperties[0]?.id,
        })),
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(properties.map((p) => p.data as PropertyData));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save property listings",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const allValid = properties.length > 0 && properties.every((p) => p.isValid);

  return (
    <div className={theme.container}>
      {/* Header Section */}
      <div
        className={cn(
          "flex flex-col md:flex-row md:items-end justify-between gap-4",
          theme.headerBorder,
        )}
      >
        <div>
          <h2 className={theme.headerTitle}>
            {isOnboarding ? "Add Your Listings" : "Manage Properties"}
          </h2>
          <p className={theme.headerDescription}>
            Add detailed information for your property listings to verify your
            professional portfolio.
          </p>
        </div>

        {properties.length < maxProperties && (
          <Button onClick={handleAddProperty} className={theme.addButton}>
            <Plus className={cn("h-4 w-4 mr-2", theme.addButtonIcon)} />
            Add Another Listing
          </Button>
        )}
      </div>

      {/* Global Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={theme.errorBanner}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Property List */}
      <div className="space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
          {properties.map((property, index) => (
            <motion.div
              key={property.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                theme.propertyCard,
                property.isExpanded
                  ? theme.propertyCardExpanded
                  : theme.propertyCardCollapsed,
              )}
            >
              {/* Card Header (Clickable) */}
              <div
                onClick={() => handleToggleProperty(property.id)}
                className={theme.cardHeader}
              >
                <div className="flex items-center gap-4">
                  {/* Status Indicator Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border transition-colors",
                      property.isValid
                        ? theme.statusIndicatorValid
                        : theme.statusIndicatorInvalid,
                    )}
                  >
                    {property.isValid ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <HomeIcon className="h-6 w-6" />
                    )}
                  </div>

                  <div>
                    <h3
                      className={cn(
                        "font-semibold text-lg transition-colors",
                        !property.data.title
                          ? theme.propertyNameEmpty
                          : theme.propertyName,
                      )}
                    >
                      {property.data.title || `Property Listing ${index + 1}`}
                    </h3>
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm mt-0.5",
                        theme.statusMeta,
                      )}
                    >
                      {property.isValid ? (
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            theme.statusValid,
                          )}
                        >
                          <Check className="h-3 w-3" />
                          Ready
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            theme.statusInvalid,
                          )}
                        >
                          Incomplete
                        </span>
                      )}
                      {(property.data.location || property.data.price) && (
                        <>
                          <span
                            className={cn(
                              "w-1 h-1 rounded-full",
                              theme.statusDot,
                            )}
                          />
                          <span className="flex items-center gap-1">
                            {property.data.location && (
                              <>
                                <MapPin className="h-3 w-3" />{" "}
                                {property.data.location}
                              </>
                            )}
                            {property.data.location &&
                              property.data.price &&
                              ", "}
                            {property.data.price && (
                              <>
                                {property.data.currency || "KES"}{" "}
                                {property.data.price.toLocaleString()}
                              </>
                            )}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={theme.removeButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveProperty(property.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div
                    className={cn(
                      "transition-transform duration-300",
                      theme.chevron,
                      property.isExpanded && "rotate-180",
                    )}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* Accordion Content */}
              <AnimatePresence>
                {property.isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className={theme.accordionContent}>
                      <PropertyForm
                        defaultValues={property.data}
                        isEditing={!!property.data.id}
                        hideSubmitButton
                        onChange={(data) =>
                          handlePropertyUpdate(property.id, data)
                        }
                        onSubmit={async () => {}} // No-op, handled by parent
                        // We do not pass variant here as PropertyForm has its own dark/light logic
                        // but usually it adapts to parents via Tailwind classes if set up correctly
                        // If PropertyForm needs explicit mode, we might need to add it to props.
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {properties.length === 0 && (
          <div className={theme.emptyState}>
            <HomeIcon
              className={cn("mx-auto h-12 w-12 mb-4", theme.emptyStateIcon)}
            />
            <h3 className={theme.emptyStateTitle}>
              No detailed listings added
            </h3>
            <p className={theme.emptyStateDescription}>
              Get started by adding your first property listing to your
              professional portfolio.
            </p>
            <Button
              onClick={handleAddProperty}
              className={theme.emptyStateButton}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add First Listing
            </Button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className={theme.footer}>
        <div className={cn("hidden sm:block", theme.footerMeta)}>
          {properties.filter((p) => p.isValid).length}/{properties.length}{" "}
          listings ready
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {isOnboarding && (
            <Button
              variant="ghost"
              onClick={onCancel}
              disabled={isSubmitting}
              className={theme.skipButton}
            >
              Skip for now
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !allValid}
            className={cn(
              "min-w-[140px] transition-all",
              allValid ? theme.submitButtonValid : theme.submitButtonInvalid,
            )}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : (
              "Save & Continue"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
