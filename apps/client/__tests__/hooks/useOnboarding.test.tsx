// @vitest-environment jsdom
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "react-toastify";
import { useOnboarding } from "@/app/onboarding/_hooks/useOnboarding";
import { CLERK_CLAIM_REFRESH_FAILURE_MESSAGE } from "@/app/lib/auth/clerk-claim-refresh";
import {
  OnboardingAnalyticsProvider,
  NullAnalytics,
} from "@/lib/analytics/OnboardingAnalyticsContext";
import { ROUTES } from "@/lib/links";

const mockReplace = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockSkipClient = vi.hoisted(() => vi.fn());
const mockSkipProfessional = vi.hoisted(() => vi.fn());
const mockSubmit = vi.hoisted(() => vi.fn());
const mockReload = vi.hoisted(() => vi.fn());
const mockGetToken = vi.hoisted(() => vi.fn());

let mockUserState: {
  user: {
    id: string;
    publicMetadata: Record<string, unknown>;
    reload: typeof mockReload;
  } | null;
  isLoaded: boolean;
};

const mockSearchParams = vi.hoisted(() => ({
  get: vi.fn(() => null),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    refresh: mockRefresh,
  }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => mockUserState,
  useClerk: () => ({ signOut: mockSignOut }),
  useAuth: () => ({ getToken: mockGetToken }),
}));

vi.mock("react-toastify", () => ({
  toast: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/facades/onboarding-client", () => ({
  onboardingClient: {
    skipClient: mockSkipClient,
    skipProfessional: mockSkipProfessional,
    submit: mockSubmit,
  },
}));

describe("useOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserState = {
      user: {
        id: "clerk_123",
        publicMetadata: {},
        reload: mockReload,
      },
      isLoaded: true,
    };
    mockReload.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue("fresh-token");
    mockSkipClient.mockResolvedValue({ success: true });
    mockSkipProfessional.mockResolvedValue({ success: true });
    mockSubmit.mockResolvedValue({ success: true });
  });

  it("redirects already-onboarded professionals to the professional dashboard", async () => {
    mockUserState.user = {
      id: "clerk_123",
      publicMetadata: {
        isOnboarded: true,
        role: "PROFESSIONAL",
      },
      reload: mockReload,
    };

    renderHook(() => useOnboarding(), {
      wrapper: ({ children }) => (
        <OnboardingAnalyticsProvider value={NullAnalytics}>
          {children}
        </OnboardingAnalyticsProvider>
      ),
    });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(ROUTES.professionalDashboard);
    });
  });

  it("submits onboarding data and routes professionals to their dashboard", async () => {
    mockReload.mockImplementation(async () => {
      if (mockUserState.user) {
        mockUserState.user.publicMetadata = {
          isOnboarded: true,
          role: "professional",
        };
      }
    });

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: ({ children }) => (
        <OnboardingAnalyticsProvider value={NullAnalytics}>
          {children}
        </OnboardingAnalyticsProvider>
      ),
    });

    act(() => {
      result.current.handleRoleSelect("professional");
    });

    await act(async () => {
      await result.current.handleSubmit({
        role: "professional",
        profession: "ARCHITECT",
        companyName: "Build Market Studio",
        county: "NAIROBI",
      } as never);
    });

    expect(mockSubmit).toHaveBeenCalledWith({
      role: "professional",
      profession: "ARCHITECT",
      companyName: "Build Market Studio",
      county: "NAIROBI",
    });
    expect(toast.success).toHaveBeenCalledWith(
      "Profile created! Redirecting...",
    );
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(ROUTES.professionalDashboard);
    });
  });

  it("routes through auth-callback when refreshed onboarding claims cannot be confirmed", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: ({ children }) => (
        <OnboardingAnalyticsProvider value={NullAnalytics}>
          {children}
        </OnboardingAnalyticsProvider>
      ),
    });

    act(() => {
      result.current.handleRoleSelect("professional");
    });

    await act(async () => {
      await result.current.handleSubmit({
        role: "professional",
        profession: "ARCHITECT",
        companyName: "Build Market Studio",
        county: "NAIROBI",
      } as never);
    });

    expect(mockGetToken).toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalledWith(ROUTES.professionalDashboard);
    expect(toast.error).toHaveBeenCalledWith(
      CLERK_CLAIM_REFRESH_FAILURE_MESSAGE,
    );
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith(
        "/auth-callback?transition=onboarding&expectedRole=professional",
      );
    });
  });

  it("uses the dedicated client skip call and navigates to the user dashboard", async () => {
    mockReload.mockImplementation(async () => {
      if (mockUserState.user) {
        mockUserState.user.publicMetadata = {
          isOnboarded: true,
          role: "client",
        };
      }
    });

    const { result } = renderHook(() => useOnboarding(), {
      wrapper: ({ children }) => (
        <OnboardingAnalyticsProvider value={NullAnalytics}>
          {children}
        </OnboardingAnalyticsProvider>
      ),
    });

    await act(async () => {
      await result.current.handleSkip("client");
    });

    expect(mockSkipClient).toHaveBeenCalledTimes(1);
    expect(mockSkipProfessional).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith(
      "Welcome! Redirecting to your dashboard...",
    );
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(ROUTES.userDashboard);
    });
  });

  it("signs the user out when onboarding is cancelled", async () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: ({ children }) => (
        <OnboardingAnalyticsProvider value={NullAnalytics}>
          {children}
        </OnboardingAnalyticsProvider>
      ),
    });

    await act(async () => {
      await result.current.handleCancelOnboarding();
    });

    expect(toast.info).toHaveBeenCalledWith(
      "Onboarding cancelled. Signing out...",
    );
    expect(mockSignOut).toHaveBeenCalledWith({ redirectUrl: "/" });
  });

  it("exposes jumpToStep and updates step when called with valid index", () => {
    const { result } = renderHook(() => useOnboarding(), {
      wrapper: ({ children }) => (
        <OnboardingAnalyticsProvider value={NullAnalytics}>
          {children}
        </OnboardingAnalyticsProvider>
      ),
    });

    expect(result.current.step).toBe(1);

    act(() => {
      result.current.handleRoleSelect("professional");
    });
    expect(result.current.step).toBe(2);

    act(() => {
      result.current.jumpToStep(1);
    });
    expect(result.current.step).toBe(1);
  });
});
