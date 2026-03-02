"use client";

import React, { useState, useMemo, memo, useCallback } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";
import {
  Store,
  MapPin,
  ImagePlus,
  X,
  Loader2,
  AlertCircle,
  Hammer,
  ChevronsUpDown,
  Check,
  Upload,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/text-area";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { isLocalUpload } from "@/lib/services/upload";
import { useImageUploader } from "@/hooks/useImageUploader";
import Image from "next/image";
import {
  DELIVERY_OPTIONS,
  STORE_CATEGORIES,
  STORE_CATEGORY_LABELS,
  STORE_TYPE_LABELS,
  COUNTIES,
  COUNTY_LABELS,
  type County,
  type StoreType,
  type StoreCategory,
} from "@build/enums";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/** Theme variant for the form */
export type StoreFormVariant = "light" | "dark";

/**
 * Theme constants for consistent styling across the form.
 * Supports both light and dark variants.
 */
const createTheme = (variant: StoreFormVariant) => {
  const isDark = variant === "dark";

  return {
    // Container styles
    container: isDark ? "space-y-6" : "space-y-6",

    // Section card
    section: isDark
      ? "bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-6 shadow-lg"
      : "bg-white rounded-xl border border-zinc-100 p-6 shadow-sm",

    sectionHeader: isDark
      ? "flex items-start gap-3 mb-6 border-b border-white/10 pb-4"
      : "flex items-start gap-3 mb-6 border-b border-zinc-100 pb-4",

    sectionIcon: isDark
      ? "p-2 bg-emerald-500/20 text-emerald-400 rounded-lg"
      : "p-2 bg-emerald-50 text-emerald-600 rounded-lg",

    sectionTitle: isDark
      ? "text-base font-semibold text-white"
      : "text-base font-semibold text-zinc-900",

    sectionDescription: isDark
      ? "text-sm text-zinc-400"
      : "text-sm text-zinc-500",

    // Labels
    label: isDark
      ? "text-emerald-400 text-xs uppercase tracking-widest font-semibold mb-2 block"
      : "text-sm font-medium text-zinc-700 flex items-center gap-1",

    labelRequired: isDark
      ? "text-amber-400 ml-1"
      : "text-emerald-500 text-xs ml-0.5",

    labelOptional: isDark
      ? "text-zinc-500 text-xs ml-1 font-normal normal-case tracking-normal"
      : "text-zinc-400 text-xs ml-1 font-normal",

    // Inputs
    input: isDark
      ? "w-full bg-white/5 p-3 text-white placeholder:text-zinc-500 focus:outline-none transition-colors rounded-md border border-white/20 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 h-11"
      : "h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white transition-all",

    inputIcon: isDark ? "text-zinc-500" : "text-zinc-400",

    textarea: isDark
      ? "w-full bg-white/5 p-3 text-white placeholder:text-zinc-500 focus:outline-none transition-colors rounded-md border border-white/20 focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 resize-none min-h-[100px]"
      : "bg-zinc-50/50 border-zinc-200 focus:bg-white resize-none min-h-[100px]",

    // Dropdowns / Combobox
    combobox: isDark
      ? "w-full h-11 bg-white/5 border-white/20 text-white hover:bg-white/10 focus:border-emerald-400"
      : "h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white",

    // Drop zone
    dropZone:
      "border-2 border-dashed rounded-xl transition-colors cursor-pointer",
    dropZoneDefault: isDark
      ? "border-zinc-600 hover:border-zinc-500 bg-white/5"
      : "border-zinc-300 hover:border-zinc-400 bg-zinc-50/30",
    dropZoneActive: isDark
      ? "border-emerald-500 bg-emerald-500/10"
      : "border-emerald-500 bg-emerald-50",

    // Empty state
    emptyState: isDark
      ? "border-2 border-dashed border-zinc-700 rounded-xl p-8 text-center bg-white/5"
      : "border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center bg-zinc-50/30",

    emptyStateText: isDark ? "text-sm text-zinc-500" : "text-sm text-zinc-500",

    // Icon container
    iconContainer: isDark
      ? "w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-zinc-400"
      : "w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400",

    // Buttons
    primaryButton: isDark
      ? "min-w-[150px] font-bold py-3 px-6 rounded-lg text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 transition-all duration-200 shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 h-11"
      : "min-w-[150px] bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-base shadow-md shadow-emerald-200",

    secondaryButton: isDark
      ? "py-2.5 px-4 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 border border-white/20 transition-colors"
      : "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200",

    // Error styling
    error: isDark
      ? "text-xs text-red-400 mt-1 flex items-center gap-1.5"
      : "text-xs text-red-500 flex items-center gap-1.5 animate-in slide-in-from-top-1",

    errorBanner: isDark
      ? "bg-red-500/10 border border-red-500/30 rounded-xl p-4"
      : "bg-red-50 border border-red-200 rounded-xl p-4",

    errorBannerText: isDark ? "text-sm text-red-400" : "text-sm text-red-800",

    errorBannerTitle: isDark
      ? "text-sm font-semibold text-red-400 mb-3"
      : "text-sm font-semibold text-red-900 mb-3",

    // Category chips
    chip: isDark
      ? "inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-full text-sm border border-emerald-500/30"
      : "inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm border border-emerald-200",

    chipRemove: isDark
      ? "ml-1 hover:text-emerald-300"
      : "ml-1 hover:text-emerald-900",

    // Image gallery
    imageCard: isDark
      ? "relative group aspect-square rounded-lg overflow-hidden border border-white/10 bg-white/5 shadow-sm"
      : "relative group aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm",

    // Text colors
    text: isDark ? "text-white" : "text-zinc-900",
    textMuted: isDark ? "text-zinc-400" : "text-zinc-500",
    textSubtle: isDark ? "text-zinc-500" : "text-zinc-400",
  } as const;
};

/** Maximum number of images allowed */
const MAX_IMAGES = 10;

/** Maximum number of categories allowed */
const MAX_CATEGORIES = 10;

/** Threshold for lazy loading images */
const LAZY_LOAD_THRESHOLD = 4;

// Convert STORE_CATEGORY_OPTIONS to array format for dropdown
const STORE_CATEGORY_OPTIONS_ARRAY = STORE_CATEGORIES.map((value) => ({
  value,
  label: STORE_CATEGORY_LABELS[value as keyof typeof STORE_CATEGORY_LABELS],
}));

// Store Type options - using types from store.ts
const STORE_TYPES: Array<{ value: StoreType; label: string }> = [
  { value: "RETAIL", label: `Retail - ${STORE_TYPE_LABELS.RETAIL}` },
  { value: "WHOLESALE", label: `Wholesale - ${STORE_TYPE_LABELS.WHOLESALE}` },
  {
    value: "MANUFACTURER",
    label: `Manufacturer - ${STORE_TYPE_LABELS.MANUFACTURER}`,
  },
  {
    value: "DISTRIBUTOR",
    label: `Distributor - ${STORE_TYPE_LABELS.DISTRIBUTOR}`,
  },
  {
    value: "ONLINE_ONLY",
    label: `Online Only - ${STORE_TYPE_LABELS.ONLINE_ONLY}`,
  },
];

// County options - using types from store.ts
const COUNTY_OPTIONS: Array<{ value: County; label: string }> = Object.entries(
  COUNTY_LABELS,
).map(([value, label]) => ({
  value: value as County,
  label,
}));

// Kenyan postal code regex pattern (typically 5 digits)
const KENYAN_POSTAL_CODE_REGEX = /^\d{5}$/;

const storeSchema = z.object({
  role: z.literal("professional"),
  slug: z
    .string()
    .min(1, "Store slug is required")
    .max(100)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1, "Store name is required").max(100),
  description: z.string().max(1000).optional(),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  county: z.enum(COUNTIES),
  zipCode: z
    .string()
    .optional()
    .refine((val) => !val || KENYAN_POSTAL_CODE_REGEX.test(val), {
      message: "Postal code must be 5 digits (e.g., 00100)",
    }),
  categories: z
    .array(z.enum(STORE_CATEGORY_LABELS))
    .min(1, "Select at least one category")
    .max(MAX_CATEGORIES, `Maximum ${MAX_CATEGORIES} categories allowed`),
  storeType: z.enum(STORE_TYPE_LABELS),
  deliveryOption: z.enum(DELIVERY_OPTIONS),
  images: z
    .array(
      z.object({
        value: z
          .string()
          .min(1, "Image URL is required")
          .url("Image URL must be a valid URL")
          .refine((url) => url.startsWith("https://") || url.startsWith("/"), {
            message: "Image URL must be HTTPS or a local path",
          }),
      }),
    )
    .max(MAX_IMAGES, `Maximum ${MAX_IMAGES} images allowed`)
    .optional(),
  documents: z.array(z.any()).optional(),
  acceptsCard: z.boolean().optional(),
  acceptsCash: z.boolean().optional(),
  contactPhone: z.string().optional(),

  email: z.string().email().optional(),
  website: z.string().url().optional(),
  whatsappNumber: z.string().optional(),
  neighbourhood: z.string().optional(),
  // Business verification
  businessRegNo: z.string().optional(),
  kraPin: z.string().optional(),

  logoUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),

  deliveryRadiusKm: z.number().int().positive().optional(),
  baseDeliveryFee: z.number().min(0).optional(),
  minOrderValue: z.number().min(0).optional(),
});

