"use client";

import React, { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  Store as StoreIcon,
  ChevronDown,
  AlertCircle,
  Check,
  Building,
  Loader2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import StoreForm, { StoreFormSubmitData, StoreFormVariant } from "./StoreForm";

// Re-export types for usage
export type { StoreFormSubmitData } from "./StoreForm"; // Keep this
// export type { StoreData } from "./MultiStoreForm"; // REMOVE THIS LINE

// ============================================================================
// TYPES
// ============================================================================

// StoreData extends the submission type (images as string[])
export interface StoreData extends StoreFormSubmitData {
  id?: string;
}

export interface MultiStoreFormProps {
  initialStores?: StoreData[];
  onSubmit: (stores: StoreData[]) => Promise<void> | void;
  onCancel?: () => void;
  maxStores?: number;
  isOnboarding?: boolean;
  startEmpty?: boolean;
  /** Theme variant - 'light' for standalone pages, 'dark' for wizard/onboarding */
  variant?: StoreFormVariant;
}

// ============================================================================
// THEME
// ============================================================================

const createMultiStoreTheme = (variant: StoreFormVariant) => {
  const isDark = variant === "dark";

  return {
    // Container
    container: isDark
      ? "max-w-4xl mx-auto space-y-8 pb-10"
      : "max-w-4xl mx-auto space-y-8 pb-10",

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

    // Store card
    storeCard: isDark
      ? "group rounded-xl border transition-all duration-300 overflow-hidden bg-white/5 backdrop-blur-sm"
      : "group rounded-xl border transition-all duration-300 overflow-hidden bg-white",

    storeCardExpanded: isDark
      ? "ring-1 ring-emerald-500/30 shadow-lg border-emerald-500/30"
      : "ring-1 ring-zinc-200 shadow-lg border-zinc-300",

    storeCardCollapsed: isDark
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

    // Store name
    storeName: isDark ? "text-white" : "text-zinc-900",
    storeNameEmpty: isDark ? "text-zinc-500 italic" : "text-zinc-400 italic",

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

interface StoreEntry {
  id: string;
  data: Partial<StoreData>;
  isExpanded: boolean;
  isValid: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MultiStoreForm({
  initialStores = [],
  onSubmit,
  onCancel,
  maxStores = 5,
  isOnboarding = false,
  startEmpty = false,
  variant = "light",
}: MultiStoreFormProps) {
  // Create theme based on variant
  const theme = useMemo(() => createMultiStoreTheme(variant), [variant]);
  // Validation Logic
  function validateStore(data: Partial<StoreData>): boolean {
    return !!(
      data.name?.trim() &&
      data.address?.trim() &&
      data.city?.trim() &&
      data.county &&
      data.categories &&
      data.categories.length > 0 &&
      data.storeType
    );
  }

  // State Initialization
  const [stores, setStores] = useState<StoreEntry[]>(() => {
    if (initialStores.length > 0) {
      return initialStores.map((data, index) => ({
        id: `store-${Date.now()}-${index}`,
        data,
        isExpanded: index === 0,
        isValid: validateStore(data),
      }));
    }
    if (startEmpty) return [];
    return [
      {
        id: `store-${Date.now()}-0`,
        data: {},
        isExpanded: true,
        isValid: false,
      },
    ];
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handlers
  const handleAddStore = useCallback(() => {
    if (stores.length >= maxStores) return;
    setStores((prev) => [
      ...prev.map((s) => ({ ...s, isExpanded: false })), // Collapse others
      {
        id: `store-${Date.now()}-${prev.length}`,
        data: {},
        isExpanded: true,
        isValid: false,
      },
    ]);
  }, [stores.length, maxStores]);

  const handleRemoveStore = useCallback((storeId: string) => {
    setStores((prev) => prev.filter((s) => s.id !== storeId));
  }, []);

  const handleToggleStore = useCallback((storeId: string) => {
    setStores((prev) =>
      prev.map((s) => ({
        ...s,
        isExpanded: s.id === storeId ? !s.isExpanded : false,
      })),
    );
  }, []);

  const handleStoreUpdate = useCallback(
    (storeId: string, data: Partial<StoreData>) => {
      setStores((prev) =>
        prev.map((s) =>
          s.id === storeId
            ? {
                ...s,
                data: { ...s.data, ...data },
                isValid: validateStore({ ...s.data, ...data }),
              }
            : s,
        ),
      );
    },
    [],
  );

  const handleSubmit = async () => {
    const invalidStores = stores.filter((s) => !s.isValid);
    if (invalidStores.length > 0) {
      setError(
        `Please complete all required fields for ${invalidStores.length} store(s).`,
      );
      // Expand the first invalid store
      setStores((prev) =>
        prev.map((s) => ({
          ...s,
          isExpanded: s.id === invalidStores[0]?.id,
        })),
      );
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(stores.map((s) => s.data as StoreData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save stores");
    } finally {
      setIsSubmitting(false);
    }
  };

  const allValid = stores.length > 0 && stores.every((s) => s.isValid);

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
            {isOnboarding ? "Setup Your Stores" : "Manage Locations"}
          </h2>
          <p className={theme.headerDescription}>
            Add detailed information for each of your branches to help customers
            find you easily.
          </p>
        </div>

        {stores.length < maxStores && (
          <Button onClick={handleAddStore} className={theme.addButton}>
            <Plus className={cn("h-4 w-4 mr-2", theme.addButtonIcon)} />
            Add Another Branch
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

      {/* Store List */}
      <div className="space-y-4">
        <AnimatePresence initial={false} mode="popLayout">
          {stores.map((store, index) => (
            <motion.div
              key={store.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                theme.storeCard,
                store.isExpanded
                  ? theme.storeCardExpanded
                  : theme.storeCardCollapsed,
              )}
            >
              {/* Card Header (Clickable) */}
              <div
                onClick={() => handleToggleStore(store.id)}
                className={theme.cardHeader}
              >
                <div className="flex items-center gap-4">
                  {/* Status Indicator Icon */}
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center border transition-colors",
                      store.isValid
                        ? theme.statusIndicatorValid
                        : theme.statusIndicatorInvalid,
                    )}
                  >
                    {store.isValid ? (
                      <Check className="h-6 w-6" />
                    ) : (
                      <Building className="h-6 w-6" />
                    )}
                  </div>

                  <div>
                    <h3
                      className={cn(
                        "font-semibold text-lg transition-colors",
                        !store.data.name
                          ? theme.storeNameEmpty
                          : theme.storeName,
                      )}
                    >
                      {store.data.name || `New Store Location ${index + 1}`}
                    </h3>
                    <div
                      className={cn(
                        "flex items-center gap-2 text-sm mt-0.5",
                        theme.statusMeta,
                      )}
                    >
                      {store.isValid ? (
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
                      {store.data.city && (
                        <>
                          <span
                            className={cn(
                              "w-1 h-1 rounded-full",
                              theme.statusDot,
                            )}
                          />
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {store.data.city}, {store.data.county}
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
                      handleRemoveStore(store.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div
                    className={cn(
                      "transition-transform duration-300",
                      theme.chevron,
                      store.isExpanded && "rotate-180",
                    )}
                  >
                    <ChevronDown className="h-5 w-5" />
                  </div>
                </div>
              </div>

              {/* Accordion Content */}
              <AnimatePresence>
                {store.isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                  >
                    <div className={theme.accordionContent}>
                      <StoreForm
                        defaultValues={store.data}
                        isEditing={!!store.data.id}
                        hideSubmitButton
                        onChange={(data) => handleStoreUpdate(store.id, data)}
                        onSubmit={async () => {}} // No-op, handled by parent
                        variant={variant}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {stores.length === 0 && (
          <div className={theme.emptyState}>
            <StoreIcon
              className={cn("mx-auto h-12 w-12 mb-4", theme.emptyStateIcon)}
            />
            <h3 className={theme.emptyStateTitle}>No stores added yet</h3>
            <p className={theme.emptyStateDescription}>
              Get started by adding your first store location to the Build
              Market platform.
            </p>
            <Button onClick={handleAddStore} className={theme.emptyStateButton}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Store
            </Button>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className={theme.footer}>
        <div className={cn("hidden sm:block", theme.footerMeta)}>
          {stores.filter((s) => s.isValid).length}/{stores.length} locations
          ready
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
