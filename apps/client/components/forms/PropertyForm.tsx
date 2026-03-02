"use client";

import React, { memo, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useForm,
  Controller,
  useFieldArray,
  Control,
  UseFormRegister,
  FieldErrors,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useDebounce } from "use-debounce";
import {
  Home,
  MapPin,
  ImagePlus,
  X,
  Loader2,
  AlertCircle,
  FileText,
  Plus,
  Upload,
  ExternalLink,
  File,
  FileImage,
  FileCheck,
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
// @build/enums — single source of truth for all Prisma-aligned enums
import {
  COUNTIES,
  COUNTY_LABELS,
  PROPERTY_TYPES as PROPERTY_TYPE_VALUES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORIES as PROPERTY_CATEGORY_VALUES,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_TENURES,
} from "@build/enums";
// Local sub-type (only the 3 document types exposed in this form)
import type {
  PropertyType,
  PropertyCategory,
  PropertyAttachmentType,
} from "@/types/property";
import { PROPERTY_ATTACHMENT_TYPE_LABELS as ATTACH_LABELS } from "@/types/property";
import type { County } from "@build/enums";

// ============================================================================
// CONSTANTS & TYPES
// ============================================================================

/**
 * Theme constants for consistent styling across the form.
 * Defines reusable class combinations for inputs, sections, and containers.
 */
const THEME = {
  /** Standard input styling */
  input:
    "h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white dark:bg-zinc-800/50 dark:border-zinc-700 dark:focus:bg-zinc-800",
  /** Input with icon prefix padding */
  inputWithPrefix: "pl-16",
  /** Section card container */
  section:
    "bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm",
  /** Form field container with light background */
  fieldContainer:
    "p-4 border border-zinc-200 rounded-lg bg-zinc-50/30 dark:border-zinc-700 dark:bg-zinc-800/30",
  /** Drag and drop zone base */
  dropZone:
    "border-2 border-dashed rounded-xl transition-colors cursor-pointer",
  /** Drag and drop zone default state */
  dropZoneDefault:
    "border-zinc-300 hover:border-zinc-400 bg-zinc-50/30 dark:border-zinc-600 dark:hover:border-zinc-500",
  /** Drag and drop zone active state */
  dropZoneActive: "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20",
  /** Empty state container */
  emptyState:
    "border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center bg-zinc-50/30 dark:border-zinc-700",
  /** Icon container */
  iconContainer:
    "w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-400 dark:bg-zinc-800",
  /** Secondary button styling */
  secondaryButton:
    "bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100",
} as const;

/** Maximum number of images allowed in the form */
const MAX_IMAGES = 20;

/** Maximum number of attachments allowed in the form */
const MAX_ATTACHMENTS = 5;

/** Threshold for enabling lazy loading on images */
const LAZY_LOAD_THRESHOLD = 4;

/**
 * Allowed domains for external URLs (for security).
 * Add trusted domains here. Empty array allows all HTTPS domains.
 * Example: ["cloudinary.com", "amazonaws.com", "storage.googleapis.com"]
 */
const ALLOWED_URL_DOMAINS: readonly string[] = [];

/**
 * Validates if a URL is from an allowed domain.
 * Returns true if ALLOWED_URL_DOMAINS is empty (all allowed) or domain matches.
 * Can be used for additional URL validation if domain restrictions are needed.
 * @param url - The URL to validate
 * @returns true if the URL is allowed
 */
export const isAllowedUrlDomain = (url: string): boolean => {
  if (!url) return false;
  if (ALLOWED_URL_DOMAINS.length === 0) return true; // All domains allowed when empty
  if (url.startsWith("/")) return true; // Local URLs always allowed

  try {
    const urlObj = new URL(url);
    return ALLOWED_URL_DOMAINS.some(
      (domain: string) =>
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
};

/**
 * Returns an appropriate icon component based on URL or file type.
 */
const getAttachmentIcon = (url: string, type: string): React.ReactNode => {
  if (!url) return <File className="h-4 w-4 text-zinc-400" />;

  // Check file extension from URL
  const ext = url.split(".").pop()?.toLowerCase();

  if (ext === "pdf" || type.includes("DEED") || type.includes("SEARCH")) {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
    return <FileImage className="h-4 w-4 text-blue-500" />;
  }
  if (type.includes("APPROVAL") || type.includes("CERTIFICATE")) {
    return <FileCheck className="h-4 w-4 text-green-500" />;
  }

  return <File className="h-4 w-4 text-zinc-500" />;
};

// Property Type options — derived from @build/enums (single source of truth)
const PROPERTY_TYPE_OPTIONS: Array<{ value: PropertyType; label: string }> =
  PROPERTY_TYPE_VALUES.map((v) => ({
    value: v as PropertyType,
    label: PROPERTY_TYPE_LABELS[v],
  }));

// Property Category options — derived from @build/enums
const PROPERTY_CATEGORY_OPTIONS: Array<{
  value: PropertyCategory;
  label: string;
}> = PROPERTY_CATEGORY_VALUES.map((v) => ({
  value: v as PropertyCategory,
  label: PROPERTY_CATEGORY_LABELS[v],
}));

// Property Attachment Type options (form subset — 3 document types only)
const ATTACHMENT_TYPES: Array<{
  value: PropertyAttachmentType;
  label: string;
}> = [
  { value: "TITLE_DEED", label: ATTACH_LABELS.TITLE_DEED },
  { value: "OFFICIAL_SEARCH", label: ATTACH_LABELS.OFFICIAL_SEARCH },
  { value: "MANDATE_LETTER", label: ATTACH_LABELS.MANDATE_LETTER },
];

// County options — derived from @build/enums COUNTY_LABELS record
const COUNTY_OPTIONS: Array<{ value: County; label: string }> = Object.entries(
  COUNTY_LABELS,
).map(([value, label]) => ({
  value: value as County,
  label,
}));

// Currency options (Kenyan Shilling is primary, but allow USD for international properties)
const CURRENCY_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "KES", label: "KES - Kenyan Shilling" },
  { value: "USD", label: "USD - US Dollar" },
  { value: "EUR", label: "EUR - Euro" },
  { value: "GBP", label: "GBP - British Pound" },
];

// Zod enums — derived from @build/enums as-const arrays (single source of truth)
const CountyEnum = z.enum(COUNTIES);
const PropertyTypeEnum = z.enum(PROPERTY_TYPE_VALUES);
const PropertyCategoryEnum = z.enum(PROPERTY_CATEGORY_VALUES);
// Attachment type is a narrower 3-element subset used only in this form
const PropertyAttachmentTypeEnum = z.enum([
  "TITLE_DEED",
  "OFFICIAL_SEARCH",
  "MANDATE_LETTER",
] as const);

// Property attachment schema
const PropertyAttachmentSchema = z.object({
  fileUrl: z
    .string()
    .min(1, "File URL is required")
    .url("File URL must be a valid URL")
    .refine((url) => url.startsWith("https://"), {
      message: "File URL must start with https://",
    }),
  type: PropertyAttachmentTypeEnum,
  notes: z
    .string()
    .max(500, "Notes must be less than 500 characters")
    .optional(),
});

const propertySchema = z
  .object({
    title: z.string().min(1, "Property title is required").max(200),
    description: z
      .string()
      .max(5000, "Description must be less than 5000 characters")
      .optional(),
    price: z
      .number()
      .min(1, "Price must be at least 1")
      .positive("Price must be a positive number"),
    currency: z
      .string()
      .min(1, "Currency is required")
      .max(3, "Currency code must be 3 characters or less"),
    type: PropertyTypeEnum,
    tenure: z.enum(PROPERTY_TENURES),
    category: PropertyCategoryEnum,
    county: CountyEnum,
    location: z.string().min(1, "Location is required").max(100),
    constituency: z
      .string()
      .max(100, "Constituency must be less than 100 characters")
      .optional(),
    neighbourhood: z
      .string()
      .max(100, "Neighbourhood must be less than 100 characters")
      .optional(),
    address: z
      .string()
      .max(500, "Address must be less than 500 characters")
      .optional(),
    latitude: z
      .number()
      .min(-90, "Latitude must be between -90 and 90")
      .max(90, "Latitude must be between -90 and 90")
      .optional(),
    longitude: z
      .number()
      .min(-180, "Longitude must be between -180 and 180")
      .max(180, "Longitude must be between -180 and 180")
      .optional(),
    bedrooms: z
      .number()
      .int()
      .min(0, "Bedrooms cannot be negative")
      .max(50, "Bedrooms cannot exceed 50")
      .optional(),
    bathrooms: z
      .number()
      .int()
      .min(0, "Bathrooms cannot be negative")
      .max(50, "Bathrooms cannot exceed 50")
      .optional(),
    areaSqFt: z.number().positive("Area must be a positive number").optional(),
    areaUnit: z.enum(["SQ_FEET", "ACRES", "SQ_METERS"]).optional(),
    lotSize: z
      .number()
      .positive("Lot size must be a positive number")
      .optional(),
    lrNumber: z
      .string()
      .max(100, "LR Number must be less than 100 characters")
      .optional(),
    floorPlan: z
      .string()
      .url("Floor plan must be a valid URL")
      .refine((url) => !url || url.startsWith("https://"), {
        message: "Floor plan URL must start with https://",
      })
      .optional(),
    videoUrl: z
      .string()
      .url("Video URL must be a valid URL")
      .refine((url) => !url || url.startsWith("https://"), {
        message: "Video URL must start with https://",
      })
      .optional(),
    features: z
      .array(
        z
          .string()
          .min(1, "Feature cannot be empty")
          .max(100, "Feature must be less than 100 characters"),
      )
      .max(20, "Maximum 20 features allowed")
      .optional(),
    priceNegotiable: z.boolean().optional(),
    isGatedCommunity: z.boolean().optional(),
    hasBorehole: z.boolean().optional(),
    hasBackupGenerator: z.boolean().optional(),
    hasElevator: z.boolean().optional(),
    hasCCTV: z.boolean().optional(),
    images: z
      .array(
        z.object({
          value: z
            .string()
            .min(1, "Image URL is required")
            .url("Image URL must be a valid URL")
            .refine(
              (url) => url.startsWith("https://") || url.startsWith("/"),
              {
                message: "Image URL must be a valid HTTPS or local URL",
              },
            ),
        }),
      )
      .min(1, "At least one image is required")
      .max(20, "Maximum 20 images allowed")
      .optional(),
    attachments: z
      .array(PropertyAttachmentSchema)
      .max(5, "Maximum 5 attachments allowed")
      .optional(),
  })
  .refine(
    (data) =>
      (data.latitude && data.longitude) || (!data.latitude && !data.longitude),
    {
      message: "Provide both latitude and longitude or neither",
      path: ["latitude"],
    },
  );

export type PropertyFormData = z.infer<typeof propertySchema>;

// Transformed data type for submission (images as string array)
export type PropertyFormSubmitData = Omit<PropertyFormData, "images"> & {
  images?: string[];
};

interface PropertyFormProps {
  /** Form submission handler - always returns a Promise for consistency */
  onSubmit: (data: PropertyFormSubmitData) => Promise<void>;
  /** Default form values for editing or pre-filling (images as string array) */
  defaultValues?: Partial<PropertyFormSubmitData>;
  /** Whether the form is in edit mode */
  isEditing?: boolean;
  /** Hide the submit button (useful for controlled forms) */
  hideSubmitButton?: boolean;
  /** Callback fired when form values change (debounced by 300ms) */
  onChange?: (data: Partial<PropertyFormSubmitData>) => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const FormSection: React.FC<{
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, description, icon, children, className }) => (
  <div
    className={cn(
      "bg-white dark:bg-zinc-900/50 rounded-xl border border-zinc-100 dark:border-zinc-800 p-6 shadow-sm",
      className,
    )}
  >
    <div className="flex items-start gap-3 mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
      {icon && (
        <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-lg">
          {icon}
        </div>
      )}
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
      </div>
    </div>
    <div className="space-y-5">{children}</div>
  </div>
);

const FormField: React.FC<{
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  description?: string;
  className?: string;
}> = ({
  label,
  children,
  required,
  optional,
  error,
  description,
  className,
}) => (
  <div className={cn("space-y-1.5", className)}>
    <div className="space-y-1">
      <Label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
        {label}
        {required && <span className="text-emerald-500 text-xs ml-0.5">*</span>}
        {optional && !required && (
          <span className="text-zinc-400 text-xs ml-1 font-normal">
            (optional)
          </span>
        )}
      </Label>
      {description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      )}
    </div>
    {children}
    {error && (
      <p className="text-xs text-red-500 flex items-center gap-1.5 animate-in slide-in-from-top-1">
        <AlertCircle className="h-3 w-3" />
        {error}
      </p>
    )}
  </div>
);

