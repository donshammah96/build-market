// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useImageUploader } from "@/hooks/useImageUploader";
import type { ImageField } from "@/hooks/useImageUploader";

const { mockToast, mockUploadFiles, mockValidateFiles } = vi.hoisted(() => ({
  mockToast: {
    loading: vi.fn(() => "loading-toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
    warning: vi.fn(),
  },
  mockUploadFiles: vi.fn(),
  mockValidateFiles: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/lib/services/upload", () => ({
  uploadFiles: (...args: unknown[]) => mockUploadFiles(...args),
  validateFiles: (...args: unknown[]) => mockValidateFiles(...args),
  UploadError: class UploadError extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  },
  UploadErrorCode: {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    NETWORK_ERROR: "NETWORK_ERROR",
    SERVER_ERROR: "SERVER_ERROR",
    INVALID_RESPONSE: "INVALID_RESPONSE",
    MAX_RETRIES_EXCEEDED: "MAX_RETRIES_EXCEEDED",
    ABORTED: "ABORTED",
    UNKNOWN: "UNKNOWN",
  },
  FILE_LIMITS: {
    IMAGE_MAX_SIZE: 10 * 1024 * 1024,
    DOCUMENT_MAX_SIZE: 25 * 1024 * 1024,
    MAX_FILES_PER_UPLOAD: 10,
  },
}));

