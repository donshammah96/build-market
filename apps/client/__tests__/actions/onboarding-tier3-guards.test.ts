import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  skipOnboarding,
  skipProfessionalOnboarding,
} from "@/app/actions/onboarding";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  headers: vi.fn(),
  checkRateLimit: vi.fn(),
  userFindUnique: vi.fn(),
  adminProfileFindUnique: vi.fn(),
  completeOnboarding: vi.fn(),
  skipClientOnboarding: vi.fn(),
  skipProfessionalOnboardingService: vi.fn(),
  createStore: vi.fn(),
  createProperty: vi.fn(),
  updateClerkOnboardingMetadata: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));

vi.mock("next/headers", () => ({
  headers: mocks.headers,
}));

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
    },
    adminProfile: {
      findUnique: mocks.adminProfileFindUnique,
    },
  },
}));

vi.mock("@/app/lib/api/resilient-api", () => ({
  getClientLogger: () => ({
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
    error: mocks.loggerError,
  }),
  getResilientExecutor: () => ({
    execute: vi.fn(),
  }),
}));

vi.mock("@/app/lib/api/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/app/lib/domains/user-profile", () => ({
  userProfileOnboardingService: {
    completeOnboarding: mocks.completeOnboarding,
    skipClientOnboarding: mocks.skipClientOnboarding,
    skipProfessionalOnboarding: mocks.skipProfessionalOnboardingService,
  },
}));

vi.mock("@/app/lib/domains/stores", () => ({
  storesService: {
    createStore: mocks.createStore,
  },
}));

vi.mock("@/app/lib/domains/properties", () => ({
  propertiesService: {
    createProperty: mocks.createProperty,
  },
}));

vi.mock("@/app/lib/domains/user-profile/clerk-metadata", () => ({
  updateClerkOnboardingMetadata: mocks.updateClerkOnboardingMetadata,
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: vi.fn().mockResolvedValue({ status: "new" }),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("onboarding Tier-3 guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({
      userId: "clerk_123",
      sessionClaims: {
        auth_time: Math.floor(Date.now() / 1000),
      },
    });
    mocks.headers.mockResolvedValue(
      new Headers({
        origin: "http://localhost:3500",
        cookie: "__session=test",
      }),
    );
    mocks.checkRateLimit.mockResolvedValue({
      success: true,
      limit: 8,
      remaining: 7,
      reset: Date.now() + 60_000,
    });
  });

  it("blocks verification-role transition when recent-auth is stale", async () => {
    mocks.auth.mockResolvedValueOnce({
      userId: "clerk_123",
      sessionClaims: {
        auth_time: Math.floor(Date.now() / 1000) - 3_600,
      },
    });

    const result = await skipProfessionalOnboarding();

    expect(result).toEqual({
      success: false,
      error: {
        code: "unauthorized",
        message:
          "Recent authentication required. Please sign in again and retry.",
        status: 401,
        details: expect.objectContaining({
          reason: "stale_claim",
          maxAgeSeconds: 300,
        }),
      },
    });
    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.currentUser).not.toHaveBeenCalled();
    expect(mocks.skipProfessionalOnboardingService).not.toHaveBeenCalled();
  });

  it("rate-limits onboarding critical transitions before handler execution", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      success: false,
      limit: 8,
      remaining: 0,
      reset: Date.now() + 45_000,
    });

    const result = await skipOnboarding();

    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "high-value-onboarding-transition:skip-client:clerk_123",
      8,
      15 * 60 * 1000,
    );
    expect(mocks.currentUser).not.toHaveBeenCalled();
    expect(mocks.skipClientOnboarding).not.toHaveBeenCalled();
    expect(mocks.updateClerkOnboardingMetadata).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: {
        code: "limit_exceeded",
        message:
          "Too many onboarding transition attempts. Please try again shortly.",
        status: 429,
        details: expect.objectContaining({
          limit: 8,
          remaining: 0,
        }),
      },
    });
  });
});
