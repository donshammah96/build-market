import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeOnboardingOrchestration } from "@/app/lib/domains/shared/onboarding-orchestration";
import type {
  OnboardingIntent,
  ValidatedOnboardingData,
} from "@/app/lib/domains/shared/onboarding-orchestration";

vi.mock("server-only", () => ({}));

const mockCompleteOnboarding = vi.hoisted(() => vi.fn());
const mockSkipClientOnboarding = vi.hoisted(() => vi.fn());
const mockSkipProfessionalOnboarding = vi.hoisted(() => vi.fn());
const mockCreateStore = vi.hoisted(() => vi.fn());
const mockCreateProperty = vi.hoisted(() => vi.fn());
const mockFinalizeClerkOnboardingTransition = vi.hoisted(() => vi.fn());
const mockIdempotencyFail = vi.hoisted(() => vi.fn());
const mockIdempotencyComplete = vi.hoisted(() => vi.fn());

vi.mock("@/app/lib/domains/user-profile", () => ({
  userProfileOnboardingService: {
    completeOnboarding: mockCompleteOnboarding,
    skipClientOnboarding: mockSkipClientOnboarding,
    skipProfessionalOnboarding: mockSkipProfessionalOnboarding,
  },
}));

vi.mock("@/app/lib/domains/stores", () => ({
  storesService: {
    createStore: mockCreateStore,
  },
}));

vi.mock("@/app/lib/domains/properties", () => ({
  propertiesService: {
    createProperty: mockCreateProperty,
  },
}));

vi.mock("@/app/lib/domains/user-profile/clerk-metadata", () => ({
  CLERK_ONBOARDING_FINALIZATION_RETRY_MESSAGE:
    "Unable to finalize account state. Please retry.",
  finalizeClerkOnboardingTransition: mockFinalizeClerkOnboardingTransition,
}));

vi.mock("@/app/lib/services/idempotency.service", () => ({
  IdempotencyService: {
    fail: mockIdempotencyFail,
    complete: mockIdempotencyComplete,
  },
}));

const actor = {
  clerkId: "clerk_123",
  correlationId: "corr_123",
};

const clerkUser = {
  emailAddresses: [{ emailAddress: "test@example.com" }],
  firstName: "Test",
  lastName: "User",
  phoneNumbers: [{ phoneNumber: "+254700000000" }],
};

const idempotencyContext = {
  key: "idem-key",
  scope: "onboarding" as const,
  actorId: "clerk_123",
  method: "POST",
};

const clientSubmitIntent: OnboardingIntent = {
  kind: "submit",
  role: "CLIENT",
  data: {
    role: "client",
    county: "NAIROBI",
    city: "Nairobi",
    type: "HOMEOWNER",
    projectType: "new_construction",
    projectLocation: "Nairobi",
    estimatedBudget: "1000000-5000000",
    description: "Build a family home",
  } as unknown as ValidatedOnboardingData,
};

const professionalSubmitIntentWithStore: OnboardingIntent = {
  kind: "submit",
  role: "PROFESSIONAL",
  data: {
    role: "professional",
    profession: "ARCHITECT",
    companyName: "Build Co",
    county: "NAIROBI",
    stores: [
      {
        name: "Main Store",
        slug: "main-store",
        county: "NAIROBI",
        categories: [],
        images: [],
      },
    ],
  } as unknown as ValidatedOnboardingData,
};

const professionalSubmitIntentWithProperty: OnboardingIntent = {
  kind: "submit",
  role: "PROFESSIONAL",
  data: {
    role: "professional",
    profession: "ARCHITECT",
    companyName: "Build Co",
    county: "NAIROBI",
    properties: [
      {
        title: "Sample Property",
        type: "SALE",
        category: "RESIDENTIAL",
        price: 7500000,
        currency: "KES",
        priceNegotiable: false,
        location: "Nairobi",
        images: ["https://example.com/property.jpg"],
        hasBorehole: false,
        hasBackupGenerator: false,
        hasElevator: false,
        hasCCTV: false,
        isGatedCommunity: false,
      },
    ],
  } as unknown as ValidatedOnboardingData,
};