export type StoreFormData = z.infer<typeof storeSchema>;

// Transformed data type for submission (images as string array)
export type StoreFormSubmitData = Omit<StoreFormData, "images"> & {
  images?: string[];
};

interface StoreFormProps {
  /** Form submission handler - receives transformed data with images as string array */
  onSubmit: (data: StoreFormSubmitData) => Promise<void>;
  /** Default form values for editing or pre-filling */
  defaultValues?: Partial<StoreFormSubmitData>;
  /** Whether the form is in edit mode */
  isEditing?: boolean;
  /** Hide the submit button (useful for controlled forms) */
  hideSubmitButton?: boolean;
  /** Callback fired when form values change (debounced by 300ms) */
  onChange?: (data: Partial<StoreFormSubmitData>) => void;
  /** Callback fired when form validity changes - useful for parent form integration */
  onValidityChange?: (isValid: boolean) => void;
  /** External error message to display at the top of the form */
  externalError?: string;
  /** Theme variant - 'light' for standalone pages, 'dark' for wizard/onboarding */
  variant?: StoreFormVariant;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

interface ThemedFormSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  theme: ReturnType<typeof createTheme>;
}

const FormSection: React.FC<ThemedFormSectionProps> = ({
  title,
  description,
  icon,
  children,
  className,
  theme,
}) => (
  <div className={cn(theme.section, className)}>
    <div className={theme.sectionHeader}>
      {icon && <div className={theme.sectionIcon}>{icon}</div>}
      <div>
        <h3 className={theme.sectionTitle}>{title}</h3>
        {description && (
          <p className={theme.sectionDescription}>{description}</p>
        )}
      </div>
    </div>
    <div className="space-y-5">{children}</div>
  </div>
);

