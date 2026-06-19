// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import EditUser from "../EditUser";

// Mock Sheet component parts since they might use context or primitives
vi.mock("@/components/ui/sheet", () => {
  const React = require("react");
  return {
    SheetContent: ({ children }: any) =>
      React.createElement("div", null, children),
    SheetDescription: ({ children }: any) =>
      React.createElement("div", null, children),
    SheetHeader: ({ children }: any) =>
      React.createElement("div", null, children),
    SheetTitle: ({ children }: any) =>
      React.createElement("div", null, children),
  };
});

describe("EditUser component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form fields with default values", () => {
    render(<EditUser />);

    expect(screen.getByText("Edit User")).toBeInTheDocument();
    expect(screen.getByLabelText("Full Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Phone")).toBeInTheDocument();
    expect(screen.getByLabelText("Address")).toBeInTheDocument();
    expect(screen.getByLabelText("City")).toBeInTheDocument();

    // Check defaults
    expect(screen.getByLabelText("Full Name")).toHaveValue("John Doe");
    expect(screen.getByLabelText("Email")).toHaveValue("john.doe@gmail.com");
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 234 5678");
    expect(screen.getByLabelText("Address")).toHaveValue("123 Main St");
    expect(screen.getByLabelText("City")).toHaveValue("New York");
  });

  it("submits the form when fields are valid and submit button is clicked", async () => {
    const mockSubmit = vi.fn();
    render(<EditUser onSubmit={mockSubmit} />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "Jane Smith" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "jane.smith@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Phone"), {
      target: { value: "+1 987 65432" },
    });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "456 Oak Ave" },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: "Boston" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith({
        fullName: "Jane Smith",
        email: "jane.smith@example.com",
        phone: "+1 987 65432",
        address: "456 Oak Ave",
        city: "Boston",
      });
    });
  });

  it("shows validation errors when fields are empty", async () => {
    const mockSubmit = vi.fn();
    render(<EditUser onSubmit={mockSubmit} />);

    fireEvent.change(screen.getByLabelText("Full Name"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("City"), { target: { value: "" } });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(
        screen.getByText("Full name must be at least 2 characters!"),
      ).toBeInTheDocument();
      expect(screen.getByText("Invalid email address!")).toBeInTheDocument();
    });

    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
