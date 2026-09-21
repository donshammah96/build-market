// @vitest-environment jsdom
import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import AuthCallbackPage from "@/app/auth-callback/page";
import { env } from "@/app/lib/infrastructure/env";
import { ROUTES } from "@/lib/routes";

const mockReplace = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => ({
  get: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => mockSearchParams,
}));

let mockUserState: any = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    id: "user_test_123",
    publicMetadata: {
      role: "CLIENT",
      isOnboarded: false,
    },
  },
};

vi.mock("@clerk/nextjs", () => ({
  useUser: () => mockUserState,
  useClerk: () => ({ signOut: vi.fn() }),
  useAuth: () => ({ getToken: vi.fn() }),
}));

const mockWaitForClerkClaimRefresh = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/auth/clerk-claim-refresh", () => ({
  waitForClerkClaimRefresh: mockWaitForClerkClaimRefresh,
  hasExpectedOnboardingClaims: vi.fn(),
  hasRoutableAuthClaims: vi.fn(),
  CLERK_CLAIM_REFRESH_FAILURE_MESSAGE: "Claim refresh failed",
}));

describe("AuthCallbackPage redirect behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserState = {
      isLoaded: true,
      isSignedIn: true,
      user: {
        id: "user_test_123",
        publicMetadata: {
          role: "CLIENT",
          isOnboarded: false,
        },
      },
    };
  });

  it("should redirect an admin user to the admin app URL even if not onboarded", async () => {
    mockUserState.user.publicMetadata = {
      role: "ADMIN",
      isOnboarded: false,
    };

    mockWaitForClerkClaimRefresh.mockResolvedValue({
      ok: true,
      metadata: { role: "ADMIN", isOnboarded: false },
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(env.adminAppUrl);
    });
  });

  it("should redirect a regular user to onboarding if not onboarded", async () => {
    mockUserState.user.publicMetadata = {
      role: "CLIENT",
      isOnboarded: false,
    };

    mockWaitForClerkClaimRefresh.mockResolvedValue({
      ok: true,
      metadata: { role: "CLIENT", isOnboarded: false },
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(ROUTES.onboarding);
    });
  });

  it("should redirect a homeowner to homeowner dashboard if onboarded", async () => {
    mockUserState.user.publicMetadata = {
      role: "CLIENT",
      isOnboarded: true,
    };

    mockWaitForClerkClaimRefresh.mockResolvedValue({
      ok: true,
      metadata: { role: "CLIENT", isOnboarded: true },
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(ROUTES.userDashboard);
    });
  });
});
