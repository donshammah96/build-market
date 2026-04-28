"use client";

import React, { memo, useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  useForm,
  Controller,
  useFieldArray,
  useWatch,
  Control,
  UseFormRegister,
  FieldErrors,
  FieldPath,
  Path,
  Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Home,
  MapPin,
  ImagePlus,
  GripVertical,
  X,
  Loader2,
  AlertCircle,
  FileText,
  Plus,
  Upload,
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

export const SECURITY_PERSISTENCE_ALLOWLIST = [
  "title",
  "description",
  "price",
  "currency",
  "location",
  "address",
  "county",
  "type",
  "category",
  "status",
  "features",
] as const;
import { uploadForCredential } from "@/lib/upload-client";
import { isLocalUpload } from "@/lib/utils/upload";
import { useImageUploader } from "@/hooks/useImageUploader";
import Image from "next/image";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement } from "@dnd-kit/modifiers";
// @build/enums — single source of truth for all Prisma-aligned enums
import {
  COUNTIES,
  COUNTY_LABELS,
  PROPERTY_TYPES as PROPERTY_TYPE_VALUES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_CATEGORIES as PROPERTY_CATEGORY_VALUES,
  PROPERTY_CATEGORY_LABELS,
  PROPERTY_DOCUMENT_TYPES,
  PROPERTY_DOCUMENT_TYPE_LABELS,
  PROPERTY_TENURES,
  PROPERTY_TENURE_LABELS,
  type PropertyDocumentType,
} from "@build/enums";
// Local sub-types for type/category fields
import type { PropertyType, PropertyCategory } from "@/types/property";
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
    "h-11 bg-(--color-input-background) border-(--color-input) focus:bg-background",
  /** Input with icon prefix padding */
  inputWithPrefix: "pl-16",
  /** Section card container */
  section: "bg-card rounded-xl border border-border p-6 shadow-sm",
  /** Form field container with light background */
  fieldContainer:
    "p-4 border border-border rounded-lg bg-(--color-input-background)",
  /** Drag and drop zone base */
  dropZone:
    "border-2 border-dashed rounded-xl transition-colors cursor-pointer",
  /** Drag and drop zone default state */
  dropZoneDefault:
    "border-border hover:border-ring bg-(--color-input-background)",
  /** Drag and drop zone active state */
  dropZoneActive: "border-success bg-success/10",
  /** Empty state container */
  emptyState:
    "border-2 border-dashed border-border rounded-xl p-8 text-center bg-(--color-input-background)",
  /** Icon container */
  iconContainer:
    "w-12 h-12 bg-muted rounded-full flex items-center justify-center text-muted-foreground",
  /** Secondary button styling */
  secondaryButton:
    "bg-secondary hover:opacity-90 text-secondary-foreground border border-border",
} as const;

/** Maximum number of images allowed in the form */
const MAX_IMAGES = 20;

/** Maximum number of verification documents allowed in the form */
const MAX_DOCUMENTS = 5;

/** Threshold for enabling lazy loading on images */
const LAZY_LOAD_THRESHOLD = 4;
const PROPERTY_FORM_DRAFT_STORAGE_KEY = "properties-form-draft-v1";
const IMAGE_URL_INPUT_ID = "property-images-url-input";

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
const getDocumentIcon = (nameOrUrl: string, type: string): React.ReactNode => {
  if (!nameOrUrl) return <File className="h-4 w-4 text-muted-foreground" />;

  // Check file extension from URL
  const ext = nameOrUrl.split(".").pop()?.toLowerCase();

  if (ext === "pdf" || type.includes("DEED") || type.includes("SEARCH")) {
    return <FileText className="h-4 w-4 text-error" />;
  }
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext || "")) {
    return <FileImage className="h-4 w-4 text-primary" />;
  }
  if (type.includes("APPROVAL") || type.includes("CERTIFICATE")) {
    return <FileCheck className="h-4 w-4 text-success" />;
  }

  return <File className="h-4 w-4 text-muted-foreground" />;
};

function findFirstInvalidFieldPath(
  errors: unknown,
  parentPath = "",
): string | null {
  if (!errors || typeof errors !== "object") {
    return null;
  }

  for (const [key, value] of Object.entries(
    errors as Record<string, unknown>,
  )) {
    if (!value) continue;

    const fieldPath = parentPath ? `${parentPath}.${key}` : key;

    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index++) {
        const nested = findFirstInvalidFieldPath(
          value[index],
          `${fieldPath}.${index}`,
        );
        if (nested) return nested;
      }
      continue;
    }

    if (typeof value === "object") {
      if ("message" in (value as Record<string, unknown>)) {
        return fieldPath;
      }
      const nested = findFirstInvalidFieldPath(value, fieldPath);
      if (nested) return nested;
    }
  }

  return null;
}

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

