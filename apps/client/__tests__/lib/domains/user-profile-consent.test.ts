/**
 * GDPR Article 7(1): Each consent event must be individually documented.
 * When all three consents (email, sms, analytics) arrive in one request,
 * exactly three ConsentRecord rows must be created — one per type.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { completeClientProfile } from "@/app/lib/domains/user-profile/profile-complete";

const mockConsentRecordCreate = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserUpdate = vi.hoisted(() => vi.fn());
const mockClientProfileUpsert = vi.hoisted(() => vi.fn());
const mockSyncUserProfileCompletionStatus = vi.hoisted(() => vi.fn());

vi.mock("@build/db", () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    clientProfile: {
      upsert: (...args: unknown[]) => mockClientProfileUpsert(...args),
    },
    $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        user: {
          update: (...args: unknown[]) => mockUserUpdate(...args),
        },
        clientProfile: {
          upsert: (...args: unknown[]) => mockClientProfileUpsert(...args),
        },
        consentRecord: {
          create: (...args: unknown[]) => mockConsentRecordCreate(...args),
        },
      }),
    ),
  },
}));

vi.mock("@/app/lib/domains/user-profile/completion", () => ({
  syncUserProfileCompletionStatus: (...args: unknown[]) =>
    mockSyncUserProfileCompletionStatus(...args),
}));

describe("completeClientProfile — GDPR consent records", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindUnique.mockResolvedValue({
      role: "CLIENT",
      status: "ACTIVE",
      emailMarketingConsent: false,
      smsMarketingConsent: false,
      clientProfile: { userId: "user_123" },
    });
    mockUserUpdate.mockResolvedValue({
      id: "user_123",
      firstName: "Jane",
      lastName: "Doe",
      phone: "+254700000000",
      avatar: null,
      bio: null,
      role: "CLIENT",
      isProfileComplete: true,
    });
    mockClientProfileUpsert.mockResolvedValue({ userId: "user_123" });
    mockConsentRecordCreate.mockResolvedValue({});
    mockSyncUserProfileCompletionStatus.mockResolvedValue({
      ok: true,
      data: {
        isProfileComplete: true,
        completion: {
          isComplete: true,
          percentage: 100,
          missingRequired: [],
          missingRequiredLabels: [],
          missingOptional: [],
          filledFields: [],
        },
      },
    });
  });

  it("creates exactly three ConsentRecord rows when all three consents are sent in one request", async () => {
    await completeClientProfile(
      { userId: "user_123" },
      {
        firstName: "Jane",
        lastName: "Doe",
        emailMarketingConsent: true,
        smsMarketingConsent: true,
        analyticsConsent: true,
      },
    );

    expect(mockConsentRecordCreate).toHaveBeenCalledTimes(3);

    const createCalls = mockConsentRecordCreate.mock.calls;
    const types = createCalls.map((call) => {
      const arg = call[0] as { data: { type: string } };
      return arg?.data?.type ?? "";
    });
    expect(types).toContain("MARKETING_EMAIL");
    expect(types).toContain("MARKETING_SMS");
    expect(types).toContain("ANALYTICS_COOKIES");
  });
});
