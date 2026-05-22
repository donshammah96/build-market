// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useProfileStatus } from "@/hooks/useProfileStatus";
import { useVerificationRedirect } from "@/hooks/useVerificationRedirect";

const mockUserProfileClient = vi.hoisted(() => ({
  getProfileStatus: vi.fn(),
  updateProfile: vi.fn(),
}));

const mockProfileClient = vi.hoisted(() => ({
  getOwnProfile: vi.fn(),
}));

const mockUseMyStores = vi.hoisted(() => vi.fn());
const mockUseMyProperties = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("@/lib/facades/user-profile-client", async () => {
  const actual = await vi.importActual("@/lib/facades/user-profile-client");
  return {
    ...actual,
    userProfileClient: mockUserProfileClient,
  };
});

// Canonical colocated path (Phase 5 migration)
vi.mock("@/lib/facades/user-profile/user-profile-client", async () => {
  const actual = await vi.importActual(
    "@/lib/facades/user-profile/user-profile-client",
  );
  return {
    ...actual,
    userProfileClient: mockUserProfileClient,
  };
});

vi.mock("@/lib/facades/profile-client", () => ({
  profileClient: mockProfileClient,
}));

// Canonical colocated path (Phase 5 migration)
vi.mock("@/lib/facades/user-profile/profile-client", () => ({
  profileClient: mockProfileClient,
}));

vi.mock("@/hooks/useStores", () => ({
  useMyStores: mockUseMyStores,
}));

// Also mock the canonical facade path (colocated after Phase 5 migration)
vi.mock("@/lib/facades/stores/useStores", () => ({
  useMyStores: mockUseMyStores,
}));

vi.mock("@/hooks/useProperties", () => ({
  useMyProperties: mockUseMyProperties,
}));

// Also mock the canonical facade path (colocated after Phase 5 migration)
vi.mock("@/lib/facades/properties/useProperties", () => ({
  useMyProperties: mockUseMyProperties,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
}

describe("profile client hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseMyStores.mockReturnValue({ data: [], isLoading: false });
    mockUseMyProperties.mockReturnValue({
      data: { properties: [] },
      isLoading: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks onboarding as needed when the profile status facade returns null", async () => {
    mockUserProfileClient.getProfileStatus.mockResolvedValue({
      success: true,
      data: null,
    });

    const { result } = renderHook(() => useProfileStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.profile).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.needsOnboarding).toBe(true);
  });

  it("submits profile updates and triggers a profile-status refetch", async () => {
    const initialProfileStatus = {
      success: true,
      data: {
        user: {
          id: "user-1",
          clerkId: "clerk-1",
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Doe",
          phone: null,
          avatar: null,
          role: "professional",
          isProfileComplete: false,
          createdAt: "2026-03-10T12:00:00.000Z",
          updatedAt: "2026-03-10T12:00:00.000Z",
        },
        profile: {
          userId: "user-1",
          companyName: "Old Name Ltd",
          profession: "architect",
          licenseNumber: null,
          yearsExperience: 4,
          servicesOffered: [],
          portfolioUrl: null,
          website: null,
          bio: null,
          city: "Nairobi",
          county: "Nairobi",
          country: "Kenya",
          verified: false,
          createdAt: "2026-03-10T12:00:00.000Z",
          updatedAt: "2026-03-10T12:00:00.000Z",
        },
        completion: {
          percentage: 60,
          isComplete: false,
          missingRequired: ["bio"],
          missingRequiredLabels: ["Bio"],
          missingOptional: [],
          filledFields: ["firstName", "lastName", "companyName"],
        },
      },
    };

    const updatedProfileStatus = {
      success: true,
      data: {
        user: {
          id: "user-1",
          clerkId: "clerk-1",
          email: "jane@example.com",
          firstName: "Jane",
          lastName: "Doe",
          phone: null,
          avatar: null,
          role: "professional",
          isProfileComplete: true,
          createdAt: "2026-03-10T12:00:00.000Z",
          updatedAt: "2026-03-10T12:05:00.000Z",
        },
        profile: {
          userId: "user-1",
          companyName: "New Name Ltd",
          profession: "architect",
          licenseNumber: null,
          yearsExperience: 4,
          servicesOffered: [],
          portfolioUrl: null,
          website: null,
          bio: "Studio profile",
          city: "Nairobi",
          county: "Nairobi",
          country: "Kenya",
          verified: false,
          createdAt: "2026-03-10T12:00:00.000Z",
          updatedAt: "2026-03-10T12:05:00.000Z",
        },
        completion: {
          percentage: 100,
          isComplete: true,
          missingRequired: [],
          missingRequiredLabels: [],
          missingOptional: [],
          filledFields: ["firstName", "lastName", "companyName", "bio"],
        },
      },
    };

    mockUserProfileClient.getProfileStatus
      .mockResolvedValueOnce(initialProfileStatus)
      .mockResolvedValue(updatedProfileStatus);

    mockUserProfileClient.updateProfile.mockResolvedValue(updatedProfileStatus);

    const { result } = renderHook(() => useProfileStatus(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.updateProfile({
      companyName: "New Name Ltd",
      bio: "Studio profile",
    });

    await waitFor(() => expect(result.current.isUpdating).toBe(false));

    expect(mockUserProfileClient.updateProfile).toHaveBeenCalledWith({
      companyName: "New Name Ltd",
      bio: "Studio profile",
    });
    await waitFor(() => {
      expect(mockUserProfileClient.getProfileStatus).toHaveBeenCalledTimes(2);
    });
  });

  it("redirects professionals with rejected verification back to the verification tab", async () => {
    mockProfileClient.getOwnProfile.mockResolvedValue({
      success: true,
      data: {
        id: "profile-1",
        userId: "user-1",
        companyName: "Build Right Ltd",
        profession: "CONTRACTOR",
        bio: null,
        city: "Nairobi",
        county: "Nairobi",
        website: null,
        portfolioUrl: null,
        yearsExperience: 5,
        licenseNumber: null,
        verified: false,
        verificationStatus: "REJECTED",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z",
        services: [],
        user: {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          avatar: null,
        },
      },
    });

    renderHook(() => useVerificationRedirect(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/professional-portal/settings/complete-profile?tab=verification&status=rejected",
      );
    });
  });

  it("redirects to property verification when profile verification is clear", async () => {
    mockProfileClient.getOwnProfile.mockResolvedValue({
      success: true,
      data: {
        id: "profile-1",
        userId: "user-1",
        companyName: "Build Right Ltd",
        profession: "CONTRACTOR",
        bio: null,
        city: "Nairobi",
        county: "Nairobi",
        website: null,
        portfolioUrl: null,
        yearsExperience: 5,
        licenseNumber: null,
        verified: true,
        verificationStatus: "APPROVED",
        createdAt: "2026-03-10T12:00:00.000Z",
        updatedAt: "2026-03-10T12:00:00.000Z",
        services: [],
        user: {
          firstName: "Jane",
          lastName: "Doe",
          email: "jane@example.com",
          avatar: null,
        },
      },
    });
    mockUseMyProperties.mockReturnValue({
      data: {
        properties: [
          {
            id: "property-1",
            verificationStatus: "PENDING",
          },
        ],
      },
      isLoading: false,
    });

    renderHook(() => useVerificationRedirect(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/professional-portal/settings/properties?tab=verification&status=pending",
      );
    });
  });
});
