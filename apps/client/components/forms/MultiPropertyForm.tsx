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
      : "border-b border-border pb-6",
    headerTitle: "text-2xl font-bold text-foreground tracking-tight",
    headerDescription: "text-muted-foreground mt-1 max-w-xl",

    // Add button
    addButton: isDark
      ? "bg-white/5 hover:bg-white/10 text-foreground border border-border shadow-sm transition-all"
      : "bg-background hover:bg-muted text-foreground border border-border shadow-sm transition-all",
    addButtonIcon: "text-[var(--color-success)]",

    // Error banner
    errorBanner: isDark
      ? "bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] px-4 py-3 rounded-xl flex items-center gap-2 text-sm"
      : "bg-[var(--color-error)]/10 border border-[var(--color-error)]/30 text-[var(--color-error)] px-4 py-3 rounded-lg flex items-center gap-2 text-sm",

    // Property card
    propertyCard: isDark
      ? "group rounded-xl border transition-all duration-300 overflow-hidden bg-white/5 backdrop-blur-sm"
      : "group rounded-xl border transition-all duration-300 overflow-hidden bg-background",

    propertyCardExpanded: isDark
      ? "ring-1 ring-[var(--color-success)]/30 shadow-lg border-[var(--color-success)]/30"
      : "ring-1 ring-border shadow-lg border-border",

    propertyCardCollapsed: isDark
      ? "hover:border-white/20 hover:shadow-md border-white/10 shadow-sm"
      : "hover:border-border hover:shadow-md border-border shadow-sm",

    // Card header
    cardHeader: isDark
      ? "flex items-center justify-between p-5 cursor-pointer select-none bg-white/5"
      : "flex items-center justify-between p-5 cursor-pointer select-none bg-white",

    // Status indicator
    statusIndicatorValid: isDark
      ? "bg-[var(--color-success)]/20 border-[var(--color-success)]/30 text-[var(--color-success)]"
      : "bg-[var(--color-success)]/10 border-[var(--color-success)]/30 text-[var(--color-success)]",

    statusIndicatorInvalid: isDark
      ? "bg-white/5 border-white/10 text-muted-foreground group-hover:bg-white/10"
      : "bg-muted border-muted text-muted-foreground group-hover:bg-muted",

    // Property name
    propertyName: "text-foreground",
    propertyNameEmpty: "text-muted-foreground italic",

    // Status text
    statusValid: "text-[var(--color-success)] font-medium",
    statusInvalid: "text-[var(--color-error)]",
    statusMeta: "text-muted-foreground",
    statusDot: "bg-muted-foreground",

    // Remove button
    removeButton:
      "text-muted-foreground hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors",

    // Chevron
    chevron: "text-muted-foreground",

    // Accordion content
    accordionContent: isDark
      ? "border-t border-white/10 bg-white/5 p-6 md:p-8"
      : "border-t border-border bg-muted/30 p-6 md:p-8",

    // Empty state
    emptyState: isDark
      ? "text-center py-16 border-2 border-dashed border-white/10 rounded-xl bg-white/5"
      : "text-center py-16 border-2 border-dashed border-border rounded-xl bg-muted/50",

    emptyStateIcon: "text-muted-foreground",
    emptyStateTitle: "text-lg font-medium text-foreground",
    emptyStateDescription: "text-muted-foreground mb-6 max-w-sm mx-auto",
    emptyStateButton: isDark
      ? "bg-[var(--color-success)] text-primary-foreground hover:opacity-90"
      : "bg-primary text-primary-foreground hover:opacity-90",

    // Footer
    footer: isDark
      ? "sticky bottom-0 z-10 bg-zinc-900/80 backdrop-blur-md border-t border-white/10 p-4 -mx-4 md:mx-0 md:rounded-xl md:border md:shadow-lg flex items-center justify-between mt-8"
      : "sticky bottom-0 z-10 bg-white/80 backdrop-blur-md border-t border-zinc-200 p-4 -mx-4 md:mx-0 md:rounded-xl md:border md:shadow-lg flex items-center justify-between mt-8",

    footerMeta: "text-sm text-zinc-500",

    // Footer buttons
    skipButton: isDark
      ? "text-zinc-400 hover:text-white hover:bg-white/5"
      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100",

    submitButtonValid: isDark
      ? "bg-gradient-to-r from-[var(--color-success)] to-[var(--color-success)] hover:opacity-90 text-white shadow-lg shadow-[var(--color-success)]/20"
      : "bg-[var(--color-success)] hover:opacity-90 text-white shadow-md",

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
            // role="alert" is an implicit aria-live="assertive" region.
            // Validation errors on submit warrant assertive — the user needs
            // to know immediately that they cannot proceed.
            role="alert"
            className={theme.errorBanner}
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
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
              {/* Card Header (Accordion trigger - native button for a11y) */}
              <button
                type="button"
                onClick={() => handleToggleProperty(property.id)}
                className={cn(theme.cardHeader, "w-full text-left")}
                aria-expanded={property.isExpanded}
                aria-controls={`property-content-${property.id}`}
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
                    // aria-label required: icon-only buttons are announced as
                    // unlabelled by screen readers without it.
                    aria-label={`Remove ${property.data.title || `Property Listing ${index + 1}`}`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
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
              </button>

              {/* Accordion Content */}
              <AnimatePresence>
                {property.isExpanded && (
                  <motion.div
                    id={`property-content-${property.id}`}
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
              "min-w-35 transition-all",
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