// Property document type options (form subset — 3 verification document types only)
const DOCUMENT_TYPES: Array<{
  value: PropertyDocumentType;
  label: string;
}> = [
  {
    value: "TITLE_DEED",
    label: PROPERTY_DOCUMENT_TYPE_LABELS.TITLE_DEED,
  },
  {
    value: "OFFICIAL_SEARCH",
    label: PROPERTY_DOCUMENT_TYPE_LABELS.OFFICIAL_SEARCH,
  },
  {
    value: "MANDATE_LETTER",
    label: PROPERTY_DOCUMENT_TYPE_LABELS.MANDATE_LETTER,
  },
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

const PROPERTY_TENURE_OPTIONS: Array<{ value: string; label: string }> =
  PROPERTY_TENURES.map((value) => ({
    value,
    label: PROPERTY_TENURE_LABELS[value],
  }));

const SECTION_ORDER = [
  "Basic Details",
  "Pricing",
  "Location",
  "Property Specs",
  "Legal Information",
  "Media",
  "Features",
  "Documents",
  "Other",
] as const;

const FIELD_LABELS: Record<string, { label: string; section: string }> = {
  title: { label: "Property Title", section: "Basic Details" },
  description: { label: "Description", section: "Basic Details" },
  type: { label: "Property Type", section: "Basic Details" },
  tenure: { label: "Tenure", section: "Basic Details" },
  category: { label: "Category", section: "Basic Details" },
  price: { label: "Price", section: "Pricing" },
  currency: { label: "Currency", section: "Pricing" },
  county: { label: "County", section: "Location" },
  constituency: { label: "Constituency", section: "Location" },
  neighbourhood: { label: "Neighbourhood", section: "Location" },
  address: { label: "Address", section: "Location" },
  latitude: { label: "Latitude", section: "Location" },
  longitude: { label: "Longitude", section: "Location" },
  bedrooms: { label: "Bedrooms", section: "Property Specs" },
  bathrooms: { label: "Bathrooms", section: "Property Specs" },
  buildingSize: { label: "Area (sq ft)", section: "Property Specs" },
  plotSize: { label: "Plot Size", section: "Property Specs" },
  lrNumber: { label: "LR Number", section: "Legal Information" },
  images: { label: "Images", section: "Media" },
  videoUrl: { label: "Video URL", section: "Media" },
  floorPlan: { label: "Floor Plan", section: "Media" },
  features: { label: "Features", section: "Features" },
  documents: { label: "Verification Documents", section: "Documents" },
};

const safeMessage = (msg: unknown): string => {
  if (typeof msg === "string") return msg;
  if (msg === null || msg === undefined) return "Unknown error";
  return String(msg);
};

// Zod enums — derived from @build/enums as-const arrays (single source of truth)
const CountyEnum = z.enum(COUNTIES);
const PropertyTypeEnum = z.enum(PROPERTY_TYPE_VALUES);
const PropertyCategoryEnum = z.enum(PROPERTY_CATEGORY_VALUES);
const PropertyDocumentTypeEnum = z.enum(PROPERTY_DOCUMENT_TYPES);

// Property document schema with optional UI-only metadata for preview state
const PropertyDocumentSchema = z.object({
  assetId: z
    .string()
    .uuid("Asset ID must be a valid UUID")
    .min(1, "Asset ID is required"),
  type: PropertyDocumentTypeEnum,
  notes: z
    .string()
    .max(500, "Notes must be less than 500 characters")
    .optional(),
  fileUrl: z
    .string()
    .min(1, "Document preview URL is required")
    .max(2048, "Document preview URL must be less than 2048 characters")
    .optional(),
  fileName: z
    .string()
    .max(255, "File name must be less than 255 characters")
    .optional(),
  mimeType: z
    .string()
    .max(255, "MIME type must be less than 255 characters")
    .optional(),
  size: z
    .number()
    .int()
    .positive("Document size must be a positive number")
    .optional(),
});

const PropertyImageSchema = z.object({
  value: z
    .string()
    .min(1, "Image URL is required")
    .url("Image URL must be a valid URL")
    .refine((url) => url.startsWith("https://") || url.startsWith("/"), {
      message: "Image URL must be a valid HTTPS or local URL",
    }),
  assetId: z
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().uuid("Asset ID must be a valid UUID"),
    )
    .optional(),
});

const optionalNumberInput = <T extends z.ZodNumber>(schema: T) =>
  z
    .preprocess(
      (value) =>
        typeof value === "number" && Number.isNaN(value) ? undefined : value,
      schema,
    )
    .optional();

const optionalUrlInput = (
  schema: z.ZodString,
  emptyValue: string | undefined = "",
) =>
  z.preprocess(
    (value) => (value === emptyValue ? undefined : value),
    schema.optional(),
  );

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
    latitude: optionalNumberInput(
      z
        .number()
        .min(-90, "Latitude must be between -90 and 90")
        .max(90, "Latitude must be between -90 and 90"),
    ),
    longitude: optionalNumberInput(
      z
        .number()
        .min(-180, "Longitude must be between -180 and 180")
        .max(180, "Longitude must be between -180 and 180"),
    ),
    bedrooms: optionalNumberInput(
      z
        .number()
        .int()
        .min(0, "Bedrooms cannot be negative")
        .max(50, "Bedrooms cannot exceed 50"),
    ),
    bathrooms: optionalNumberInput(
      z
        .number()
        .int()
        .min(0, "Bathrooms cannot be negative")
        .max(50, "Bathrooms cannot exceed 50"),
    ),
    buildingSize: optionalNumberInput(
      z.number().positive("Building size must be a positive number"),
    ),
    areaUnit: z.enum(["SQ_FEET", "ACRES", "SQ_METERS"]).optional(),
    plotSize: optionalNumberInput(
      z.number().positive("Plot size must be a positive number"),
    ),
    lrNumber: z
      .string()
      .max(100, "LR Number must be less than 100 characters")
      .optional(),
    floorPlan: optionalUrlInput(
      z
        .string()
        .url("Floor plan must be a valid URL")
        .refine((url) => url.startsWith("https://"), {
          message: "Floor plan URL must start with https://",
        }),
    ),
    videoUrl: optionalUrlInput(
      z
        .string()
        .url("Video URL must be a valid URL")
        .refine((url) => url.startsWith("https://"), {
          message: "Video URL must start with https://",
        }),
    ),
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
      .array(PropertyImageSchema)
      .min(1, "At least one image is required")
      .max(20, "Maximum 20 images allowed"),
    documents: z
      .array(PropertyDocumentSchema)
      .max(5, "Maximum 5 verification documents allowed")
      .optional(),
  })
  .refine(
    (data) => {
      const hasLatitude =
        data.latitude !== undefined &&
        data.latitude !== null &&
        Number.isFinite(data.latitude);
      const hasLongitude =
        data.longitude !== undefined &&
        data.longitude !== null &&
        Number.isFinite(data.longitude);
      return hasLatitude === hasLongitude;
    },
    {
      message: "Provide both latitude and longitude or neither",
      path: ["latitude"],
    },
  );

export type PropertyFormData = z.infer<typeof propertySchema>;

type PropertyFormSubmitDocument = {
  assetId: string;
  type: PropertyDocumentType;
  notes?: string;
};

type PropertyFormSubmitImage = {
  assetId: string;
  url: string;
};

// Transformed data type for submission (images as string array plus canonical asset refs)
export type PropertyFormSubmitData = Omit<
  PropertyFormData,
  "images" | "documents"
> & {
  images?: string[];
  imageAssets?: PropertyFormSubmitImage[];
  documents?: PropertyFormSubmitDocument[];
};

type PropertyFormDefaultValues = Partial<PropertyFormSubmitData> & {
  id?: string;
};

