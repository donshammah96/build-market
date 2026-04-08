"use client";

/**
 * @module useImageUploader
 * @description Custom React hook for managing image uploads with drag-and-drop support.
 *
 * Features:
 * - Drag-and-drop file handling
 * - URL input for remote images
 * - File validation (type, size, count)
 * - Sequential upload with progress tracking
 * - Integration with react-hook-form's useFieldArray
 *
 * @example
 * ```tsx
 * // In a form component
 * const { fields, append, update, remove } = useFieldArray({ control, name: "images" });
 *
 * const {
 *   uploadingImages,
 *   isDragging,
 *   handleFileSelect,
 *   handleDragOver,
 *   handleDragLeave,
 *   handleDrop,
 *   handleAddImage,
 *   handleRemoveImage,
 *   newImageUrl,
 *   setNewImageUrl,
 *   fileInputRef,
 * } = useImageUploader({ maxImages: 20 });
 *
 * // Wire up to your image gallery component
 * <ImageGallery
 *   images={fields}
 *   uploadingImages={uploadingImages}
 *   isDragging={isDragging}
 *   onDragOver={handleDragOver}
 *   onDragLeave={handleDragLeave}
 *   onDrop={(e) => handleDrop(e, fields, append, update, remove)}
 *   onFileSelect={(files) => handleFileSelect(files, fields, append, update, remove)}
 *   onRemove={(idx) => handleRemoveImage(idx, remove)}
 *   onAddImage={() => handleAddImage(fields, append)}
 *   // ...
 * />
 * ```
 *
 * @see {@link ImageField} for the expected image field structure
 * @see {@link UseImageUploaderOptions} for configuration options
 * @see {@link UseImageUploaderReturn} for the hook's return type
 */

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  uploadFiles as uploadFilesService,
  UploadError,
  UploadErrorCode,
  validateFiles,
  FILE_LIMITS,
} from "@/lib/upload-client";

export interface ImageField {
  id: string;
  value: string;
  assetId?: string;
}

export interface UseImageUploaderOptions {
  /** Maximum number of images allowed */
  maxImages?: number;
  /** Callback when images are added */
  onImagesAdded?: (urls: string[]) => void;
  /** Callback when an image is removed */
  onImageRemoved?: (index: number) => void;
}

