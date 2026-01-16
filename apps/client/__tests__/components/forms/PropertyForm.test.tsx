// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import PropertyForm from "@/components/forms/PropertyForm";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    loading: vi.fn(() => "loading-toast-id"),
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock the useImageUploader hook
vi.mock("@/hooks/useImageUploader", () => ({
  useImageUploader: () => ({
    uploadingImages: new Set<number>(),
    isDragging: false,
    newImageUrl: "",
    fileInputRef: { current: null },
    setNewImageUrl: vi.fn(),
    handleFileSelect: vi.fn(),
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    handleAddImage: vi.fn(),
    handleRemoveImage: vi.fn(),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} {...props} />
  ),
}));

describe("PropertyForm", () => {
  const mockOnSubmit = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders the form with all sections", () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      // Check for main sections
      expect(screen.getByText("Basic Details")).toBeInTheDocument();
      expect(screen.getByText("Pricing")).toBeInTheDocument();
      expect(screen.getByText("Location")).toBeInTheDocument();
      expect(screen.getByText("Property Specifications")).toBeInTheDocument();
      expect(screen.getByText("Property Images")).toBeInTheDocument();
    });

    it("renders required field labels", () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText("Property Title")).toBeInTheDocument();
      expect(screen.getByText("Price")).toBeInTheDocument();
      expect(screen.getByText("County")).toBeInTheDocument();
    });

    it("renders submit button with correct text for new property", () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      expect(
        screen.getByRole("button", { name: /create property/i })
      ).toBeInTheDocument();
    });

    it("renders submit button with correct text for editing", () => {
      render(<PropertyForm onSubmit={mockOnSubmit} isEditing />);

      expect(
        screen.getByRole("button", { name: /save changes/i })
      ).toBeInTheDocument();
    });

    it("hides submit button when hideSubmitButton is true", () => {
      render(<PropertyForm onSubmit={mockOnSubmit} hideSubmitButton />);

      expect(
        screen.queryByRole("button", { name: /create property/i })
      ).not.toBeInTheDocument();
    });
  });

  describe("Default Values", () => {
    it("populates form with default values", () => {
      const defaultValues = {
        title: "Test Property",
        price: 100000,
        currency: "USD",
        description: "A test property description",
      };

      render(
        <PropertyForm onSubmit={mockOnSubmit} defaultValues={defaultValues} />
      );

      expect(screen.getByDisplayValue("Test Property")).toBeInTheDocument();
      expect(screen.getByDisplayValue("100000")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("A test property description")
      ).toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("shows error when submitting without required fields", async () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole("button", {
        name: /create property/i,
      });
      submitButton.click();

      // Wait for validation errors
      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });

    it("validates title is required", async () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      const submitButton = screen.getByRole("button", {
        name: /create property/i,
      });
      submitButton.click();

      await waitFor(() => {
        expect(mockOnSubmit).not.toHaveBeenCalled();
      });
    });
  });

  describe("Form Submission", () => {
    it("calls onSubmit with form data when valid", async () => {
      const defaultValues = {
        title: "Valid Property",
        price: 50000,
        currency: "KES",
        type: "SALE" as const,
        category: "RESIDENTIAL" as const,
        county: "NAIROBI" as const,
        location: "Westlands",
        images: ["https://example.com/image.jpg"],
      };

      render(
        <PropertyForm onSubmit={mockOnSubmit} defaultValues={defaultValues} />
      );

      const submitButton = screen.getByRole("button", {
        name: /create property/i,
      });
      submitButton.click();

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });

  describe("Attachments", () => {
    it("renders add document button", () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      expect(
        screen.getByRole("button", { name: /add document/i })
      ).toBeInTheDocument();
    });

    it("adds an attachment when clicking add document", async () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      const addButton = screen.getByRole("button", { name: /add document/i });
      addButton.click();

      // Check that a document section is added
      await waitFor(() => {
        expect(screen.getByText("Document 1")).toBeInTheDocument();
      });
    });

    it("limits attachments to maximum of 5", async () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      const addButton = screen.getByRole("button", { name: /add document/i });

      // Add 5 attachments
      for (let i = 0; i < 5; i++) {
        addButton.click();
        // Wait a bit between clicks to allow state updates
        await waitFor(() => {});
      }

      // Button should be disabled or show max message
      await waitFor(() => {
        const button = screen.getByRole("button", {
          name: /maximum 5 documents reached/i,
        });
        expect(button).toBeDisabled();
      });
    });

    it("removes attachment when clicking remove button", async () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      // Add an attachment first
      const addButton = screen.getByRole("button", { name: /add document/i });
      addButton.click();

      await waitFor(() => {
        expect(screen.getByText("Document 1")).toBeInTheDocument();
      });

      // Find and click remove button
      const removeButton = screen.getByRole("button", {
        name: /remove document 1/i,
      });
      removeButton.click();

      await waitFor(() => {
        expect(screen.queryByText("Document 1")).not.toBeInTheDocument();
      });
    });
  });

  describe("Features Input", () => {
    it("renders features input section", () => {
      render(<PropertyForm onSubmit={mockOnSubmit} />);

      expect(screen.getByText("Features & Amenities")).toBeInTheDocument();
    });
  });

  describe("Snapshot", () => {
    it("matches snapshot for default state", () => {
      const { container } = render(<PropertyForm onSubmit={mockOnSubmit} />);
      expect(container).toMatchSnapshot();
    });

    it("matches snapshot for editing state", () => {
      const { container } = render(
        <PropertyForm
          onSubmit={mockOnSubmit}
          isEditing
          defaultValues={{
            title: "Existing Property",
            price: 200000,
            currency: "KES",
          }}
        />
      );
      expect(container).toMatchSnapshot();
    });
  });
});