// Features multi-input component - Memoized to prevent unnecessary re-renders
const FeaturesInput = memo<{
  value: string[];
  onChange: (features: string[]) => void;
}>(({ value, onChange }) => {
  const [newFeature, setNewFeature] = useState("");

  const handleAddFeature = useCallback(() => {
    if (newFeature.trim() && !value.includes(newFeature.trim())) {
      onChange([...value, newFeature.trim()]);
      setNewFeature("");
    }
  }, [newFeature, value, onChange]);

  const handleRemoveFeature = useCallback(
    (feature: string) => {
      onChange(value.filter((f) => f !== feature));
    },
    [value, onChange],
  );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={newFeature}
          onChange={(e) => setNewFeature(e.target.value)}
          placeholder="e.g. Swimming Pool, Gym, Borehole"
          className="flex-1 bg-zinc-50/50 border-zinc-200 focus:bg-white h-11"
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), handleAddFeature())
          }
        />
        <Button
          type="button"
          onClick={handleAddFeature}
          variant="secondary"
          className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border border-zinc-200"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((feature) => (
            <div
              key={feature}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-sm border border-emerald-200"
            >
              <span>{feature}</span>
              <button
                type="button"
                onClick={() => handleRemoveFeature(feature)}
                className="ml-1 hover:text-emerald-900"
                aria-label={`Remove ${feature}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

FeaturesInput.displayName = "FeaturesInput";

/**
 * ImageGallery component for displaying and managing property images.
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
}

/**
 * Memoized ImageGallery component for displaying and managing property images.
 * Supports drag-and-drop upload, URL input, and lazy loading for performance.
 *
 * @future To add drag-to-reorder functionality:
 * 1. Install: npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
 * 2. Wrap grid in DndContext with SortableContext
 * 3. Make each image item a SortableItem with useSortable hook
 * 4. Handle onDragEnd to reorder via useFieldArray's `move` function
 * 5. For mobile touch support, add @dnd-kit/modifiers for touch handling
 */
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
}) {
  return (
    <div className="space-y-4">
      {/* Drag and Drop Zone */}
      <div
        className={cn(
          THEME.dropZone,
          "p-6 mb-4",
          isDragging ? THEME.dropZoneActive : THEME.dropZoneDefault,
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
          <div className={cn(THEME.iconContainer, "mb-3")}>
            {isDragging ? (
              <Upload className="h-6 w-6 text-emerald-600" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </div>
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
            {isDragging
              ? "Drop images here"
              : "Drag and drop images here, or click to browse"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
          className={cn("flex-1", THEME.input)}
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), onAddImage())
          }
        />
        <Button
          type="button"
          onClick={onAddImage}
          variant="secondary"
          className={THEME.secondaryButton}
        >
          Add URL
        </Button>
      </div>

      {error && (
        <div className="text-xs text-red-500 flex items-center gap-1.5 mb-2">
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <div className={THEME.emptyState}>
          <div className={cn(THEME.iconContainer, "mx-auto mb-3")}>
            <ImagePlus className="h-6 w-6" />
          </div>
          <p className="text-sm text-zinc-500">No images added yet.</p>
          <p className="text-xs text-zinc-400 mt-1">
            At least one image is required
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {images.map((field, index) => {
            const url = field.value;
            const isUploading = uploadingImages.has(index) || !url;
            // Lazy load images after the threshold for better performance
            const shouldLazyLoad = index >= LAZY_LOAD_THRESHOLD;
            return (
              <div
                key={field.id}
                className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {isUploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-200 dark:bg-zinc-700">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
                  </div>
                ) : (
                  <>
                    <Image
                      src={url}
                      alt={`Property image ${index + 1}`}
                      fill
                      className="object-cover"
                      unoptimized={!isLocalUpload(url)}
                      priority={index === 0}
                      loading={shouldLazyLoad ? "lazy" : undefined}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
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

/**
 * AttachmentList component for managing property verification documents.
 * Supports multiple attachments with type selection, file URLs, and notes.
 */
interface AttachmentListProps {
  attachments: Array<{ id: string }>;
  errors: FieldErrors<PropertyFormData>;
  control: Control<PropertyFormData>;
  register: UseFormRegister<PropertyFormData>;
  onRemove: (index: number) => void;
  onAdd: () => void;
  attachmentTypes: Array<{ value: PropertyAttachmentType; label: string }>;
}

const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  errors,
  control,
  register,
  onRemove,
  onAdd,
  attachmentTypes,
}) => {
  const canAddMore = attachments.length < MAX_ATTACHMENTS;

  return (
    <div className="space-y-4">
      {attachments.length > 0 && (
        <p className="text-xs text-zinc-500">
          {attachments.length} of {MAX_ATTACHMENTS} documents added
        </p>
      )}

      {attachments.map((field, index) => (
        <Controller
          key={field.id}
          name={`attachments.${index}`}
          control={control}
          render={({ field: attachmentField }) => {
            const currentType = attachmentField.value?.type || "";
            const currentUrl = attachmentField.value?.fileUrl || "";

            return (
              <div className={cn(THEME.fieldContainer, "space-y-3")}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getAttachmentIcon(currentUrl, currentType)}
                    <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      Document {index + 1}
                    </h4>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => onRemove(index)}
                    aria-label={`Remove document ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField
                    label="Document Type"
                    required
                    error={errors.attachments?.[index]?.type?.message}
                  >
                    <Controller
                      name={`attachments.${index}.type`}
                      control={control}
                      render={({ field }) => (
                        <Combobox
                          options={attachmentTypes}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select document type"
                          className="h-11"
                        />
                      )}
                    />
                  </FormField>

                  <FormField
                    label="File URL"
                    required
                    error={errors.attachments?.[index]?.fileUrl?.message}
                    description="Must be an HTTPS URL"
                  >
                    <div className="relative">
                      <Input
                        {...register(`attachments.${index}.fileUrl`)}
                        placeholder="https://..."
                        className={cn(THEME.input, currentUrl && "pr-10")}
                      />
                      {currentUrl && currentUrl.startsWith("https://") && (
                        <a
                          href={currentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                          aria-label="Open document in new tab"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </FormField>
                </div>

                <FormField
                  label="Notes"
                  optional
                  error={errors.attachments?.[index]?.notes?.message}
                >
                  <Textarea
                    {...register(`attachments.${index}.notes`)}
                    placeholder="Additional notes about this document..."
                    className="bg-zinc-50/50 border-zinc-200 focus:bg-white dark:bg-zinc-800/50 dark:border-zinc-700 resize-none min-h-[80px]"
                  />
                </FormField>
              </div>
            );
          }}
        />
      ))}

      <Button
        type="button"
        onClick={onAdd}
        variant="outline"
        className="w-full border-dashed border-zinc-300 hover:border-zinc-400 dark:border-zinc-600"
        disabled={!canAddMore}
      >
        <Plus className="h-4 w-4 mr-2" />
        {canAddMore
          ? "Add Document"
          : `Maximum ${MAX_ATTACHMENTS} documents reached`}
      </Button>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PropertyForm({
  onSubmit,
  defaultValues,
  isEditing = false,
  hideSubmitButton = false,
  onChange,
}: PropertyFormProps) {
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
    formState: { errors, isSubmitting },
    watch,
    setValue,
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      title: "",
      description: "",
      price: 0,
      currency: "KES",
      type: "SALE",
      category: "RESIDENTIAL",
      county: undefined,
      location: "",
      constituency: "",
      neighbourhood: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      areaSqFt: undefined,
      lotSize: undefined,
      lrNumber: "",
      floorPlan: "",
      videoUrl: "",
      features: [],
      attachments: defaultValues?.attachments || [],
      ...defaultValues,
      // Convert string array to object array for useFieldArray (override after spread)
      images: defaultValues?.images?.map((url) => ({ value: url })) || [],
    },
  });

  // Use useFieldArray for both images and attachments
  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
    update: updateImage,
  } = useFieldArray({
    control,
    name: "images",
  });

  const {
    fields: attachmentFields,
    append: appendAttachment,
    remove: removeAttachment,
  } = useFieldArray({
    control,
    name: "attachments",
  });

  const formValues = watch();

  // Debounce form values to prevent expensive onChange calls on every keystroke
  const [debouncedFormValues] = useDebounce(formValues, 300);

  // Keep a stable ref to the latest onChange callback to prevent infinite useEffect loops
  // when parent components pass inline functions as onChange handlers
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    if (onChangeRef.current) {
      // Transform images from object array to string array for onChange callback
      const transformedValues: Partial<PropertyFormSubmitData> = {
        ...debouncedFormValues,
        images: debouncedFormValues.images?.map((img) => img.value),
      };
      onChangeRef.current(transformedValues);
    }
  }, [debouncedFormValues]);

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

  const handleAddAttachment = () => {
    appendAttachment({
      fileUrl: "",
      type: "TITLE_DEED" as PropertyAttachmentType,
      notes: "",
    });
  };

  // Collect all form errors for summary
  /**
   * Safely extracts a message string from an error object.
   * Handles undefined, null, and non-string values safely.
   */
  const safeMessage = (msg: unknown): string => {
    if (typeof msg === "string") return msg;
    if (msg === null || msg === undefined) return "Unknown error";
    return msg?.toString?.() ?? String(msg ?? "Unknown error");
  };

  /**
   * Field labels grouped by section for user-friendly error display.
   */
  const FIELD_LABELS: Record<string, { label: string; section: string }> = {
    // Basic Details
    title: { label: "Property Title", section: "Basic Details" },
    description: { label: "Description", section: "Basic Details" },
    type: { label: "Property Type", section: "Basic Details" },
    category: { label: "Category", section: "Basic Details" },
    // Pricing
    price: { label: "Price", section: "Pricing" },
    currency: { label: "Currency", section: "Pricing" },
    // Location
    county: { label: "County", section: "Location" },
    constituency: { label: "Constituency", section: "Location" },
    neighbourhood: { label: "Neighbourhood", section: "Location" },
    address: { label: "Address", section: "Location" },
    latitude: { label: "Latitude", section: "Location" },
    longitude: { label: "Longitude", section: "Location" },
    // Property Specs
    bedrooms: { label: "Bedrooms", section: "Property Specs" },
    bathrooms: { label: "Bathrooms", section: "Property Specs" },
    areaSqFt: { label: "Area (sq ft)", section: "Property Specs" },
    lotSize: { label: "Lot Size", section: "Property Specs" },
    yearBuilt: { label: "Year Built", section: "Property Specs" },
    // Legal
    lrNumber: { label: "LR Number", section: "Legal Information" },
    // Media
    images: { label: "Images", section: "Media" },
    videoUrl: { label: "Video URL", section: "Media" },
    floorPlan: { label: "Floor Plan", section: "Media" },
    // Features
    features: { label: "Features", section: "Features" },
    // Documents
    attachments: { label: "Attachments", section: "Documents" },
  };

  /**
   * Collects all form errors with friendly labels, grouped by section.
   * Handles top-level errors, array-level errors, and per-item array errors.
   */
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

    // Array field names to skip in top-level loop (handled separately)
    const arrayFields = ["attachments", "images", "features"];

    // Top-level errors (excluding arrays which are handled separately)
    Object.entries(errors).forEach(([key, value]) => {
      if (arrayFields.includes(key)) return; // Skip arrays
      if (value && typeof value === "object" && "message" in value) {
        const fieldInfo = FIELD_LABELS[key] || {
          label: key,
          section: "Other",
        };
        errorList.push({
          field: fieldInfo.label,
          message: safeMessage(value.message),
          section: fieldInfo.section,
        });
      }
    });

    // Attachments array errors
    if (errors.attachments) {
      // Array-level error (e.g., "At least one attachment required")
      if (
        typeof errors.attachments === "object" &&
        "message" in errors.attachments &&
        !Array.isArray(errors.attachments)
      ) {
        errorList.push({
          field: "Attachments",
          message: safeMessage(errors.attachments.message),
          section: "Documents",
        });
      }
      // Per-item errors
      if (Array.isArray(errors.attachments)) {
        errors.attachments.forEach((attachment, index) => {
          if (attachment && typeof attachment === "object") {
            Object.entries(attachment).forEach(([key, value]) => {
              if (value && typeof value === "object" && "message" in value) {
                const fieldLabel =
                  key === "fileUrl"
                    ? "File URL"
                    : key === "type"
                      ? "Type"
                      : key;
                errorList.push({
                  field: `Attachment ${index + 1} - ${fieldLabel}`,
                  message: safeMessage(value.message),
                  section: "Documents",
                });
              }
            });
          }
        });
      }
    }

    // Images array errors
    if (errors.images) {
      // Array-level error (e.g., "At least one image required")
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
      // Per-item errors
      if (Array.isArray(errors.images)) {
        errors.images.forEach((image, index) => {
          if (image && typeof image === "object") {
            // Check for nested value error (from object structure { value: string })
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
              // Direct message on the image item
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

    // Features array errors
    if (errors.features) {
      // Array-level error (e.g., "Max 20 features")
      if (
        typeof errors.features === "object" &&
        "message" in errors.features &&
        !Array.isArray(errors.features)
      ) {
        errorList.push({
          field: "Features",
          message: safeMessage(errors.features.message),
          section: "Features",
        });
      }
      // Per-item errors
      if (Array.isArray(errors.features)) {
        errors.features.forEach((feature, index) => {
          if (feature && typeof feature === "object" && "message" in feature) {
            errorList.push({
              field: `Feature ${index + 1}`,
              message: safeMessage((feature as { message: unknown }).message),
              section: "Features",
            });
          }
        });
      }
    }

    return errorList;
  };

  /**
   * Handles form submission with loading state and error handling.
   * Wraps the onSubmit prop to ensure it always returns a Promise.
   */
  /**
   * Handles form submission with loading state and error handling.
   * Transforms images from object array to string array before submission.
   * Wraps the onSubmit prop to ensure it always returns a Promise<void>.
   */
  const onFormSubmit = async (data: PropertyFormData): Promise<void> => {
    const loadingToast = toast.loading(
      isEditing ? "Saving changes..." : "Creating property...",
    );
    try {
      // Transform images from object array to string array for submission
      const submitData: PropertyFormSubmitData = {
        ...data,
        images: data.images?.map((img) => img.value),
      };

      // Ensure onSubmit returns a Promise and await it
      // This handles both sync and async onSubmit implementations
      await Promise.resolve(onSubmit(submitData));

      toast.dismiss(loadingToast);
      toast.success("Property saved successfully!");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "An error occurred");
      // Re-throw to allow parent error handling if needed
      throw error;
    }
  };

  const allErrors = getAllErrors();
  const hasErrors = allErrors.length > 0;

  // Group errors by section for better organization
  const errorsBySection = allErrors.reduce<
    Record<string, Array<{ field: string; message: string; section: string }>>
  >((acc, err) => {
    if (!acc[err.section]) {
      acc[err.section] = [];
    }
    acc[err.section]!.push(err);
    return acc;
  }, {});

  // Define section order for consistent display
  const sectionOrder = [
    "Basic Details",
    "Pricing",
    "Location",
    "Property Specs",
    "Legal Information",
    "Media",
    "Features",
    "Documents",
    "Other",
  ];

  // Sort sections by defined order
  const sortedSections = Object.keys(errorsBySection).sort(
    (a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b),
  );

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
      {/* Error Summary - Grouped by Section */}
      {hasErrors && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 dark:text-red-100 mb-3">
                Please fix the following errors ({allErrors.length}):
              </h3>
              <div className="space-y-3">
                {sortedSections.map((section) => (
                  <div key={section}>
                    <h4 className="text-xs font-semibold text-red-700 dark:text-red-300 uppercase tracking-wide mb-1">
                      {section}
                    </h4>
                    <ul className="space-y-0.5 text-sm text-red-800 dark:text-red-200">
                      {errorsBySection[section]?.map((err, idx) => (
                        <li key={idx} className="flex items-start gap-2">
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
        description="Core information about the property"
        icon={<Home className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            label="Property Title"
            required
            error={errors.title?.message}
            className="md:col-span-2"
          >
            <Input
              {...register("title")}
              placeholder="e.g. Modern 3-Bedroom Apartment in Kilimani"
              className="bg-zinc-50/50 border-zinc-200 focus:bg-white transition-all h-11"
            />
          </FormField>

          <FormField
            label="Property Type"
            required
            error={errors.type?.message}
          >
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Combobox
                  options={PROPERTY_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select type"
                  className="h-11"
                />
              )}
            />
          </FormField>

          <FormField label="Category" required error={errors.category?.message}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Combobox
                  options={PROPERTY_CATEGORY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select category"
                  className="h-11"
                />
              )}
            />
          </FormField>

          <FormField label="Price" required error={errors.price?.message}>
            <div className="relative">
              <span className="absolute left-3 top-3 text-zinc-500 text-sm font-medium">
                {watch("currency") || "KES"}
              </span>
              <Input
                {...register("price", { valueAsNumber: true })}
                type="number"
                placeholder="0.00"
                className="pl-16 h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
              />
            </div>
          </FormField>

          <FormField label="Currency" optional error={errors.currency?.message}>
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Combobox
                  options={CURRENCY_OPTIONS}
                  value={field.value || "KES"}
                  onChange={field.onChange}
                  placeholder="Select currency"
                  className="h-11"
                />
              )}
            />
          </FormField>

          <FormField
            label="Description"
            error={errors.description?.message}
            className="md:col-span-2"
          >
            <Textarea
              {...register("description")}
              placeholder="Describe the property, its features, and what makes it special..."
              className="bg-zinc-50/50 border-zinc-200 focus:bg-white resize-none min-h-[120px]"
            />
          </FormField>
        </div>
      </FormSection>

      {/* 2. Location */}
      <FormSection
        title="Location"
        description="Where is the property located?"
        icon={<MapPin className="h-5 w-5" />}
      >
        <div className="space-y-4">
          <FormField label="Location" required error={errors.location?.message}>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
              <Input
                {...register("location")}
                placeholder="e.g. Kilimani, Nairobi"
                className="pl-10 h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
              />
            </div>
          </FormField>

          <FormField
            label="Street Address"
            optional
            error={errors.address?.message}
          >
            <Input
              {...register("address")}
              placeholder="e.g. Road C, Off Enterprise Road"
              className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="City/Constituency"
              optional
              error={errors.constituency?.message}
            >
              <Input
                {...register("constituency")}
                placeholder="Constituency"
                className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
              />
            </FormField>

            <FormField
              label="Neighbourhood"
              optional
              error={errors.neighbourhood?.message}
            >
              <Input
                {...register("neighbourhood")}
                placeholder="Neighbourhood"
                className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
              />
            </FormField>

            <FormField label="County" required error={errors.county?.message}>
              <Controller
                name="county"
                control={control}
                render={({ field }) => (
                  <Combobox
                    options={COUNTY_OPTIONS}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Select County"
                    className="h-11"
                  />
                )}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Latitude"
              error={errors.latitude?.message}
              description="Optional: Provide both latitude and longitude together"
            >
              <Input
                {...register("latitude", { valueAsNumber: true })}
                type="number"
                step="any"
                placeholder="e.g. -1.2921"
                className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
              />
            </FormField>

            <FormField
              label="Longitude"
              error={errors.longitude?.message}
              description="Optional: Provide both latitude and longitude together"
            >
              <Input
                {...register("longitude", { valueAsNumber: true })}
                type="number"
                step="any"
                placeholder="e.g. 36.8219"
                className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      {/* 3. Property Specifications */}
      <FormSection
        title="Property Specifications"
        description="Details about the property"
        icon={<Home className="h-5 w-5" />}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <FormField label="Bedrooms" optional error={errors.bedrooms?.message}>
            <Input
              {...register("bedrooms", { valueAsNumber: true })}
              type="number"
              min="0"
              max="50"
              placeholder="0"
              className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
            />
          </FormField>

          <FormField
            label="Bathrooms"
            optional
            error={errors.bathrooms?.message}
          >
            <Input
              {...register("bathrooms", { valueAsNumber: true })}
              type="number"
              min="0"
              max="50"
              placeholder="0"
              className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
            />
          </FormField>

          <FormField
            label="Area (sq ft)"
            optional
            error={errors.areaSqFt?.message}
          >
            <Input
              {...register("areaSqFt", { valueAsNumber: true })}
              type="number"
              step="any"
              placeholder="0"
              className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
            />
          </FormField>

          <FormField
            label="Lot Size (sq ft)"
            optional
            error={errors.lotSize?.message}
          >
            <Input
              {...register("lotSize", { valueAsNumber: true })}
              type="number"
              step="any"
              placeholder="0"
              className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
            />
          </FormField>
        </div>

        <FormField
          label="Land Reference Number"
          optional
          error={errors.lrNumber?.message}
        >
          <Input
            {...register("lrNumber")}
            placeholder="e.g. LR 209/12345"
            className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
          />
        </FormField>

        <FormField
          label="Features"
          optional
          description="Add features like Swimming Pool, Gym, Borehole, etc. (Max 20 features, 100 characters each)"
          error={
            errors.features?.message ||
            (errors.features as { root?: { message?: string } } | undefined)
              ?.root?.message
          }
        >
          <Controller
            name="features"
            control={control}
            render={({ field }) => (
              <FeaturesInput
                value={field.value || []}
                onChange={(features) =>
                  setValue("features", features, { shouldValidate: true })
                }
              />
            )}
          />
        </FormField>
      </FormSection>

      {/* 4. Media */}
      <FormSection
        title="Property Images"
        description="Showcase your property with high-quality photos"
        icon={<ImagePlus className="h-5 w-5" />}
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
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <FormField
            label="Floor Plan URL"
            optional
            error={errors.floorPlan?.message}
            description="Must be an HTTPS URL"
          >
            <Input
              {...register("floorPlan")}
              placeholder="https://..."
              className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
            />
          </FormField>

          <FormField
            label="Video URL"
            optional
            error={errors.videoUrl?.message}
            description="Must be an HTTPS URL"
          >
            <Input
              {...register("videoUrl")}
              placeholder="https://..."
              className="h-11 bg-zinc-50/50 border-zinc-200 focus:bg-white"
            />
          </FormField>
        </div>
      </FormSection>

      {/* 5. Verification Documents */}
      <FormSection
        title="Verification Documents"
        description="Upload property verification documents"
        icon={<FileText className="h-5 w-5" />}
      >
        <AttachmentList
          attachments={attachmentFields}
          errors={errors}
          control={control}
          register={register}
          onRemove={removeAttachment}
          onAdd={handleAddAttachment}
          attachmentTypes={ATTACHMENT_TYPES}
        />
      </FormSection>
      {/* Submit Button */}
      {!hideSubmitButton && (
        <div className="pt-4 flex justify-end">
          <Button
            type="submit"
            disabled={isSubmitting}
            className="min-w-[150px] bg-emerald-600 hover:bg-emerald-700 text-white h-11 text-base shadow-md shadow-emerald-200"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEditing ? "Save Changes" : "Create Property"}
          </Button>
        </div>
      )}
    </form>
  );
}