export interface UseImageUploaderReturn {
  /** Set of indices currently uploading */
  uploadingImages: Set<number>;
  /** Whether a drag operation is in progress */
  isDragging: boolean;
  /** Current value of the URL input */
  newImageUrl: string;
  /** Ref for the file input element */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  /** Set the URL input value */
  setNewImageUrl: (url: string) => void;
  /** Handle file selection from input or drop */
  handleFileSelect: (
    files: FileList | null,
    imageFields: ImageField[],
    appendImage: (
      data: { value: string; assetId?: string },
      options?: { shouldFocus?: boolean },
    ) => void,
    updateImage: (
      index: number,
      data: { value: string; assetId?: string },
    ) => void,
    removeImage: (index: number) => void,
  ) => Promise<void>;
  /** Handle drag over event */
  handleDragOver: (e: React.DragEvent) => void;
  /** Handle drag leave event */
  handleDragLeave: (e: React.DragEvent) => void;
  /** Handle drop event */
  handleDrop: (
    e: React.DragEvent,
    imageFields: ImageField[],
    appendImage: (
      data: { value: string; assetId?: string },
      options?: { shouldFocus?: boolean },
    ) => void,
    updateImage: (
      index: number,
      data: { value: string; assetId?: string },
    ) => void,
    removeImage: (index: number) => void,
  ) => void;
  /** Add image from URL input */
  handleAddImage: (
    imageFields: ImageField[],
    appendImage: (
      data: { value: string; assetId?: string },
      options?: { shouldFocus?: boolean },
    ) => void,
  ) => void;
  /** Remove an image by index */
  handleRemoveImage: (
    index: number,
    removeImage: (index: number) => void,
  ) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_IMAGES = 20;

// ============================================================================
// HOOK
// ============================================================================

/**
 * Custom hook for handling image uploads with drag-and-drop support.
 *
 * Provides complete upload state management including:
 * - File selection via input or drag-and-drop
 * - URL input for remote images
 * - Upload progress tracking per-image
 * - File validation (type, size, max count)
 * - Sequential uploads with error handling
 *
 * @param options - Configuration options for the uploader
 * @param options.maxImages - Maximum number of images allowed (default: 20)
 * @param options.onImagesAdded - Callback fired when images are successfully added
 * @param options.onImageRemoved - Callback fired when an image is removed
 *
 * @returns Object containing state and handlers for image management
 *
 * @example Basic usage
 * ```tsx
 * const uploader = useImageUploader({ maxImages: 10 });
 * ```
 *
 * @example With callbacks
 * ```tsx
 * const uploader = useImageUploader({
 *   maxImages: 20,
 *   onImagesAdded: (urls) => console.log('Added:', urls),
 *   onImageRemoved: (idx) => console.log('Removed index:', idx),
 * });
 * ```
 *
 * @see {@link UseImageUploaderOptions} for all available options
 * @see {@link UseImageUploaderReturn} for return type details
 */
export function useImageUploader(
  options: UseImageUploaderOptions = {},
): UseImageUploaderReturn {
  const {
    maxImages = DEFAULT_MAX_IMAGES,
    onImagesAdded,
    onImageRemoved,
  } = options;

  // State
  const [uploadingImages, setUploadingImages] = useState<Set<number>>(
    new Set(),
  );
  const [isDragging, setIsDragging] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  /**
   * Uploads files using the upload service with proper error handling.
   */
  const uploadFiles = useCallback(
    async (
      files: File[],
      fieldName: string,
    ): Promise<{ urls: string[]; assetIds: string[] }> => {
      try {
        // Validate files before upload
        validateFiles(files, fieldName === "images" ? "images" : "documents");

        // Use the upload service with retry logic
        const result = await uploadFilesService(files, fieldName, {
          maxRetries: 3,
          retryDelay: 1000,
        });

        return { urls: result.urls, assetIds: result.assetIds };
      } catch (error) {
        // Provide user-friendly error messages based on error code
        if (error instanceof UploadError) {
          switch (error.code) {
            case UploadErrorCode.VALIDATION_ERROR:
              throw new Error(error.message);
            case UploadErrorCode.NETWORK_ERROR:
              throw new Error(
                "Network error. Please check your connection and try again.",
              );
            case UploadErrorCode.SERVER_ERROR:
              throw new Error(
                `Server error (${error.statusCode || "unknown"}). Please try again later.`,
              );
            case UploadErrorCode.INVALID_RESPONSE:
              throw new Error(
                "Unexpected response from server. Please try again.",
              );
            case UploadErrorCode.MAX_RETRIES_EXCEEDED:
              throw new Error(
                "Upload failed after multiple attempts. Please try again.",
              );
            case UploadErrorCode.ABORTED:
              throw new Error("Upload was cancelled.");
            default:
              throw new Error(error.message || "Upload failed");
          }
        }
        throw error;
      }
    },
    [],
  );

  /**
   * Handles file selection from input or drag-and-drop.
   * Validates file types, sizes, and max count, then uploads sequentially.
   */
  const handleFileSelect = useCallback(
    async (
      files: FileList | null,
      imageFields: ImageField[],
      appendImage: (
        data: { value: string; assetId?: string },
        options?: { shouldFocus?: boolean },
      ) => void,
      updateImage: (
        index: number,
        data: { value: string; assetId?: string },
      ) => void,
      removeImage: (index: number) => void,
    ) => {
      if (!files || files.length === 0) return;

      const imageFiles = Array.from(files).filter((file) =>
        file.type.startsWith("image/"),
      );

      if (imageFiles.length === 0) {
        toast.error("Please select image files");
        return;
      }

      // Check max images limit
      const currentCount = imageFields.length;
      if (currentCount >= maxImages) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }

      // Limit files to remaining slots
      const remainingSlots = maxImages - currentCount;
      const filesToUpload = imageFiles.slice(0, remainingSlots);
      if (filesToUpload.length < imageFiles.length) {
        toast.warning(
          `Only uploading ${filesToUpload.length} of ${imageFiles.length} images (max ${maxImages} allowed)`,
        );
      }

      // Validate file sizes using constant
      const maxSizeBytes = FILE_LIMITS.IMAGE_MAX_SIZE;
      const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
      const oversized = filesToUpload.filter((f) => f.size > maxSizeBytes);
      if (oversized.length > 0) {
        toast.error(`Images must be less than ${maxSizeMB}MB`);
        return;
      }

      const startIndex = imageFields.length;

      // Create set of indices that will be uploading
      const tempSet = new Set<number>(
        Array.from({ length: filesToUpload.length }, (_, i) => startIndex + i),
      );

      // Add placeholder empty objects for loaders to appear
      const placeholders = Array.from({ length: filesToUpload.length }, () => ({
        value: "",
        assetId: "",
      }));
      placeholders.forEach((placeholder) =>
        appendImage(placeholder, { shouldFocus: false }),
      );

      // Mark all as uploading
      setUploadingImages((prev) => new Set([...prev, ...tempSet]));

      try {
        const uploadedUrls: string[] = [];

        // Upload sequentially for individual progress tracking
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          if (!file) {
            // Remove placeholder and from uploading set if file is missing
            removeImage(startIndex + i);
            setUploadingImages((prev) => {
              const next = new Set(prev);
              next.delete(startIndex + i);
              return next;
            });
            continue;
          }

          const { urls, assetIds } = await uploadFiles([file], "images");
          const uploadedUrl = urls[0];
          const uploadedAssetId = assetIds[0];
          if (uploadedUrl) {
            // Update the placeholder with the actual URL
            updateImage(startIndex + i, {
              value: uploadedUrl,
              ...(uploadedAssetId ? { assetId: uploadedAssetId } : {}),
            });
            uploadedUrls.push(uploadedUrl);
          }

          // Remove this index from uploading set
          setUploadingImages((prev) => {
            const next = new Set(prev);
            next.delete(startIndex + i);
            return next;
          });
        }

        const uploadedCount = uploadedUrls.length;
        if (uploadedCount > 0) {
          toast.success(`Added ${uploadedCount} image(s)`);
          onImagesAdded?.(uploadedUrls);
        }
      } catch (error) {
        // On error, remove placeholders and clear uploading state
        for (let i = filesToUpload.length - 1; i >= 0; i--) {
          removeImage(startIndex + i);
        }
        setUploadingImages((prev) => {
          const next = new Set(prev);
          tempSet.forEach((idx) => next.delete(idx));
          return next;
        });
        toast.error(
          error instanceof Error ? error.message : "Failed to upload images",
        );
      }
    },
    [maxImages, uploadFiles, onImagesAdded],
  );

  /**
   * Handle drag over event for drop zone.
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave event for drop zone.
   */
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handle drop event for file upload.
   */
  const handleDrop = useCallback(
    (
      e: React.DragEvent,
      imageFields: ImageField[],
      appendImage: (
        data: { value: string; assetId?: string },
        options?: { shouldFocus?: boolean },
      ) => void,
      updateImage: (
        index: number,
        data: { value: string; assetId?: string },
      ) => void,
      removeImage: (index: number) => void,
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(
          files,
          imageFields,
          appendImage,
          updateImage,
          removeImage,
        );
      }
    },
    [handleFileSelect],
  );

  /**
   * Add an image from URL input.
   */
  const handleAddImage = useCallback(
    (
      imageFields: ImageField[],
      appendImage: (
        data: { value: string },
        options?: { shouldFocus?: boolean },
      ) => void,
    ) => {
      if (newImageUrl) {
        // Check max images limit
        if (imageFields.length >= maxImages) {
          toast.error(`Maximum ${maxImages} images allowed`);
          return;
        }

        // Check if URL already exists
        const exists = imageFields.some((field) => field.value === newImageUrl);
        if (exists) {
          toast.error("This image URL is already added");
          return;
        }

        // Local paths (e.g. /uploads/image.jpg) are valid without URL parsing
        if (newImageUrl.startsWith("/")) {
          appendImage({ value: newImageUrl }, { shouldFocus: false });
          setNewImageUrl("");
          toast.success("Image added");
          onImagesAdded?.([newImageUrl]);
          return;
        }

        // For https URLs, validate format
        if (!newImageUrl.startsWith("https://")) {
          toast.error("Image URL must start with https:// or be a local path");
          return;
        }

        try {
          new URL(newImageUrl);
          appendImage({ value: newImageUrl }, { shouldFocus: false });
          setNewImageUrl("");
          toast.success("Image added");
          onImagesAdded?.([newImageUrl]);
        } catch {
          toast.error("Invalid URL format");
        }
      }
    },
    [newImageUrl, maxImages, onImagesAdded],
  );

  /**
   * Remove an image by index.
   */
  const handleRemoveImage = useCallback(
    (index: number, removeImage: (index: number) => void) => {
      removeImage(index);
      onImageRemoved?.(index);
    },
    [onImageRemoved],
  );

  return {
    uploadingImages,
    isDragging,
    newImageUrl,
    fileInputRef,
    setNewImageUrl,
    handleFileSelect,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleAddImage,
    handleRemoveImage,
  };
}
