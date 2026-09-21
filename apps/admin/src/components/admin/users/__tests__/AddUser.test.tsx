// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AddUser from "../AddUser";

const mockMutate = vi.fn();
const mockUseMutation = vi.fn(() => ({
  mutate: mockMutate,
  isPending: false,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: () => mockUseMutation(),
}));

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue("mock-token"),
  }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

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

describe("AddUser component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form fields correctly", () => {
    render(<AddUser />);

    expect(screen.getByText("Add User")).toBeInTheDocument();
    expect(screen.getByLabelText("First Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Last Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Email Addresses")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("submits the form when fields are filled and submit button is clicked", async () => {
    render(<AddUser />);

    fireEvent.change(screen.getByLabelText("First Name"), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText("Last Name"), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "johndoe" },
    });
    fireEvent.change(screen.getByLabelText("Email Addresses"), {
      target: { value: "john.doe@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "Password123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: "John",
          lastName: "Doe",
          username: "johndoe",
          emailAddress: ["john.doe@example.com"],
          password: "Password123!",
        }),
      );
    });
  });

  it("shows validation errors when fields are empty", async () => {
    render(<AddUser />);

    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(
        screen.getByText("First name must be at least 2 characters!"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Last name must be at least 2 characters!"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Username must be at least 2 characters!"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Password must be at least 8 characters!"),
      ).toBeInTheDocument();
    });

    expect(mockMutate).not.toHaveBeenCalled();
  });
});