describe("onboarding orchestration contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCompleteOnboarding.mockResolvedValue({
      ok: true,
      data: {
        userId: "user_123",
        role: "CLIENT",
        isProfileComplete: true,
      },
    });

    mockSkipClientOnboarding.mockResolvedValue({
      ok: true,
      data: {
        userId: "user_123",
        role: "CLIENT",
        isProfileComplete: false,
        skipped: true,
        redirectTo: "/dashboard",
        message: "Onboarding skipped",
      },
    });

    mockSkipProfessionalOnboarding.mockResolvedValue({
      ok: true,
      data: {
        userId: "user_123",
        role: "PROFESSIONAL",
        isProfileComplete: false,
        skipped: true,
        redirectTo: "/professional-portal/dashboard",
        message: "Onboarding skipped",
      },
    });

    mockCreateStore.mockResolvedValue({ ok: true, data: { id: "store_123" } });
    mockCreateProperty.mockResolvedValue({
      ok: true,
      data: { id: "property_123" },
    });

    mockFinalizeClerkOnboardingTransition.mockResolvedValue(undefined);
    mockIdempotencyFail.mockResolvedValue(undefined);
    mockIdempotencyComplete.mockResolvedValue(undefined);
  });

  it("submits client onboarding with no store or property side-effects", async () => {
    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      clientSubmitIntent,
      idempotencyContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      userId: "user_123",
      role: "CLIENT",
      isProfileComplete: true,
      status: "ACTIVE",
      redirectTo: "/dashboard",
    });

    expect(mockCompleteOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({
          clerkId: "clerk_123",
          correlationId: "corr_123",
          role: "CLIENT",
        }),
      }),
    );
    expect(mockCreateStore).not.toHaveBeenCalled();
    expect(mockCreateProperty).not.toHaveBeenCalled();
    expect(mockFinalizeClerkOnboardingTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          role: "CLIENT",
          isOnboarded: true,
          status: "ACTIVE",
        },
      }),
    );
    expect(mockIdempotencyComplete).toHaveBeenCalledWith(
      "idem-key",
      expect.objectContaining({ role: "CLIENT" }),
    );
  });

  it("collects store warnings for professional submit when store creation fails", async () => {
    mockCompleteOnboarding.mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "user_123",
        role: "PROFESSIONAL",
        isProfileComplete: true,
      },
    });

    mockCreateStore.mockResolvedValueOnce({
      ok: false,
      error: "internal",
      message: "Store creation failed",
    });

    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      professionalSubmitIntentWithStore,
      idempotencyContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.warnings).toEqual([
      {
        resourceType: "store",
        resourceName: "Main Store",
        reason: "Store creation failed",
      },
    ]);

    expect(mockCreateStore).toHaveBeenCalledWith(
      { userId: "user_123", role: "PROFESSIONAL" },
      expect.objectContaining({
        name: "Main Store",
        slug: "main-store",
      }),
    );
  });

  it("collects property warnings for professional submit when property creation fails", async () => {
    mockCompleteOnboarding.mockResolvedValueOnce({
      ok: true,
      data: {
        userId: "user_123",
        role: "PROFESSIONAL",
        isProfileComplete: true,
      },
    });

    mockCreateProperty.mockResolvedValueOnce({
      ok: false,
      error: "internal_error",
      message: "Property creation failed",
    });

    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      professionalSubmitIntentWithProperty,
      idempotencyContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.warnings).toEqual([
      {
        resourceType: "property",
        resourceName: "Sample Property",
        reason: "Property creation failed",
      },
    ]);

    expect(mockCreateProperty).toHaveBeenCalledWith(
      { userId: "user_123", role: "PROFESSIONAL" },
      expect.objectContaining({
        title: "Sample Property",
        price: 7500000,
      }),
    );
  });

  it("executes skip-client intent with client clerk metadata finalization", async () => {
    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      { kind: "skip_client" },
      idempotencyContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      userId: "user_123",
      role: "CLIENT",
      isProfileComplete: false,
      status: "ACTIVE",
      redirectTo: "/dashboard",
    });

    expect(mockSkipClientOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ role: "CLIENT" }),
      }),
    );
    expect(mockFinalizeClerkOnboardingTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          role: "CLIENT",
          isOnboarded: true,
          status: "ACTIVE",
        },
      }),
    );
  });

  it("executes skip-professional intent with professional clerk metadata finalization", async () => {
    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      { kind: "skip_professional" },
      idempotencyContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      userId: "user_123",
      role: "PROFESSIONAL",
      isProfileComplete: false,
      status: "PENDING_VERIFICATION",
      redirectTo: "/professional-portal/dashboard",
    });

    expect(mockSkipProfessionalOnboarding).toHaveBeenCalledWith(
      expect.objectContaining({
        actor: expect.objectContaining({ role: "PROFESSIONAL" }),
      }),
    );
    expect(mockFinalizeClerkOnboardingTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          role: "PROFESSIONAL",
          isOnboarded: true,
          status: "PENDING_VERIFICATION",
        },
      }),
    );
  });

  it("marks idempotency failed and returns domain failure", async () => {
    mockCompleteOnboarding.mockResolvedValueOnce({
      ok: false,
      error: "conflict",
      message: "Onboarding already completed",
      status: 409,
    });

    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      clientSubmitIntent,
      idempotencyContext,
    );

    expect(result).toEqual({
      ok: false,
      error: "conflict",
      message: "Onboarding already completed",
      status: 409,
    });
    expect(mockIdempotencyFail).toHaveBeenCalledWith("idem-key");
    expect(mockFinalizeClerkOnboardingTransition).not.toHaveBeenCalled();
  });

  it("returns clerk_sync_failed and keeps mutation retryable when clerk finalization fails", async () => {
    mockFinalizeClerkOnboardingTransition.mockRejectedValueOnce(
      new Error("clerk unavailable"),
    );

    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      clientSubmitIntent,
      idempotencyContext,
    );

    expect(result).toEqual({
      ok: false,
      error: "clerk_sync_failed",
      message: "Unable to finalize account state. Please retry.",
      status: 503,
    });
    expect(mockIdempotencyFail).toHaveBeenCalledWith("idem-key");
    expect(mockIdempotencyComplete).not.toHaveBeenCalled();
  });

  it("returns success when idempotency completion persistence fails", async () => {
    mockIdempotencyComplete.mockRejectedValueOnce(
      new Error("redis unavailable"),
    );

    const result = await executeOnboardingOrchestration(
      actor,
      clerkUser,
      clientSubmitIntent,
      idempotencyContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data).toEqual({
      userId: "user_123",
      role: "CLIENT",
      isProfileComplete: true,
      status: "ACTIVE",
      redirectTo: "/dashboard",
    });
    expect(mockIdempotencyFail).toHaveBeenCalledWith("idem-key");
  });
});