interface ThemedFormFieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  description?: string;
  className?: string;
  theme: ReturnType<typeof createTheme>;
}

const FormField: React.FC<ThemedFormFieldProps> = ({
  label,
  children,
  required,
  optional,
  error,
  description,
  className,
  theme,
}) => (
  <div className={cn("space-y-1.5", className)}>
    <div className="space-y-1">
      <Label className={theme.label}>
        {label}
        {required && <span className={theme.labelRequired}>*</span>}
        {optional && !required && (
          <span className={theme.labelOptional}>(optional)</span>
        )}
      </Label>
      {description && (
        <p className={cn("text-xs", theme.textMuted)}>{description}</p>
      )}
    </div>
    {children}
    {error && (
      <p className={theme.error}>
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
);

/** Props for CategoryMultiSelect component */
interface CategoryMultiSelectProps {
  value: StoreCategory[];
  onChange: (categories: StoreCategory[]) => void;
  maxCategories?: number;
  theme: ReturnType<typeof createTheme>;
}

/**
 * Memoized multi-select category dropdown component.
 * Allows selecting multiple store categories with search and chips display.
 */
const CategoryMultiSelect = memo<CategoryMultiSelectProps>(
  function CategoryMultiSelect({
    value,
    onChange,
    maxCategories = MAX_CATEGORIES,
    theme,
  }) {
    const [open, setOpen] = useState(false);
    const selectedValues = useMemo(() => value || [], [value]);

    const toggleCategory = useCallback(
      (categoryValue: StoreCategory) => {
        const isSelected = selectedValues.includes(categoryValue);
        if (isSelected) {
          onChange(selectedValues.filter((c) => c !== categoryValue));
        } else if (selectedValues.length < maxCategories) {
          onChange([...selectedValues, categoryValue]);
        } else {
          toast.error(`Maximum ${maxCategories} categories allowed`);
        }
      },
      [selectedValues, onChange, maxCategories],
    );

    return (
      <>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn("w-full justify-between", theme.combobox)}
            >
              <span
                className={
                  selectedValues.length > 0 ? theme.text : theme.textMuted
                }
              >
                {selectedValues.length > 0
                  ? `${selectedValues.length} categor${selectedValues.length === 1 ? "y" : "ies"} selected`
                  : "Select categories..."}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Search categories..." />
              <CommandList>
                <CommandEmpty>No category found.</CommandEmpty>
                <CommandGroup>
                  {STORE_CATEGORY_OPTIONS_ARRAY.map((option) => {
                    const isSelected = selectedValues.includes(option.value);
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.label}
                        onSelect={() => toggleCategory(option.value)}
                        className="cursor-pointer"
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Display selected categories as chips */}
        {selectedValues.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedValues.map((cat) => (
              <div key={cat} className={theme.chip}>
                <span>{STORE_CATEGORY_LABELS[cat]}</span>
                <button
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={theme.chipRemove}
                  aria-label={`Remove ${STORE_CATEGORY_LABELS[cat]}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </>
    );
  },
);

/**
 * ImageGallery component for displaying and managing store images.
 * Supports drag-and-drop upload, URL input, and image removal.
 */
interface ImageGalleryProps {
  images: Array<{ id: string; value: string }>;
  uploadingImages: Set<number>;
  onRemove: (index: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (files: FileList | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isDragging: boolean;
  newImageUrl: string;
  onImageUrlChange: (url: string) => void;
  onAddImage: () => void;
  error?: string;
  theme: ReturnType<typeof createTheme>;
}

const ImageGallery = memo<ImageGalleryProps>(function ImageGallery({
  images,
  uploadingImages,
  onRemove,
  onDragOver,
  onDragLeave,
  onDrop,
  onFileSelect,
  fileInputRef,
  isDragging,
  newImageUrl,
  onImageUrlChange,
  onAddImage,
  error,
  theme,
}) {
  return (
    <div className="space-y-4">
      {/* Drag and Drop Zone */}
      <div
        className={cn(
          theme.dropZone,
          "p-6 mb-4",
          isDragging ? theme.dropZoneActive : theme.dropZoneDefault,
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload images by clicking or dragging files here"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFileSelect(e.target.files)}
        />
        <div className="flex flex-col items-center justify-center text-center">
          <div className={cn(theme.iconContainer, "mb-3")}>
            {isDragging ? (
              <Upload className="h-6 w-6 text-emerald-500" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </div>
          <p className={cn("text-sm font-medium mb-1", theme.text)}>
            {isDragging
              ? "Drop images here"
              : "Drag and drop images here, or click to browse"}
          </p>
          <p className={cn("text-xs", theme.textMuted)}>
            Supports JPG, PNG, WebP (max 10MB per file, max {MAX_IMAGES} images)
          </p>
        </div>
      </div>

      {/* URL Input */}
      <div className="flex gap-2 mb-4">
        <Input
          value={newImageUrl}
          onChange={(e) => onImageUrlChange(e.target.value)}
          placeholder="Or paste image URL (must start with https://...)"
          className={cn("flex-1", theme.input)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), onAddImage())
          }
        />
        <Button
          type="button"
          onClick={onAddImage}
          variant="secondary"
          className={theme.secondaryButton}
        >
          Add URL
        </Button>
      </div>

      {error && (
        <div className={theme.error}>
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <div className={theme.emptyState}>
          <div className={cn(theme.iconContainer, "mx-auto mb-3")}>
            <ImagePlus className="h-6 w-6" />
          </div>
          <p className={theme.emptyStateText}>No images added yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {images.map((field, index) => {
            const url = field.value;
            const isUploading = uploadingImages.has(index) || !url;
            const shouldLazyLoad = index >= LAZY_LOAD_THRESHOLD;

            return (
              <div key={field.id} className={theme.imageCard}>
                {isUploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-800/50">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                  </div>
                ) : (
                  <>
                    <Image
                      src={url}
                      alt={`Store image ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized={!isLocalUpload(url)}
                      priority={index === 0}
                      loading={shouldLazyLoad ? "lazy" : undefined}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8 rounded-full"
                        onClick={() => onRemove(index)}
                        aria-label={`Remove image ${index + 1}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function StoreForm({
  onSubmit,
  defaultValues,
  isEditing = false,
  hideSubmitButton = false,
  onChange,
  onValidityChange,
  externalError,
  variant = "light",
}: StoreFormProps) {
  // Create theme based on variant
  const theme = useMemo(() => createTheme(variant), [variant]);
  // Use the image uploader hook for file management
  const {
    uploadingImages,
    isDragging,
    newImageUrl,
    fileInputRef,
    setNewImageUrl,
    handleFileSelect: handleFileSelectBase,
    handleDragOver,
    handleDragLeave,
    handleDrop: handleDropBase,
    handleAddImage: handleAddImageBase,
    handleRemoveImage: handleRemoveImageBase,
  } = useImageUploader({ maxImages: MAX_IMAGES });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting, isValid },
    setValue,
    watch,
  } = useForm<StoreFormData>({
    mode: "onChange", // Enable validation on change for real-time validity tracking
    resolver: zodResolver(storeSchema),
    defaultValues: {
      name: "",
      description: "",
      address: "",
      city: "",
      county: undefined,
      zipCode: "",
      categories: [],
      storeType: "retail",
      ...defaultValues,
      // Convert string array to object array for useFieldArray (override after spread)
      images: defaultValues?.images?.map((url) => ({ value: url })) || [],
    },
  });

  // Use useFieldArray for images
  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
    update: updateImage,
  } = useFieldArray({
    control,
    name: "images",
  });

  // Explicit type cast for categories
  const selectedCategories = (watch("categories") as StoreCategory[]) ?? [];
  const formValues = watch();

  // Debounce form values to prevent expensive onChange calls on every keystroke
  const [debouncedFormValues] = useDebounce(formValues, 300);

  React.useEffect(() => {
    if (onChange) {
      // Transform images from object array to string array for onChange callback
      const transformedValues: Partial<StoreFormSubmitData> = {
        ...debouncedFormValues,
        images: debouncedFormValues.images?.map((img) => img.value),
      };
      onChange(transformedValues);
    }
  }, [debouncedFormValues, onChange]);

  // Notify parent of validity changes for controlled form integration
  React.useEffect(() => {
    onValidityChange?.(isValid);
  }, [isValid, onValidityChange]);

  // Memoized image fields for stable reference
  const stableImageFields = useMemo(
    () => imageFields.map((f) => ({ id: f.id, value: f.value })),
    [imageFields],
  );

  // Wrapper handlers that connect the hook to useFieldArray
  const handleFileSelect = (files: FileList | null) => {
    handleFileSelectBase(
      files,
      stableImageFields,
      appendImage,
      updateImage,
      removeImage,
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    handleDropBase(e, stableImageFields, appendImage, updateImage, removeImage);
  };

  const handleAddImage = () => {
    handleAddImageBase(stableImageFields, appendImage);
  };

  const handleRemoveImage = (index: number) => {
    handleRemoveImageBase(index, removeImage);
  };

  // Collect all form errors for summary
  const safeMessage = (msg: unknown): string => {
    if (typeof msg === "string") return msg;
    if (msg === null || msg === undefined) return "Unknown error";
    return msg?.toString?.() ?? String(msg ?? "Unknown error");
  };

  const FIELD_LABELS: Record<string, { label: string; section: string }> = {
    name: { label: "Store Name", section: "Basic Details" },
    description: { label: "Description", section: "Basic Details" },
    storeType: { label: "Business Type", section: "Basic Details" },
    categories: { label: "Categories", section: "Specialties" },
    address: { label: "Street Address", section: "Location" },
    city: { label: "City", section: "Location" },
    county: { label: "County", section: "Location" },
    zipCode: { label: "Postal Code", section: "Location" },
    images: { label: "Images", section: "Media" },
  };

  const getAllErrors = (): Array<{
    field: string;
    message: string;
    section: string;
  }> => {
    const errorList: Array<{
      field: string;
      message: string;
      section: string;
    }> = [];

    const arrayFields = ["images"];

    Object.entries(errors).forEach(([key, value]) => {
      if (arrayFields.includes(key)) return;
      if (value && typeof value === "object" && "message" in value) {
        const fieldInfo = FIELD_LABELS[key] || { label: key, section: "Other" };
        errorList.push({
          field: fieldInfo.label,
          message: safeMessage(value.message),
          section: fieldInfo.section,
        });
      }
    });

    // Images array errors
    if (errors.images) {
      if (
        typeof errors.images === "object" &&
        "message" in errors.images &&
        !Array.isArray(errors.images)
      ) {
        errorList.push({
          field: "Images",
          message: safeMessage(errors.images.message),
          section: "Media",
        });
      }
      if (Array.isArray(errors.images)) {
        errors.images.forEach((image, index) => {
          if (image && typeof image === "object") {
            const valueError = (image as Record<string, unknown>)?.value;
            if (
              valueError &&
              typeof valueError === "object" &&
              valueError !== null &&
              "message" in valueError
            ) {
              errorList.push({
                field: `Image ${index + 1}`,
                message: safeMessage(
                  (valueError as { message: unknown }).message,
                ),
                section: "Media",
              });
            } else if ("message" in image) {
              errorList.push({
                field: `Image ${index + 1}`,
                message: safeMessage((image as { message: unknown }).message),
                section: "Media",
              });
            }
          }
        });
      }
    }

    return errorList;
  };

  const onFormSubmit = async (data: StoreFormData): Promise<void> => {
    const loadingToast = toast.loading(
      isEditing ? "Saving changes..." : "Creating store...",
    );
    try {
      // Transform images from object array to string array for submission
      const submitData: StoreFormSubmitData = {
        ...data,
        images: data.images?.map((img) => img.value),
      };

      await Promise.resolve(onSubmit(submitData));

      toast.dismiss(loadingToast);
      toast.success("Store saved successfully!");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "An error occurred");
      throw error;
    }
  };

  const allErrors = getAllErrors();
  const hasErrors = allErrors.length > 0;

  // Group errors by section
  const errorsBySection = allErrors.reduce<
    Record<string, Array<{ field: string; message: string; section: string }>>
  >((acc, err) => {
    if (!acc[err.section]) {
      acc[err.section] = [];
    }
    acc[err.section]!.push(err);
    return acc;
  }, {});

  const sectionOrder = [
    "Basic Details",
    "Specialties",
    "Location",
    "Media",
    "Other",
  ];

  const sortedSections = Object.keys(errorsBySection).sort(
    (a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b),
  );

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className={theme.container}>
      {/* External Error (from parent form) */}
      {externalError && (
        <div className={theme.errorBanner}>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <p className={theme.errorBannerText}>{externalError}</p>
          </div>
        </div>
      )}

      {/* Validation Error Summary */}
      {hasErrors && (
        <div className={theme.errorBanner}>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className={theme.errorBannerTitle}>
                Please fix the following errors ({allErrors.length}):
              </h3>
              <div className="space-y-3">
                {sortedSections.map((section) => (
                  <div key={section}>
                    <h4 className="text-xs font-semibold text-red-500 uppercase tracking-wide mb-1">
                      {section}
                    </h4>
                    <ul className="space-y-0.5 text-sm">
                      {errorsBySection[section]?.map((err, idx) => (
                        <li
                          key={idx}
                          className={cn(
                            "flex items-start gap-2",
                            theme.errorBannerText,
                          )}
                        >
                          <span className="text-red-500 mt-0.5">•</span>
                          <span>
                            <span className="font-medium">{err.field}:</span>{" "}
                            {err.message}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1. Basic Details */}
      <FormSection
        title="Basic Details"
        description="Core information about your business"
        icon={<Store className="h-5 w-5" />}
        theme={theme}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            label="Store Name"
            required
            error={errors.name?.message}
            className="md:col-span-2"
            theme={theme}
          >
            <Input
              {...register("name")}
              placeholder="e.g. Nairobi Builders Warehouse"
              className={theme.input}
            />
          </FormField>

          <FormField
            label="Business Type"
            required
            error={errors.storeType?.message}
            theme={theme}
          >
            <Controller
              name="storeType"
              control={control}
              render={({ field }) => (
                <Combobox
                  options={STORE_TYPES}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select type"
                  className={theme.combobox}
                />
              )}
            />
          </FormField>

          <FormField
            label="Description"
            optional
            error={errors.description?.message}
            className="md:col-span-2"
            theme={theme}
          >
            <Textarea
              {...register("description")}
              placeholder="Briefly describe what you sell..."
              className={theme.textarea}
            />
          </FormField>
        </div>
      </FormSection>

      {/* 2. Categories (Multi-Select Dropdown) */}
      <FormSection
        title="Specialties"
        description={`Select all categories that apply to your inventory (max ${MAX_CATEGORIES})`}
        icon={<Hammer className="h-5 w-5" />}
        theme={theme}
      >
        <FormField
          label="Store Categories"
          required
          error={errors.categories?.message}
          theme={theme}
        >
          <CategoryMultiSelect
            value={selectedCategories}
            onChange={(categories) =>
              setValue("categories", categories, { shouldValidate: true })
            }
            maxCategories={MAX_CATEGORIES}
            theme={theme}
          />
        </FormField>
      </FormSection>

      {/* 3. Location */}
      <FormSection
        title="Location"
        description="Where can customers find you?"
        icon={<MapPin className="h-5 w-5" />}
        theme={theme}
      >
        <div className="space-y-4">
          <FormField
            label="Street Address"
            required
            error={errors.address?.message}
            theme={theme}
          >
            <div className="relative">
              <MapPin
                className={cn("absolute left-3 top-3 h-5 w-5", theme.inputIcon)}
              />
              <Input
                {...register("address")}
                placeholder="e.g. Road C, Off Enterprise Road"
                className={cn("pl-10", theme.input)}
              />
            </div>
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="City"
              required
              error={errors.city?.message}
              theme={theme}
            >
              <Input
                {...register("city")}
                placeholder="City/Town"
                className={theme.input}
              />
            </FormField>

            <FormField
              label="County"
              required
              error={errors.county?.message}
              theme={theme}
            >
              <Controller
                name="county"
                control={control}
                render={({ field }) => (
                  <Combobox
                    options={COUNTY_OPTIONS}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    placeholder="Select County"
                    className={theme.combobox}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Postal Code"
              optional
              error={errors.zipCode?.message}
              theme={theme}
            >
              <Input
                {...register("zipCode")}
                placeholder="00100"
                className={theme.input}
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      {/* 4. Media */}
      <FormSection
        title="Store Images"
        description="Showcase your storefront and products"
        icon={<ImagePlus className="h-5 w-5" />}
        theme={theme}
      >
        <ImageGallery
          images={imageFields}
          uploadingImages={uploadingImages}
          onRemove={handleRemoveImage}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onFileSelect={handleFileSelect}
          fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
          isDragging={isDragging}
          newImageUrl={newImageUrl}
          onImageUrlChange={setNewImageUrl}
          onAddImage={handleAddImage}
          error={
            (
              errors.images as
                | { message?: string; root?: { message?: string } }
                | undefined
            )?.message ||
            (
              errors.images as
                | { message?: string; root?: { message?: string } }
                | undefined
            )?.root?.message
          }
          theme={theme}
        />
      </FormSection>

      {/* Submit Button (Only if standalone) */}
      {!hideSubmitButton && (
        <div className="pt-4 flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className={theme.primaryButton}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEditing ? "Save Changes" : "Create Store"}
          </Button>
        </div>
      )}
    </form>
  );
}