interface PropertyFormProps {
  /** Form submission handler - always returns a Promise for consistency */
  onSubmit: (data: PropertyFormSubmitData) => Promise<void>;
  /** Default form values for editing or pre-filling (images as string array) */
  defaultValues?: PropertyFormDefaultValues;
  /** Whether the form is in edit mode */
  isEditing?: boolean;
  /** Optional stable property ID to scope edit-mode draft storage */
  propertyId?: string;
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
  <div className={cn(THEME.section, className)}>
    <div className="flex items-start gap-3 mb-6 border-b border-border pb-4">
      {icon && (
        <div className="p-2 bg-primary/10 text-primary rounded-lg">{icon}</div>
      )}
      <div>
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
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
  fieldId?: string;
}> = ({
  label,
  children,
  required,
  optional,
  error,
  description,
  className,
  fieldId,
}) => {
  const LABELABLE_TAGS = new Set([
    "button",
    "input",
    "meter",
    "output",
    "progress",
    "select",
    "textarea",
  ]);

  const generatedId = React.useId();
  const resolvedFieldId = fieldId || `property-field-${generatedId}`;
  const descriptionId = description
    ? `${resolvedFieldId}-description`
    : undefined;
  const errorId = error ? `${resolvedFieldId}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ");

  let renderedChildren = children;
  if (React.isValidElement(children)) {
    const childType = children.type;
    const isNativeElement = typeof childType === "string";
    const canInjectControlProps =
      !isNativeElement || LABELABLE_TAGS.has(childType);

    if (canInjectControlProps) {
      const existingDescribedBy = (
        children.props as { "aria-describedby"?: string }
      )["aria-describedby"];
      renderedChildren = React.cloneElement(
        children as React.ReactElement<Record<string, unknown>>,
        {
          id: (children.props as { id?: string }).id ?? resolvedFieldId,
          "aria-invalid":
            error !== undefined
              ? true
              : (children.props as { "aria-invalid"?: boolean })[
                  "aria-invalid"
                ],
          "aria-describedby": [existingDescribedBy, describedBy]
            .filter(Boolean)
            .join(" "),
        },
      );
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="space-y-1">
        <Label
          htmlFor={resolvedFieldId}
          className="text-sm font-medium text-foreground flex items-center gap-1"
        >
          {label}
          {required && (
            <span className="text-success text-xs ml-0.5" aria-hidden="true">
              *
            </span>
          )}
          {optional && !required && (
            <span className="text-muted-foreground text-xs ml-1 font-normal">
              (optional)
            </span>
          )}
        </Label>
        {description && (
          <p id={descriptionId} className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {renderedChildren}
      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="text-xs text-error flex items-center gap-1.5 motion-safe:animate-in motion-safe:slide-in-from-top-1"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
};

// Features multi-input component - Memoized to prevent unnecessary re-renders
const FeaturesInput = memo<{
  value: string[];
  onChange: (features: string[]) => void;
  inputId?: string;
  ariaDescribedBy?: string;
  hasError?: boolean;
}>(({ value, onChange, inputId, ariaDescribedBy, hasError }) => {
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
          id={inputId}
          aria-describedby={ariaDescribedBy}
          aria-invalid={hasError ? true : undefined}
          value={newFeature}
          onChange={(e) => setNewFeature(e.target.value)}
          placeholder="e.g. Swimming Pool, Gym, Borehole"
          className="flex-1 h-11 bg-(--color-input-background) border-input focus:bg-background"
          onKeyDown={(e) =>
            e.key === "Enter" && (e.preventDefault(), handleAddFeature())
          }
        />
        <Button
          type="button"
          onClick={handleAddFeature}
          variant="secondary"
          className="bg-secondary hover:opacity-90 text-secondary-foreground border border-border"
          aria-label="Add feature"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((feature) => (
            <div
              key={feature}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 text-success rounded-full text-sm border border-success/30"
            >
              <span>{feature}</span>
              <button
                type="button"
                onClick={() => handleRemoveFeature(feature)}
                className="ml-1 hover:opacity-75"
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
  images: Array<{ id: string; value: string; assetId?: string }>;
  uploadingImages: Set<number>;
  onRemove: (index: number) => void;
  onReorder: (activeId: string, overId: string) => void;
  disableReorder?: boolean;
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

interface SortableImageItemProps {
  imageId: string;
  index: number;
  url: string;
  isUploading: boolean;
  disableDrag?: boolean;
  onRemove: (index: number) => void;
}

const SortableImageItem = memo<SortableImageItemProps>(
  function SortableImageItem({
    imageId,
    index,
    url,
    isUploading,
    disableDrag,
    onRemove,
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: imageId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const shouldLazyLoad = index >= LAZY_LOAD_THRESHOLD;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "relative group aspect-square rounded-lg overflow-hidden border border-border bg-muted/40 shadow-sm touch-none",
          isDragging && "opacity-60 ring-2 ring-ring",
        )}
      >
        {isUploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
            <button
              type="button"
              className={cn(
                "absolute left-2 top-2 h-11 w-11 rounded-full bg-foreground/70 text-background flex items-center justify-center",
                disableDrag
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-grab active:cursor-grabbing",
              )}
              aria-label={`Drag image ${index + 1} to reorder`}
              disabled={disableDrag}
              {...(disableDrag ? {} : attributes)}
              {...(disableDrag ? {} : listeners)}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-11 w-11 rounded-full"
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
  },
);

/**
 * Memoized ImageGallery component for displaying and managing property images.
 * Supports drag-and-drop upload, URL input, and lazy loading for performance.
 */
const ImageGallery = memo<ImageGalleryProps>(function ImageGallery({
  images,
  uploadingImages,
  onRemove,
  onReorder,
  disableReorder,
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      onReorder(String(active.id), String(over.id));
    },
    [onReorder],
  );

  const canReorder = !disableReorder;

  const renderImageGrid = () => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {images.map((field, index) => {
        const url = field.value;
        const isUploading = uploadingImages.has(index) || !url;

        return (
          <SortableImageItem
            key={field.id}
            imageId={field.id}
            index={index}
            url={url}
            isUploading={isUploading}
            disableDrag={!canReorder || isUploading}
            onRemove={onRemove}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Drag and Drop Zone */}
      <button
        type="button"
        className={cn(
          THEME.dropZone,
          "p-6 mb-4 w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2",
          isDragging ? THEME.dropZoneActive : THEME.dropZoneDefault,
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        aria-label="Upload images by clicking or dragging files here"
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
              <Upload className="h-6 w-6 text-success" />
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </div>
          <p className="text-sm font-medium text-foreground mb-1">
            {isDragging
              ? "Drop images here"
              : "Drag and drop images here, or click to browse"}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports JPG, PNG, WebP (max 10MB per file, max {MAX_IMAGES} images)
          </p>
        </div>
      </button>

      {/* URL Input */}
      <div className="mb-4 space-y-1.5">
        <Label htmlFor={IMAGE_URL_INPUT_ID} className="text-sm font-medium">
          Image URL
        </Label>
        <div className="flex gap-2">
          <Input
            id={IMAGE_URL_INPUT_ID}
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
      </div>

      {error && (
        <div
          aria-live="polite"
          className="text-xs text-error flex items-center gap-1.5 mb-2"
        >
          <AlertCircle className="h-3 w-3" />
          {error}
        </div>
      )}

      {images.length === 0 ? (
        <div className={THEME.emptyState}>
          <div className={cn(THEME.iconContainer, "mx-auto mb-3")}>
            <ImagePlus className="h-6 w-6" />
          </div>
          <p className="text-sm text-muted-foreground">No images added yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            At least one image is required
          </p>
        </div>
      ) : canReorder ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToParentElement]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((image) => image.id)}
            strategy={rectSortingStrategy}
          >
            {renderImageGrid()}
          </SortableContext>
        </DndContext>
      ) : (
        renderImageGrid()
      )}
    </div>
  );
});

interface PropertyDocumentCardProps {
  index: number;
  errors: FieldErrors<PropertyFormData>;
  control: Control<PropertyFormData>;
  register: UseFormRegister<PropertyFormData>;
  resolveError: (
    path: Path<PropertyFormData>,
    message: unknown,
  ) => string | undefined;
  onRemove: (index: number) => void;
  onUpload: (index: number, file: File) => Promise<void>;
  isUploading: boolean;
  documentTypes: Array<{ value: PropertyDocumentType; label: string }>;
}

const PropertyDocumentCard: React.FC<PropertyDocumentCardProps> = ({
  index,
  errors,
  control,
  register,
  resolveError,
  onRemove,
  onUpload,
  isUploading,
  documentTypes,
}) => {
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const documentValue = useWatch({
    control,
    name: `documents.${index}`,
  });
  const currentType = documentValue?.type || "";
  const currentAssetId = documentValue?.assetId || "";
  const currentFileUrl = documentValue?.fileUrl || "";
  const currentFileName = documentValue?.fileName || "";
  const documentTypeFieldId = `property-field-documents-${index}-type`;
  const documentAssetFieldId = `property-field-documents-${index}-assetId`;
  const documentTypeDescribedBy = `${documentTypeFieldId}-error`;
  const documentFileDescribedBy = [
    `${documentAssetFieldId}-description`,
    `${documentAssetFieldId}-error`,
  ].join(" ");

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await onUpload(index, file);
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className={cn(THEME.fieldContainer, "space-y-3")}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {getDocumentIcon(currentFileName || currentFileUrl, currentType)}
          <div>
            <h4 className="text-sm font-medium text-foreground">
              Document {index + 1}
            </h4>
            <p className="text-xs text-muted-foreground">
              Upload a PDF or image and we will store the asset reference for
              you.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-error hover:bg-error/10"
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
          fieldId={documentTypeFieldId}
          error={resolveError(
            `documents.${index}.type` as Path<PropertyFormData>,
            errors.documents?.[index]?.type?.message,
          )}
        >
          <Controller
            name={`documents.${index}.type`}
            control={control}
            render={({ field }) => (
              <Combobox
                id={documentTypeFieldId}
                aria-describedby={documentTypeDescribedBy}
                aria-invalid={
                  resolveError(
                    `documents.${index}.type` as Path<PropertyFormData>,
                    errors.documents?.[index]?.type?.message,
                  )
                    ? true
                    : undefined
                }
                options={documentTypes}
                value={field.value}
                onChange={field.onChange}
                placeholder="Select document type"
                className="h-11"
              />
            )}
          />
        </FormField>

        <FormField
          label="Document File"
          required
          fieldId={documentAssetFieldId}
          error={resolveError(
            `documents.${index}.assetId` as Path<PropertyFormData>,
            errors.documents?.[index]?.assetId?.message,
          )}
          description="PDF, JPG, PNG, or WEBP up to 25MB"
        >
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
            <div
              id={documentAssetFieldId}
              aria-describedby={documentFileDescribedBy}
              aria-invalid={
                resolveError(
                  `documents.${index}.assetId` as Path<PropertyFormData>,
                  errors.documents?.[index]?.assetId?.message,
                )
                  ? true
                  : undefined
              }
              tabIndex={-1}
              className={cn(
                "rounded-lg border border-border bg-muted/30 p-3",
                resolveError(
                  `documents.${index}.assetId` as Path<PropertyFormData>,
                  errors.documents?.[index]?.assetId?.message,
                )
                  ? "border-error/50"
                  : undefined,
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-10"
                  onClick={handleChooseFile}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  {currentAssetId ? "Replace File" : "Choose File"}
                </Button>

                {currentFileUrl ? (
                  <Button type="button" variant="ghost" asChild>
                    <a
                      href={currentFileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Preview
                    </a>
                  </Button>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                {currentFileName ||
                  (currentAssetId
                    ? `Uploaded asset ${currentAssetId.slice(0, 8)}...`
                    : "No file uploaded yet")}
              </p>
            </div>

            <input type="hidden" {...register(`documents.${index}.assetId`)} />
          </div>
        </FormField>
      </div>

      <FormField
        label="Notes"
        optional
        error={resolveError(
          `documents.${index}.notes` as Path<PropertyFormData>,
          errors.documents?.[index]?.notes?.message,
        )}
      >
        <Textarea
          {...register(`documents.${index}.notes`)}
          placeholder="Additional notes about this document..."
          className={cn(THEME.input, "resize-none min-h-20")}
        />
      </FormField>
    </div>
  );
};

interface PropertyDocumentListProps {
  documents: Array<{ id: string }>;
  errors: FieldErrors<PropertyFormData>;
  control: Control<PropertyFormData>;
  register: UseFormRegister<PropertyFormData>;
  resolveError: (
    path: Path<PropertyFormData>,
    message: unknown,
  ) => string | undefined;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onUpload: (index: number, file: File) => Promise<void>;
  uploadingDocumentIndexes: Set<number>;
  documentTypes: Array<{ value: PropertyDocumentType; label: string }>;
}

const PropertyDocumentList: React.FC<PropertyDocumentListProps> = ({
  documents,
  errors,
  control,
  register,
  resolveError,
  onRemove,
  onAdd,
  onUpload,
  uploadingDocumentIndexes,
  documentTypes,
}) => {
  const canAddMore = documents.length < MAX_DOCUMENTS;

  return (
    <div className="space-y-4">
      {documents.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {documents.length} of {MAX_DOCUMENTS} documents added
        </p>
      )}

      {documents.map((field, index) => (
        <PropertyDocumentCard
          key={field.id}
          index={index}
          errors={errors}
          control={control}
          register={register}
          resolveError={resolveError}
          onRemove={onRemove}
          onUpload={onUpload}
          isUploading={uploadingDocumentIndexes.has(index)}
          documentTypes={documentTypes}
        />
      ))}

      <Button
        type="button"
        onClick={onAdd}
        variant="outline"
        className="w-full border-dashed border-border hover:border-ring"
        disabled={!canAddMore}
      >
        <Plus className="h-4 w-4 mr-2" />
        {canAddMore
          ? "Add Document"
          : `Maximum ${MAX_DOCUMENTS} documents reached`}
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
  propertyId,
  hideSubmitButton = false,
  onChange,
}: PropertyFormProps) {
  const errorSummaryHeadingRef = React.useRef<HTMLHeadingElement | null>(null);
  const hasHydratedDraftRef = React.useRef(false);
  const defaultValueId =
    typeof defaultValues?.id === "string" && defaultValues.id.length > 0
      ? defaultValues.id
      : "new";
  const formDefaultValues = React.useMemo(() => {
    if (!defaultValues) return undefined;
    const { id, imageAssets, ...rest } = defaultValues;
    void imageAssets;
    void id;
    return rest;
  }, [defaultValues]);
  const normalizedDefaultImages = React.useMemo(() => {
    if (defaultValues?.imageAssets?.length) {
      return defaultValues.imageAssets.map((image) => ({
        value: image.url,
        assetId: image.assetId,
      }));
    }

    return defaultValues?.images?.map((url) => ({ value: url })) || [];
  }, [defaultValues]);
  const draftStorageKey = React.useMemo(() => {
    if (isEditing) {
      const scopedId = propertyId || defaultValueId;
      return `${PROPERTY_FORM_DRAFT_STORAGE_KEY}:edit:${scopedId}`;
    }
    return `${PROPERTY_FORM_DRAFT_STORAGE_KEY}:create`;
  }, [defaultValueId, isEditing, propertyId]);

  const fieldA11y = React.useCallback(
    (path: string, hasDescription = false) => {
      const base = `property-field-${path.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      return {
        fieldId: base,
        describedBy: [
          hasDescription ? `${base}-description` : undefined,
          `${base}-error`,
        ]
          .filter(Boolean)
          .join(" "),
      };
    },
    [],
  );

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
    formState: { errors, isSubmitting, touchedFields, submitCount },
    watch,
    setValue,
    setFocus,
  } = useForm<PropertyFormData>({
    resolver: zodResolver(propertySchema) as Resolver<PropertyFormData>,
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      price: undefined,
      currency: "KES",
      type: "SALE",
      category: "RESIDENTIAL",
      tenure: "FREEHOLD",
      county: undefined,
      location: "",
      constituency: "",
      neighbourhood: "",
      address: "",
      latitude: undefined,
      longitude: undefined,
      bedrooms: undefined,
      bathrooms: undefined,
      buildingSize: undefined,
      plotSize: undefined,
      lrNumber: "",
      floorPlan: "",
      videoUrl: "",
      features: [],
      documents: formDefaultValues?.documents || [],
      ...formDefaultValues,
      // Convert string array to object array for useFieldArray (override after spread)
      images: normalizedDefaultImages,
    },
  });

  const [uploadingDocumentIndexes, setUploadingDocumentIndexes] = useState<
    Set<number>
  >(new Set());

  // Use useFieldArray for both images and verification documents
  const {
    fields: imageFields,
    append: appendImage,
    remove: removeImage,
    update: updateImage,
    move: moveImage,
  } = useFieldArray({
    control,
    name: "images",
  });

  const {
    fields: documentFields,
    append: appendDocument,
    remove: removeDocument,
  } = useFieldArray({
    control,
    name: "documents",
  });

  const watchedCurrency = useWatch({ control, name: "currency" });

  // Keep a stable ref to the latest onChange callback to prevent infinite useEffect loops
  // when parent components pass inline functions as onChange handlers
  const onChangeRef = React.useRef(onChange);
  const changeDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  React.useEffect(() => {
    const subscription = watch((values) => {
      if (changeDebounceRef.current) {
        clearTimeout(changeDebounceRef.current);
      }

      changeDebounceRef.current = setTimeout(() => {
        if (onChangeRef.current) {
          const normalizedImages = values.images
            ?.map((img) => img?.value)
            .filter(
              (img): img is string => typeof img === "string" && img.length > 0,
            );
          const normalizedImageAssets = values.images
            ?.filter(
              (
                image,
              ): image is {
                value: string;
                assetId: string;
              } =>
                Boolean(image) &&
                typeof image?.value === "string" &&
                image.value.length > 0 &&
                typeof image?.assetId === "string" &&
                image.assetId.length > 0,
            )
            .map((image) => ({
              assetId: image.assetId,
              url: image.value,
            }));
          const normalizedFeatures = values.features?.filter(
            (feature): feature is string =>
              typeof feature === "string" && feature.length > 0,
          );
          const normalizedDocuments = values.documents
            ?.filter(
              (
                document,
              ): document is {
                assetId: string;
                type: PropertyDocumentType;
                notes?: string;
              } =>
                Boolean(document) &&
                typeof document?.assetId === "string" &&
                document.assetId.length > 0 &&
                typeof document.type === "string",
            )
            .map((document) => ({
              assetId: document.assetId,
              type: document.type,
              ...(document.notes ? { notes: document.notes } : {}),
            }));

          const transformedValues: Partial<PropertyFormSubmitData> = {
            ...values,
            features: normalizedFeatures,
            images: normalizedImages,
            imageAssets: normalizedImageAssets,
            documents: normalizedDocuments,
          };
          onChangeRef.current(transformedValues);
        }

        if (!hasHydratedDraftRef.current || typeof window === "undefined") {
          return;
        }

        // SECURITY_PERSISTENCE_ALLOWLIST: Persists non-sensitive property draft form state.
        window.sessionStorage.setItem(draftStorageKey, JSON.stringify(values));
      }, 300);
    });

    return () => {
      subscription.unsubscribe();
      if (changeDebounceRef.current) {
        clearTimeout(changeDebounceRef.current);
      }
    };
  }, [draftStorageKey, watch]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // SECURITY_PERSISTENCE_ALLOWLIST: Reads non-sensitive property draft form state.
    const serializedDraft = window.sessionStorage.getItem(draftStorageKey);
    if (!serializedDraft) {
      hasHydratedDraftRef.current = true;
      return;
    }

    try {
      const parsedDraft = JSON.parse(
        serializedDraft,
      ) as Partial<PropertyFormData>;
      Object.entries(parsedDraft).forEach(([key, value]) => {
        setValue(key as Path<PropertyFormData>, value as never, {
          shouldDirty: false,
          shouldTouch: false,
          shouldValidate: false,
        });
      });
    } catch {
      // SECURITY_PERSISTENCE_ALLOWLIST: Clears malformed non-sensitive property draft form state.
      window.sessionStorage.removeItem(draftStorageKey);
    } finally {
      hasHydratedDraftRef.current = true;
    }
  }, [draftStorageKey, setValue]);

  // Memoized image fields for stable reference
  const stableImageFields = useMemo(
    () =>
      imageFields.map((f) => ({
        id: f.id,
        value: f.value,
        assetId: f.assetId,
      })),
    [imageFields],
  );

  // Wrapper handlers that connect the hook to useFieldArray
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      handleFileSelectBase(
        files,
        stableImageFields,
        appendImage,
        updateImage,
        removeImage,
      );
    },
    [
      appendImage,
      handleFileSelectBase,
      removeImage,
      stableImageFields,
      updateImage,
    ],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      handleDropBase(
        e,
        stableImageFields,
        appendImage,
        updateImage,
        removeImage,
      );
    },
    [appendImage, handleDropBase, removeImage, stableImageFields, updateImage],
  );

  const handleAddImage = useCallback(() => {
    handleAddImageBase(stableImageFields, appendImage);
  }, [appendImage, handleAddImageBase, stableImageFields]);

  const handleRemoveImage = useCallback(
    (index: number) => {
      handleRemoveImageBase(index, removeImage);
    },
    [handleRemoveImageBase, removeImage],
  );

  const handleReorderImages = useCallback(
    (activeId: string, overId: string) => {
      if (uploadingImages.size > 0) return;

      const oldIndex = stableImageFields.findIndex(
        (item) => item.id === activeId,
      );
      const newIndex = stableImageFields.findIndex(
        (item) => item.id === overId,
      );

      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      moveImage(oldIndex, newIndex);
    },
    [moveImage, stableImageFields, uploadingImages.size],
  );

  const handleAddDocument = () => {
    appendDocument({
      assetId: "",
      type: "TITLE_DEED",
      notes: "",
    });
  };

  const handleUploadDocument = useCallback(
    async (index: number, file: File) => {
      setUploadingDocumentIndexes((current) => new Set(current).add(index));

      try {
        const { assetId, url } = await uploadForCredential(file, "documents");
        setValue(`documents.${index}.assetId`, assetId, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: true,
        });
        setValue(`documents.${index}.fileUrl`, url, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: false,
        });
        setValue(`documents.${index}.fileName`, file.name, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: false,
        });
        setValue(`documents.${index}.mimeType`, file.type, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: false,
        });
        setValue(`documents.${index}.size`, file.size, {
          shouldDirty: true,
          shouldTouch: true,
          shouldValidate: false,
        });
        toast.success(`Uploaded ${file.name}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to upload document",
        );
        throw error;
      } finally {
        setUploadingDocumentIndexes((current) => {
          const next = new Set(current);
          next.delete(index);
          return next;
        });
      }
    },
    [setValue],
  );

  const getNestedValue = React.useCallback((obj: unknown, path: string) => {
    return path.split(".").reduce<unknown>((acc, key) => {
      if (!acc || typeof acc !== "object") return undefined;
      return (acc as Record<string, unknown>)[key];
    }, obj);
  }, []);

  const shouldShowFieldError = React.useCallback(
    (path: FieldPath<PropertyFormData>): boolean => {
      if (submitCount > 0) return true;
      return Boolean(getNestedValue(touchedFields, path));
    },
    [getNestedValue, submitCount, touchedFields],
  );

  const visibleError = React.useCallback(
    (
      path: FieldPath<PropertyFormData>,
      message: unknown,
    ): string | undefined => {
      if (!message || !shouldShowFieldError(path)) return undefined;
      return safeMessage(message);
    },
    [shouldShowFieldError],
  );

  const resolveFieldDomId = React.useCallback(
    (path: string): string | null => {
      const documentMatch = path.match(/^documents\.(\d+)\.(type|assetId)$/);
      if (documentMatch) {
        const [, index, field] = documentMatch;
        return `property-field-documents-${index}-${field}`;
      }

      if (/^images(\.|$)/.test(path)) return IMAGE_URL_INPUT_ID;
      if (/^features(\.|$)/.test(path)) {
        return fieldA11y("features", true).fieldId;
      }

      const explicitA11yFields = new Set([
        "type",
        "tenure",
        "category",
        "price",
        "currency",
        "location",
        "county",
        "features",
      ]);

      if (explicitA11yFields.has(path)) {
        return fieldA11y(path, path === "features").fieldId;
      }

      return null;
    },
    [fieldA11y],
  );

  const focusFieldByPath = React.useCallback(
    (path: string) => {
      try {
        setFocus(path as Path<PropertyFormData>);
      } catch {
        // Ignore setFocus mismatches for non-registered summary-only paths.
      }

      requestAnimationFrame(() => {
        const domId = resolveFieldDomId(path);
        if (!domId) return;

        const target = document.getElementById(domId) as HTMLElement | null;
        target?.focus();
      });
    },
    [resolveFieldDomId, setFocus],
  );

  /**
   * Collects all form errors with friendly labels, grouped by section.
   * Handles top-level errors, array-level errors, and per-item array errors.
   */
  const getAllErrors = React.useCallback(() => {
    const errorList: Array<{
      field: string;
      message: string;
      section: string;
      path?: string;
    }> = [];

    // Array field names to skip in top-level loop (handled separately)
    const arrayFields = ["documents", "images", "features"];

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
          path: key,
        });
      }
    });

    // Verification documents array errors
    if (errors.documents) {
      // Array-level error
      if (
        typeof errors.documents === "object" &&
        "message" in errors.documents &&
        !Array.isArray(errors.documents)
      ) {
        errorList.push({
          field: "Verification Documents",
          message: safeMessage(errors.documents.message),
          section: "Documents",
          path: "documents",
        });
      }
      // Per-item errors
      if (Array.isArray(errors.documents)) {
        errors.documents.forEach((document, index) => {
          if (document && typeof document === "object") {
            Object.entries(document).forEach(([key, value]) => {
              if (value && typeof value === "object" && "message" in value) {
                const fieldLabel =
                  key === "assetId" ? "File" : key === "type" ? "Type" : key;
                errorList.push({
                  field: `Document ${index + 1} - ${fieldLabel}`,
                  message: safeMessage(value.message),
                  section: "Documents",
                  path: `documents.${index}.${key}`,
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
          path: "images",
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
                path: "images",
              });
            } else if ("message" in image) {
              // Direct message on the image item
              errorList.push({
                field: `Image ${index + 1}`,
                message: safeMessage((image as { message: unknown }).message),
                section: "Media",
                path: "images",
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
          path: "features",
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
              path: "features",
            });
          }
        });
      }
    }

    return errorList;
  }, [errors]);

  /**
   * Handles form submission with loading state and error handling.
   * Wraps the onSubmit prop to ensure it always returns a Promise.
   */
  /**
   * Handles form submission with loading state and error handling.
   * Transforms images from object array to string array and strips document
   * preview metadata before submission.
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
        imageAssets: data.images
          ?.filter(
            (
              image,
            ): image is {
              value: string;
              assetId: string;
            } =>
              typeof image.value === "string" &&
              image.value.length > 0 &&
              typeof image.assetId === "string" &&
              image.assetId.length > 0,
          )
          .map((image) => ({
            assetId: image.assetId,
            url: image.value,
          })),
        documents: data.documents?.map((document) => ({
          assetId: document.assetId,
          type: document.type,
          ...(document.notes ? { notes: document.notes } : {}),
        })),
      };

      // Ensure onSubmit returns a Promise and await it
      // This handles both sync and async onSubmit implementations
      await Promise.resolve(onSubmit(submitData));

      if (typeof window !== "undefined") {
        // SECURITY_PERSISTENCE_ALLOWLIST: Clears non-sensitive property draft form state after successful submit.
        window.sessionStorage.removeItem(draftStorageKey);
      }

      toast.dismiss(loadingToast);
      toast.success("Property saved successfully!");
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error instanceof Error ? error.message : "An error occurred");
      // Re-throw to allow parent error handling if needed
      throw error;
    }
  };

  const { allErrors, errorsBySection, sortedSections } = useMemo(() => {
    const collectedErrors = getAllErrors();
    const grouped = collectedErrors.reduce<
      Record<
        string,
        Array<{
          field: string;
          message: string;
          section: string;
          path?: string;
        }>
      >
    >((acc, err) => {
      if (!acc[err.section]) {
        acc[err.section] = [];
      }
      acc[err.section]!.push(err);
      return acc;
    }, {});

    const sectionOrderIndex = (section: string): number => {
      const index = SECTION_ORDER.indexOf(
        section as (typeof SECTION_ORDER)[number],
      );
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };

    const orderedSections = Object.keys(grouped).sort(
      (a, b) => sectionOrderIndex(a) - sectionOrderIndex(b),
    );

    return {
      allErrors: collectedErrors,
      errorsBySection: grouped,
      sortedSections: orderedSections,
    };
  }, [getAllErrors]);
  const hasErrors = allErrors.length > 0;

  const handleInvalidSubmit = React.useCallback(
    (formErrors: FieldErrors<PropertyFormData>) => {
      const firstInvalidField = findFirstInvalidFieldPath(formErrors);
      if (firstInvalidField) {
        focusFieldByPath(firstInvalidField);
        return;
      }

      errorSummaryHeadingRef.current?.focus();
    },
    [focusFieldByPath],
  );

  const typeA11y = fieldA11y("type");
  const tenureA11y = fieldA11y("tenure");
  const categoryA11y = fieldA11y("category");
  const priceA11y = fieldA11y("price");
  const currencyA11y = fieldA11y("currency");
  const locationA11y = fieldA11y("location");
  const countyA11y = fieldA11y("county");
  const featuresA11y = fieldA11y("features", true);

  return (
    <form
      onSubmit={handleSubmit(onFormSubmit, handleInvalidSubmit)}
      className="space-y-6"
    >
      {/* Error Summary - Grouped by Section */}
      {hasErrors && (
        <div
          className="bg-error/10 border border-error/30 rounded-xl p-4"
          role="alert"
          aria-live="polite"
          aria-atomic="true"
          aria-label="Form validation errors"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-error mt-0.5 shrink-0" />
            <div className="flex-1">
              <h3
                ref={errorSummaryHeadingRef}
                tabIndex={-1}
                className="text-sm font-semibold text-error mb-3"
              >
                Please fix the following errors ({allErrors.length}):
              </h3>
              <div className="space-y-3">
                {sortedSections.map((section) => (
                  <div key={section}>
                    <h4 className="text-xs font-semibold text-error uppercase tracking-wide mb-1">
                      {section}
                    </h4>
                    <ul className="space-y-0.5 text-sm text-foreground">
                      {errorsBySection[section]?.map((err, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-error mt-0.5">•</span>
                          {err.path ? (
                            <button
                              type="button"
                              className="text-left underline decoration-error/40 underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm"
                              onClick={() => focusFieldByPath(err.path!)}
                            >
                              <span className="font-medium">{err.field}:</span>{" "}
                              {err.message}
                            </button>
                          ) : (
                            <span>
                              <span className="font-medium">{err.field}:</span>{" "}
                              {err.message}
                            </span>
                          )}
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
            error={visibleError("title", errors.title?.message)}
            className="md:col-span-2"
          >
            <Input
              {...register("title")}
              placeholder="e.g. Modern 3-Bedroom Apartment in Kilimani"
              className={cn(THEME.input, "transition-all")}
            />
          </FormField>

          <FormField
            label="Property Type"
            required
            error={visibleError("type", errors.type?.message)}
            fieldId={typeA11y.fieldId}
          >
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <Combobox
                  id={typeA11y.fieldId}
                  aria-describedby={typeA11y.describedBy}
                  aria-invalid={
                    visibleError("type", errors.type?.message)
                      ? true
                      : undefined
                  }
                  options={PROPERTY_TYPE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select type"
                  className="h-11"
                />
              )}
            />
          </FormField>

          <FormField
            label="Tenure"
            required
            error={visibleError("tenure", errors.tenure?.message)}
            fieldId={tenureA11y.fieldId}
          >
            <Controller
              name="tenure"
              control={control}
              render={({ field }) => (
                <Combobox
                  id={tenureA11y.fieldId}
                  aria-describedby={tenureA11y.describedBy}
                  aria-invalid={
                    visibleError("tenure", errors.tenure?.message)
                      ? true
                      : undefined
                  }
                  options={PROPERTY_TENURE_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select tenure"
                  className="h-11"
                />
              )}
            />
          </FormField>

          <FormField
            label="Category"
            required
            error={visibleError("category", errors.category?.message)}
            fieldId={categoryA11y.fieldId}
          >
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <Combobox
                  id={categoryA11y.fieldId}
                  aria-describedby={categoryA11y.describedBy}
                  aria-invalid={
                    visibleError("category", errors.category?.message)
                      ? true
                      : undefined
                  }
                  options={PROPERTY_CATEGORY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Select category"
                  className="h-11"
                />
              )}
            />
          </FormField>

          <FormField
            label="Price"
            required
            error={visibleError("price", errors.price?.message)}
            fieldId={priceA11y.fieldId}
          >
            <div className="relative">
              <span className="absolute left-3 top-3 text-muted-foreground text-sm font-medium">
                {watchedCurrency || "KES"}
              </span>
              <Input
                id={priceA11y.fieldId}
                aria-describedby={priceA11y.describedBy}
                aria-invalid={
                  visibleError("price", errors.price?.message)
                    ? true
                    : undefined
                }
                {...register("price", { valueAsNumber: true })}
                type="number"
                placeholder="0.00"
                className={cn(THEME.inputWithPrefix, THEME.input)}
              />
            </div>
          </FormField>

          <FormField
            label="Currency"
            required
            error={visibleError("currency", errors.currency?.message)}
            fieldId={currencyA11y.fieldId}
          >
            <Controller
              name="currency"
              control={control}
              render={({ field }) => (
                <Combobox
                  id={currencyA11y.fieldId}
                  aria-describedby={currencyA11y.describedBy}
                  aria-invalid={
                    visibleError("currency", errors.currency?.message)
                      ? true
                      : undefined
                  }
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
            error={visibleError("description", errors.description?.message)}
            className="md:col-span-2"
          >
            <Textarea
              {...register("description")}
              placeholder="Describe the property, its features, and what makes it special..."
              className={cn(THEME.input, "resize-none min-h-30")}
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
          <FormField
            label="Location"
            required
            error={visibleError("location", errors.location?.message)}
            fieldId={locationA11y.fieldId}
          >
            <div className="relative">
              <MapPin className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
              <Input
                id={locationA11y.fieldId}
                aria-describedby={locationA11y.describedBy}
                aria-invalid={
                  visibleError("location", errors.location?.message)
                    ? true
                    : undefined
                }
                {...register("location")}
                placeholder="e.g. Kilimani, Nairobi"
                className={cn("pl-10", THEME.input)}
              />
            </div>
          </FormField>

          <FormField
            label="Street Address"
            optional
            error={visibleError("address", errors.address?.message)}
          >
            <Input
              {...register("address")}
              placeholder="e.g. Road C, Off Enterprise Road"
              className={THEME.input}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField
              label="City/Constituency"
              optional
              error={visibleError("constituency", errors.constituency?.message)}
            >
              <Input
                {...register("constituency")}
                placeholder="Constituency"
                className={THEME.input}
              />
            </FormField>

            <FormField
              label="Neighbourhood"
              optional
              error={visibleError(
                "neighbourhood",
                errors.neighbourhood?.message,
              )}
            >
              <Input
                {...register("neighbourhood")}
                placeholder="Neighbourhood"
                className={THEME.input}
              />
            </FormField>

            <FormField
              label="County"
              required
              error={visibleError("county", errors.county?.message)}
              fieldId={countyA11y.fieldId}
            >
              <Controller
                name="county"
                control={control}
                render={({ field }) => (
                  <Combobox
                    id={countyA11y.fieldId}
                    aria-describedby={countyA11y.describedBy}
                    aria-invalid={
                      visibleError("county", errors.county?.message)
                        ? true
                        : undefined
                    }
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
              error={visibleError("latitude", errors.latitude?.message)}
              description="Optional: Provide both latitude and longitude together"
            >
              <Input
                {...register("latitude", { valueAsNumber: true })}
                type="number"
                step="any"
                placeholder="e.g. -1.2921"
                className={THEME.input}
              />
            </FormField>

            <FormField
              label="Longitude"
              error={visibleError("longitude", errors.longitude?.message)}
              description="Optional: Provide both latitude and longitude together"
            >
              <Input
                {...register("longitude", { valueAsNumber: true })}
                type="number"
                step="any"
                placeholder="e.g. 36.8219"
                className={THEME.input}
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
          <FormField
            label="Bedrooms"
            optional
            error={visibleError("bedrooms", errors.bedrooms?.message)}
          >
            <Input
              {...register("bedrooms", { valueAsNumber: true })}
              type="number"
              min="0"
              max="50"
              placeholder="0"
              className={THEME.input}
            />
          </FormField>

          <FormField
            label="Bathrooms"
            optional
            error={visibleError("bathrooms", errors.bathrooms?.message)}
          >
            <Input
              {...register("bathrooms", { valueAsNumber: true })}
              type="number"
              min="0"
              max="50"
              placeholder="0"
              className={THEME.input}
            />
          </FormField>

          <FormField
            label="Area (sq ft)"
            optional
            error={visibleError("buildingSize", errors.buildingSize?.message)}
          >
            <Input
              {...register("buildingSize", { valueAsNumber: true })}
              type="number"
              step="any"
              placeholder="0"
              className={THEME.input}
            />
          </FormField>

          <FormField
            label="Plot Size (sq ft)"
            optional
            error={visibleError("plotSize", errors.plotSize?.message)}
          >
            <Input
              {...register("plotSize", { valueAsNumber: true })}
              type="number"
              step="any"
              placeholder="0"
              className={THEME.input}
            />
          </FormField>
        </div>

        <FormField
          label="Land Reference Number"
          optional
          error={visibleError("lrNumber", errors.lrNumber?.message)}
        >
          <Input
            {...register("lrNumber")}
            placeholder="e.g. LR 209/12345"
            className={THEME.input}
          />
        </FormField>

        <FormField
          label="Features"
          optional
          description="Add features like Swimming Pool, Gym, Borehole, etc. (Max 20 features, 100 characters each)"
          error={visibleError(
            "features",
            errors.features?.message ||
              (errors.features as { root?: { message?: string } } | undefined)
                ?.root?.message,
          )}
          fieldId={featuresA11y.fieldId}
        >
          <Controller
            name="features"
            control={control}
            render={({ field }) => (
              <FeaturesInput
                value={field.value || []}
                inputId={featuresA11y.fieldId}
                ariaDescribedBy={featuresA11y.describedBy}
                hasError={
                  visibleError(
                    "features",
                    errors.features?.message ||
                      (
                        errors.features as
                          | { root?: { message?: string } }
                          | undefined
                      )?.root?.message,
                  ) !== undefined
                }
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
          onReorder={handleReorderImages}
          disableReorder={uploadingImages.size > 0}
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
            error={visibleError("floorPlan", errors.floorPlan?.message)}
            description="Must be an HTTPS URL"
          >
            <Input
              {...register("floorPlan")}
              placeholder="https://..."
              className={THEME.input}
            />
          </FormField>

          <FormField
            label="Video URL"
            optional
            error={visibleError("videoUrl", errors.videoUrl?.message)}
            description="Must be an HTTPS URL"
          >
            <Input
              {...register("videoUrl")}
              placeholder="https://..."
              className={THEME.input}
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
        <PropertyDocumentList
          documents={documentFields}
          errors={errors}
          control={control}
          register={register}
          resolveError={visibleError}
          onRemove={removeDocument}
          onAdd={handleAddDocument}
          onUpload={handleUploadDocument}
          uploadingDocumentIndexes={uploadingDocumentIndexes}
          documentTypes={DOCUMENT_TYPES}
        />
      </FormSection>
      {/* Submit Button */}
      {!hideSubmitButton && (
        <div className="pt-4 flex justify-end">
          <Button
            type="submit"
            isLoading={isSubmitting}
            loadingText={isEditing ? "Saving Changes" : "Creating Property"}
            className="min-w-37.5 bg-primary hover:bg-primary/90 text-primary-foreground h-11 text-base shadow-md shadow-primary/20"
          >
            {isEditing ? "Save Changes" : "Create Property"}
          </Button>
        </div>
      )}
    </form>
  );
}
