import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  skipOnboarding,
  skipProfessionalOnboarding,
  submitOnboarding,
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
  finalizeClerkOnboardingTransition: vi.fn(),
  idempotencyCheckOrCreate: vi.fn(),
  idempotencyComplete: vi.fn(),
  idempotencyFail: vi.fn(),
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
    execute: vi.fn(async (fn: () => Promise<unknown>) => ({
      success: true,
      data: await fn(),
    })),
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
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE:
    "Unable to finalize account state. Please retry.",
  finalizeClerkOnboardingTransition: mocks.finalizeClerkOnboardingTransition,
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    generateKey: vi.fn().mockReturnValue("idem-key"),
    checkOrCreate: mocks.idempotencyCheckOrCreate,
    complete: mocks.idempotencyComplete,
    fail: mocks.idempotencyFail,
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
    mocks.currentUser.mockResolvedValue({
      id: "clerk_123",
      emailAddresses: [{ emailAddress: "test@example.com" }],
      firstName: "Test",
      lastName: "User",
      phoneNumbers: [{ phoneNumber: "+254700000000" }],
    });
    mocks.idempotencyCheckOrCreate.mockResolvedValue({ status: "new" });
    mocks.idempotencyComplete.mockResolvedValue(undefined);
    mocks.idempotencyFail.mockResolvedValue(undefined);
    mocks.finalizeClerkOnboardingTransition.mockResolvedValue(undefined);
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
    expect(mocks.finalizeClerkOnboardingTransition).not.toHaveBeenCalled();
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

  it("returns 503 and skips idempotency completion when Clerk finalization fails", async () => {
    mocks.completeOnboarding.mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "db_user_123",
        role: "CLIENT",
        isProfileComplete: true,
      },
    });
    mocks.finalizeClerkOnboardingTransition.mockImplementationOnce(
      async (params?: { onFailure?: () => Promise<void> | void }) => {
        await params?.onFailure?.();
        throw new Error("clerk unavailable");
      },
    );

    const result = await submitOnboarding({
      role: "client",
      county: "NAIROBI",
      city: "Nairobi",
      type: "HOMEOWNER",
      projectType: "new_construction",
      projectLocation: "Nairobi",
      estimatedBudget: "1000000-5000000",
      description: "Building a new home",
    } as never);

    expect(result).toEqual({
      success: false,
      error: {
        code: "internal",
        message: "Unable to finalize account state. Please retry.",
        status: 503,
      },
    });
    expect(mocks.idempotencyFail).toHaveBeenCalledWith("idem-key");
    expect(mocks.idempotencyComplete).not.toHaveBeenCalled();
  });

  it("returns success when onboarding completion persistence fails after finalization", async () => {
    mocks.completeOnboarding.mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "db_user_123",
        role: "CLIENT",
        isProfileComplete: true,
      },
    });
    mocks.idempotencyComplete.mockRejectedValueOnce(
      new Error("idempotency persistence failed"),
    );

    const result = await submitOnboarding({
      role: "client",
      county: "NAIROBI",
      city: "Nairobi",
      type: "HOMEOWNER",
      projectType: "new_construction",
      projectLocation: "Nairobi",
      estimatedBudget: "1000000-5000000",
      description: "Building a new home",
    } as never);

    expect(result).toEqual({
      success: true,
      data: {
        userId: "db_user_123",
        role: "CLIENT",
        isProfileComplete: true,
      },
    });
    expect(mocks.finalizeClerkOnboardingTransition).toHaveBeenCalled();
    expect(mocks.idempotencyFail).not.toHaveBeenCalled();
  });
});