describe("useImageUploader", () => {
  // Mock functions for useFieldArray operations
  const mockAppendImage = vi.fn();
  const mockUpdateImage = vi.fn();
  const mockRemoveImage = vi.fn();

  // Sample image fields
  const emptyImageFields: ImageField[] = [];
  const sampleImageFields: ImageField[] = [
    { id: "1", value: "https://example.com/image1.jpg" },
    { id: "2", value: "https://example.com/image2.jpg" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUploadFiles.mockResolvedValue({
      urls: ["https://example.com/new.jpg"],
    });
    mockValidateFiles.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Initial State", () => {
    it("returns initial state correctly", () => {
      const { result } = renderHook(() => useImageUploader());

      expect(result.current.uploadingImages.size).toBe(0);
      expect(result.current.isDragging).toBe(false);
      expect(result.current.newImageUrl).toBe("");
      expect(result.current.fileInputRef.current).toBe(null);
    });

    it("accepts custom maxImages option", () => {
      const { result } = renderHook(() => useImageUploader({ maxImages: 10 }));

      // The maxImages is used internally, so we test it indirectly
      expect(result.current).toBeDefined();
    });
  });

  describe("setNewImageUrl", () => {
    it("updates newImageUrl state", () => {
      const { result } = renderHook(() => useImageUploader());

      act(() => {
        result.current.setNewImageUrl("https://example.com/test.jpg");
      });

      expect(result.current.newImageUrl).toBe("https://example.com/test.jpg");
    });
  });

  describe("handleDragOver", () => {
    it("sets isDragging to true", () => {
      const { result } = renderHook(() => useImageUploader());

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(mockEvent);
      });

      expect(result.current.isDragging).toBe(true);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe("handleDragLeave", () => {
    it("sets isDragging to false", () => {
      const { result } = renderHook(() => useImageUploader());

      // First set dragging to true
      const dragOverEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(dragOverEvent);
      });

      expect(result.current.isDragging).toBe(true);

      // Then leave
      const dragLeaveEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragLeave(dragLeaveEvent);
      });

      expect(result.current.isDragging).toBe(false);
    });
  });

  describe("handleAddImage", () => {
    it("adds image from valid URL", () => {
      const { result } = renderHook(() => useImageUploader());

      act(() => {
        result.current.setNewImageUrl("https://example.com/image.jpg");
      });

      act(() => {
        result.current.handleAddImage(emptyImageFields, mockAppendImage);
      });

      expect(mockAppendImage).toHaveBeenCalledWith(
        { value: "https://example.com/image.jpg" },
        { shouldFocus: false },
      );
      expect(result.current.newImageUrl).toBe("");
      expect(mockToast.success).toHaveBeenCalledWith("Image added");
    });

    it("rejects invalid URL format", () => {
      const { result } = renderHook(() => useImageUploader());

      act(() => {
        result.current.setNewImageUrl("not-a-valid-url");
      });

      act(() => {
        result.current.handleAddImage(emptyImageFields, mockAppendImage);
      });

      expect(mockAppendImage).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith("Invalid URL format");
    });

    it("rejects non-HTTPS URL", () => {
      const { result } = renderHook(() => useImageUploader());

      act(() => {
        result.current.setNewImageUrl("http://example.com/image.jpg");
      });

      act(() => {
        result.current.handleAddImage(emptyImageFields, mockAppendImage);
      });

      expect(mockAppendImage).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith(
        "Image URL must start with https:// or be a local path",
      );
    });

    it("allows local path URLs", () => {
      const { result } = renderHook(() => useImageUploader());

      act(() => {
        result.current.setNewImageUrl("/uploads/image.jpg");
      });

      act(() => {
        result.current.handleAddImage(emptyImageFields, mockAppendImage);
      });

      expect(mockAppendImage).toHaveBeenCalledWith(
        { value: "/uploads/image.jpg" },
        { shouldFocus: false },
      );
    });

    it("prevents duplicate URLs", () => {
      const { result } = renderHook(() => useImageUploader());

      act(() => {
        result.current.setNewImageUrl("https://example.com/image1.jpg");
      });

      act(() => {
        result.current.handleAddImage(sampleImageFields, mockAppendImage);
      });

      expect(mockAppendImage).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith(
        "This image URL is already added",
      );
    });

    it("prevents adding when max images reached", () => {
      const { result } = renderHook(() => useImageUploader({ maxImages: 2 }));

      act(() => {
        result.current.setNewImageUrl("https://example.com/new.jpg");
      });

      act(() => {
        result.current.handleAddImage(sampleImageFields, mockAppendImage);
      });

      expect(mockAppendImage).not.toHaveBeenCalled();
      expect(mockToast.error).toHaveBeenCalledWith("Maximum 2 images allowed");
    });

    it("does nothing when URL is empty", () => {
      const { result } = renderHook(() => useImageUploader());

      act(() => {
        result.current.handleAddImage(emptyImageFields, mockAppendImage);
      });

      expect(mockAppendImage).not.toHaveBeenCalled();
    });
  });

  describe("handleRemoveImage", () => {
    it("calls removeImage with correct index", () => {
      const onImageRemoved = vi.fn();
      const { result } = renderHook(() => useImageUploader({ onImageRemoved }));

      act(() => {
        result.current.handleRemoveImage(1, mockRemoveImage);
      });

      expect(mockRemoveImage).toHaveBeenCalledWith(1);
      expect(onImageRemoved).toHaveBeenCalledWith(1);
    });
  });

  describe("handleFileSelect", () => {
    it("rejects empty file list", async () => {
      const { result } = renderHook(() => useImageUploader());

      await act(async () => {
        await result.current.handleFileSelect(
          null,
          emptyImageFields,
          mockAppendImage,
          mockUpdateImage,
          mockRemoveImage,
        );
      });

      expect(mockAppendImage).not.toHaveBeenCalled();
    });

    it("rejects non-image files", async () => {
      const { result } = renderHook(() => useImageUploader());

      const nonImageFile = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });
      const fileList = {
        length: 1,
        item: () => nonImageFile,
        [Symbol.iterator]: function* () {
          yield nonImageFile;
        },
      } as unknown as FileList;

      await act(async () => {
        await result.current.handleFileSelect(
          fileList,
          emptyImageFields,
          mockAppendImage,
          mockUpdateImage,
          mockRemoveImage,
        );
      });

      expect(mockToast.error).toHaveBeenCalledWith("Please select image files");
    });

    it("uploads valid image files successfully", async () => {
      const onImagesAdded = vi.fn();
      const { result } = renderHook(() => useImageUploader({ onImagesAdded }));

      const imageFile = new File(["image content"], "test.jpg", {
        type: "image/jpeg",
      });
      const fileList = {
        length: 1,
        item: () => imageFile,
        [Symbol.iterator]: function* () {
          yield imageFile;
        },
      } as unknown as FileList;

      await act(async () => {
        await result.current.handleFileSelect(
          fileList,
          emptyImageFields,
          mockAppendImage,
          mockUpdateImage,
          mockRemoveImage,
        );
      });

      await waitFor(() => {
        expect(mockAppendImage).toHaveBeenCalled();
        expect(mockUpdateImage).toHaveBeenCalledWith(0, {
          value: "https://example.com/new.jpg",
        });
        expect(mockToast.success).toHaveBeenCalledWith("Added 1 image(s)");
      });
    });

    it("prevents upload when max images reached", async () => {
      const { result } = renderHook(() => useImageUploader({ maxImages: 2 }));

      const imageFile = new File(["image content"], "test.jpg", {
        type: "image/jpeg",
      });
      const fileList = {
        length: 1,
        item: () => imageFile,
        [Symbol.iterator]: function* () {
          yield imageFile;
        },
      } as unknown as FileList;

      await act(async () => {
        await result.current.handleFileSelect(
          fileList,
          sampleImageFields, // Already has 2 images
          mockAppendImage,
          mockUpdateImage,
          mockRemoveImage,
        );
      });

      expect(mockToast.error).toHaveBeenCalledWith("Maximum 2 images allowed");
      expect(mockAppendImage).not.toHaveBeenCalled();
    });

    it("handles upload errors gracefully", async () => {
      mockUploadFiles.mockRejectedValue(new Error("Upload failed"));

      const { result } = renderHook(() => useImageUploader());

      const imageFile = new File(["image content"], "test.jpg", {
        type: "image/jpeg",
      });
      const fileList = {
        length: 1,
        item: () => imageFile,
        [Symbol.iterator]: function* () {
          yield imageFile;
        },
      } as unknown as FileList;

      await act(async () => {
        await result.current.handleFileSelect(
          fileList,
          emptyImageFields,
          mockAppendImage,
          mockUpdateImage,
          mockRemoveImage,
        );
      });

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Upload failed");
        expect(mockRemoveImage).toHaveBeenCalled();
      });
    });
  });

  describe("handleDrop", () => {
    it("handles file drop correctly", async () => {
      const { result } = renderHook(() => useImageUploader());

      const imageFile = new File(["image content"], "dropped.jpg", {
        type: "image/jpeg",
      });

      const mockEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: {
          files: {
            length: 1,
            item: () => imageFile,
            [Symbol.iterator]: function* () {
              yield imageFile;
            },
          } as unknown as FileList,
        },
      } as unknown as React.DragEvent;

      // First trigger drag over to set isDragging
      const dragOverEvent = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
      } as unknown as React.DragEvent;

      act(() => {
        result.current.handleDragOver(dragOverEvent);
      });

      expect(result.current.isDragging).toBe(true);

      // Then drop
      await act(async () => {
        result.current.handleDrop(
          mockEvent,
          emptyImageFields,
          mockAppendImage,
          mockUpdateImage,
          mockRemoveImage,
        );
      });

      expect(result.current.isDragging).toBe(false);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
    });
  });

  describe("Callbacks", () => {
    it("calls onImagesAdded callback after successful upload", async () => {
      const onImagesAdded = vi.fn();
      const { result } = renderHook(() => useImageUploader({ onImagesAdded }));

      const imageFile = new File(["image content"], "test.jpg", {
        type: "image/jpeg",
      });
      const fileList = {
        length: 1,
        item: () => imageFile,
        [Symbol.iterator]: function* () {
          yield imageFile;
        },
      } as unknown as FileList;

      await act(async () => {
        await result.current.handleFileSelect(
          fileList,
          emptyImageFields,
          mockAppendImage,
          mockUpdateImage,
          mockRemoveImage,
        );
      });

      await waitFor(() => {
        expect(onImagesAdded).toHaveBeenCalledWith([
          "https://example.com/new.jpg",
        ]);
      });
    });

    it("calls onImageRemoved callback when removing image", () => {
      const onImageRemoved = vi.fn();
      const { result } = renderHook(() => useImageUploader({ onImageRemoved }));

      act(() => {
        result.current.handleRemoveImage(0, mockRemoveImage);
      });

      expect(onImageRemoved).toHaveBeenCalledWith(0);
    });
  });
});
