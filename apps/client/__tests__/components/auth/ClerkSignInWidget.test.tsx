// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import ClerkSignInWidget from "@/components/auth/ClerkSignInWidget";

const mockSearchParams = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

const mockSignInCreate = vi.hoisted(() => vi.fn());
const mockSetActive = vi.hoisted(() => vi.fn());

let mockUserState: any = {
  isLoaded: true,
  isSignedIn: false,
};

let mockClerkState: any = {
  loaded: true,
  client: {
    signIn: {
      create: mockSignInCreate,
    },
  },
  setActive: mockSetActive,
};

vi.mock("@clerk/nextjs", () => ({
  useUser: () => mockUserState,
  useClerk: () => mockClerkState,
  SignIn: () => (
    <div data-testid="clerk-sign-in-component">SignIn Component</div>
  ),
}));

describe("ClerkSignInWidget Ticket Auto-Consumption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserState = {
      isLoaded: true,
      isSignedIn: false,
    };
    mockClerkState = {
      loaded: true,
      client: {
        signIn: {
          create: mockSignInCreate,
        },
      },
      setActive: mockSetActive,
    };
    // Mock window.location
    delete (window as any).location;
    window.location = { href: "" } as any;
  });

  it("successfully completes ticket authentication and activates session without premature effect cancellation", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "__clerk_ticket") return "valid_clerk_ticket_xyz";
      if (key === "redirect_url") return "/onboarding";
      return null;
    });

    mockSignInCreate.mockImplementation(async () => {
      // Simulate asynchronous network delay to Clerk API
      await new Promise((resolve) => setTimeout(resolve, 10));
      return {
        status: "complete",
        createdSessionId: "sess_456",
      };
    });

    render(<ClerkSignInWidget />);

    await waitFor(() => {
      expect(mockSignInCreate).toHaveBeenCalledWith({
        strategy: "ticket",
        ticket: "valid_clerk_ticket_xyz",
      });
    });

    await waitFor(
      () => {
        expect(mockSetActive).toHaveBeenCalledWith({
          session: "sess_456",
        });
        expect(window.location.href).toBe("/onboarding");
      },
      { timeout: 1000 },
    );
  });

  it("defaults redirect to ROUTES.authCallback when no redirect_url is specified", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "__clerk_ticket") return "valid_clerk_ticket_abc";
      return null;
    });

    mockSignInCreate.mockResolvedValueOnce({
      status: "complete",
      createdSessionId: "sess_789",
    });

    render(<ClerkSignInWidget />);

    await waitFor(() => {
      expect(mockSetActive).toHaveBeenCalledWith({
        session: "sess_789",
      });
      expect(window.location.href).toBe("/auth-callback");
    });
  });

  it("handles ticket failure gracefully and presents standard sign-in", async () => {
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === "__clerk_ticket") return "invalid_ticket";
      return null;
    });

    mockSignInCreate.mockRejectedValueOnce(new Error("Ticket has expired"));

    const { findByTestId } = render(<ClerkSignInWidget />);

    const signIn = await findByTestId("clerk-sign-in-component");
    expect(signIn).toBeInTheDocument();
    expect(mockSetActive).not.toHaveBeenCalled();
  });

  it("renders standard SignIn component when no ticket is provided", async () => {
    mockSearchParams.get.mockReturnValue(null);

    const { findByTestId } = render(<ClerkSignInWidget />);

    const signIn = await findByTestId("clerk-sign-in-component");
    expect(signIn).toBeInTheDocument();
    expect(mockSignInCreate).not.toHaveBeenCalled();
  });
});
